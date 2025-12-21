import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock database
vi.mock("@/lib/db/mongodb", () => ({
  default: vi.fn(() => Promise.resolve()),
}));

// Mock session
const mockCreateSession = vi.fn();
vi.mock("@/lib/auth/session", () => ({
  createSession: (data: unknown) => mockCreateSession(data),
}));

// Mock User model
const mockUserFindOne = vi.fn();
const mockUserSave = vi.fn();
vi.mock("@/lib/db/models", () => ({
  User: {
    findOne: (query: unknown) => mockUserFindOne(query),
  },
}));

import { POST } from "@/app/api/auth/login/route";

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createRequest = (body: object) =>
    new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  describe("validation", () => {
    it("should return 400 for invalid email format", async () => {
      const request = createRequest({
        email: "not-an-email",
        password: "password123",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Validation failed");
    });

    it("should return 400 for missing email", async () => {
      const request = createRequest({
        password: "password123",
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it("should return 400 for missing password", async () => {
      const request = createRequest({
        email: "test@example.com",
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });
  });

  describe("authentication", () => {
    it("should return 401 for non-existent user", async () => {
      mockUserFindOne.mockResolvedValueOnce(null);

      const request = createRequest({
        email: "unknown@example.com",
        password: "password123",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Invalid email or password");
    });

    it("should return 401 for invalid password", async () => {
      mockUserFindOne.mockResolvedValueOnce({
        _id: { toString: () => "user-123" },
        email: "test@example.com",
        name: "Test User",
        isSuperAdmin: false,
        isBlocked: false,
        comparePassword: vi.fn().mockResolvedValue(false),
        save: mockUserSave,
      });

      const request = createRequest({
        email: "test@example.com",
        password: "wrongpassword",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Invalid email or password");
    });

    it("should login successfully with valid credentials", async () => {
      const mockUser = {
        _id: { toString: () => "user-123" },
        email: "test@example.com",
        name: "Test User",
        isSuperAdmin: false,
        isBlocked: false,
        comparePassword: vi.fn().mockResolvedValue(true),
        save: mockUserSave,
      };
      mockUserFindOne.mockResolvedValueOnce(mockUser);
      mockUserSave.mockResolvedValueOnce(mockUser);
      mockCreateSession.mockResolvedValueOnce(undefined);

      const request = createRequest({
        email: "test@example.com",
        password: "password123",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("Login successful");
      expect(data.user.id).toBe("user-123");
      expect(data.user.email).toBe("test@example.com");
    });
  });

  describe("blocked user", () => {
    it("should return 403 for blocked user", async () => {
      mockUserFindOne.mockResolvedValueOnce({
        _id: { toString: () => "user-123" },
        email: "blocked@example.com",
        name: "Blocked User",
        isSuperAdmin: false,
        isBlocked: true,
        blockedAt: new Date(),
        blockedReason: "Violation of terms",
        comparePassword: vi.fn().mockResolvedValue(true),
        save: mockUserSave,
      });

      const request = createRequest({
        email: "blocked@example.com",
        password: "password123",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("Your account has been blocked. Please contact support.");
    });

    it("should not update lastLoginAt for blocked user", async () => {
      const mockUser = {
        _id: { toString: () => "user-123" },
        email: "blocked@example.com",
        name: "Blocked User",
        isSuperAdmin: false,
        isBlocked: true,
        comparePassword: vi.fn().mockResolvedValue(true),
        save: mockUserSave,
      };
      mockUserFindOne.mockResolvedValueOnce(mockUser);

      const request = createRequest({
        email: "blocked@example.com",
        password: "password123",
      });

      await POST(request);

      expect(mockUserSave).not.toHaveBeenCalled();
    });

    it("should not create session for blocked user", async () => {
      mockUserFindOne.mockResolvedValueOnce({
        _id: { toString: () => "user-123" },
        email: "blocked@example.com",
        name: "Blocked User",
        isSuperAdmin: false,
        isBlocked: true,
        comparePassword: vi.fn().mockResolvedValue(true),
        save: mockUserSave,
      });

      const request = createRequest({
        email: "blocked@example.com",
        password: "password123",
      });

      await POST(request);

      expect(mockCreateSession).not.toHaveBeenCalled();
    });
  });

  describe("super admin", () => {
    it("should return isSuperAdmin flag for super admin users", async () => {
      const mockUser = {
        _id: { toString: () => "admin-123" },
        email: "admin@example.com",
        name: "Admin User",
        isSuperAdmin: true,
        isBlocked: false,
        comparePassword: vi.fn().mockResolvedValue(true),
        save: mockUserSave,
      };
      mockUserFindOne.mockResolvedValueOnce(mockUser);
      mockUserSave.mockResolvedValueOnce(mockUser);
      mockCreateSession.mockResolvedValueOnce(undefined);

      const request = createRequest({
        email: "admin@example.com",
        password: "admin123",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.user.isSuperAdmin).toBe(true);
    });
  });
});
