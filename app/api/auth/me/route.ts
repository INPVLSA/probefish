import { NextResponse } from "next/server";
import connectDB from "@/lib/db/mongodb";
import { User, Organization } from "@/lib/db/models";
import { getSession } from "@/lib/auth/session";

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    await connectDB();

    const user = await User.findById(session.userId).select("-passwordHash");
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Get user's organizations
    const organizations = await Organization.find({
      _id: { $in: user.organizationIds },
    }).select("name slug");

    return NextResponse.json({
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        isSuperAdmin: user.isSuperAdmin || false,
        organizationIds: user.organizationIds.map((id: { toString: () => string }) => id.toString()),
        settings: user.settings,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
      },
      organizations: organizations.map((org) => ({
        id: org._id.toString(),
        name: org.name,
        slug: org.slug,
      })),
    });
  } catch (error) {
    console.error("Get user error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
