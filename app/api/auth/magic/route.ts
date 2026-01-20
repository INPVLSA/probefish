import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongodb";
import { MagicLinkToken, User, Organization } from "@/lib/db/models";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

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
        { status: 404 }
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

    let organizationName = null;
    if (magicLink.metadata?.organizationId) {
      const org = await Organization.findById(magicLink.metadata.organizationId);
      organizationName = org?.name || null;
    } else if (user.organizationIds?.length > 0) {
      const org = await Organization.findById(user.organizationIds[0]);
      organizationName = org?.name || null;
    }

    return NextResponse.json({
      valid: true,
      email: user.email,
      name: user.name,
      organizationName,
      purpose: magicLink.purpose,
    });
  } catch (error) {
    console.error("Magic link validation error:", error);
    return NextResponse.json(
      { error: "Failed to validate token" },
      { status: 500 }
    );
  }
}
