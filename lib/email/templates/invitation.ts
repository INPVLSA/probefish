import type { EmailTemplate, SendInvitationEmailParams } from "../types";

type InvitationContext = Omit<SendInvitationEmailParams, "to">;

export const invitationTemplate: EmailTemplate<InvitationContext> = {
  subject: (ctx) =>
    `${ctx.inviterName} invited you to join ${ctx.organizationName}`,

  html: (ctx) => {
    const expiresFormatted = ctx.expiresAt.toLocaleDateString("en-US", {
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
        <p style="color: #666; margin: 5px 0 0;">A web-based LLM prompt and endpoint testing platform</p>
      </div>

      <div style="background: #f9fafb; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
        <h2 style="margin-top: 0;">You're invited!</h2>
        <p><strong>${ctx.inviterName}</strong> has invited you to join <strong>${ctx.organizationName}</strong> as a <strong>${ctx.role}</strong>.</p>

        ${
          ctx.message
            ? `<div style="background: white; border-left: 4px solid #0070f3; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0; font-style: italic;">"${ctx.message}"</p>
        </div>`
            : ""
        }

        <a href="${ctx.inviteUrl}" style="display: inline-block; background: #0070f3; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 500; margin: 20px 0;">
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
        <a href="${ctx.inviteUrl}" style="color: #999;">${ctx.inviteUrl}</a>
      </p>
    </body>
    </html>
  `;
  },

  text: (ctx) => {
    const expiresFormatted = ctx.expiresAt.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    return `
You're invited to join ${ctx.organizationName}!

${ctx.inviterName} has invited you to join ${ctx.organizationName} as a ${ctx.role}.

${ctx.message ? `Message from ${ctx.inviterName}: "${ctx.message}"\n` : ""}
Accept your invitation: ${ctx.inviteUrl}

This invitation expires on ${expiresFormatted}.

If you didn't expect this invitation, you can safely ignore this email.
    `.trim();
  },
};
