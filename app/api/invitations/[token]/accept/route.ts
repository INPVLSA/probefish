import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongodb";
import { Invitation, Organization, User } from "@/lib/db/models";
import { getSession, createSession } from "@/lib/auth/session";

interface RouteParams {
  params: Promise<{ token: string }>;
}

// POST /api/invitations/[token]/accept - Accept invitation
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params;
    const session = await getSession();
    const body = await request.json().catch(() => ({}));

    await connectDB();

    // Find invitation
    const invitation = await Invitation.findOne({ token });
    if (!invitation) {
      return NextResponse.json(
        { error: "Invalid invitation" },
        { status: 404 }
      );
    }

    // Check status
    if (invitation.status === "accepted") {
      return NextResponse.json(
        { error: "Invitation has already been accepted" },
        { status: 400 }
      );
    }
    if (invitation.status === "revoked") {
      return NextResponse.json(
        { error: "Invitation has been revoked" },
        { status: 400 }
      );
    }
    if (invitation.status === "expired" || invitation.expiresAt < new Date()) {
      invitation.status = "expired";
      await invitation.save();
      return NextResponse.json(
        { error: "Invitation has expired" },
        { status: 400 }
      );
    }

    const organization = await Organization.findById(invitation.organizationId);
    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    let user = null;

    // Check if invitee email has existing account
    const existingUser = await User.findOne({ email: invitation.email });

    if (existingUser) {
      // Case 1: Existing user
      if (session) {
        // Logged in - verify it's the same user
        if (session.email.toLowerCase() !== invitation.email.toLowerCase()) {
          return NextResponse.json(
            {
              error:
                "This invitation was sent to a different email address. Please log in with the correct account.",
            },
            { status: 403 }
          );
        }
      }
      user = existingUser;
    } else {
      // Case 2: New user - must provide name and password
      if (session) {
        // If logged in but email doesn't match, error
        return NextResponse.json(
          {
            error:
              "This invitation was sent to a different email address. Please log out and create a new account.",
          },
          { status: 403 }
        );
      }

      const { name, password } = body;

      if (!name || typeof name !== "string" || name.length < 2) {
        return NextResponse.json(
          { error: "Name is required (minimum 2 characters)" },
          { status: 400 }
        );
      }

      if (!password || typeof password !== "string" || password.length < 6) {
        return NextResponse.json(
          { error: "Password is required (minimum 6 characters)" },
          { status: 400 }
        );
      }

      // Create new user
      user = new User({
        email: invitation.email,
        passwordHash: password, // Will be hashed by pre-save hook
        name: name.trim(),
        settings: { theme: "system" },
        organizationIds: [],
      });
      await user.save();
    }

    // Add user to organization
    const isAlreadyMember = organization.members.some(
      (m) => m.userId.toString() === user!._id.toString()
    );

    if (!isAlreadyMember) {
      organization.members.push({
        userId: user._id,
        role: invitation.role,
        joinedAt: new Date(),
      });
      await organization.save();

      // Update user's organizationIds
      if (
        !user.organizationIds.some(
          (id) => id.toString() === organization._id.toString()
        )
      ) {
        user.organizationIds.push(organization._id);
        await user.save();
      }
    }

    // Update invitation
    invitation.status = "accepted";
    invitation.acceptedAt = new Date();
    invitation.acceptedBy = user._id;
    await invitation.save();

    // Create session if new user or not logged in
    if (!session) {
      await createSession({
        userId: user._id.toString(),
        email: user.email,
        name: user.name,
        isSuperAdmin: user.isSuperAdmin || false,
      });
    }

    return NextResponse.json({
      message: "Successfully joined organization",
      organization: {
        id: organization._id.toString(),
        name: organization.name,
        slug: organization.slug,
      },
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error("Accept invitation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
