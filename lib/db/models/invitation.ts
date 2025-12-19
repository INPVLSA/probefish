import mongoose, { Schema, Document, Model } from "mongoose";
import { nanoid } from "nanoid";

export type InvitationStatus = "pending" | "accepted" | "expired" | "revoked";

export interface IInvitation extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  token: string;
  organizationId: mongoose.Types.ObjectId;
  invitedBy: mongoose.Types.ObjectId;
  role: "admin" | "member" | "viewer";
  status: InvitationStatus;
  expiresAt: Date;
  acceptedAt?: Date;
  acceptedBy?: mongoose.Types.ObjectId;
  revokedAt?: Date;
  revokedBy?: mongoose.Types.ObjectId;
  message?: string;
  createdAt: Date;
  updatedAt: Date;
}

type InvitationModel = Model<IInvitation>;

const invitationSchema = new Schema<IInvitation>(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"],
    },
    token: {
      type: String,
      required: true,
      unique: true,
      default: () => nanoid(32),
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    invitedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      enum: ["admin", "member", "viewer"],
      default: "member",
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "expired", "revoked"],
      default: "pending",
    },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
    acceptedAt: Date,
    acceptedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    revokedAt: Date,
    revokedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    message: {
      type: String,
      maxlength: [500, "Message cannot exceed 500 characters"],
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
// Note: token index is created via unique: true in field definition
invitationSchema.index({ email: 1, organizationId: 1 });
invitationSchema.index({ organizationId: 1, status: 1 });
invitationSchema.index({ expiresAt: 1 });

// Virtual to check if expired
invitationSchema.virtual("isExpired").get(function () {
  return this.status === "pending" && new Date() > this.expiresAt;
});

const Invitation: InvitationModel =
  mongoose.models.Invitation ||
  mongoose.model<IInvitation, InvitationModel>("Invitation", invitationSchema);

export default Invitation;
