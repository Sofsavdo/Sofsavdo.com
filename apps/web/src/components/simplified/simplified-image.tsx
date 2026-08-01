/**
 * Simplified Image Component
 * 
 * Optimized image component with loading states and error handling
 */

'use client';

import { useState } from 'react';
import { cn } from '@/components/lib/utils';

interface SimplifiedImageProps {
  src: string;
  alt: string;
  className?: string;
}

export function SimplifiedImage({ src, alt, className }: SimplifiedImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <div className={cn('relative', className)}>
      {!loaded && !error && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse" />
      )}
      {error ? (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
          <span className="text-gray-400">No image</span>
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          className={cn('w-full h-full object-cover', !loaded && 'opacity-0')}
        />
      )}
    </div>
  );
}
