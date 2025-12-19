import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import {
  requireProjectPermission,
  authError,
} from "@/lib/auth/authorization";
import { PROJECT_PERMISSIONS } from "@/lib/auth/projectPermissions";
import { connectDB } from "@/lib/db/mongodb";
import Project, { ProjectRole } from "@/lib/db/models/project";
import User from "@/lib/db/models/user";
import Organization from "@/lib/db/models/organization";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

// GET /api/projects/[projectId]/members - List project members
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { projectId } = await params;

  const auth = await requireProjectPermission(
    projectId,
    PROJECT_PERMISSIONS.VIEW,
    request
  );

  if (!auth.authorized || !auth.context) {
    return authError(auth);
  }

  try {
    await connectDB();

    const project = await Project.findById(projectId).lean();
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Handle projects without members field (backwards compatibility)
    const projectMembers = project.members || [];

    // Get user details for each member
    const memberUserIds = projectMembers.map((m) => m.userId);
    const users = await User.find({ _id: { $in: memberUserIds } })
      .select("_id name email")
      .lean();

    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    const members = projectMembers.map((m) => {
      const user = userMap.get(m.userId.toString());
      return {
        userId: m.userId.toString(),
        name: user?.name || "Unknown User",
        email: user?.email || "",
        role: m.role,
        addedAt: m.addedAt,
      };
    });

    return NextResponse.json({
      members,
      projectId,
      projectName: project.name,
    });
  } catch (error) {
    console.error("Error fetching project members:", error);
    return NextResponse.json(
      { error: "Failed to fetch project members" },
      { status: 500 }
    );
  }
}

// POST /api/projects/[projectId]/members - Add a member to project
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { projectId } = await params;

  const auth = await requireProjectPermission(
    projectId,
    PROJECT_PERMISSIONS.MANAGE_MEMBERS,
    request
  );

  if (!auth.authorized || !auth.context) {
    return authError(auth);
  }

  try {
    const body = await request.json();
    const { userId, email, role } = body;

    if (!role || !["viewer", "editor", "admin"].includes(role)) {
      return NextResponse.json(
        { error: "Valid role is required (viewer, editor, admin)" },
        { status: 400 }
      );
    }

    await connectDB();

    const project = await Project.findById(projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Find user by ID or email
    let user;
    if (userId) {
      user = await User.findById(userId);
    } else if (email) {
      user = await User.findOne({ email: email.toLowerCase() });
    } else {
      return NextResponse.json(
        { error: "userId or email is required" },
        { status: 400 }
      );
    }

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check user is a member of the organization
    const org = await Organization.findById(project.organizationId);
    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    const isOrgMember = org.members.some(
      (m) => m.userId.toString() === user._id.toString()
    );

    if (!isOrgMember) {
      return NextResponse.json(
        { error: "User must be a member of the organization first" },
        { status: 400 }
      );
    }

    // Check if already a member
    const existingMember = project.members.find(
      (m) => m.userId.toString() === user._id.toString()
    );

    if (existingMember) {
      return NextResponse.json(
        { error: "User is already a project member" },
        { status: 400 }
      );
    }

    // Add member
    project.members.push({
      userId: user._id,
      role: role as ProjectRole,
      addedBy: new mongoose.Types.ObjectId(auth.context.user.id),
      addedAt: new Date(),
    });

    await project.save();

    return NextResponse.json({
      success: true,
      member: {
        userId: user._id.toString(),
        name: user.name,
        email: user.email,
        role,
        addedAt: new Date(),
      },
    });
  } catch (error) {
    console.error("Error adding project member:", error);
    return NextResponse.json(
      { error: "Failed to add project member" },
      { status: 500 }
    );
  }
}
