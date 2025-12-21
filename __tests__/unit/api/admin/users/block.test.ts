import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock authorization
const mockRequireSuperAdmin = vi.fn();
vi.mock("@/lib/auth/authorization", () => ({
  requireSuperAdmin: () => mockRequireSuperAdmin(),
  authError: (result: { error: string; status: number }) =>
    new Response(JSON.stringify({ error: result.error }), { status: result.status }),
}));

// Mock database
vi.mock("@/lib/db/mongodb", () => ({
  default: vi.fn(() => Promise.resolve()),
}));

// Mock User model
const mockUserFindById = vi.fn();
const mockUserSave = vi.fn();
vi.mock("@/lib/db/models", () => ({
  User: {
    findById: (id: string) => mockUserFindById(id),
  },
}));

import { POST, DELETE } from "@/app/api/admin/users/[userId]/block/route";

describe("User Block API Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createRequest = (body?: object) =>
    new NextRequest("http://localhost:3000/api/admin/users/user-123/block", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });

  const createParams = (userId: string) => ({
    params: Promise.resolve({ userId }),
  });

  describe("POST /api/admin/users/[userId]/block", () => {
    it("should return 401 when not authorized", async () => {
      mockRequireSuperAdmin.mockResolvedValueOnce({
        authorized: false,
        error: "Unauthorized",
        status: 401,
      });

      const request = createRequest();
      const response = await POST(request, createParams("user-123"));
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("should return 403 when trying to block yourself", async () => {
      mockRequireSuperAdmin.mockResolvedValueOnce({
        authorized: true,
        context: { user: { id: "user-123" } },
      });

      const request = createRequest();
      const response = await POST(request, createParams("user-123"));
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("Cannot block yourself");
    });

    it("should return 404 when user not found", async () => {
      mockRequireSuperAdmin.mockResolvedValueOnce({
        authorized: true,
        context: { user: { id: "admin-123" } },
      });
      mockUserFindById.mockResolvedValueOnce(null);

      const request = createRequest();
      const response = await POST(request, createParams("user-123"));
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("User not found");
    });

    it("should return 400 when user is already blocked", async () => {
      mockRequireSuperAdmin.mockResolvedValueOnce({
        authorized: true,
        context: { user: { id: "admin-123" } },
      });
      mockUserFindById.mockResolvedValueOnce({
        _id: { toString: () => "user-123" },
        email: "user@example.com",
        name: "Test User",
        isBlocked: true,
      });

      const request = createRequest();
      const response = await POST(request, createParams("user-123"));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("User is already blocked");
    });

    it("should block user successfully", async () => {
      mockRequireSuperAdmin.mockResolvedValueOnce({
        authorized: true,
        context: { user: { id: "admin-123" } },
      });
      const mockUser = {
        _id: { toString: () => "user-123" },
        email: "user@example.com",
        name: "Test User",
        isBlocked: false,
        save: mockUserSave,
      };
      mockUserFindById.mockResolvedValueOnce(mockUser);
      mockUserSave.mockResolvedValueOnce(mockUser);

      const request = createRequest({ reason: "Violation of terms" });
      const response = await POST(request, createParams("user-123"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("User blocked");
      expect(data.user.isBlocked).toBe(true);
      expect(mockUser.isBlocked).toBe(true);
      expect(mockUser.blockedReason).toBe("Violation of terms");
    });

    it("should block user without reason", async () => {
      mockRequireSuperAdmin.mockResolvedValueOnce({
        authorized: true,
        context: { user: { id: "admin-123" } },
      });
      const mockUser = {
        _id: { toString: () => "user-123" },
        email: "user@example.com",
        name: "Test User",
        isBlocked: false,
        save: mockUserSave,
      };
      mockUserFindById.mockResolvedValueOnce(mockUser);
      mockUserSave.mockResolvedValueOnce(mockUser);

      const request = createRequest();
      const response = await POST(request, createParams("user-123"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("User blocked");
      expect(mockUser.isBlocked).toBe(true);
    });
  });

  describe("DELETE /api/admin/users/[userId]/block", () => {
    const createDeleteRequest = () =>
      new NextRequest("http://localhost:3000/api/admin/users/user-123/block", {
        method: "DELETE",
      });

    it("should return 401 when not authorized", async () => {
      mockRequireSuperAdmin.mockResolvedValueOnce({
        authorized: false,
        error: "Unauthorized",
        status: 401,
      });

      const request = createDeleteRequest();
      const response = await DELETE(request, createParams("user-123"));
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("should return 404 when user not found", async () => {
      mockRequireSuperAdmin.mockResolvedValueOnce({
        authorized: true,
        context: { user: { id: "admin-123" } },
      });
      mockUserFindById.mockResolvedValueOnce(null);

      const request = createDeleteRequest();
      const response = await DELETE(request, createParams("user-123"));
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("User not found");
    });

    it("should return 400 when user is not blocked", async () => {
      mockRequireSuperAdmin.mockResolvedValueOnce({
        authorized: true,
        context: { user: { id: "admin-123" } },
      });
      mockUserFindById.mockResolvedValueOnce({
        _id: { toString: () => "user-123" },
        email: "user@example.com",
        name: "Test User",
        isBlocked: false,
      });

      const request = createDeleteRequest();
      const response = await DELETE(request, createParams("user-123"));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("User is not blocked");
    });

    it("should unblock user successfully", async () => {
      mockRequireSuperAdmin.mockResolvedValueOnce({
        authorized: true,
        context: { user: { id: "admin-123" } },
      });
      const mockUser = {
        _id: { toString: () => "user-123" },
        email: "user@example.com",
        name: "Test User",
        isBlocked: true,
        blockedAt: new Date(),
        blockedReason: "Test reason",
        save: mockUserSave,
      };
      mockUserFindById.mockResolvedValueOnce(mockUser);
      mockUserSave.mockResolvedValueOnce(mockUser);

      const request = createDeleteRequest();
      const response = await DELETE(request, createParams("user-123"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("User unblocked");
      expect(data.user.isBlocked).toBe(false);
      expect(mockUser.isBlocked).toBe(false);
      expect(mockUser.blockedAt).toBeUndefined();
      expect(mockUser.blockedReason).toBeUndefined();
    });
  });
});
