import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongodb";
import { MagicLinkToken, User, Organization } from "@/lib/db/models";
import { createSession } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { error: "Token is required" },
        { status: 400 }
      );
    }

    await connectDB();

    const magicLink = await MagicLinkToken.findOne({ token });

    if (!magicLink) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 400 }
      );
    }

    if (magicLink.usedAt) {
      return NextResponse.json(
        { error: "Token has already been used" },
        { status: 410 }
      );
    }

    if (new Date() > magicLink.expiresAt) {
      return NextResponse.json(
        { error: "Token has expired" },
        { status: 410 }
      );
    }

    const user = await User.findById(magicLink.userId);
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    if (user.isBlocked) {
      return NextResponse.json(
        { error: "Account is blocked" },
        { status: 403 }
      );
    }

    // Mark token as used
    magicLink.usedAt = new Date();
    await magicLink.save();

    // Update last login
    user.lastLoginAt = new Date();
    await user.save();

    // Create session
    await createSession({
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      isSuperAdmin: user.isSuperAdmin,
    });

    // Get organization info
    let organization = null;
    if (magicLink.metadata?.organizationId) {
      const org = await Organization.findById(magicLink.metadata.organizationId);
      if (org) {
        organization = {
          id: org._id.toString(),
          name: org.name,
          slug: org.slug,
        };
      }
    } else if (user.organizationIds?.length > 0) {
      const org = await Organization.findById(user.organizationIds[0]);
      if (org) {
        organization = {
          id: org._id.toString(),
          name: org.name,
          slug: org.slug,
        };
      }
    }

    return NextResponse.json({
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
      },
      organization,
      redirectTo: organization ? `/${organization.slug}` : "/dashboard",
    });
  } catch (error) {
    console.error("Magic link verification error:", error);
    return NextResponse.json(
      { error: "Failed to verify token" },
      { status: 500 }
    );
  }
}
