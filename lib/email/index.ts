export * from "./types";
export { emailService, EmailService } from "./service";
export { smtpProvider } from "./providers/smtp";
export { invitationTemplate } from "./templates/invitation";

// Backward-compatible function export
import { emailService } from "./service";
import type { SendInvitationEmailParams } from "./types";

export async function sendInvitationEmail(
  params: SendInvitationEmailParams
): Promise<{ success: boolean; error?: string }> {
  return emailService.sendInvitationEmail(params);
}
