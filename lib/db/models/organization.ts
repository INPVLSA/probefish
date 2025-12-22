import mongoose, { Schema, Document, Model } from "mongoose";

export type MemberRole = "owner" | "admin" | "member" | "viewer";

export interface IMember {
  userId: mongoose.Types.ObjectId;
  role: MemberRole;
  joinedAt: Date;
}

export interface ILLMCredential {
  apiKey: string;
  encryptedAt: Date;
}

export interface IOrganization extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  ownerId: mongoose.Types.ObjectId;
  members: IMember[];
  llmCredentials: {
    openai?: ILLMCredential;
    anthropic?: ILLMCredential;
    gemini?: ILLMCredential;
    grok?: ILLMCredential;
    custom?: Array<{ name: string; baseUrl: string } & ILLMCredential>;
  };
  settings: {
    defaultJudgeModel?: string;
    maxConcurrentTests?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

type OrganizationModel = Model<IOrganization>;

const memberSchema = new Schema<IMember>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      enum: ["owner", "admin", "member", "viewer"],
      default: "member",
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const llmCredentialSchema = new Schema<ILLMCredential>(
  {
    apiKey: {
      type: String,
      required: true,
    },
    encryptedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const organizationSchema = new Schema<IOrganization>(
  {
    name: {
      type: String,
      required: [true, "Organization name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    slug: {
      type: String,
      required: [true, "Slug is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[a-z0-9-]+$/,
        "Slug can only contain lowercase letters, numbers, and hyphens",
      ],
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    members: [memberSchema],
    llmCredentials: {
      openai: llmCredentialSchema,
      anthropic: llmCredentialSchema,
      gemini: llmCredentialSchema,
      grok: llmCredentialSchema,
      custom: [
        {
          name: String,
          baseUrl: String,
          apiKey: String,
          encryptedAt: Date,
        },
      ],
    },
    settings: {
      defaultJudgeModel: {
        type: String,
      },
      maxConcurrentTests: {
        type: Number,
        default: 5,
        min: 1,
        max: 50,
      },
    },
  },
  {
    timestamps: true,
  }
);

organizationSchema.index({ ownerId: 1 });
organizationSchema.index({ "members.userId": 1 });

// Helper to generate slug from name
organizationSchema.statics.generateSlug = function (name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
};

const Organization: OrganizationModel =
  mongoose.models.Organization ||
  mongoose.model<IOrganization, OrganizationModel>(
    "Organization",
    organizationSchema
  );

export default Organization;
