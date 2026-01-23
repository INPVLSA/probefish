/**
 * Slug generation and validation utilities for human-readable identifiers
 */

// Regex for valid slug: starts and ends with alphanumeric, allows hyphens in between
const SLUG_REGEX = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
const MIN_LENGTH = 3;
const MAX_LENGTH = 50;

/**
 * Generate a slug from a name string
 * - Converts to lowercase
 * - Replaces spaces and underscores with hyphens
 * - Removes non-alphanumeric characters (except hyphens)
 * - Collapses multiple hyphens into one
 * - Trims hyphens from start and end
 * - Truncates to max length
 */
export function generateSlug(name: string): string {
  let slug = name
    .toLowerCase()
    .trim()
    // Replace spaces and underscores with hyphens
    .replace(/[\s_]+/g, "-")
    // Remove non-alphanumeric characters except hyphens
    .replace(/[^a-z0-9-]/g, "")
    // Collapse multiple hyphens into one
    .replace(/-+/g, "-")
    // Trim hyphens from start and end
    .replace(/^-+|-+$/g, "");

  // Truncate to max length, but don't cut in the middle of a word
  if (slug.length > MAX_LENGTH) {
    slug = slug.substring(0, MAX_LENGTH);
    // Remove trailing hyphen if we cut mid-word
    slug = slug.replace(/-+$/, "");
  }

  // Ensure minimum length by padding if needed
  if (slug.length < MIN_LENGTH) {
    // If slug is too short, pad with random chars
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    while (slug.length < MIN_LENGTH) {
      slug += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  }

  return slug;
}

/**
 * Validate a slug string
 * Returns true if valid, false otherwise
 */
export function isValidSlug(slug: string): boolean {
  if (!slug || typeof slug !== "string") {
    return false;
  }
  if (slug.length < MIN_LENGTH || slug.length > MAX_LENGTH) {
    return false;
  }
  return SLUG_REGEX.test(slug);
}

/**
 * Get validation error message for a slug, or null if valid
 */
export function getSlugValidationError(slug: string): string | null {
  if (!slug || typeof slug !== "string") {
    return "Slug is required";
  }
  if (slug.length < MIN_LENGTH) {
    return `Slug must be at least ${MIN_LENGTH} characters`;
  }
  if (slug.length > MAX_LENGTH) {
    return `Slug must be at most ${MAX_LENGTH} characters`;
  }
  if (!SLUG_REGEX.test(slug)) {
    return "Slug must contain only lowercase letters, numbers, and hyphens, and must start and end with a letter or number";
  }
  return null;
}

/**
 * Ensure a slug is unique by appending a numeric suffix if needed
 * @param baseSlug The base slug to check
 * @param checkExists Function that returns true if the slug already exists
 * @returns A unique slug (may have -1, -2, etc. appended)
 */
export async function ensureUniqueSlug(
  baseSlug: string,
  checkExists: (slug: string) => Promise<boolean>
): Promise<string> {
  // First try the base slug
  if (!(await checkExists(baseSlug))) {
    return baseSlug;
  }

  // Try with numeric suffixes
  let counter = 1;
  const maxAttempts = 100;

  while (counter <= maxAttempts) {
    const candidateSlug = `${baseSlug}-${counter}`;

    // Make sure the suffixed slug isn't too long
    if (candidateSlug.length > MAX_LENGTH) {
      // Truncate base slug to fit the suffix
      const maxBaseLength = MAX_LENGTH - `-${counter}`.length;
      const truncatedBase = baseSlug.substring(0, maxBaseLength).replace(/-+$/, "");
      const truncatedCandidate = `${truncatedBase}-${counter}`;

      if (!(await checkExists(truncatedCandidate))) {
        return truncatedCandidate;
      }
    } else if (!(await checkExists(candidateSlug))) {
      return candidateSlug;
    }

    counter++;
  }

  // Fallback: append random string
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  return `${baseSlug.substring(0, MAX_LENGTH - 7)}-${randomSuffix}`;
}

/**
 * Check if a string looks like a MongoDB ObjectId
 * ObjectIds are 24-character hex strings
 */
export function isObjectIdFormat(str: string): boolean {
  return /^[0-9a-fA-F]{24}$/.test(str);
}

export const SLUG_MIN_LENGTH = MIN_LENGTH;
export const SLUG_MAX_LENGTH = MAX_LENGTH;
