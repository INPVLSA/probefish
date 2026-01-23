import mongoose, { Schema, Document, Model } from "mongoose";

// Project-level roles
export type ProjectRole = "viewer" | "editor" | "admin";
export type ProjectVisibility = "public" | "private";

export interface IProjectMember {
  userId: mongoose.Types.ObjectId;
  role: ProjectRole;
  addedBy: mongoose.Types.ObjectId;
  addedAt: Date;
}

export interface IProject extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  organizationId: mongoose.Types.ObjectId;
  parentId?: mongoose.Types.ObjectId; // For folder hierarchy
  isFolder: boolean;
  color?: string;
  icon?: string;
  visibility: ProjectVisibility;
  members: IProjectMember[];
  inheritFromParent: boolean;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

type ProjectModel = Model<IProject>;

const projectSchema = new Schema<IProject>(
  {
    name: {
      type: String,
      required: [true, "Project name is required"],
      trim: true,
      minlength: [1, "Name must be at least 1 character"],
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    slug: {
      type: String,
      required: [true, "Slug is required"],
      lowercase: true,
      trim: true,
      minlength: [3, "Slug must be at least 3 characters"],
      maxlength: [50, "Slug cannot exceed 50 characters"],
      match: [/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, "Slug must contain only lowercase letters, numbers, and hyphens, and must start and end with a letter or number"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    parentId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      default: null,
    },
    isFolder: {
      type: Boolean,
      default: false,
    },
    color: {
      type: String,
      default: null,
    },
    icon: {
      type: String,
      default: null,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    visibility: {
      type: String,
      enum: ["public", "private"],
      default: "public",
    },
    members: [
      {
        userId: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        role: {
          type: String,
          enum: ["viewer", "editor", "admin"],
          required: true,
        },
        addedBy: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        addedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    inheritFromParent: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

projectSchema.index({ organizationId: 1 });
projectSchema.index({ parentId: 1 });
projectSchema.index({ organizationId: 1, parentId: 1 });
projectSchema.index({ organizationId: 1, slug: 1 }, { unique: true });

const Project: ProjectModel =
  mongoose.models.Project ||
  mongoose.model<IProject, ProjectModel>("Project", projectSchema);

export default Project;
