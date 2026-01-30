import { describe, it, expect } from 'vitest';
import {
  generateSlug,
  isValidSlug,
  getSlugValidationError,
  ensureUniqueSlug,
  isObjectIdFormat,
  SLUG_MIN_LENGTH,
  SLUG_MAX_LENGTH,
} from '@/lib/utils/slug';

describe('slug utilities', () => {
  describe('generateSlug', () => {
    it('should convert name to lowercase kebab-case', () => {
      expect(generateSlug('My Test Project')).toBe('my-test-project');
    });

    it('should replace spaces with hyphens', () => {
      expect(generateSlug('hello world')).toBe('hello-world');
    });

    it('should replace underscores with hyphens', () => {
      expect(generateSlug('hello_world')).toBe('hello-world');
    });

    it('should remove special characters', () => {
      expect(generateSlug('Hello! World?')).toBe('hello-world');
      expect(generateSlug('Test@#$%Suite')).toBe('testsuite');
    });

    it('should collapse multiple hyphens into one', () => {
      expect(generateSlug('hello   world')).toBe('hello-world');
      expect(generateSlug('hello---world')).toBe('hello-world');
    });

    it('should trim hyphens from start and end', () => {
      expect(generateSlug(' -hello world- ')).toBe('hello-world');
      expect(generateSlug('---test---')).toBe('test');
    });

    it('should truncate to max length', () => {
      const longName = 'a'.repeat(100);
      const slug = generateSlug(longName);
      expect(slug.length).toBeLessThanOrEqual(SLUG_MAX_LENGTH);
    });

    it('should not cut in the middle of a word when truncating', () => {
      const longName = 'word-'.repeat(20);
      const slug = generateSlug(longName);
      expect(slug.endsWith('-')).toBe(false);
    });

    it('should pad short slugs to minimum length', () => {
      const shortName = 'ab';
      const slug = generateSlug(shortName);
      expect(slug.length).toBeGreaterThanOrEqual(SLUG_MIN_LENGTH);
    });

    it('should handle unicode characters by removing them', () => {
      expect(generateSlug('Hello 世界')).toBe('hello');
      expect(generateSlug('Café Test')).toBe('caf-test');
    });

    it('should handle already valid slug', () => {
      expect(generateSlug('my-project')).toBe('my-project');
    });

    it('should handle mixed case', () => {
      expect(generateSlug('MyTestPROJECT')).toBe('mytestproject');
    });

    it('should handle numbers', () => {
      expect(generateSlug('Test 123 Suite')).toBe('test-123-suite');
      expect(generateSlug('123')).toBe('123');
    });
  });

  describe('isValidSlug', () => {
    it('should return true for valid slugs', () => {
      expect(isValidSlug('my-project')).toBe(true);
      expect(isValidSlug('test123')).toBe(true);
      expect(isValidSlug('a1b')).toBe(true);
    });

    it('should return false for slugs that are too short', () => {
      expect(isValidSlug('ab')).toBe(false);
      expect(isValidSlug('a')).toBe(false);
    });

    it('should return false for slugs that are too long', () => {
      expect(isValidSlug('a'.repeat(51))).toBe(false);
    });

    it('should return false for slugs with uppercase', () => {
      expect(isValidSlug('MyProject')).toBe(false);
    });

    it('should return false for slugs with special characters', () => {
      expect(isValidSlug('my_project')).toBe(false);
      expect(isValidSlug('my.project')).toBe(false);
      expect(isValidSlug('my project')).toBe(false);
    });

    it('should return false for slugs starting with hyphen', () => {
      expect(isValidSlug('-my-project')).toBe(false);
    });

    it('should return false for slugs ending with hyphen', () => {
      expect(isValidSlug('my-project-')).toBe(false);
    });

    it('should return false for empty or null values', () => {
      expect(isValidSlug('')).toBe(false);
      expect(isValidSlug(null as unknown as string)).toBe(false);
      expect(isValidSlug(undefined as unknown as string)).toBe(false);
    });

    it('should return true for slugs at min/max boundaries', () => {
      expect(isValidSlug('abc')).toBe(true); // min length
      expect(isValidSlug('a'.repeat(50))).toBe(true); // max length
    });
  });

  describe('getSlugValidationError', () => {
    it('should return null for valid slugs', () => {
      expect(getSlugValidationError('my-project')).toBeNull();
    });

    it('should return error for empty slug', () => {
      expect(getSlugValidationError('')).toBe('Slug is required');
    });

    it('should return error for short slug', () => {
      expect(getSlugValidationError('ab')).toContain('at least');
    });

    it('should return error for long slug', () => {
      expect(getSlugValidationError('a'.repeat(51))).toContain('at most');
    });

    it('should return error for invalid characters', () => {
      expect(getSlugValidationError('my_project')).toContain('lowercase letters');
    });
  });

  describe('ensureUniqueSlug', () => {
    it('should return base slug if it does not exist', async () => {
      const slug = await ensureUniqueSlug('my-project', async () => false);
      expect(slug).toBe('my-project');
    });

    it('should append -1 if base slug exists', async () => {
      const existingSlugs = new Set(['my-project']);
      const slug = await ensureUniqueSlug('my-project', async (s) =>
        existingSlugs.has(s)
      );
      expect(slug).toBe('my-project-1');
    });

    it('should increment suffix until unique', async () => {
      const existingSlugs = new Set([
        'my-project',
        'my-project-1',
        'my-project-2',
      ]);
      const slug = await ensureUniqueSlug('my-project', async (s) =>
        existingSlugs.has(s)
      );
      expect(slug).toBe('my-project-3');
    });

    it('should handle max length when appending suffix', async () => {
      const longSlug = 'a'.repeat(48);
      const existingSlugs = new Set([longSlug]);
      const slug = await ensureUniqueSlug(longSlug, async (s) =>
        existingSlugs.has(s)
      );
      expect(slug.length).toBeLessThanOrEqual(SLUG_MAX_LENGTH);
      expect(slug).toContain('-1');
    });
  });

  describe('isObjectIdFormat', () => {
    it('should return true for valid ObjectId format', () => {
      expect(isObjectIdFormat('507f1f77bcf86cd799439011')).toBe(true);
      expect(isObjectIdFormat('000000000000000000000000')).toBe(true);
      expect(isObjectIdFormat('ffffffffffffffffffffffff')).toBe(true);
      expect(isObjectIdFormat('FFFFFFFFFFFFFFFFFFFFFFFF')).toBe(true);
    });

    it('should return false for invalid ObjectId format', () => {
      expect(isObjectIdFormat('my-project')).toBe(false);
      expect(isObjectIdFormat('507f1f77bcf86cd79943901')).toBe(false); // 23 chars
      expect(isObjectIdFormat('507f1f77bcf86cd7994390111')).toBe(false); // 25 chars
      expect(isObjectIdFormat('507f1f77bcf86cd79943901g')).toBe(false); // invalid char
      expect(isObjectIdFormat('')).toBe(false);
    });
  });
});
