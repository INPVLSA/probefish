import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongodb";
import { AccessToken, ALL_SCOPES, TokenScope } from "@/lib/db/models/accessToken";
import User from "@/lib/db/models/user";

// GET /api/user/tokens - List user's access tokens
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const user = await User.findById(session.userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const tokens = await AccessToken.find({
      userId: session.userId,
      revokedAt: null,
    })
      .select("name tokenPrefix scopes expiresAt lastUsedAt createdAt")
      .sort({ createdAt: -1 });

    return NextResponse.json({
      tokens: tokens.map((t) => ({
        id: t._id.toString(),
        name: t.name,
        tokenPrefix: t.tokenPrefix,
        scopes: t.scopes,
        expiresAt: t.expiresAt,
        lastUsedAt: t.lastUsedAt,
        createdAt: t.createdAt,
        isExpired: t.expiresAt ? t.expiresAt < new Date() : false,
      })),
    });
  } catch (error) {
    console.error("Error fetching tokens:", error);
    return NextResponse.json({ error: "Failed to fetch tokens" }, { status: 500 });
  }
}

// POST /api/user/tokens - Create a new access token
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const user = await User.findById(session.userId);
    if (!user || user.organizationIds.length === 0) {
      return NextResponse.json({ error: "User or organization not found" }, { status: 404 });
    }

    const body = await request.json();
    const { name, scopes, expiresIn } = body;

    // Validate name
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Token name is required" }, { status: 400 });
    }

    if (name.length > 100) {
      return NextResponse.json({ error: "Token name must be 100 characters or less" }, { status: 400 });
    }

    // Validate scopes
    if (!scopes || !Array.isArray(scopes) || scopes.length === 0) {
      return NextResponse.json({ error: "At least one scope is required" }, { status: 400 });
    }

    const invalidScopes = scopes.filter((s: string) => !ALL_SCOPES.includes(s as TokenScope));
    if (invalidScopes.length > 0) {
      return NextResponse.json({ error: `Invalid scopes: ${invalidScopes.join(", ")}` }, { status: 400 });
    }

    // Calculate expiration
    let expiresAt: Date | null = null;
    if (expiresIn) {
      const now = new Date();
      switch (expiresIn) {
        case "7d":
          expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          break;
        case "30d":
          expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
          break;
        case "90d":
          expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
          break;
        case "1y":
          expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
          break;
        case "never":
          expiresAt = null;
          break;
        default:
          return NextResponse.json({ error: "Invalid expiration period" }, { status: 400 });
      }
    }

    // Generate token
    const { token, hash, prefix } = AccessToken.generateToken();

    // Create token record
    const accessToken = await AccessToken.create({
      name: name.trim(),
      tokenHash: hash,
      tokenPrefix: prefix,
      userId: session.userId,
      organizationId: user.organizationIds[0],
      scopes,
      expiresAt,
    });

    // Return the token only once - it cannot be retrieved again
    return NextResponse.json({
      token, // This is the only time the full token is returned
      id: accessToken._id.toString(),
      name: accessToken.name,
      tokenPrefix: prefix,
      scopes: accessToken.scopes,
      expiresAt: accessToken.expiresAt,
      createdAt: accessToken.createdAt,
    });
  } catch (error) {
    console.error("Error creating token:", error);
    return NextResponse.json({ error: "Failed to create token" }, { status: 500 });
  }
}
