import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock session
const mockGetSession = vi.fn();
vi.mock("@/lib/auth/session", () => ({
  getSession: () => mockGetSession(),
}));

// Mock database
vi.mock("@/lib/db/mongodb", () => ({
  connectDB: vi.fn(() => Promise.resolve()),
}));

// Mock User model
const mockUserFindById = vi.fn();
vi.mock("@/lib/db/models/user", () => ({
  default: {
    findById: () => mockUserFindById(),
  },
}));

// Mock AccessToken model
const mockTokenFind = vi.fn();
const mockTokenFindOne = vi.fn();
const mockTokenCreate = vi.fn();
const mockTokenSave = vi.fn();

vi.mock("@/lib/db/models/accessToken", () => ({
  AccessToken: {
    find: () => ({
      select: () => ({
        sort: () => mockTokenFind(),
      }),
    }),
    findOne: () => mockTokenFindOne(),
    create: (data: any) => mockTokenCreate(data),
    generateToken: () => ({
      token: "pf_testtoken123456789",
      hash: "testhash123",
      prefix: "pf_testtok",
    }),
  },
  ALL_SCOPES: [
    "projects:read",
    "projects:write",
    "test-suites:read",
    "test-suites:write",
    "test-runs:execute",
    "exports:read",
  ],
  TokenScope: {},
}));

import { GET, POST } from "@/app/api/user/tokens/route";

describe("Token API Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/user/tokens", () => {
    it("should return 401 when not authenticated", async () => {
      mockGetSession.mockResolvedValueOnce(null);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("should return 404 when user not found", async () => {
      mockGetSession.mockResolvedValueOnce({ userId: "user-123" });
      mockUserFindById.mockResolvedValueOnce(null);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("User not found");
    });

    it("should return empty array when no tokens exist", async () => {
      mockGetSession.mockResolvedValueOnce({ userId: "user-123" });
      mockUserFindById.mockResolvedValueOnce({ _id: "user-123" });
      mockTokenFind.mockResolvedValueOnce([]);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tokens).toEqual([]);
    });

    it("should return list of tokens", async () => {
      mockGetSession.mockResolvedValueOnce({ userId: "user-123" });
      mockUserFindById.mockResolvedValueOnce({ _id: "user-123" });
      mockTokenFind.mockResolvedValueOnce([
        {
          _id: { toString: () => "token-1" },
          name: "CI Token",
          tokenPrefix: "pf_abc12345",
          scopes: ["projects:read"],
          expiresAt: new Date("2025-12-31"),
          lastUsedAt: new Date("2025-01-01"),
          createdAt: new Date("2025-01-01"),
        },
        {
          _id: { toString: () => "token-2" },
          name: "Test Token",
          tokenPrefix: "pf_xyz98765",
          scopes: ["exports:read"],
          expiresAt: null,
          lastUsedAt: null,
          createdAt: new Date("2025-01-02"),
        },
      ]);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tokens).toHaveLength(2);
      expect(data.tokens[0].id).toBe("token-1");
      expect(data.tokens[0].name).toBe("CI Token");
      expect(data.tokens[1].id).toBe("token-2");
    });

    it("should mark expired tokens", async () => {
      mockGetSession.mockResolvedValueOnce({ userId: "user-123" });
      mockUserFindById.mockResolvedValueOnce({ _id: "user-123" });
      mockTokenFind.mockResolvedValueOnce([
        {
          _id: { toString: () => "token-1" },
          name: "Expired Token",
          tokenPrefix: "pf_expired",
          scopes: ["projects:read"],
          expiresAt: new Date("2020-01-01"), // Past date
          lastUsedAt: null,
          createdAt: new Date("2019-01-01"),
        },
      ]);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tokens[0].isExpired).toBe(true);
    });
  });

  describe("POST /api/user/tokens", () => {
    const createRequest = (body: object) =>
      new NextRequest("http://localhost:3000/api/user/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

    it("should return 401 when not authenticated", async () => {
      mockGetSession.mockResolvedValueOnce(null);

      const request = createRequest({ name: "Test", scopes: ["projects:read"] });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("should return 404 when user has no organization", async () => {
      mockGetSession.mockResolvedValueOnce({ userId: "user-123" });
      mockUserFindById.mockResolvedValueOnce({ _id: "user-123", organizationIds: [] });

      const request = createRequest({ name: "Test", scopes: ["projects:read"] });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("User or organization not found");
    });

    it("should return 400 when name is missing", async () => {
      mockGetSession.mockResolvedValueOnce({ userId: "user-123" });
      mockUserFindById.mockResolvedValueOnce({
        _id: "user-123",
        organizationIds: ["org-123"],
      });

      const request = createRequest({ scopes: ["projects:read"] });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Token name is required");
    });

    it("should return 400 when name is empty", async () => {
      mockGetSession.mockResolvedValueOnce({ userId: "user-123" });
      mockUserFindById.mockResolvedValueOnce({
        _id: "user-123",
        organizationIds: ["org-123"],
      });

      const request = createRequest({ name: "   ", scopes: ["projects:read"] });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Token name is required");
    });

    it("should return 400 when name is too long", async () => {
      mockGetSession.mockResolvedValueOnce({ userId: "user-123" });
      mockUserFindById.mockResolvedValueOnce({
        _id: "user-123",
        organizationIds: ["org-123"],
      });

      const longName = "a".repeat(101);
      const request = createRequest({ name: longName, scopes: ["projects:read"] });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Token name must be 100 characters or less");
    });

    it("should return 400 when scopes are missing", async () => {
      mockGetSession.mockResolvedValueOnce({ userId: "user-123" });
      mockUserFindById.mockResolvedValueOnce({
        _id: "user-123",
        organizationIds: ["org-123"],
      });

      const request = createRequest({ name: "Test Token" });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("At least one scope is required");
    });

    it("should return 400 when scopes array is empty", async () => {
      mockGetSession.mockResolvedValueOnce({ userId: "user-123" });
      mockUserFindById.mockResolvedValueOnce({
        _id: "user-123",
        organizationIds: ["org-123"],
      });

      const request = createRequest({ name: "Test Token", scopes: [] });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("At least one scope is required");
    });

    it("should return 400 for invalid scopes", async () => {
      mockGetSession.mockResolvedValueOnce({ userId: "user-123" });
      mockUserFindById.mockResolvedValueOnce({
        _id: "user-123",
        organizationIds: ["org-123"],
      });

      const request = createRequest({
        name: "Test Token",
        scopes: ["invalid:scope", "another:invalid"],
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid scopes");
      expect(data.error).toContain("invalid:scope");
    });

    it("should return 400 for invalid expiration period", async () => {
      mockGetSession.mockResolvedValueOnce({ userId: "user-123" });
      mockUserFindById.mockResolvedValueOnce({
        _id: "user-123",
        organizationIds: ["org-123"],
      });

      const request = createRequest({
        name: "Test Token",
        scopes: ["projects:read"],
        expiresIn: "invalid",
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid expiration period");
    });

    it("should create token successfully", async () => {
      mockGetSession.mockResolvedValueOnce({ userId: "user-123" });
      mockUserFindById.mockResolvedValueOnce({
        _id: "user-123",
        organizationIds: ["org-123"],
      });
      mockTokenCreate.mockResolvedValueOnce({
        _id: { toString: () => "new-token-id" },
        name: "CI Token",
        tokenPrefix: "pf_testtok",
        scopes: ["projects:read", "exports:read"],
        expiresAt: new Date("2025-12-31"),
        createdAt: new Date(),
      });

      const request = createRequest({
        name: "CI Token",
        scopes: ["projects:read", "exports:read"],
        expiresIn: "30d",
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.token).toBe("pf_testtoken123456789");
      expect(data.id).toBe("new-token-id");
      expect(data.name).toBe("CI Token");
      expect(data.tokenPrefix).toBe("pf_testtok");
    });

    it("should create token with no expiration", async () => {
      mockGetSession.mockResolvedValueOnce({ userId: "user-123" });
      mockUserFindById.mockResolvedValueOnce({
        _id: "user-123",
        organizationIds: ["org-123"],
      });
      mockTokenCreate.mockResolvedValueOnce({
        _id: { toString: () => "new-token-id" },
        name: "Permanent Token",
        tokenPrefix: "pf_testtok",
        scopes: ["projects:read"],
        expiresAt: null,
        createdAt: new Date(),
      });

      const request = createRequest({
        name: "Permanent Token",
        scopes: ["projects:read"],
        expiresIn: "never",
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.expiresAt).toBeNull();
    });

    it("should trim token name", async () => {
      mockGetSession.mockResolvedValueOnce({ userId: "user-123" });
      mockUserFindById.mockResolvedValueOnce({
        _id: "user-123",
        organizationIds: ["org-123"],
      });
      mockTokenCreate.mockImplementationOnce((data) => ({
        _id: { toString: () => "new-token-id" },
        ...data,
        createdAt: new Date(),
      }));

      const request = createRequest({
        name: "  Trimmed Name  ",
        scopes: ["projects:read"],
      });
      await POST(request);

      expect(mockTokenCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Trimmed Name",
        })
      );
    });
  });
});
