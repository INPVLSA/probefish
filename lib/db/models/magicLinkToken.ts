import mongoose, { Schema, Document, Model } from "mongoose";
import { nanoid } from "nanoid";

export type MagicLinkPurpose = "provisioning" | "login";

export interface IMagicLinkToken extends Document {
  _id: mongoose.Types.ObjectId;
  token: string;
  email: string;
  userId: mongoose.Types.ObjectId;
  purpose: MagicLinkPurpose;
  expiresAt: Date;
  usedAt?: Date;
  metadata?: {
    landingUserId?: string;
    subscriptionId?: string;
    organizationId?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

type MagicLinkTokenModel = Model<IMagicLinkToken>;

const magicLinkTokenSchema = new Schema<IMagicLinkToken>(
  {
    token: {
      type: String,
      required: true,
      unique: true,
      default: () => nanoid(32),
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"],
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    purpose: {
      type: String,
      enum: ["provisioning", "login"],
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    },
    usedAt: Date,
    metadata: {
      type: new Schema(
        {
          landingUserId: String,
          subscriptionId: String,
          organizationId: String,
        },
        { _id: false }
      ),
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
magicLinkTokenSchema.index({ email: 1 });
magicLinkTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

// Virtual to check if expired
magicLinkTokenSchema.virtual("isExpired").get(function () {
  return new Date() > this.expiresAt;
});

// Virtual to check if used
magicLinkTokenSchema.virtual("isUsed").get(function () {
  return !!this.usedAt;
});

const MagicLinkToken: MagicLinkTokenModel =
  mongoose.models.MagicLinkToken ||
  mongoose.model<IMagicLinkToken, MagicLinkTokenModel>(
    "MagicLinkToken",
    magicLinkTokenSchema
  );

export default MagicLinkToken;
