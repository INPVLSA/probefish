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

// Mock models
const mockUserFindById = vi.fn();
const mockUserFindByIdAndDelete = vi.fn();
const mockOrgUpdateMany = vi.fn();

vi.mock("@/lib/db/models", () => ({
  User: {
    findById: (id: string) => mockUserFindById(id),
    findByIdAndDelete: (id: string) => mockUserFindByIdAndDelete(id),
  },
  Organization: {
    updateMany: (...args: unknown[]) => mockOrgUpdateMany(...args),
  },
}));

import { DELETE } from "@/app/api/admin/users/[userId]/route";

describe("User Delete API Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createRequest = () =>
    new NextRequest("http://localhost:3000/api/admin/users/user-123", {
      method: "DELETE",
    });

  const createParams = (userId: string) => ({
    params: Promise.resolve({ userId }),
  });

  describe("DELETE /api/admin/users/[userId]", () => {
    it("should return 401 when not authorized", async () => {
      mockRequireSuperAdmin.mockResolvedValueOnce({
        authorized: false,
        error: "Unauthorized",
        status: 401,
      });

      const request = createRequest();
      const response = await DELETE(request, createParams("user-123"));
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("should return 403 when trying to delete yourself", async () => {
      mockRequireSuperAdmin.mockResolvedValueOnce({
        authorized: true,
        context: { user: { id: "user-123" } },
      });

      const request = createRequest();
      const response = await DELETE(request, createParams("user-123"));
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("Cannot delete yourself");
    });

    it("should return 404 when user not found", async () => {
      mockRequireSuperAdmin.mockResolvedValueOnce({
        authorized: true,
        context: { user: { id: "admin-123" } },
      });
      mockUserFindById.mockResolvedValueOnce(null);

      const request = createRequest();
      const response = await DELETE(request, createParams("user-123"));
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("User not found");
    });

    it("should return 403 when trying to delete a super admin", async () => {
      mockRequireSuperAdmin.mockResolvedValueOnce({
        authorized: true,
        context: { user: { id: "admin-123" } },
      });
      mockUserFindById.mockResolvedValueOnce({
        _id: { toString: () => "user-123" },
        email: "superadmin@example.com",
        name: "Super Admin",
        isSuperAdmin: true,
      });

      const request = createRequest();
      const response = await DELETE(request, createParams("user-123"));
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("Cannot delete a super admin. Revoke super admin status first.");
    });

    it("should delete user successfully", async () => {
      mockRequireSuperAdmin.mockResolvedValueOnce({
        authorized: true,
        context: { user: { id: "admin-123" } },
      });
      mockUserFindById.mockResolvedValueOnce({
        _id: { toString: () => "user-123" },
        email: "user@example.com",
        name: "Test User",
        isSuperAdmin: false,
      });
      mockOrgUpdateMany.mockResolvedValueOnce({ modifiedCount: 2 });
      mockUserFindByIdAndDelete.mockResolvedValueOnce({
        _id: { toString: () => "user-123" },
      });

      const request = createRequest();
      const response = await DELETE(request, createParams("user-123"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe("User deleted");
      expect(data.userId).toBe("user-123");
      expect(mockOrgUpdateMany).toHaveBeenCalledWith(
        { "members.userId": "user-123" },
        { $pull: { members: { userId: "user-123" } } }
      );
      expect(mockUserFindByIdAndDelete).toHaveBeenCalledWith("user-123");
    });

    it("should remove user from organizations before deletion", async () => {
      mockRequireSuperAdmin.mockResolvedValueOnce({
        authorized: true,
        context: { user: { id: "admin-123" } },
      });
      mockUserFindById.mockResolvedValueOnce({
        _id: { toString: () => "user-456" },
        email: "member@example.com",
        name: "Member User",
        isSuperAdmin: false,
      });
      mockOrgUpdateMany.mockResolvedValueOnce({ modifiedCount: 3 });
      mockUserFindByIdAndDelete.mockResolvedValueOnce({});

      const request = createRequest();
      await DELETE(request, createParams("user-456"));

      // Verify organization cleanup was called before user deletion
      expect(mockOrgUpdateMany).toHaveBeenCalled();
      expect(mockUserFindByIdAndDelete).toHaveBeenCalled();
    });
  });
});
