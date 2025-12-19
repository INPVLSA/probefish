import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongodb";
import { Organization } from "@/lib/db/models";
import { requireOrgPermission, authError } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { encrypt, maskApiKey } from "@/lib/utils/encryption";

interface RouteParams {
  params: Promise<{ orgId: string; provider: string }>;
}

type ProviderKey = "openai" | "anthropic" | "gemini";
const VALID_PROVIDERS: ProviderKey[] = ["openai", "anthropic", "gemini"];

// POST /api/organizations/[orgId]/api-keys/[provider]/rotate - Rotate API key
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { orgId, provider } = await params;

    if (!VALID_PROVIDERS.includes(provider as ProviderKey)) {
      return NextResponse.json(
        { error: "Invalid provider. Must be openai, anthropic, or gemini" },
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

    const body = await request.json();
    const { newApiKey } = body;

    if (!newApiKey || typeof newApiKey !== "string" || newApiKey.length < 10) {
      return NextResponse.json(
        { error: "Valid new API key is required (minimum 10 characters)" },
        { status: 400 }
      );
    }

    await connectDB();
    const org = await Organization.findById(orgId);

    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Check if there's an existing key to rotate
    if (!org.llmCredentials?.[provider as ProviderKey]) {
      return NextResponse.json(
        { error: `No existing ${provider} API key to rotate. Use POST to set a new key.` },
        { status: 400 }
      );
    }

    // Initialize llmCredentials if needed
    if (!org.llmCredentials) {
      org.llmCredentials = {};
    }

    // Encrypt and store the new API key
    const encryptedKey = encrypt(newApiKey);
    org.llmCredentials[provider as ProviderKey] = {
      apiKey: encryptedKey,
      encryptedAt: new Date(),
    };

    await org.save();

    return NextResponse.json({
      message: `${provider} API key rotated successfully`,
      maskedKey: maskApiKey(newApiKey),
    });
  } catch (error) {
    console.error("Rotate API key error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
