import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import type {
  EmailProviderInterface,
  EmailMessage,
  EmailSendResult,
  SMTPConfig,
} from "../types";

export class SMTPProvider implements EmailProviderInterface {
  name = "smtp" as const;
  private transporter: Transporter | null = null;

  private getConfig(): SMTPConfig | null {
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !port || !user || !pass) {
      return null;
    }

    return {
      host,
      port: parseInt(port, 10),
      secure: process.env.SMTP_SECURE === "true",
      auth: { user, pass },
    };
  }

  private getTransporter(): Transporter | null {
    if (this.transporter) {
      return this.transporter;
    }

    const config = this.getConfig();
    if (!config) {
      return null;
    }

    this.transporter = nodemailer.createTransport(config);
    return this.transporter;
  }

  isConfigured(): boolean {
    return this.getConfig() !== null;
  }

  async send(message: EmailMessage, from: string): Promise<EmailSendResult> {
    const transporter = this.getTransporter();

    if (!transporter) {
      return {
        success: false,
        error: "SMTP not configured",
      };
    }

    try {
      const result = await transporter.sendMail({
        from,
        to: Array.isArray(message.to) ? message.to.join(", ") : message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });

      return {
        success: true,
        messageId: result.messageId,
      };
    } catch (error) {
      console.error("SMTP send error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to send email",
      };
    }
  }
}

export const smtpProvider = new SMTPProvider();
