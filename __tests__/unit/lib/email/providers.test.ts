import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: vi.fn(),
    })),
  },
}));

import nodemailer from "nodemailer";
import { SMTPProvider } from "@/lib/email/providers/smtp";

describe("SMTPProvider", () => {
  const originalEnv = { ...process.env };
  let provider: SMTPProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    // Create fresh instance for each test
    provider = new SMTPProvider();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("name", () => {
    it("should have correct provider name", () => {
      expect(provider.name).toBe("smtp");
    });
  });

  describe("isConfigured", () => {
    it("should return false when SMTP_HOST is not set", () => {
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_PORT;
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;

      expect(provider.isConfigured()).toBe(false);
    });

    it("should return false when SMTP_PORT is not set", () => {
      process.env.SMTP_HOST = "smtp.example.com";
      delete process.env.SMTP_PORT;
      process.env.SMTP_USER = "user";
      process.env.SMTP_PASS = "pass";

      expect(provider.isConfigured()).toBe(false);
    });

    it("should return false when SMTP_USER is not set", () => {
      process.env.SMTP_HOST = "smtp.example.com";
      process.env.SMTP_PORT = "587";
      delete process.env.SMTP_USER;
      process.env.SMTP_PASS = "pass";

      expect(provider.isConfigured()).toBe(false);
    });

    it("should return false when SMTP_PASS is not set", () => {
      process.env.SMTP_HOST = "smtp.example.com";
      process.env.SMTP_PORT = "587";
      process.env.SMTP_USER = "user";
      delete process.env.SMTP_PASS;

      expect(provider.isConfigured()).toBe(false);
    });

    it("should return true when all SMTP vars are set", () => {
      process.env.SMTP_HOST = "smtp.example.com";
      process.env.SMTP_PORT = "587";
      process.env.SMTP_USER = "user";
      process.env.SMTP_PASS = "pass";

      expect(provider.isConfigured()).toBe(true);
    });
  });

  describe("send", () => {
    it("should return error when not configured", async () => {
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_PORT;
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;

      const result = await provider.send(
        { to: "test@example.com", subject: "Test", html: "<p>Test</p>" },
        "from@example.com"
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("SMTP not configured");
    });

    it("should send email via nodemailer when configured", async () => {
      process.env.SMTP_HOST = "smtp.example.com";
      process.env.SMTP_PORT = "587";
      process.env.SMTP_USER = "user";
      process.env.SMTP_PASS = "pass";

      const mockSendMail = vi.fn().mockResolvedValue({ messageId: "msg-123" });
      vi.mocked(nodemailer.createTransport).mockReturnValue({
        sendMail: mockSendMail,
      } as unknown as ReturnType<typeof nodemailer.createTransport>);

      const result = await provider.send(
        { to: "test@example.com", subject: "Test", html: "<p>Test</p>" },
        "from@example.com"
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBe("msg-123");
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: "from@example.com",
          to: "test@example.com",
          subject: "Test",
          html: "<p>Test</p>",
        })
      );
    });

    it("should handle array of recipients", async () => {
      process.env.SMTP_HOST = "smtp.example.com";
      process.env.SMTP_PORT = "587";
      process.env.SMTP_USER = "user";
      process.env.SMTP_PASS = "pass";

      const mockSendMail = vi.fn().mockResolvedValue({ messageId: "msg-123" });
      vi.mocked(nodemailer.createTransport).mockReturnValue({
        sendMail: mockSendMail,
      } as unknown as ReturnType<typeof nodemailer.createTransport>);

      await provider.send(
        {
          to: ["test1@example.com", "test2@example.com"],
          subject: "Test",
          html: "<p>Test</p>",
        },
        "from@example.com"
      );

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "test1@example.com, test2@example.com",
        })
      );
    });

    it("should handle send errors gracefully", async () => {
      process.env.SMTP_HOST = "smtp.example.com";
      process.env.SMTP_PORT = "587";
      process.env.SMTP_USER = "user";
      process.env.SMTP_PASS = "pass";

      const mockSendMail = vi
        .fn()
        .mockRejectedValue(new Error("Connection failed"));
      vi.mocked(nodemailer.createTransport).mockReturnValue({
        sendMail: mockSendMail,
      } as unknown as ReturnType<typeof nodemailer.createTransport>);

      const result = await provider.send(
        { to: "test@example.com", subject: "Test", html: "<p>Test</p>" },
        "from@example.com"
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Connection failed");
    });

    it("should create transporter with correct config", async () => {
      process.env.SMTP_HOST = "smtp.example.com";
      process.env.SMTP_PORT = "465";
      process.env.SMTP_SECURE = "true";
      process.env.SMTP_USER = "myuser";
      process.env.SMTP_PASS = "mypass";

      const mockSendMail = vi.fn().mockResolvedValue({ messageId: "msg-123" });
      vi.mocked(nodemailer.createTransport).mockReturnValue({
        sendMail: mockSendMail,
      } as unknown as ReturnType<typeof nodemailer.createTransport>);

      await provider.send(
        { to: "test@example.com", subject: "Test", html: "<p>Test</p>" },
        "from@example.com"
      );

      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: "smtp.example.com",
        port: 465,
        secure: true,
        auth: {
          user: "myuser",
          pass: "mypass",
        },
      });
    });
  });
});
