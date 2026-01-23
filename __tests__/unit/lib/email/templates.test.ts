import { describe, it, expect } from "vitest";
import { invitationTemplate } from "@/lib/email/templates/invitation";

describe("Invitation Template", () => {
  const baseContext = {
    inviterName: "John Doe",
    organizationName: "Acme Corp",
    inviteUrl: "https://example.com/invite/abc123",
    role: "member",
    expiresAt: new Date("2025-06-15"),
  };

  describe("subject", () => {
    it("should generate correct subject line", () => {
      const subject = invitationTemplate.subject(baseContext);
      expect(subject).toBe("John Doe invited you to join Acme Corp");
    });

    it("should include inviter name", () => {
      const context = { ...baseContext, inviterName: "Jane Smith" };
      const subject = invitationTemplate.subject(context);
      expect(subject).toContain("Jane Smith");
    });

    it("should include organization name", () => {
      const context = { ...baseContext, organizationName: "Test Org" };
      const subject = invitationTemplate.subject(context);
      expect(subject).toContain("Test Org");
    });
  });

  describe("html", () => {
    it("should include inviter name", () => {
      const html = invitationTemplate.html(baseContext);
      expect(html).toContain("John Doe");
    });

    it("should include organization name", () => {
      const html = invitationTemplate.html(baseContext);
      expect(html).toContain("Acme Corp");
    });

    it("should include role", () => {
      const html = invitationTemplate.html(baseContext);
      expect(html).toContain("member");
    });

    it("should include invite URL", () => {
      const html = invitationTemplate.html(baseContext);
      expect(html).toContain("https://example.com/invite/abc123");
    });

    it("should include Accept Invitation button", () => {
      const html = invitationTemplate.html(baseContext);
      expect(html).toContain("Accept Invitation");
    });

    it("should include Probefish branding", () => {
      const html = invitationTemplate.html(baseContext);
      expect(html).toContain("Probefish");
    });

    it("should include personal message when provided", () => {
      const context = { ...baseContext, message: "Welcome to the team!" };
      const html = invitationTemplate.html(context);
      expect(html).toContain("Welcome to the team!");
    });

    it("should not include message block when message is empty", () => {
      const html = invitationTemplate.html(baseContext);
      expect(html).not.toContain("font-style: italic");
    });

    it("should include expiration date", () => {
      const html = invitationTemplate.html(baseContext);
      // Date format: "Sunday, June 15, 2025"
      expect(html).toContain("June");
      expect(html).toContain("2025");
    });
  });

  describe("text", () => {
    it("should generate plain text version", () => {
      const text = invitationTemplate.text!(baseContext);
      expect(text).toBeDefined();
    });

    it("should include inviter name", () => {
      const text = invitationTemplate.text!(baseContext);
      expect(text).toContain("John Doe");
    });

    it("should include organization name", () => {
      const text = invitationTemplate.text!(baseContext);
      expect(text).toContain("Acme Corp");
    });

    it("should include invite URL", () => {
      const text = invitationTemplate.text!(baseContext);
      expect(text).toContain("https://example.com/invite/abc123");
    });

    it("should include role", () => {
      const text = invitationTemplate.text!(baseContext);
      expect(text).toContain("member");
    });

    it("should include personal message when provided", () => {
      const context = { ...baseContext, message: "Looking forward to working with you!" };
      const text = invitationTemplate.text!(context);
      expect(text).toContain("Looking forward to working with you!");
    });

    it("should not include message line when message is empty", () => {
      const text = invitationTemplate.text!(baseContext);
      expect(text).not.toContain('Message from');
    });
  });
});
