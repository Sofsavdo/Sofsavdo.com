/**
 * SKU Generator Utility
 * 
 * Generates Stock Keeping Units (SKUs) for products.
 * Used for auto-generating SKUs when creating products.
 */

export class SKUGenerator {
  /**
   * Generate a SKU from a product name and optional category.
   * 
   * @param productName - The product name
   * @param category - Optional category prefix
   * @param options - Optional configuration
   * @returns A generated SKU
   * 
   * @example
   * generateSKU("Face Serum") // "FS-001"
   * generateSKU("Face Serum", "SKINCARE") // "SKIN-FS-001"
   */
  static generate(
    productName: string,
    category: string | null = null,
    options: {
      separator?: string;
      padLength?: number;
    } = {}
  ): string {
    const {
      separator = '-',
      padLength = 3,
    } = options;

    // Extract initials from product name (first letter of each word)
    const initials = productName
      .split(/\s+/)
      .map(word => word.charAt(0).toUpperCase())
      .join('')
      .substring(0, 3); // Max 3 characters

    // Build SKU parts
    const parts: string[] = [];

    // Add category prefix if provided
    if (category) {
      const categoryPrefix = category.substring(0, 4).toUpperCase();
      parts.push(categoryPrefix);
    }

    // Add product initials
    parts.push(initials);

    // Add random number for uniqueness
    const randomNumber = Math.floor(Math.random() * 999) + 1;
    const paddedNumber = randomNumber.toString().padStart(padLength, '0');
    parts.push(paddedNumber);

    return parts.join(separator);
  }

  /**
   * Generate a unique SKU by incrementing the number if the SKU already exists.
   * 
   * @param baseSKU - The base SKU to use
   * @param existingSKUs - Array of existing SKUs to check against
   * @returns A unique SKU
   * 
   * @example
   * generateUniqueSKU("FS-001", ["FS-001"]) // "FS-002"
   * generateUniqueSKU("FS-001", ["FS-001", "FS-002"]) // "FS-003"
   */
  static generateUnique(
    baseSKU: string,
    existingSKUs: string[]
  ): string {
    if (!existingSKUs.includes(baseSKU)) {
      return baseSKU;
    }

    // Extract the numeric part and increment
    const parts = baseSKU.split('-');
    const numericPart = parts[parts.length - 1];
    const prefix = parts.slice(0, -1).join('-');

    if (!numericPart) {
      // If no numeric part, append -001
      return `${baseSKU}-001`;
    }

    let counter = parseInt(numericPart, 10) + 1;
    let uniqueSKU: string;

    do {
      const paddedNumber = counter.toString().padStart(numericPart.length, '0');
      uniqueSKU = prefix ? `${prefix}-${paddedNumber}` : paddedNumber;
      counter++;
    } while (existingSKUs.includes(uniqueSKU));

    return uniqueSKU;
  }

  /**
   * Validate if a string is a valid SKU format.
   * 
   * @param sku - The SKU to validate
   * @returns True if valid, false otherwise
   */
  static isValid(sku: string): boolean {
    // SKU should contain uppercase letters, numbers, and hyphens
    // Should not start or end with hyphen
    // Should not have consecutive hyphens
    const skuRegex = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;
    return skuRegex.test(sku);
  }

  /**
   * Generate a batch of unique SKUs.
   * 
   * @param count - Number of SKUs to generate
   * @param productName - The product name
   * @param category - Optional category prefix
   * @param existingSKUs - Array of existing SKUs to check against
   * @returns Array of unique SKUs
   */
  static generateBatch(
    count: number,
    productName: string,
    category: string | null = null,
    existingSKUs: string[] = []
  ): string[] {
    const skus: string[] = [];
    const currentExisting = [...existingSKUs];

    for (let i = 0; i < count; i++) {
      const baseSKU = this.generate(productName, category);
      const uniqueSKU = this.generateUnique(baseSKU, currentExisting);
      skus.push(uniqueSKU);
      currentExisting.push(uniqueSKU);
    }

    return skus;
  }
}
