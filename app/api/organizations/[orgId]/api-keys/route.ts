import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/mongodb";
import { Organization } from "@/lib/db/models";
import { requireOrgPermission, authError } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { encrypt, decrypt, maskApiKey, isEncrypted } from "@/lib/utils/encryption";

interface RouteParams {
  params: Promise<{ orgId: string }>;
}

type ProviderKey = "openai" | "anthropic" | "gemini";
const VALID_PROVIDERS: ProviderKey[] = ["openai", "anthropic", "gemini"];

// GET /api/organizations/[orgId]/api-keys - List API keys (masked)
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { orgId } = await params;
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

    const keys: Record<
      string,
      { configured: boolean; maskedKey?: string; lastUpdated?: Date }
    > = {};

    for (const provider of VALID_PROVIDERS) {
      const cred = org.llmCredentials?.[provider];
      if (cred?.apiKey) {
        // Decrypt if encrypted, then mask
        let actualKey = cred.apiKey;
        if (isEncrypted(cred.apiKey)) {
          try {
            actualKey = decrypt(cred.apiKey);
          } catch {
            // If decryption fails, key might be stored unencrypted (legacy)
            actualKey = cred.apiKey;
          }
        }
        keys[provider] = {
          configured: true,
          maskedKey: maskApiKey(actualKey),
          lastUpdated: cred.encryptedAt,
        };
      } else {
        keys[provider] = { configured: false };
      }
    }

    return NextResponse.json({ keys });
  } catch (error) {
    console.error("List API keys error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/organizations/[orgId]/api-keys - Set/Update API key
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { orgId } = await params;
    const authResult = await requireOrgPermission(
      orgId,
      PERMISSIONS.MANAGE_KEYS,
      request
    );

    if (!authResult.authorized) {
      return authError(authResult);
    }

    const body = await request.json();
    const { provider, apiKey } = body;

    if (!provider || !VALID_PROVIDERS.includes(provider)) {
      return NextResponse.json(
        { error: "Valid provider is required (openai, anthropic, gemini)" },
        { status: 400 }
      );
    }

    if (!apiKey || typeof apiKey !== "string" || apiKey.length < 10) {
      return NextResponse.json(
        { error: "Valid API key is required (minimum 10 characters)" },
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

    // Initialize llmCredentials if needed
    if (!org.llmCredentials) {
      org.llmCredentials = {};
    }

    // Encrypt and store the API key
    const encryptedKey = encrypt(apiKey);
    org.llmCredentials[provider as ProviderKey] = {
      apiKey: encryptedKey,
      encryptedAt: new Date(),
    };

    await org.save();

    return NextResponse.json({
      message: "API key saved successfully",
      provider,
      maskedKey: maskApiKey(apiKey),
    });
  } catch (error) {
    console.error("Set API key error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
