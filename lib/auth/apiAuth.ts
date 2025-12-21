import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { authenticateToken, requireScopes } from "@/lib/auth/tokenAuth";
import { IAccessToken, TokenScope } from "@/lib/db/models/accessToken";

export interface ApiAuthResult {
  authenticated: boolean;
  userId?: string;
  organizationId?: string;
  authType: "session" | "token" | "none";
  token?: IAccessToken;
  error?: string;
}

/**
 * Authenticate an API request via session cookie OR Bearer token
 * Prefers token auth if Authorization header is present
 */
export async function authenticateApiRequest(request: NextRequest): Promise<ApiAuthResult> {
  const authHeader = request.headers.get("authorization");

  // If Authorization header is present, use token auth
  if (authHeader) {
    const tokenResult = await authenticateToken(request);

    if (!tokenResult.success) {
      return {
        authenticated: false,
        authType: "none",
        error: tokenResult.error,
      };
    }

    return {
      authenticated: true,
      userId: tokenResult.userId,
      organizationId: tokenResult.organizationId,
      authType: "token",
      token: tokenResult.token,
    };
  }

  // Fall back to session auth
  const session = await getSession();

  if (!session) {
    return {
      authenticated: false,
      authType: "none",
      error: "Unauthorized",
    };
  }

  return {
    authenticated: true,
    userId: session.userId,
    authType: "session",
  };
}

/**
 * Helper to check scopes when using token auth
 * Returns null if authorized, or a NextResponse error if not
 */
export function checkTokenScopes(
  auth: ApiAuthResult,
  requiredScopes: TokenScope[]
): NextResponse | null {
  // Session auth has full access
  if (auth.authType === "session") {
    return null;
  }

  // Token auth requires specific scopes
  if (auth.authType === "token" && auth.token) {
    const scopeError = requireScopes(auth.token, requiredScopes);
    if (scopeError) {
      return NextResponse.json(
        { error: scopeError.error },
        { status: 403 }
      );
    }
  }

  return null;
}

/**
 * Combined auth check - authenticates and checks scopes in one call
 * Returns error response if not authorized, or auth result if authorized
 */
export async function requireApiAuth(
  request: NextRequest,
  requiredScopes?: TokenScope[]
): Promise<{ auth: ApiAuthResult } | { error: NextResponse }> {
  const auth = await authenticateApiRequest(request);

  if (!auth.authenticated) {
    return {
      error: NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 }),
    };
  }

  if (requiredScopes && requiredScopes.length > 0) {
    const scopeError = checkTokenScopes(auth, requiredScopes);
    if (scopeError) {
      return { error: scopeError };
    }
  }

  return { auth };
}
