import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongodb";
import { Organization } from "@/lib/db/models";
import { requireOrgPermission, authError } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";

interface RouteParams {
  params: Promise<{ orgId: string; provider: string }>;
}

type ProviderKey = "openai" | "anthropic" | "gemini" | "grok";
const VALID_PROVIDERS: ProviderKey[] = ["openai", "anthropic", "gemini", "grok"];

// DELETE /api/organizations/[orgId]/api-keys/[provider] - Delete API key
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { orgId, provider } = await params;

    if (!VALID_PROVIDERS.includes(provider as ProviderKey)) {
      return NextResponse.json(
        { error: "Invalid provider. Must be openai, anthropic, gemini, or grok" },
        { status: 400 }
      );
    }

    const authResult = await requireOrgPermission(
      orgId,
      PERMISSIONS.MANAGE_KEYS,
      request
    );

    if (!authResult.authorized) {
      return authError(authResult);
    }

    await connectDB();
    const org = await Organization.findById(orgId);

    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    if (org.llmCredentials?.[provider as ProviderKey]) {
      org.llmCredentials[provider as ProviderKey] = undefined;
      await org.save();
    }

    return NextResponse.json({
      message: `${provider} API key deleted successfully`,
    });
  } catch (error) {
    console.error("Delete API key error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
