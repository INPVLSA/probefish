import mongoose, { Schema, Document, Model } from "mongoose";
import bcrypt from "bcryptjs";

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  passwordHash: string;
  name: string;
  avatar?: string;
  organizationIds: mongoose.Types.ObjectId[];
  isSuperAdmin: boolean;
  apiKey?: string;
  apiKeyCreatedAt?: Date;
  settings: {
    defaultProvider?: "openai" | "anthropic" | "gemini" | "custom";
    theme?: "light" | "dark" | "system";
  };
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

interface IUserMethods {
  comparePassword(candidatePassword: string): Promise<boolean>;
}

type UserModel = Model<IUser, object, IUserMethods>;

const userSchema = new Schema<IUser, UserModel, IUserMethods>(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"],
    },
    passwordHash: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
    },
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    avatar: {
      type: String,
    },
    organizationIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "Organization",
      },
    ],
    isSuperAdmin: {
      type: Boolean,
      default: false,
    },
    apiKey: {
      type: String,
      unique: true,
      sparse: true,
    },
    apiKeyCreatedAt: {
      type: Date,
    },
    settings: {
      defaultProvider: {
        type: String,
        enum: ["openai", "anthropic", "gemini", "custom"],
      },
      theme: {
        type: String,
        enum: ["light", "dark", "system"],
        default: "system",
      },
    },
    lastLoginAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.pre("save", async function () {
  if (!this.isModified("passwordHash")) {
    return;
  }

  // If passwordHash is not already hashed (doesn't start with $2), hash it
  if (!this.passwordHash.startsWith("$2")) {
    const salt = await bcrypt.genSalt(12);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
  }
});

userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// Note: email index is created via unique: true in field definition

const User: UserModel =
  mongoose.models.User || mongoose.model<IUser, UserModel>("User", userSchema);

export default User;
