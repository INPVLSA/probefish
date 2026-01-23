import type { EmailTemplate, SendMagicLinkEmailParams } from "../types";

type MagicLinkContext = Omit<SendMagicLinkEmailParams, "to">;

export const magicLinkTemplate: EmailTemplate<MagicLinkContext> = {
  subject: (ctx) =>
    ctx.isNewUser
      ? "Welcome to Probefish! Access your account"
      : "Your Probefish login link",

  html: (ctx) => {
    const expiresFormatted = ctx.expiresAt.toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #0070f3; margin: 0;">Probefish</h1>
        <p style="color: #666; margin: 5px 0 0;">LLM Testing Platform</p>
      </div>

      <div style="background: #f9fafb; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
        ${
          ctx.isNewUser
            ? `
        <h2 style="margin-top: 0;">Welcome to Probefish, ${ctx.recipientName}!</h2>
        <p>Your Pro subscription is now active. Your workspace <strong>${ctx.organizationName}</strong> is ready to go.</p>
        <p>Click the button below to access your account:</p>
        `
            : `
        <h2 style="margin-top: 0;">Hello ${ctx.recipientName}!</h2>
        <p>Click the button below to log in to your Probefish account:</p>
        `
        }

        <a href="${ctx.magicLinkUrl}" style="display: inline-block; background: #0070f3; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 500; margin: 20px 0;">
          ${ctx.isNewUser ? "Access Your Account" : "Log In"}
        </a>

        <p style="color: #666; font-size: 14px;">
          This link expires on ${expiresFormatted}.
        </p>
      </div>

      <p style="color: #999; font-size: 12px; text-align: center;">
        If you didn't request this, you can safely ignore this email.
      </p>

      <p style="color: #999; font-size: 12px; text-align: center;">
        <a href="${ctx.magicLinkUrl}" style="color: #999;">${ctx.magicLinkUrl}</a>
      </p>
    </body>
    </html>
  `;
  },

  text: (ctx) => {
    const expiresFormatted = ctx.expiresAt.toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    if (ctx.isNewUser) {
      return `
Welcome to Probefish, ${ctx.recipientName}!

Your Pro subscription is now active. Your workspace "${ctx.organizationName}" is ready to go.

Access your account: ${ctx.magicLinkUrl}

This link expires on ${expiresFormatted}.

If you didn't request this, you can safely ignore this email.
      `.trim();
    }

    return `
Hello ${ctx.recipientName}!

Log in to your Probefish account: ${ctx.magicLinkUrl}

This link expires on ${expiresFormatted}.

If you didn't request this, you can safely ignore this email.
    `.trim();
  },
};
