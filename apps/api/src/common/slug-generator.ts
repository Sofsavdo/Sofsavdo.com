/**
 * Slug Generator Utility
 * 
 * Generates URL-friendly slugs from text strings.
 * Used for auto-generating slugs for products, campaigns, etc.
 */

import { transliterate } from 'transliteration';

export class SlugGenerator {
  /**
   * Generate a URL-friendly slug from a text string.
   * 
   * @param text - The text to convert to a slug
   * @param options - Optional configuration
   * @returns A URL-friendly slug
   * 
   * @example
   * generateSlug("Face Serum for Glowing Skin") // "face-serum-for-glowing-skin"
   * generateSlug("Серум для лица") // "serum-dlya-litsa"
   */
  static generate(
    text: string,
    options: {
      maxLength?: number;
      separator?: string;
      lowercase?: boolean;
    } = {}
  ): string {
    const {
      maxLength = 100,
      separator = '-',
      lowercase = true,
    } = options;

    // Transliterate non-Latin characters (Cyrillic, etc.)
    let slug = transliterate(text);

    // Convert to lowercase if specified
    if (lowercase) {
      slug = slug.toLowerCase();
    }

    // Replace spaces and special characters with separator
    slug = slug
      .replace(/[^a-z0-9\s-]/g, '') // Remove non-alphanumeric chars except spaces and hyphens
      .replace(/\s+/g, separator) // Replace spaces with separator
      .replace(/-+/g, separator) // Replace multiple hyphens with single separator
      .replace(new RegExp(`^${separator}+`), '') // Remove leading separators
      .replace(new RegExp(`${separator}+$`), ''); // Remove trailing separators

    // Truncate to max length
    if (slug.length > maxLength) {
      slug = slug.substring(0, maxLength).replace(new RegExp(`${separator}+$`), '');
    }

    return slug;
  }

  /**
   * Generate a unique slug by appending a number if the slug already exists.
   * 
   * @param baseSlug - The base slug to use
   * @param existingSlugs - Array of existing slugs to check against
   * @returns A unique slug
   * 
   * @example
   * generateUniqueSlug("face-serum", ["face-serum"]) // "face-serum-2"
   * generateUniqueSlug("face-serum", ["face-serum", "face-serum-2"]) // "face-serum-3"
   */
  static generateUnique(
    baseSlug: string,
    existingSlugs: string[]
  ): string {
    if (!existingSlugs.includes(baseSlug)) {
      return baseSlug;
    }

    let counter = 2;
    let uniqueSlug: string;

    do {
      uniqueSlug = `${baseSlug}-${counter}`;
      counter++;
    } while (existingSlugs.includes(uniqueSlug));

    return uniqueSlug;
  }

  /**
   * Validate if a string is a valid slug format.
   * 
   * @param slug - The slug to validate
   * @returns True if valid, false otherwise
   */
  static isValid(slug: string): boolean {
    // Slug should contain only lowercase letters, numbers, and hyphens
    // Should not start or end with hyphen
    // Should not have consecutive hyphens
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    return slugRegex.test(slug);
  }
}
