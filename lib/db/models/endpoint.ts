import mongoose, { Schema, Document, Model } from "mongoose";

export interface IEndpointAuth {
  type: "none" | "bearer" | "apiKey" | "basic";
  token?: string;
  apiKeyHeader?: string;
  apiKey?: string;
  username?: string;
  password?: string;
}

export interface IEndpointConfig {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  headers?: Record<string, string>;
  auth?: IEndpointAuth;
  bodyTemplate?: string;
  contentType?: string;
  responseContentPath?: string;
}

export interface IEndpoint extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  projectId: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  config: IEndpointConfig;
  variables: string[];
  lastTestedAt?: Date;
  lastTestStatus?: "success" | "error";
  lastTestError?: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

type EndpointModel = Model<IEndpoint> & {
  extractVariables: (content: string) => string[];
};

const endpointAuthSchema = new Schema<IEndpointAuth>(
  {
    type: {
      type: String,
      enum: ["none", "bearer", "apiKey", "basic"],
      default: "none",
    },
    token: String,
    apiKeyHeader: String,
    apiKey: String,
    username: String,
    password: String,
  },
  { _id: false }
);

const endpointConfigSchema = new Schema<IEndpointConfig>(
  {
    method: {
      type: String,
      enum: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      required: true,
      default: "POST",
    },
    url: {
      type: String,
      required: [true, "Endpoint URL is required"],
    },
    headers: {
      type: Map,
      of: String,
    },
    auth: endpointAuthSchema,
    bodyTemplate: String,
    contentType: {
      type: String,
      default: "application/json",
    },
    responseContentPath: String,
  },
  { _id: false }
);

const endpointSchema = new Schema<IEndpoint>(
  {
    name: {
      type: String,
      required: [true, "Endpoint name is required"],
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
    config: {
      type: endpointConfigSchema,
      required: true,
    },
    variables: [
      {
        type: String,
      },
    ],
    lastTestedAt: Date,
    lastTestStatus: {
      type: String,
      enum: ["success", "error"],
    },
    lastTestError: String,
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

endpointSchema.index({ projectId: 1 });
endpointSchema.index({ organizationId: 1 });
endpointSchema.index({ name: "text", description: "text" });

// Helper to extract variables from body template
endpointSchema.statics.extractVariables = function (content: string): string[] {
  if (!content) return [];
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

// Pre-save hook to extract variables from bodyTemplate
endpointSchema.pre("save", async function () {
  if (this.config?.bodyTemplate) {
    const regex = /\{\{([^}]+)\}\}/g;
    const variables: string[] = [];
    let match;
    while ((match = regex.exec(this.config.bodyTemplate)) !== null) {
      const varName = match[1].trim();
      if (!variables.includes(varName)) {
        variables.push(varName);
      }
    }
    this.variables = variables;
  } else {
    this.variables = [];
  }
});

const Endpoint: EndpointModel =
  (mongoose.models.Endpoint as EndpointModel) ||
  mongoose.model<IEndpoint, EndpointModel>("Endpoint", endpointSchema);

export default Endpoint;
