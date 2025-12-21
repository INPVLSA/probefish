import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock bcrypt
const mockBcryptCompare = vi.fn();
vi.mock("bcryptjs", () => ({
  default: {
    compare: (password: string, hash: string) => mockBcryptCompare(password, hash),
  },
}));

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

// Mock User model - handle both findById().select() and direct findById()
const mockUserSave = vi.fn();
let findByIdCallCount = 0;
const mockFindByIdResults: unknown[] = [];

vi.mock("@/lib/db/models", () => ({
  User: {
    findById: () => {
      const result = mockFindByIdResults[findByIdCallCount++];
      return {
        select: () => Promise.resolve(result),
        then: (resolve: (value: unknown) => void) => Promise.resolve(result).then(resolve),
      };
    },
  },
}));

import { POST, DELETE } from "@/app/api/admin/users/[userId]/super-admin/route";

describe("Super Admin API Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findByIdCallCount = 0;
    mockFindByIdResults.length = 0;
  });

  const createRequest = (body?: object) =>
    new NextRequest("http://localhost:3000/api/admin/users/user-123/super-admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : JSON.stringify({}),
    });

  const createParams = (userId: string) => ({
    params: Promise.resolve({ userId }),
  });

  describe("POST /api/admin/users/[userId]/super-admin - Grant Super Admin", () => {
    it("should return 401 when not authorized", async () => {
      mockRequireSuperAdmin.mockResolvedValueOnce({
        authorized: false,
        error: "Unauthorized",
        status: 401,
      });

      const request = createRequest({ password: "password123" });
      const response = await POST(request, createParams("user-123"));
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("should return 400 when password is missing", async () => {
      mockRequireSuperAdmin.mockResolvedValueOnce({
        authorized: true,
        context: { user: { id: "admin-123" } },
      });

      const request = createRequest({});
      const response = await POST(request, createParams("user-123"));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Password is required to grant super admin status");
    });

    it("should return 400 when current admin not found", async () => {
      mockRequireSuperAdmin.mockResolvedValueOnce({
        authorized: true,
        context: { user: { id: "admin-123" } },
      });
      mockFindByIdResults.push(null); // First findById for admin returns null

      const request = createRequest({ password: "password123" });
      const response = await POST(request, createParams("user-123"));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Unable to verify credentials");
    });

    it("should return 401 when password is invalid", async () => {
      mockRequireSuperAdmin.mockResolvedValueOnce({
        authorized: true,
        context: { user: { id: "admin-123" } },
      });
      mockFindByIdResults.push({
        _id: { toString: () => "admin-123" },
        passwordHash: "hashed_password",
      });
      mockBcryptCompare.mockResolvedValueOnce(false);

      const request = createRequest({ password: "wrongpassword" });
      const response = await POST(request, createParams("user-123"));
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Invalid password");
    });

    it("should return 404 when target user not found", async () => {
      mockRequireSuperAdmin.mockResolvedValueOnce({
        authorized: true,
        context: { user: { id: "admin-123" } },
      });
      mockFindByIdResults.push({
        _id: { toString: () => "admin-123" },
        passwordHash: "hashed_password",
      });
      mockFindByIdResults.push(null); // Second findById for target user returns null
      mockBcryptCompare.mockResolvedValueOnce(true);

      const request = createRequest({ password: "password123" });
      const response = await POST(request, createParams("user-123"));
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("User not found");
    });

    it("should return 400 when user is already super admin", async () => {
      mockRequireSuperAdmin.mockResolvedValueOnce({
        authorized: true,
        context: { user: { id: "admin-123" } },
      });
      mockFindByIdResults.push({
        _id: { toString: () => "admin-123" },
        passwordHash: "hashed_password",
      });
      mockFindByIdResults.push({
        _id: { toString: () => "user-123" },
        email: "user@example.com",
        name: "Test User",
        isSuperAdmin: true,
        save: mockUserSave,
      });
      mockBcryptCompare.mockResolvedValueOnce(true);

      const request = createRequest({ password: "password123" });
      const response = await POST(request, createParams("user-123"));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("User is already a super admin");
    });

    it("should grant super admin successfully with valid password", async () => {
      mockRequireSuperAdmin.mockResolvedValueOnce({
        authorized: true,
        context: { user: { id: "admin-123" } },
      });
      const mockUser = {
        _id: { toString: () => "user-123" },
        email: "user@example.com",
        name: "Test User",
        isSuperAdmin: false,
        save: mockUserSave,
      };
      mockFindByIdResults.push({
        _id: { toString: () => "admin-123" },
        passwordHash: "hashed_password",
      });
      mockFindByIdResults.push(mockUser);
      mockBcryptCompare.mockResolvedValueOnce(true);
      mockUserSave.mockResolvedValueOnce(mockUser);

      const request = createRequest({ password: "password123" });
      const response = await POST(request, createParams("user-123"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("Super admin status granted");
      expect(data.user.isSuperAdmin).toBe(true);
      expect(mockUser.isSuperAdmin).toBe(true);
    });

    it("should verify password with bcrypt", async () => {
      mockRequireSuperAdmin.mockResolvedValueOnce({
        authorized: true,
        context: { user: { id: "admin-123" } },
      });
      const mockUser = {
        _id: { toString: () => "user-123" },
        email: "user@example.com",
        name: "Test User",
        isSuperAdmin: false,
        save: mockUserSave,
      };
      mockFindByIdResults.push({
        _id: { toString: () => "admin-123" },
        passwordHash: "hashed_admin_password",
      });
      mockFindByIdResults.push(mockUser);
      mockBcryptCompare.mockResolvedValueOnce(true);
      mockUserSave.mockResolvedValueOnce(mockUser);

      const request = createRequest({ password: "mySecretPassword" });
      await POST(request, createParams("user-123"));

      expect(mockBcryptCompare).toHaveBeenCalledWith("mySecretPassword", "hashed_admin_password");
    });
  });

  describe("DELETE /api/admin/users/[userId]/super-admin - Revoke Super Admin", () => {
    const createDeleteRequest = () =>
      new NextRequest("http://localhost:3000/api/admin/users/user-123/super-admin", {
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

    it("should return 403 when trying to revoke own super admin", async () => {
      mockRequireSuperAdmin.mockResolvedValueOnce({
        authorized: true,
        context: { user: { id: "user-123" } },
      });

      const request = createDeleteRequest();
      const response = await DELETE(request, createParams("user-123"));
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("Cannot revoke your own super admin status");
    });

    it("should return 404 when user not found", async () => {
      mockRequireSuperAdmin.mockResolvedValueOnce({
        authorized: true,
        context: { user: { id: "admin-123" } },
      });
      mockFindByIdResults.push(null);

      const request = createDeleteRequest();
      const response = await DELETE(request, createParams("user-123"));
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("User not found");
    });

    it("should return 400 when user is not super admin", async () => {
      mockRequireSuperAdmin.mockResolvedValueOnce({
        authorized: true,
        context: { user: { id: "admin-123" } },
      });
      mockFindByIdResults.push({
        _id: { toString: () => "user-123" },
        email: "user@example.com",
        name: "Test User",
        isSuperAdmin: false,
      });

      const request = createDeleteRequest();
      const response = await DELETE(request, createParams("user-123"));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("User is not a super admin");
    });

    it("should revoke super admin successfully", async () => {
      mockRequireSuperAdmin.mockResolvedValueOnce({
        authorized: true,
        context: { user: { id: "admin-123" } },
      });
      const mockUser = {
        _id: { toString: () => "user-123" },
        email: "user@example.com",
        name: "Test User",
        isSuperAdmin: true,
        save: mockUserSave,
      };
      mockFindByIdResults.push(mockUser);
      mockUserSave.mockResolvedValueOnce(mockUser);

      const request = createDeleteRequest();
      const response = await DELETE(request, createParams("user-123"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("Super admin status revoked");
      expect(data.user.isSuperAdmin).toBe(false);
      expect(mockUser.isSuperAdmin).toBe(false);
    });
  });
});
