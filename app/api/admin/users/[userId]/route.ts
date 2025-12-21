import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongodb";
import { User, Organization } from "@/lib/db/models";
import { requireSuperAdmin, authError } from "@/lib/auth/authorization";

interface RouteParams {
  params: Promise<{ userId: string }>;
}

// DELETE /api/admin/users/[userId] - Delete a user
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await params;
    const authResult = await requireSuperAdmin(request);

    if (!authResult.authorized || !authResult.context) {
      return authError(authResult);
    }

    // Prevent deleting yourself
    if (authResult.context.user.id === userId) {
      return NextResponse.json(
        { error: "Cannot delete yourself" },
        { status: 403 }
      );
    }

    await connectDB();

    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Prevent deleting other super admins
    if (user.isSuperAdmin) {
      return NextResponse.json(
        { error: "Cannot delete a super admin. Revoke super admin status first." },
        { status: 403 }
      );
    }

    // Remove user from all organizations
    await Organization.updateMany(
      { "members.userId": userId },
      { $pull: { members: { userId: userId } } }
    );

    // Delete the user
    await User.findByIdAndDelete(userId);

    return NextResponse.json({
      message: "User deleted",
      userId: userId,
    });
  } catch (error) {
    console.error("Delete user error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
