import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/email/providers/smtp", () => ({
  smtpProvider: {
    name: "smtp",
    isConfigured: vi.fn(),
    send: vi.fn(),
  },
}));

import { emailService } from "@/lib/email/service";
import { smtpProvider } from "@/lib/email/providers/smtp";

describe("EmailService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getProviders", () => {
    it("should return all supported providers", () => {
      const providers = emailService.getProviders();
      expect(providers).toContain("smtp");
      expect(providers).toHaveLength(1);
    });
  });

  describe("isConfigured", () => {
    it("should return true when provider is configured", () => {
      vi.mocked(smtpProvider.isConfigured).mockReturnValue(true);
      expect(emailService.isConfigured()).toBe(true);
    });

    it("should return false when provider is not configured", () => {
      vi.mocked(smtpProvider.isConfigured).mockReturnValue(false);
      expect(emailService.isConfigured()).toBe(false);
    });
  });

  describe("send", () => {
    it("should return success when provider not configured (graceful degradation)", async () => {
      vi.mocked(smtpProvider.isConfigured).mockReturnValue(false);

      const result = await emailService.send({
        to: "test@example.com",
        subject: "Test",
        html: "<p>Test</p>",
      });

      expect(result.success).toBe(true);
      expect(smtpProvider.send).not.toHaveBeenCalled();
    });

    it("should call provider.send when configured", async () => {
      vi.mocked(smtpProvider.isConfigured).mockReturnValue(true);
      vi.mocked(smtpProvider.send).mockResolvedValue({
        success: true,
        messageId: "msg-123",
      });

      const result = await emailService.send({
        to: "test@example.com",
        subject: "Test",
        html: "<p>Test</p>",
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe("msg-123");
      expect(smtpProvider.send).toHaveBeenCalled();
    });

    it("should pass email message to provider", async () => {
      vi.mocked(smtpProvider.isConfigured).mockReturnValue(true);
      vi.mocked(smtpProvider.send).mockResolvedValue({ success: true });

      await emailService.send({
        to: "test@example.com",
        subject: "Test Subject",
        html: "<p>Test HTML</p>",
        text: "Test text",
      });

      expect(smtpProvider.send).toHaveBeenCalledWith(
        {
          to: "test@example.com",
          subject: "Test Subject",
          html: "<p>Test HTML</p>",
          text: "Test text",
        },
        expect.any(String)
      );
    });
  });

  describe("sendInvitationEmail", () => {
    it("should format invitation email correctly", async () => {
      vi.mocked(smtpProvider.isConfigured).mockReturnValue(true);
      vi.mocked(smtpProvider.send).mockResolvedValue({ success: true });

      await emailService.sendInvitationEmail({
        to: "invitee@example.com",
        inviterName: "John Doe",
        organizationName: "Acme Corp",
        inviteUrl: "https://example.com/invite/abc123",
        role: "member",
        expiresAt: new Date("2025-01-01"),
      });

      expect(smtpProvider.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "invitee@example.com",
          subject: "John Doe invited you to join Acme Corp",
          html: expect.stringContaining("Acme Corp"),
        }),
        expect.any(String)
      );
    });

    it("should include optional message in email", async () => {
      vi.mocked(smtpProvider.isConfigured).mockReturnValue(true);
      vi.mocked(smtpProvider.send).mockResolvedValue({ success: true });

      await emailService.sendInvitationEmail({
        to: "invitee@example.com",
        inviterName: "John Doe",
        organizationName: "Acme Corp",
        inviteUrl: "https://example.com/invite/abc123",
        role: "admin",
        message: "Welcome to the team!",
        expiresAt: new Date("2025-01-01"),
      });

      expect(smtpProvider.send).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining("Welcome to the team!"),
        }),
        expect.any(String)
      );
    });
  });
});
