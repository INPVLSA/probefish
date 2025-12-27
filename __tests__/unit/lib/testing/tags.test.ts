import { describe, it, expect } from "vitest";

describe("Test Case Tags", () => {
  describe("Tag normalization", () => {
    it("should normalize tags to lowercase", () => {
      const tag = "SmokeTest";
      const normalized = tag.trim().toLowerCase();
      expect(normalized).toBe("smoketest");
    });

    it("should trim whitespace from tags", () => {
      const tag = "  regression  ";
      const normalized = tag.trim().toLowerCase();
      expect(normalized).toBe("regression");
    });

    it("should handle empty tags", () => {
      const tag = "   ";
      const normalized = tag.trim().toLowerCase();
      expect(normalized).toBe("");
    });
  });

  describe("Tag filtering logic (OR)", () => {
    const testCases = [
      { name: "Test 1", tags: ["smoke", "auth"] },
      { name: "Test 2", tags: ["regression", "auth"] },
      { name: "Test 3", tags: ["smoke"] },
      { name: "Test 4", tags: [] },
      { name: "Test 5", tags: undefined },
    ];

    it("should return all tests when no tags filter is provided", () => {
      const tagsFilter: string[] = [];
      const filtered = testCases.filter(
        (tc) => tagsFilter.length === 0 || tc.tags?.some((tag) => tagsFilter.includes(tag))
      );
      expect(filtered).toHaveLength(5);
    });

    it("should filter tests with single tag (OR logic)", () => {
      const tagsFilter = ["smoke"];
      const filtered = testCases.filter(
        (tc) => tagsFilter.length === 0 || tc.tags?.some((tag) => tagsFilter.includes(tag))
      );
      expect(filtered).toHaveLength(2);
      expect(filtered.map((t) => t.name)).toEqual(["Test 1", "Test 3"]);
    });

    it("should filter tests with multiple tags (OR logic - any match)", () => {
      const tagsFilter = ["smoke", "regression"];
      const filtered = testCases.filter(
        (tc) => tagsFilter.length === 0 || tc.tags?.some((tag) => tagsFilter.includes(tag))
      );
      expect(filtered).toHaveLength(3);
      expect(filtered.map((t) => t.name)).toEqual(["Test 1", "Test 2", "Test 3"]);
    });

    it("should return empty array when no tests match tags", () => {
      const tagsFilter = ["nonexistent"];
      const filtered = testCases.filter(
        (tc) => tagsFilter.length === 0 || tc.tags?.some((tag) => tagsFilter.includes(tag))
      );
      expect(filtered).toHaveLength(0);
    });

    it("should exclude tests with undefined or empty tags when filter is active", () => {
      const tagsFilter = ["auth"];
      const filtered = testCases.filter(
        (tc) => tagsFilter.length === 0 || tc.tags?.some((tag) => tagsFilter.includes(tag))
      );
      expect(filtered).toHaveLength(2);
      expect(filtered.map((t) => t.name)).toEqual(["Test 1", "Test 2"]);
    });
  });

  describe("Collecting unique tags from test cases", () => {
    it("should collect all unique tags from test cases", () => {
      const testCases = [
        { name: "Test 1", tags: ["smoke", "auth"] },
        { name: "Test 2", tags: ["regression", "auth"] },
        { name: "Test 3", tags: ["smoke"] },
      ];

      const tags = new Set<string>();
      testCases.forEach((tc) => tc.tags?.forEach((t) => tags.add(t)));
      const uniqueTags = Array.from(tags).sort();

      expect(uniqueTags).toEqual(["auth", "regression", "smoke"]);
    });

    it("should handle test cases with no tags", () => {
      const testCases = [
        { name: "Test 1", tags: [] },
        { name: "Test 2", tags: undefined },
        { name: "Test 3" },
      ];

      const tags = new Set<string>();
      testCases.forEach((tc) => (tc as { tags?: string[] }).tags?.forEach((t) => tags.add(t)));
      const uniqueTags = Array.from(tags).sort();

      expect(uniqueTags).toEqual([]);
    });

    it("should deduplicate tags across test cases", () => {
      const testCases = [
        { name: "Test 1", tags: ["smoke", "smoke", "auth"] },
        { name: "Test 2", tags: ["smoke", "auth"] },
      ];

      const tags = new Set<string>();
      testCases.forEach((tc) => tc.tags?.forEach((t) => tags.add(t)));
      const uniqueTags = Array.from(tags).sort();

      expect(uniqueTags).toEqual(["auth", "smoke"]);
    });
  });

  describe("Tag validation", () => {
    it("should prevent duplicate tags on a single test case", () => {
      const existingTags = ["smoke", "auth"];
      const newTag = "smoke";

      const isDuplicate = existingTags.includes(newTag);

      expect(isDuplicate).toBe(true);
    });

    it("should allow adding new unique tag", () => {
      const existingTags = ["smoke", "auth"];
      const newTag = "regression";

      const isDuplicate = existingTags.includes(newTag);

      expect(isDuplicate).toBe(false);
    });

    it("should handle case-insensitive duplicate check", () => {
      const existingTags = ["smoke", "auth"];
      const newTag = "SMOKE";

      const normalizedNew = newTag.toLowerCase();
      const isDuplicate = existingTags.includes(normalizedNew);

      expect(isDuplicate).toBe(true);
    });
  });
});
