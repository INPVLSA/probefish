import type {
  EmailProvider,
  EmailProviderInterface,
  EmailMessage,
  EmailSendResult,
  SendInvitationEmailParams,
} from "./types";
import { smtpProvider } from "./providers/smtp";
import { invitationTemplate } from "./templates/invitation";

export class EmailService {
  private getProvider(provider: EmailProvider): EmailProviderInterface {
    switch (provider) {
      case "smtp":
        return smtpProvider;
      default:
        throw new Error(`Unknown email provider: ${provider}`);
    }
  }

  private getDefaultProvider(): EmailProvider {
    const provider = process.env.EMAIL_PROVIDER as EmailProvider;
    return provider || "smtp";
  }

  private getFromAddress(): string {
    return process.env.EMAIL_FROM || "Probefish <noreply@probefish.io>";
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const provider = this.getProvider(this.getDefaultProvider());

    if (!provider.isConfigured()) {
      console.warn(
        `Email provider ${provider.name} not configured, skipping email send`
      );
      return { success: true };
    }

    return provider.send(message, this.getFromAddress());
  }

  async sendInvitationEmail(
    params: SendInvitationEmailParams
  ): Promise<EmailSendResult> {
    const message: EmailMessage = {
      to: params.to,
      subject: invitationTemplate.subject(params),
      html: invitationTemplate.html(params),
      text: invitationTemplate.text?.(params),
    };

    return this.send(message);
  }

  isConfigured(): boolean {
    const provider = this.getProvider(this.getDefaultProvider());
    return provider.isConfigured();
  }

  getProviders(): EmailProvider[] {
    return ["smtp"];
  }
}

export const emailService = new EmailService();
