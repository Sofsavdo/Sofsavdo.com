/**
 * Feature Flag Hook
 * 
 * React hook for checking feature flags.
 * Used for gradual rollout and A/B testing.
 */

import { useState, useEffect } from 'react';

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

/**
 * Check if a feature flag is enabled for the current user.
 */
export function useFeatureFlag(flag: FeatureFlag): boolean {
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    // In production, this would call the backend to check the flag
    // For now, we use environment variables or localStorage
    const checkFlag = () => {
      // Check environment variable
      const envValue = process.env[`FEATURE_${flag}`];
      
      if (envValue === 'true') {
        return true;
      }
      
      if (envValue) {
        const percentage = parseInt(envValue, 10);
        if (!isNaN(percentage) && percentage > 0 && percentage <= 100) {
          // Percentage-based rollout based on user ID hash
          const userId = localStorage.getItem('userId') || 'anonymous';
          const hash = hashUserId(userId);
          return hash % 100 < percentage;
        }
      }

      // Check localStorage for manual override
      const localValue = localStorage.getItem(`feature_${flag}`);
      if (localValue === 'true') {
        return true;
      }

      return false;
    };

    setIsEnabled(checkFlag());
  }, [flag]);

  return isEnabled;
}

/**
 * Hash user ID to a number for percentage-based rollout.
 */
function hashUserId(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Manually enable a feature flag (for testing).
 */
export function enableFeatureFlag(flag: FeatureFlag): void {
  localStorage.setItem(`feature_${flag}`, 'true');
  window.dispatchEvent(new Event('storage'));
}

/**
 * Manually disable a feature flag (for testing).
 */
export function disableFeatureFlag(flag: FeatureFlag): void {
  localStorage.removeItem(`feature_${flag}`);
  window.dispatchEvent(new Event('storage'));
}
