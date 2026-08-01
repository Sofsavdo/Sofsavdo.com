/**
 * Simplified Card Component
 * 
 * A simplified, clean card component for the v2 UI.
 * Focuses on clarity and simplicity.
 */

import { cn } from '../lib/utils';

interface SimplifiedCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

export function SimplifiedCard({ children, className, hover = false, onClick }: SimplifiedCardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-xl shadow-sm border border-gray-200 p-6',
        hover && 'hover:shadow-md transition-shadow duration-200 cursor-pointer',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

export function SimplifiedCardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('mb-4', className)}>
      {children}
    </div>
  );
}

export function SimplifiedCardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h3 className={cn('text-lg font-semibold text-gray-900', className)}>
      {children}
    </h3>
  );
}

export function SimplifiedCardContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('text-gray-600', className)}>
      {children}
    </div>
  );
}
