// Email Provider Types

export type EmailProvider = "smtp";

// Core email structure
export interface EmailMessage {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

// Result of sending an email
export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Provider interface - all providers must implement this
export interface EmailProviderInterface {
  name: EmailProvider;
  send(message: EmailMessage, from: string): Promise<EmailSendResult>;
  isConfigured(): boolean;
}

// SMTP-specific configuration
export interface SMTPConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

// Email template interface
export interface EmailTemplate<T> {
  subject: (context: T) => string;
  html: (context: T) => string;
  text?: (context: T) => string;
}

// Invitation email params (preserved for backward compatibility)
export interface SendInvitationEmailParams {
  to: string;
  inviterName: string;
  organizationName: string;
  inviteUrl: string;
  role: string;
  message?: string;
  expiresAt: Date;
}

// Magic link email params
export interface SendMagicLinkEmailParams {
  to: string;
  recipientName: string;
  magicLinkUrl: string;
  isNewUser: boolean;
  organizationName?: string;
  expiresAt: Date;
}
