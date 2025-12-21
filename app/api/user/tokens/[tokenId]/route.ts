import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongodb";
import { AccessToken } from "@/lib/db/models/accessToken";

// DELETE /api/user/tokens/[tokenId] - Revoke a token
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ tokenId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tokenId } = await params;
    await connectDB();

    const token = await AccessToken.findOne({
      _id: tokenId,
      userId: session.userId,
      revokedAt: null,
    });

    if (!token) {
      return NextResponse.json({ error: "Token not found" }, { status: 404 });
    }

    // Revoke the token
    token.revokedAt = new Date();
    await token.save();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error revoking token:", error);
    return NextResponse.json({ error: "Failed to revoke token" }, { status: 500 });
  }
}
