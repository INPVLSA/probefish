import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongodb";
import { User } from "@/lib/db/models";
import { requireSuperAdmin, authError } from "@/lib/auth/authorization";

interface RouteParams {
  params: Promise<{ userId: string }>;
}

// POST /api/admin/users/[userId]/super-admin - Grant super admin status
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await params;
    const authResult = await requireSuperAdmin(request);

    if (!authResult.authorized) {
      return authError(authResult);
    }

    await connectDB();

    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.isSuperAdmin) {
      return NextResponse.json(
        { error: "User is already a super admin" },
        { status: 400 }
      );
    }

    user.isSuperAdmin = true;
    await user.save();

    return NextResponse.json({
      message: "Super admin status granted",
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        isSuperAdmin: true,
      },
    });
  } catch (error) {
    console.error("Grant super admin error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/users/[userId]/super-admin - Revoke super admin status
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await params;
    const authResult = await requireSuperAdmin(request);

    if (!authResult.authorized || !authResult.context) {
      return authError(authResult);
    }

    // Prevent revoking own super admin status
    if (authResult.context.user.id === userId) {
      return NextResponse.json(
        { error: "Cannot revoke your own super admin status" },
        { status: 403 }
      );
    }

    await connectDB();

    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.isSuperAdmin) {
      return NextResponse.json(
        { error: "User is not a super admin" },
        { status: 400 }
      );
    }

    user.isSuperAdmin = false;
    await user.save();

    return NextResponse.json({
      message: "Super admin status revoked",
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        isSuperAdmin: false,
      },
    });
  } catch (error) {
    console.error("Revoke super admin error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
