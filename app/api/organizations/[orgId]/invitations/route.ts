import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongodb";
import { Invitation, Organization, User } from "@/lib/db/models";
import { requireOrgPermission, authError } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { sendInvitationEmail } from "@/lib/email";

interface RouteParams {
  params: Promise<{ orgId: string }>;
}

// GET /api/organizations/[orgId]/invitations - List invitations
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { orgId } = await params;
    const authResult = await requireOrgPermission(
      orgId,
      PERMISSIONS.MANAGE_MEMBERS,
      request
    );

    if (!authResult.authorized) {
      return authError(authResult);
    }

    await connectDB();

    // Get query params for filtering
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const query: Record<string, unknown> = { organizationId: orgId };
    if (
      status &&
      ["pending", "accepted", "expired", "revoked"].includes(status)
    ) {
      query.status = status;
    }

    const invitations = await Invitation.find(query)
      .populate("invitedBy", "name email")
      .populate("acceptedBy", "name email")
      .sort({ createdAt: -1 });

    // Update expired invitations
    const now = new Date();
    for (const inv of invitations) {
      if (inv.status === "pending" && inv.expiresAt < now) {
        inv.status = "expired";
        await inv.save();
      }
    }

    return NextResponse.json({
      invitations: invitations.map((inv) => ({
        id: inv._id.toString(),
        email: inv.email,
        role: inv.role,
        status: inv.status,
        message: inv.message,
        expiresAt: inv.expiresAt,
        createdAt: inv.createdAt,
        acceptedAt: inv.acceptedAt,
        invitedBy: inv.invitedBy,
        acceptedBy: inv.acceptedBy,
      })),
    });
  } catch (error) {
    console.error("List invitations error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/organizations/[orgId]/invitations - Create and send invitation
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { orgId } = await params;
    const authResult = await requireOrgPermission(
      orgId,
      PERMISSIONS.MANAGE_MEMBERS,
      request
    );

    if (!authResult.authorized || !authResult.context) {
      return authError(authResult);
    }

    const body = await request.json();
    const { email, role, message, expiresInDays = 7 } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    if (!role || !["admin", "member", "viewer"].includes(role)) {
      return NextResponse.json(
        { error: "Valid role is required (admin, member, viewer)" },
        { status: 400 }
      );
    }

    if (expiresInDays < 1 || expiresInDays > 30) {
      return NextResponse.json(
        { error: "expiresInDays must be between 1 and 30" },
        { status: 400 }
      );
    }

    await connectDB();

    const organization = await Organization.findById(orgId);
    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Check if user is already a member
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      const isAlreadyMember = organization.members.some(
        (m) => m.userId.toString() === existingUser._id.toString()
      );
      if (isAlreadyMember) {
        return NextResponse.json(
          { error: "User is already a member of this organization" },
          { status: 409 }
        );
      }
    }

    // Check for existing pending invitation
    const existingInvitation = await Invitation.findOne({
      email: email.toLowerCase(),
      organizationId: orgId,
      status: "pending",
      expiresAt: { $gt: new Date() },
    });
    if (existingInvitation) {
      return NextResponse.json(
        { error: "An invitation is already pending for this email" },
        { status: 409 }
      );
    }

    // Create invitation
    const invitation = new Invitation({
      email: email.toLowerCase(),
      organizationId: orgId,
      invitedBy: authResult.context.user.id,
      role,
      message: message?.substring(0, 500),
      expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000),
    });

    await invitation.save();

    // Get inviter details
    const inviter = await User.findById(authResult.context.user.id);

    // Send email
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const inviteUrl = `${appUrl}/invite/${invitation.token}`;

    const emailResult = await sendInvitationEmail({
      to: email,
      inviterName: inviter?.name || "A team member",
      organizationName: organization.name,
      inviteUrl,
      role,
      message,
      expiresAt: invitation.expiresAt,
    });

    if (!emailResult.success) {
      // Still return success but indicate email issue
      return NextResponse.json(
        {
          invitation: {
            id: invitation._id.toString(),
            email: invitation.email,
            role: invitation.role,
            status: invitation.status,
            expiresAt: invitation.expiresAt,
            createdAt: invitation.createdAt,
          },
          warning: "Invitation created but email could not be sent",
        },
        { status: 201 }
      );
    }

    return NextResponse.json(
      {
        invitation: {
          id: invitation._id.toString(),
          email: invitation.email,
          role: invitation.role,
          status: invitation.status,
          expiresAt: invitation.expiresAt,
          createdAt: invitation.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create invitation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
