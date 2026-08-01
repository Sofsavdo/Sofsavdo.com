/**
 * Utility Functions
 * 
 * Simple utility functions for the simplified UI components.
 */

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
