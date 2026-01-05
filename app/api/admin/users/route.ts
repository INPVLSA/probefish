import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongodb";
import { User } from "@/lib/db/models";
import { requireSuperAdmin, authError } from "@/lib/auth/authorization";

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// GET /api/admin/users - List all users (super admin only)
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireSuperAdmin(request);

    if (!authResult.authorized) {
      return authError(authResult);
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const search = searchParams.get("search");

    const query: Record<string, unknown> = {};
    if (search) {
      const escapedSearch = escapeRegex(search);
      query.$or = [
        { email: { $regex: escapedSearch, $options: "i" } },
        { name: { $regex: escapedSearch, $options: "i" } },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .select("-passwordHash")
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ createdAt: -1 }),
      User.countDocuments(query),
    ]);

    return NextResponse.json({
      users: users.map((u) => ({
        id: u._id.toString(),
        email: u.email,
        name: u.name,
        avatar: u.avatar,
        isSuperAdmin: u.isSuperAdmin || false,
        isBlocked: u.isBlocked || false,
        blockedAt: u.blockedAt,
        blockedReason: u.blockedReason,
        organizationCount: u.organizationIds.length,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("List users error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
