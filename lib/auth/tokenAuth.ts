import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongodb";
import { AccessToken, IAccessToken, TokenScope } from "@/lib/db/models/accessToken";

export interface TokenAuthResult {
  success: boolean;
  token?: IAccessToken;
  userId?: string;
  organizationId?: string;
  error?: string;
}

/**
 * Authenticate a request using a Bearer token
 * Returns the token details if valid, or an error
 */
export async function authenticateToken(request: NextRequest): Promise<TokenAuthResult> {
  const authHeader = request.headers.get("authorization");

  if (!authHeader) {
    return { success: false, error: "No authorization header" };
  }

  if (!authHeader.startsWith("Bearer ")) {
    return { success: false, error: "Invalid authorization format. Use: Bearer <token>" };
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix

  if (!token.startsWith("pf_")) {
    return { success: false, error: "Invalid token format" };
  }

  try {
    await connectDB();

    const accessToken = await AccessToken.findByToken(token);

    if (!accessToken) {
      return { success: false, error: "Invalid or expired token" };
    }

    // Update last used timestamp (fire and forget)
    accessToken.updateLastUsed().catch(console.error);

    return {
      success: true,
      token: accessToken,
      userId: accessToken.userId.toString(),
      organizationId: accessToken.organizationId.toString(),
    };
  } catch (error) {
    console.error("Token authentication error:", error);
    return { success: false, error: "Authentication failed" };
  }
}

/**
 * Check if a token has the required scope
 */
export function hasScope(token: IAccessToken, scope: TokenScope): boolean {
  return token.scopes.includes(scope);
}

/**
 * Check if a token has any of the required scopes
 */
export function hasAnyScope(token: IAccessToken, scopes: TokenScope[]): boolean {
  return scopes.some((scope) => token.scopes.includes(scope));
}

/**
 * Check if a token has all of the required scopes
 */
export function hasAllScopes(token: IAccessToken, scopes: TokenScope[]): boolean {
  return scopes.every((scope) => token.scopes.includes(scope));
}

/**
 * Middleware helper to require specific scopes
 * Returns an error response if the token doesn't have the required scopes
 */
export function requireScopes(token: IAccessToken, scopes: TokenScope[]): { error: string } | null {
  const missingScopes = scopes.filter((scope) => !token.scopes.includes(scope));

  if (missingScopes.length > 0) {
    return {
      error: `Missing required scopes: ${missingScopes.join(", ")}`,
    };
  }

  return null;
}
