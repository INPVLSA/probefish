import { NextRequest, NextResponse } from "next/server";
import { getSession, getSessionFromRequest, SessionPayload } from "./session";
import { authenticateToken } from "./tokenAuth";
import { connectDB } from "@/lib/db/mongodb";
import User, { IUser } from "@/lib/db/models/user";
import Organization, {
  IOrganization,
  IMember,
} from "@/lib/db/models/organization";
import Project from "@/lib/db/models/project";
import { Permission, roleHasPermission, MemberRole } from "./permissions";
import {
  ProjectPermission,
  getProjectAccess,
  projectRoleHasPermission,
  ProjectAccessResult,
} from "./projectPermissions";
import { ProjectRole } from "@/lib/db/models/project";
import { IAccessToken, TokenScope } from "@/lib/db/models/accessToken";

export interface AuthorizationContext {
  session?: SessionPayload;
  authType: "session" | "token";
  token?: IAccessToken;
  user: {
    id: string;
    email: string;
    name: string;
    isSuperAdmin: boolean;
  };
  organization?: {
    id: string;
    name: string;
    role: MemberRole | "super_admin";
    member?: IMember;
  };
  project?: {
    id: string;
    name: string;
    effectiveRole: ProjectRole | "full";
    accessSource: ProjectAccessResult["source"];
  };
}

export interface AuthorizationResult {
  authorized: boolean;
  context?: AuthorizationContext;
  error?: {
    message: string;
    status: number;
  };
}

/**
 * Check if user is authenticated (via session or token)
 * @param request - The request object (required for token auth)
 * @param requiredScopes - Token scopes required for this operation (only checked for token auth)
 */
export async function requireAuth(
  request?: NextRequest,
  requiredScopes?: TokenScope[]
): Promise<AuthorizationResult> {
  // First, try token auth if Authorization header is present
  if (request) {
    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const tokenResult = await authenticateToken(request);

      if (!tokenResult.success || !tokenResult.token) {
        return {
          authorized: false,
          error: { message: tokenResult.error || "Invalid token", status: 401 },
        };
      }

      // Check required scopes for token auth
      if (requiredScopes && requiredScopes.length > 0) {
        const missingScopes = requiredScopes.filter(
          (scope) => !tokenResult.token!.scopes.includes(scope)
        );
        if (missingScopes.length > 0) {
          return {
            authorized: false,
            error: {
              message: `Missing required scopes: ${missingScopes.join(", ")}`,
              status: 403,
            },
          };
        }
      }

      await connectDB();
      const user = await User.findById(tokenResult.userId);

      if (!user) {
        return {
          authorized: false,
          error: { message: "User not found", status: 401 },
        };
      }

      return {
        authorized: true,
        context: {
          authType: "token",
          token: tokenResult.token,
          user: {
            id: user._id.toString(),
            email: user.email,
            name: user.name,
            isSuperAdmin: user.isSuperAdmin || false,
          },
        },
      };
    }
  }

  // Fall back to session auth
  const session = request
    ? await getSessionFromRequest(request)
    : await getSession();

  if (!session) {
    return {
      authorized: false,
      error: { message: "Authentication required", status: 401 },
    };
  }

  await connectDB();
  const user = await User.findById(session.userId);

  if (!user) {
    return {
      authorized: false,
      error: { message: "User not found", status: 401 },
    };
  }

  return {
    authorized: true,
    context: {
      authType: "session",
      session,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        isSuperAdmin: user.isSuperAdmin || false,
      },
    },
  };
}

/**
 * Check if user has permission within an organization
 */
export async function requireOrgPermission(
  organizationId: string,
  permission: Permission,
  request?: NextRequest
): Promise<AuthorizationResult> {
  const authResult = await requireAuth(request);

  if (!authResult.authorized || !authResult.context) {
    return authResult;
  }

  const { context } = authResult;

  await connectDB();
  const org = await Organization.findById(organizationId);

  if (!org) {
    return {
      authorized: false,
      error: { message: "Organization not found", status: 404 },
    };
  }

  // Super admins have all permissions
  if (context.user.isSuperAdmin) {
    return {
      authorized: true,
      context: {
        ...context,
        organization: {
          id: organizationId,
          name: org.name,
          role: "super_admin",
        },
      },
    };
  }

  // Find user's membership in the organization
  const member = org.members.find(
    (m) => m.userId.toString() === context.user.id
  );

  if (!member) {
    return {
      authorized: false,
      error: { message: "Not a member of this organization", status: 403 },
    };
  }

  // Check if role has required permission
  if (!roleHasPermission(member.role, permission)) {
    return {
      authorized: false,
      error: {
        message: `Permission denied. Required: ${permission}`,
        status: 403,
      },
    };
  }

  return {
    authorized: true,
    context: {
      ...context,
      organization: {
        id: organizationId,
        name: org.name,
        role: member.role,
        member,
      },
    },
  };
}

/**
 * Check super admin status
 */
export async function requireSuperAdmin(
  request?: NextRequest
): Promise<AuthorizationResult> {
  const authResult = await requireAuth(request);

  if (!authResult.authorized || !authResult.context) {
    return authResult;
  }

  if (!authResult.context.user.isSuperAdmin) {
    return {
      authorized: false,
      error: { message: "Super admin access required", status: 403 },
    };
  }

  return authResult;
}

/**
 * Helper to create error response from authorization result
 */
export function authError(result: AuthorizationResult): NextResponse {
  return NextResponse.json(
    { error: result.error?.message || "Unauthorized" },
    { status: result.error?.status || 403 }
  );
}

/**
 * Get user's role in an organization (without permission check)
 */
export async function getUserOrgRole(
  userId: string,
  organizationId: string
): Promise<MemberRole | null> {
  await connectDB();
  const org = await Organization.findById(organizationId);

  if (!org) return null;

  const member = org.members.find((m) => m.userId.toString() === userId);
  return member?.role || null;
}

/**
 * Check if user is member of organization (without permission check)
 */
export async function isOrgMember(
  userId: string,
  organizationId: string
): Promise<boolean> {
  const role = await getUserOrgRole(userId, organizationId);
  return role !== null;
}

/**
 * Check if user has permission on a project
 * @param projectId - The project ID
 * @param permission - The required project permission
 * @param request - The request object
 * @param requiredScopes - Token scopes required (only checked for token auth)
 */
export async function requireProjectPermission(
  projectId: string,
  permission: ProjectPermission,
  request?: NextRequest,
  requiredScopes?: TokenScope[]
): Promise<AuthorizationResult> {
  const authResult = await requireAuth(request, requiredScopes);

  if (!authResult.authorized || !authResult.context) {
    return authResult;
  }

  const { context } = authResult;

  await connectDB();
  const project = await Project.findById(projectId);

  if (!project) {
    return {
      authorized: false,
      error: { message: "Project not found", status: 404 },
    };
  }

  // Get project access
  const access = await getProjectAccess(
    context.user.id,
    projectId,
    context.user.isSuperAdmin
  );

  if (!access.hasAccess || !access.effectiveRole) {
    return {
      authorized: false,
      error: { message: "Access denied to this project", status: 403 },
    };
  }

  // Check permission
  const hasPermission =
    access.effectiveRole === "full" ||
    projectRoleHasPermission(access.effectiveRole as ProjectRole, permission);

  if (!hasPermission) {
    return {
      authorized: false,
      error: {
        message: `Permission denied. Required: ${permission}`,
        status: 403,
      },
    };
  }

  // Get org info for context
  const org = await Organization.findById(project.organizationId);
  const orgMember = org?.members.find(
    (m) => m.userId.toString() === context.user.id
  );

  return {
    authorized: true,
    context: {
      ...context,
      organization: org
        ? {
            id: project.organizationId.toString(),
            name: org.name,
            role: context.user.isSuperAdmin
              ? "super_admin"
              : orgMember?.role || "viewer",
            member: orgMember,
          }
        : undefined,
      project: {
        id: projectId,
        name: project.name,
        effectiveRole: access.effectiveRole,
        accessSource: access.source,
      },
    },
  };
}
