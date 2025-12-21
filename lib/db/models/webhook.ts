import mongoose, { Schema, Document, Model } from "mongoose";

export type WebhookEvent =
  | "test.run.completed"
  | "test.run.failed"
  | "test.regression.detected";

export type WebhookStatus = "active" | "inactive" | "failed";

export interface IWebhookDelivery {
  _id: mongoose.Types.ObjectId;
  event: WebhookEvent;
  payload: Record<string, unknown>;
  statusCode?: number;
  response?: string;
  error?: string;
  deliveredAt: Date;
  duration: number; // ms
  success: boolean;
}

export interface IWebhook extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  projectId: mongoose.Types.ObjectId;
  url: string;
  secret?: string; // For HMAC signature verification
  events: WebhookEvent[];
  status: WebhookStatus;
  headers?: Record<string, string>; // Custom headers
  // Filters
  suiteIds?: mongoose.Types.ObjectId[]; // Empty = all suites
  onlyOnFailure?: boolean; // Only trigger when tests fail
  onlyOnRegression?: boolean; // Only trigger when regression detected
  // Retry config
  retryCount: number;
  retryDelayMs: number;
  // Stats
  lastDelivery?: Date;
  lastSuccess?: Date;
  lastFailure?: Date;
  consecutiveFailures: number;
  deliveryHistory: IWebhookDelivery[];
  // Metadata
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

type WebhookModel = Model<IWebhook>;

const webhookDeliverySchema = new Schema<IWebhookDelivery>(
  {
    event: {
      type: String,
      enum: ["test.run.completed", "test.run.failed", "test.regression.detected"],
      required: true,
    },
    payload: {
      type: Schema.Types.Mixed,
      required: true,
    },
    statusCode: Number,
    response: String,
    error: String,
    deliveredAt: {
      type: Date,
      required: true,
    },
    duration: {
      type: Number,
      required: true,
    },
    success: {
      type: Boolean,
      required: true,
    },
  },
  { _id: true }
);

const webhookSchema = new Schema<IWebhook>(
  {
    name: {
      type: String,
      required: [true, "Webhook name is required"],
      trim: true,
      minlength: [1, "Name must be at least 1 character"],
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    url: {
      type: String,
      required: [true, "Webhook URL is required"],
      trim: true,
      validate: {
        validator: function (v: string) {
          try {
            const url = new URL(v);
            return url.protocol === "https:" || url.protocol === "http:";
          } catch {
            return false;
          }
        },
        message: "Invalid URL format",
      },
    },
    secret: {
      type: String,
      trim: true,
    },
    events: {
      type: [String],
      enum: ["test.run.completed", "test.run.failed", "test.regression.detected"],
      required: true,
      validate: {
        validator: function (v: string[]) {
          return v.length > 0;
        },
        message: "At least one event must be selected",
      },
    },
    status: {
      type: String,
      enum: ["active", "inactive", "failed"],
      default: "active",
    },
    headers: {
      type: Map,
      of: String,
      default: {},
    },
    suiteIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "TestSuite",
      },
    ],
    onlyOnFailure: {
      type: Boolean,
      default: false,
    },
    onlyOnRegression: {
      type: Boolean,
      default: false,
    },
    retryCount: {
      type: Number,
      default: 3,
      min: 0,
      max: 5,
    },
    retryDelayMs: {
      type: Number,
      default: 1000,
      min: 100,
      max: 60000,
    },
    lastDelivery: Date,
    lastSuccess: Date,
    lastFailure: Date,
    consecutiveFailures: {
      type: Number,
      default: 0,
    },
    deliveryHistory: {
      type: [webhookDeliverySchema],
      default: [],
    },
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

// Indexes
webhookSchema.index({ projectId: 1 });
webhookSchema.index({ projectId: 1, status: 1 });
webhookSchema.index({ projectId: 1, events: 1 });

// Limit delivery history to last 50 entries
webhookSchema.pre("save", async function () {
  if (this.deliveryHistory && this.deliveryHistory.length > 50) {
    this.deliveryHistory = this.deliveryHistory.slice(-50);
  }
});

const Webhook: WebhookModel =
  mongoose.models.Webhook ||
  mongoose.model<IWebhook, WebhookModel>("Webhook", webhookSchema);

export default Webhook;
