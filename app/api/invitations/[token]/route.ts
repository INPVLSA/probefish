import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongodb";
import { Invitation, Organization, User } from "@/lib/db/models";
import { IUser } from "@/lib/db/models/user";
import { IOrganization } from "@/lib/db/models/organization";

interface RouteParams {
  params: Promise<{ token: string }>;
}

// GET /api/invitations/[token] - Get invitation details (public)
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params;

    await connectDB();

    const invitation = await Invitation.findOne({ token })
      .populate("invitedBy", "name")
      .populate("organizationId", "name");

    if (!invitation) {
      return NextResponse.json(
        { error: "Invalid invitation" },
        { status: 404 }
      );
    }

    // Check expiry and update status
    if (invitation.status === "pending" && invitation.expiresAt < new Date()) {
      invitation.status = "expired";
      await invitation.save();
    }

    // Check if email has existing account
    const existingUser = await User.findOne({ email: invitation.email });

    const org = invitation.organizationId as unknown as IOrganization;
    const inviter = invitation.invitedBy as unknown as IUser;

    return NextResponse.json({
      email: invitation.email,
      status: invitation.status,
      role: invitation.role,
      message: invitation.message,
      expiresAt: invitation.expiresAt,
      organization: {
        name: org?.name || "Unknown Organization",
      },
      invitedBy: {
        name: inviter?.name || "A team member",
      },
      hasExistingAccount: !!existingUser,
    });
  } catch (error) {
    console.error("Get invitation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
