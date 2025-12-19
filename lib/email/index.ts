import { Resend } from "resend";

// Lazy initialization to avoid errors during build
let resend: Resend | null = null;

function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    return null;
  }
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

export interface SendInvitationEmailParams {
  to: string;
  inviterName: string;
  organizationName: string;
  inviteUrl: string;
  role: string;
  message?: string;
  expiresAt: Date;
}

export async function sendInvitationEmail({
  to,
  inviterName,
  organizationName,
  inviteUrl,
  role,
  message,
  expiresAt,
}: SendInvitationEmailParams): Promise<{ success: boolean; error?: string }> {
  const client = getResendClient();

  // Skip email sending if no API key configured
  if (!client) {
    console.warn("RESEND_API_KEY not configured, skipping email send");
    return { success: true };
  }

  try {
    const { error } = await client.emails.send({
      from: process.env.EMAIL_FROM || "Probefish <onboarding@resend.dev>",
      to: [to],
      subject: `${inviterName} invited you to join ${organizationName}`,
      html: generateInvitationEmailHtml({
        inviterName,
        organizationName,
        inviteUrl,
        role,
        message,
        expiresAt,
      }),
    });

    if (error) {
      console.error("Failed to send invitation email:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Email service error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send email",
    };
  }
}

function generateInvitationEmailHtml(
  params: Omit<SendInvitationEmailParams, "to">
): string {
  const { inviterName, organizationName, inviteUrl, role, message, expiresAt } =
    params;
  const expiresFormatted = expiresAt.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
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
        <p style="color: #666; margin: 5px 0 0;">LLM Prompt Testing Platform</p>
      </div>

      <div style="background: #f9fafb; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
        <h2 style="margin-top: 0;">You're invited!</h2>
        <p><strong>${inviterName}</strong> has invited you to join <strong>${organizationName}</strong> as a <strong>${role}</strong>.</p>

        ${
          message
            ? `<div style="background: white; border-left: 4px solid #0070f3; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0; font-style: italic;">"${message}"</p>
        </div>`
            : ""
        }

        <a href="${inviteUrl}" style="display: inline-block; background: #0070f3; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 500; margin: 20px 0;">
          Accept Invitation
        </a>

        <p style="color: #666; font-size: 14px;">
          This invitation expires on ${expiresFormatted}.
        </p>
      </div>

      <p style="color: #999; font-size: 12px; text-align: center;">
        If you didn't expect this invitation, you can safely ignore this email.
      </p>

      <p style="color: #999; font-size: 12px; text-align: center;">
        <a href="${inviteUrl}" style="color: #999;">${inviteUrl}</a>
      </p>
    </body>
    </html>
  `;
}
