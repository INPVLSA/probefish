import mongoose, { Schema, Document, Model } from "mongoose";

export interface IPromptVersion {
  version: number;
  content: string;
  systemPrompt?: string;
  variables: string[]; // Extracted from content like {{var}}
  modelConfig: {
    provider?: "openai" | "anthropic" | "gemini" | "custom";
    model?: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
  };
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  note?: string;
}

export interface IPrompt extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  projectId: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  versions: IPromptVersion[];
  currentVersion: number;
  tags: string[];
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

type PromptModel = Model<IPrompt>;

const promptVersionSchema = new Schema<IPromptVersion>(
  {
    version: {
      type: Number,
      required: true,
    },
    content: {
      type: String,
      required: [true, "Prompt content is required"],
    },
    systemPrompt: {
      type: String,
    },
    variables: [{
      type: String,
    }],
    modelConfig: {
      provider: {
        type: String,
        enum: ["openai", "anthropic", "gemini", "custom"],
      },
      model: String,
      temperature: {
        type: Number,
        min: 0,
        max: 2,
        default: 0.7,
      },
      maxTokens: {
        type: Number,
        min: 1,
        max: 128000,
      },
      topP: {
        type: Number,
        min: 0,
        max: 1,
      },
      frequencyPenalty: {
        type: Number,
        min: -2,
        max: 2,
      },
      presencePenalty: {
        type: Number,
        min: -2,
        max: 2,
      },
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    note: String,
  },
  { _id: false }
);

const promptSchema = new Schema<IPrompt>(
  {
    name: {
      type: String,
      required: [true, "Prompt name is required"],
      trim: true,
      minlength: [1, "Name must be at least 1 character"],
      maxlength: [200, "Name cannot exceed 200 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    versions: [promptVersionSchema],
    currentVersion: {
      type: Number,
      default: 1,
    },
    tags: [{
      type: String,
      trim: true,
    }],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

promptSchema.index({ projectId: 1 });
promptSchema.index({ organizationId: 1 });
promptSchema.index({ tags: 1 });
promptSchema.index({ name: "text", description: "text" });

// Helper to extract variables from prompt content
promptSchema.statics.extractVariables = function (content: string): string[] {
  const regex = /\{\{([^}]+)\}\}/g;
  const variables: string[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    const varName = match[1].trim();
    if (!variables.includes(varName)) {
      variables.push(varName);
    }
  }
  return variables;
};

const Prompt: PromptModel =
  mongoose.models.Prompt ||
  mongoose.model<IPrompt, PromptModel>("Prompt", promptSchema);

export default Prompt;
