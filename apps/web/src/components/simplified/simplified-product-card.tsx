/**
 * Simplified Product Card Component
 * 
 * A simplified product card for the v2 UI.
 * Focuses on clarity and simplicity.
 */

import { SimplifiedCard, SimplifiedCardHeader, SimplifiedCardTitle, SimplifiedCardContent } from './simplified-card';
import { SimplifiedBadge } from './simplified-badge';
import { SimplifiedButton } from './simplified-button';

interface SimplifiedProductCardProps {
  title: string;
  image: string;
  priceMinor: number;
  commissionPercent: number;
  estimatedEarningsMinor: number;
  onGetLink?: () => void;
  onViewDetails?: () => void;
}

export function SimplifiedProductCard({
  title,
  image,
  priceMinor,
  commissionPercent,
  estimatedEarningsMinor,
  onGetLink,
  onViewDetails,
}: SimplifiedProductCardProps) {
  const formatPrice = (minor: number) => {
    return (minor / 100).toLocaleString('uz-UZ') + " so'm";
  };

  return (
    <SimplifiedCard hover onClick={onViewDetails}>
      <div className="aspect-square w-full overflow-hidden rounded-lg bg-gray-100 mb-4">
        <img
          src={image}
          alt={title}
          className="w-full h-full object-cover"
        />
      </div>
      
      <SimplifiedCardHeader>
        <SimplifiedCardTitle className="line-clamp-2">{title}</SimplifiedCardTitle>
      </SimplifiedCardHeader>
      
      <SimplifiedCardContent>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Price:</span>
            <span className="font-semibold">{formatPrice(priceMinor)}</span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Commission:</span>
            <SimplifiedBadge variant="success">{commissionPercent}%</SimplifiedBadge>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Your earnings:</span>
            <span className="font-semibold text-green-600">{formatPrice(estimatedEarningsMinor)}</span>
          </div>
          
          {onGetLink && (
            <SimplifiedButton
              variant="primary"
              fullWidth
              onClick={(e) => {
                e.stopPropagation();
                onGetLink();
              }}
            >
              Get Link
            </SimplifiedButton>
          )}
        </div>
      </SimplifiedCardContent>
    </SimplifiedCard>
  );
}
