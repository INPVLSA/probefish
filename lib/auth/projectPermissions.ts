import mongoose from "mongoose";
import { connectDB } from "@/lib/db/mongodb";
import Project, {
  IProject,
  ProjectRole,
  IProjectMember,
} from "@/lib/db/models/project";
import Organization from "@/lib/db/models/organization";
import { MemberRole } from "./permissions";

// Project permission types
export const PROJECT_PERMISSIONS = {
  VIEW: "project:view",
  EDIT: "project:edit",
  MANAGE: "project:manage",
  MANAGE_MEMBERS: "project:manage_members",
} as const;

export type ProjectPermission =
  (typeof PROJECT_PERMISSIONS)[keyof typeof PROJECT_PERMISSIONS];

// Project role to permissions mapping
export const PROJECT_ROLE_PERMISSIONS: Record<ProjectRole, ProjectPermission[]> =
  {
    viewer: [PROJECT_PERMISSIONS.VIEW],
    editor: [PROJECT_PERMISSIONS.VIEW, PROJECT_PERMISSIONS.EDIT],
    admin: [
      PROJECT_PERMISSIONS.VIEW,
      PROJECT_PERMISSIONS.EDIT,
      PROJECT_PERMISSIONS.MANAGE,
      PROJECT_PERMISSIONS.MANAGE_MEMBERS,
    ],
  };

// Org role to default project role mapping (for public projects)
export const ORG_ROLE_TO_PROJECT_ROLE: Record<MemberRole, ProjectRole | "full"> = {
  owner: "full", // Full access to all projects
  admin: "full", // Full access to all projects
  member: "editor", // Public projects as editor
  viewer: "viewer", // Public projects as viewer
};

/**
 * Check if a project role has a specific permission
 */
export function projectRoleHasPermission(
  role: ProjectRole,
  permission: ProjectPermission
): boolean {
  const permissions = PROJECT_ROLE_PERMISSIONS[role];
  return permissions ? permissions.includes(permission) : false;
}

/**
 * Get effective project role for a user
 */
export interface ProjectAccessResult {
  hasAccess: boolean;
  effectiveRole: ProjectRole | "full" | null;
  source: "super_admin" | "org_role" | "project_member" | "parent_inheritance" | "denied";
}

export async function getProjectAccess(
  userId: string,
  projectId: string,
  isSuperAdmin: boolean = false
): Promise<ProjectAccessResult> {
  await connectDB();

  // 1. Super admin has full access
  if (isSuperAdmin) {
    return { hasAccess: true, effectiveRole: "full", source: "super_admin" };
  }

  const project = await Project.findById(projectId);
  if (!project) {
    return { hasAccess: false, effectiveRole: null, source: "denied" };
  }

  // 2. Check org membership
  const org = await Organization.findById(project.organizationId);
  if (!org) {
    return { hasAccess: false, effectiveRole: null, source: "denied" };
  }

  const orgMember = org.members.find(
    (m) => m.userId.toString() === userId
  );

  if (!orgMember) {
    return { hasAccess: false, effectiveRole: null, source: "denied" };
  }

  // 3. Org owner/admin has full access to all projects
  if (orgMember.role === "owner" || orgMember.role === "admin") {
    return { hasAccess: true, effectiveRole: "full", source: "org_role" };
  }

  // 4. Check direct project membership
  const projectMember = project.members.find(
    (m) => m.userId.toString() === userId
  );

  if (projectMember) {
    return {
      hasAccess: true,
      effectiveRole: projectMember.role,
      source: "project_member",
    };
  }

  // 5. Check parent folder inheritance (if enabled)
  if (project.inheritFromParent && project.parentId) {
    const parentAccess = await getParentAccess(userId, project.parentId.toString());
    if (parentAccess.hasAccess && parentAccess.effectiveRole) {
      return {
        hasAccess: true,
        effectiveRole: parentAccess.effectiveRole,
        source: "parent_inheritance",
      };
    }
  }

  // 6. For public projects, use org role mapping
  if (project.visibility === "public") {
    const defaultRole = ORG_ROLE_TO_PROJECT_ROLE[orgMember.role];
    if (defaultRole) {
      return {
        hasAccess: true,
        effectiveRole: defaultRole,
        source: "org_role",
      };
    }
  }

  // 7. Private project without explicit access
  return { hasAccess: false, effectiveRole: null, source: "denied" };
}

/**
 * Recursively check parent folder access
 */
async function getParentAccess(
  userId: string,
  parentId: string
): Promise<ProjectAccessResult> {
  const parent = await Project.findById(parentId);
  if (!parent) {
    return { hasAccess: false, effectiveRole: null, source: "denied" };
  }

  // Check direct membership on parent
  const parentMember = parent.members.find(
    (m) => m.userId.toString() === userId
  );

  if (parentMember) {
    return {
      hasAccess: true,
      effectiveRole: parentMember.role,
      source: "parent_inheritance",
    };
  }

  // Recurse to grandparent if inheritance is enabled
  if (parent.inheritFromParent && parent.parentId) {
    return getParentAccess(userId, parent.parentId.toString());
  }

  return { hasAccess: false, effectiveRole: null, source: "denied" };
}

/**
 * Check if user has specific permission on a project
 */
export async function hasProjectPermission(
  userId: string,
  projectId: string,
  permission: ProjectPermission,
  isSuperAdmin: boolean = false
): Promise<boolean> {
  const access = await getProjectAccess(userId, projectId, isSuperAdmin);

  if (!access.hasAccess) {
    return false;
  }

  // Full access (super admin or org owner/admin)
  if (access.effectiveRole === "full") {
    return true;
  }

  return projectRoleHasPermission(access.effectiveRole as ProjectRole, permission);
}

/**
 * Get all projects user has access to within an organization
 */
export async function getAccessibleProjects(
  userId: string,
  organizationId: string,
  isSuperAdmin: boolean = false
): Promise<IProject[]> {
  await connectDB();

  // Super admin sees all projects
  if (isSuperAdmin) {
    return Project.find({ organizationId }).sort({ createdAt: -1 });
  }

  const org = await Organization.findById(organizationId);
  if (!org) {
    return [];
  }

  const orgMember = org.members.find((m) => m.userId.toString() === userId);
  if (!orgMember) {
    return [];
  }

  // Org owner/admin sees all projects
  if (orgMember.role === "owner" || orgMember.role === "admin") {
    return Project.find({ organizationId }).sort({ createdAt: -1 });
  }

  // For members/viewers, get public projects + projects they're members of
  const userObjectId = new mongoose.Types.ObjectId(userId);

  const projects = await Project.find({
    organizationId,
    $or: [
      { visibility: "public" },
      { "members.userId": userObjectId },
    ],
  }).sort({ createdAt: -1 });

  return projects;
}

/**
 * Check if user can manage another user's project membership
 */
export function canManageProjectRole(
  managerRole: ProjectRole | "full",
  targetRole: ProjectRole
): boolean {
  if (managerRole === "full") {
    return true;
  }

  const hierarchy: Record<ProjectRole, number> = {
    admin: 3,
    editor: 2,
    viewer: 1,
  };

  const managerLevel = hierarchy[managerRole as ProjectRole] || 0;
  const targetLevel = hierarchy[targetRole] || 0;

  // Admins can manage editors and viewers
  return managerLevel > targetLevel;
}
