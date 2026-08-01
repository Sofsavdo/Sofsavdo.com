/**
 * Feature Flags System
 * 
 * System for gradual rollout of new features.
 * Used for A/B testing and phased deployment.
 */

export enum FeatureFlag {
  // Phase 4: Creator Frontend Simplification
  SIMPLIFIED_CREATOR_REGISTRATION = 'SIMPLIFIED_CREATOR_REGISTRATION',
  SIMPLIFIED_CREATOR_LOGIN = 'SIMPLIFIED_CREATOR_LOGIN',
  SIMPLIFIED_PRODUCTS_CATALOG = 'SIMPLIFIED_PRODUCTS_CATALOG',
  SIMPLIFIED_EARNINGS = 'SIMPLIFIED_EARNINGS',
  SIMPLIFIED_PROFILE = 'SIMPLIFIED_PROFILE',

  // Phase 5: Admin Frontend Simplification
  SIMPLIFIED_ADMIN_DASHBOARD = 'SIMPLIFIED_ADMIN_DASHBOARD',
  SIMPLIFIED_ADMIN_PRODUCTS = 'SIMPLIFIED_ADMIN_PRODUCTS',
  SIMPLIFIED_ADMIN_ORDERS = 'SIMPLIFIED_ADMIN_ORDERS',
  SIMPLIFIED_ADMIN_CREATORS = 'SIMPLIFIED_ADMIN_CREATORS',
  SIMPLIFIED_ADMIN_EARNINGS = 'SIMPLIFIED_ADMIN_EARNINGS',
  SIMPLIFIED_ADMIN_SETTINGS = 'SIMPLIFIED_ADMIN_SETTINGS',

  // Phase 6: Buyer Frontend Simplification
  SIMPLIFIED_PRODUCT_PAGE = 'SIMPLIFIED_PRODUCT_PAGE',
  SIMPLIFIED_CHECKOUT = 'SIMPLIFIED_CHECKOUT',
  SIMPLIFIED_ORDER_SUCCESS = 'SIMPLIFIED_ORDER_SUCCESS',
}

export interface FeatureFlagConfig {
  flag: FeatureFlag;
  enabled: boolean;
  rolloutPercentage?: number; // For gradual rollout (0-100)
  allowedUserIds?: string[]; // For specific user testing
}

/**
 * Feature Flags Service
 * 
 * In production, this would read from a database or configuration service.
 * For now, we use environment variables and in-memory configuration.
 */
export class FeatureFlagsService {
  private flags: Map<FeatureFlag, FeatureFlagConfig> = new Map();

  constructor() {
    // Initialize with default flags (all disabled)
    Object.values(FeatureFlag).forEach((flag) => {
      this.flags.set(flag, {
        flag,
        enabled: false,
        rolloutPercentage: 0,
      });
    });

    // Enable flags based on environment variables
    this.loadFromEnvironment();
  }

  /**
   * Check if a feature flag is enabled for a specific user.
   */
  isEnabled(flag: FeatureFlag, userId?: string): boolean {
    const config = this.flags.get(flag);

    if (!config) {
      return false;
    }

    // If explicitly disabled, return false
    if (!config.enabled) {
      return false;
    }

    // If user is in allowed list, return true
    if (userId && config.allowedUserIds?.includes(userId)) {
      return true;
    }

    // If rollout percentage is 100%, return true
    if (config.rolloutPercentage === 100) {
      return true;
    }

    // If rollout percentage is 0%, return false
    if (config.rolloutPercentage === 0) {
      return false;
    }

    // If no user ID, return false (can't do percentage-based rollout)
    if (!userId) {
      return false;
    }

    // Percentage-based rollout based on user ID hash
    const hash = this.hashUserId(userId);
    return hash % 100 < (config.rolloutPercentage || 0);
  }

  /**
   * Enable a feature flag.
   */
  enable(flag: FeatureFlag, rolloutPercentage: number = 100): void {
    const config = this.flags.get(flag);
    if (config) {
      config.enabled = true;
      config.rolloutPercentage = rolloutPercentage;
    }
  }

  /**
   * Disable a feature flag.
   */
  disable(flag: FeatureFlag): void {
    const config = this.flags.get(flag);
    if (config) {
      config.enabled = false;
      config.rolloutPercentage = 0;
    }
  }

  /**
   * Set allowed user IDs for a feature flag.
   */
  setAllowedUsers(flag: FeatureFlag, userIds: string[]): void {
    const config = this.flags.get(flag);
    if (config) {
      config.allowedUserIds = userIds;
    }
  }

  /**
   * Load feature flags from environment variables.
   */
  private loadFromEnvironment(): void {
    // Example: FEATURE_SIMPLIFIED_CREATOR_REGISTRATION=true
    Object.values(FeatureFlag).forEach((flag) => {
      const envValue = process.env[`FEATURE_${flag}`];
      if (envValue === 'true') {
        this.enable(flag, 100);
      } else if (envValue) {
        const percentage = parseInt(envValue, 10);
        if (!isNaN(percentage) && percentage > 0 && percentage <= 100) {
          this.enable(flag, percentage);
        }
      }
    });
  }

  /**
   * Hash user ID to a number for percentage-based rollout.
   */
  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}

// Singleton instance
export const featureFlags = new FeatureFlagsService();
