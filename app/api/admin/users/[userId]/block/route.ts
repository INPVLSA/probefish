import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongodb";
import { User } from "@/lib/db/models";
import { requireSuperAdmin, authError } from "@/lib/auth/authorization";

interface RouteParams {
  params: Promise<{ userId: string }>;
}

// POST /api/admin/users/[userId]/block - Block a user
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await params;
    const authResult = await requireSuperAdmin(request);

    if (!authResult.authorized || !authResult.context) {
      return authError(authResult);
    }

    // Prevent blocking yourself
    if (authResult.context.user.id === userId) {
      return NextResponse.json(
        { error: "Cannot block yourself" },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { reason } = body;

    await connectDB();

    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.isBlocked) {
      return NextResponse.json(
        { error: "User is already blocked" },
        { status: 400 }
      );
    }

    user.isBlocked = true;
    user.blockedAt = new Date();
    user.blockedReason = reason || undefined;
    await user.save();

    return NextResponse.json({
      message: "User blocked",
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        isBlocked: true,
        blockedAt: user.blockedAt,
        blockedReason: user.blockedReason,
      },
    });
  } catch (error) {
    console.error("Block user error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/users/[userId]/block - Unblock a user
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

    if (!user.isBlocked) {
      return NextResponse.json(
        { error: "User is not blocked" },
        { status: 400 }
      );
    }

    user.isBlocked = false;
    user.blockedAt = undefined;
    user.blockedReason = undefined;
    await user.save();

    return NextResponse.json({
      message: "User unblocked",
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        isBlocked: false,
      },
    });
  } catch (error) {
    console.error("Unblock user error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
