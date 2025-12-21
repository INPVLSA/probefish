import mongoose, { Schema, Document, Types } from "mongoose";
import crypto from "crypto";

export type TokenScope =
  | "projects:read"
  | "projects:write"
  | "test-suites:read"
  | "test-suites:write"
  | "test-runs:execute"
  | "exports:read";

export const ALL_SCOPES: TokenScope[] = [
  "projects:read",
  "projects:write",
  "test-suites:read",
  "test-suites:write",
  "test-runs:execute",
  "exports:read",
];

export const SCOPE_DESCRIPTIONS: Record<TokenScope, string> = {
  "projects:read": "View projects and their contents",
  "projects:write": "Create and modify projects",
  "test-suites:read": "View test suites and test cases",
  "test-suites:write": "Create and modify test suites",
  "test-runs:execute": "Run tests and view results",
  "exports:read": "Export data in various formats",
};

export interface IAccessToken extends Document {
  _id: Types.ObjectId;
  name: string;
  tokenHash: string;
  tokenPrefix: string; // First 8 chars for identification
  userId: Types.ObjectId;
  organizationId: Types.ObjectId;
  scopes: TokenScope[];
  expiresAt: Date | null; // null = never expires
  lastUsedAt: Date | null;
  createdAt: Date;
  revokedAt: Date | null;
  // Instance methods
  isValid(): boolean;
  hasScope(scope: TokenScope): boolean;
  updateLastUsed(): Promise<void>;
}

const AccessTokenSchema = new Schema<IAccessToken>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },
    tokenPrefix: {
      type: String,
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    scopes: {
      type: [String],
      required: true,
      validate: {
        validator: (scopes: string[]) =>
          scopes.length > 0 && scopes.every((s) => ALL_SCOPES.includes(s as TokenScope)),
        message: "Invalid scopes",
      },
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    lastUsedAt: {
      type: Date,
      default: null,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
AccessTokenSchema.index({ userId: 1 });
AccessTokenSchema.index({ organizationId: 1 });
// Note: tokenHash already has unique: true in schema definition

// Static methods
AccessTokenSchema.statics.generateToken = function (): { token: string; hash: string; prefix: string } {
  // Generate a secure random token: pf_xxxx (probefish token)
  const randomBytes = crypto.randomBytes(32);
  const token = `pf_${randomBytes.toString("base64url")}`;
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  const prefix = token.substring(0, 11); // "pf_" + first 8 chars

  return { token, hash, prefix };
};

AccessTokenSchema.statics.hashToken = function (token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
};

AccessTokenSchema.statics.findByToken = async function (token: string): Promise<IAccessToken | null> {
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  return this.findOne({
    tokenHash: hash,
    revokedAt: null,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
  });
};

// Instance methods
AccessTokenSchema.methods.isValid = function (): boolean {
  if (this.revokedAt) return false;
  if (this.expiresAt && this.expiresAt < new Date()) return false;
  return true;
};

AccessTokenSchema.methods.hasScope = function (scope: TokenScope): boolean {
  return this.scopes.includes(scope);
};

AccessTokenSchema.methods.updateLastUsed = async function (): Promise<void> {
  this.lastUsedAt = new Date();
  await this.save();
};

export const AccessToken =
  (mongoose.models.AccessToken as mongoose.Model<IAccessToken> & {
    generateToken: () => { token: string; hash: string; prefix: string };
    hashToken: (token: string) => string;
    findByToken: (token: string) => Promise<IAccessToken | null>;
  }) || mongoose.model<IAccessToken>("AccessToken", AccessTokenSchema);
