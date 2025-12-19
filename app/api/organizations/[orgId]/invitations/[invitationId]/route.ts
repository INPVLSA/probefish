import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/db/mongodb";
import { Invitation, Organization, User } from "@/lib/db/models";
import { requireOrgPermission, authError } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { sendInvitationEmail } from "@/lib/email";

interface RouteParams {
  params: Promise<{ orgId: string; invitationId: string }>;
}

// GET /api/organizations/[orgId]/invitations/[invitationId] - Get invitation details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { orgId, invitationId } = await params;
    const authResult = await requireOrgPermission(
      orgId,
      PERMISSIONS.MANAGE_MEMBERS,
      request
    );

    if (!authResult.authorized) {
      return authError(authResult);
    }

    await connectDB();

    const invitation = await Invitation.findOne({
      _id: invitationId,
      organizationId: orgId,
    })
      .populate("invitedBy", "name email")
      .populate("acceptedBy", "name email")
      .populate("revokedBy", "name email");

    if (!invitation) {
      return NextResponse.json(
        { error: "Invitation not found" },
        { status: 404 }
      );
    }

    // Update expired status
    if (invitation.status === "pending" && invitation.expiresAt < new Date()) {
      invitation.status = "expired";
      await invitation.save();
    }

    return NextResponse.json({
      invitation: {
        id: invitation._id.toString(),
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        message: invitation.message,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
        acceptedAt: invitation.acceptedAt,
        revokedAt: invitation.revokedAt,
        invitedBy: invitation.invitedBy,
        acceptedBy: invitation.acceptedBy,
        revokedBy: invitation.revokedBy,
      },
    });
  } catch (error) {
    console.error("Get invitation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/organizations/[orgId]/invitations/[invitationId] - Revoke invitation
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { orgId, invitationId } = await params;
    const authResult = await requireOrgPermission(
      orgId,
      PERMISSIONS.MANAGE_MEMBERS,
      request
    );

    if (!authResult.authorized || !authResult.context) {
      return authError(authResult);
    }

    await connectDB();

    const invitation = await Invitation.findOne({
      _id: invitationId,
      organizationId: orgId,
    });

    if (!invitation) {
      return NextResponse.json(
        { error: "Invitation not found" },
        { status: 404 }
      );
    }

    if (invitation.status !== "pending") {
      return NextResponse.json(
        { error: "Only pending invitations can be revoked" },
        { status: 400 }
      );
    }

    invitation.status = "revoked";
    invitation.revokedAt = new Date();
    invitation.revokedBy = new mongoose.Types.ObjectId(
      authResult.context.user.id
    );
    await invitation.save();

    return NextResponse.json({ message: "Invitation revoked successfully" });
  } catch (error) {
    console.error("Revoke invitation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/organizations/[orgId]/invitations/[invitationId] - Resend invitation
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { orgId, invitationId } = await params;
    const authResult = await requireOrgPermission(
      orgId,
      PERMISSIONS.MANAGE_MEMBERS,
      request
    );

    if (!authResult.authorized || !authResult.context) {
      return authError(authResult);
    }

    await connectDB();

    const invitation = await Invitation.findOne({
      _id: invitationId,
      organizationId: orgId,
    });

    if (!invitation) {
      return NextResponse.json(
        { error: "Invitation not found" },
        { status: 404 }
      );
    }

    if (!["pending", "expired"].includes(invitation.status)) {
      return NextResponse.json(
        { error: "Cannot resend this invitation" },
        { status: 400 }
      );
    }

    // Reset expiration and status
    invitation.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    invitation.status = "pending";
    await invitation.save();

    // Get organization and inviter
    const organization = await Organization.findById(orgId);
    const inviter = await User.findById(authResult.context.user.id);

    // Send email
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const inviteUrl = `${appUrl}/invite/${invitation.token}`;

    const emailResult = await sendInvitationEmail({
      to: invitation.email,
      inviterName: inviter?.name || "A team member",
      organizationName: organization?.name || "the organization",
      inviteUrl,
      role: invitation.role,
      message: invitation.message,
      expiresAt: invitation.expiresAt,
    });

    if (!emailResult.success) {
      return NextResponse.json(
        {
          message: "Invitation reset but email could not be sent",
          warning: true,
        },
        { status: 200 }
      );
    }

    return NextResponse.json({
      message: "Invitation resent successfully",
      invitation: {
        id: invitation._id.toString(),
        expiresAt: invitation.expiresAt,
      },
    });
  } catch (error) {
    console.error("Resend invitation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
