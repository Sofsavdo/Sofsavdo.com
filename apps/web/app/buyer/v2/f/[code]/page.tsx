/**
 * Simplified Buyer Landing Page with Clean URL
 * 
 * Route: /buyer/v2/f/[code]
 * This replaces the old /o/[slug]?ref=code pattern
 * No visible tracking parameters - silent attribution
 */

'use client';

import { useState, useEffect } from 'react';
import { SimplifiedCard, SimplifiedCardHeader, SimplifiedCardTitle, SimplifiedCardContent } from '@/components/simplified/simplified-card';
import { SimplifiedButton } from '@/components/simplified/simplified-button';
import { SimplifiedLoading } from '@/components/simplified/simplified-loading';
import { SimplifiedBadge } from '@/components/simplified/simplified-badge';
import { productsV2Service, type SimplifiedProductDto } from '@/services/v2/products-v2.service';

export default function SimplifiedBuyerLandingPage({ params }: { params: { code: string } }) {
  const [product, setProduct] = useState<SimplifiedProductDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  
  useEffect(() => {
    loadProduct();
  }, [params.code]);
  
  const loadProduct = async () => {
    setLoading(true);
    try {
      // The code is a short code that maps to a product
      // Backend will decode it and return the product
      // Attribution happens silently in the background
      const data = await productsV2Service.findByCode(params.code);
      setProduct(data);
    } catch (error) {
      console.error('Failed to load product:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleBuyNow = () => {
    // Navigate to checkout with product info
    // Attribution is tracked via cookie/session, not URL params
    if (product) {
      window.location.href = `/buyer/v2/checkout?productId=${product.id}&quantity=${quantity}`;
    }
  };
  
  const formatPrice = (minor: number) => {
    return (minor / 100).toLocaleString('uz-UZ') + " so'm";
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <SimplifiedLoading size="lg" />
      </div>
    );
  }
  
  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <SimplifiedCard>
          <SimplifiedCardContent>
            <p className="text-center text-gray-600">Product not found</p>
          </SimplifiedCardContent>
        </SimplifiedCard>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900">Sofsavdo</h1>
            <SimplifiedButton variant="outline" onClick={() => window.location.href = '/'}>
              Back to Home
            </SimplifiedButton>
          </div>
        </div>
      </div>
      
      {/* Content - Mobile First Layout */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        {/* Product Images - Full width on mobile, side-by-side on desktop */}
        <div className="mb-6">
          <div className="aspect-[3/4] bg-white rounded-xl overflow-hidden shadow-sm max-w-md mx-auto">
            <img
              src={product.images[0] || '/placeholder.png'}
              alt={product.title}
              className="w-full h-full object-contain"
            />
          </div>
          
          {product.images.length > 1 && (
            <div className="grid grid-cols-4 gap-2 mt-4 max-w-md mx-auto">
              {product.images.slice(1).map((image, index) => (
                <div key={index} className="aspect-square bg-white rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-500">
                  <img
                    src={image}
                    alt={`${product.title} ${index + 2}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Product Info - Below images */}
        <div className="space-y-4 max-w-md mx-auto">
          {/* Title */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{product.title}</h1>
            {product.category && (
              <SimplifiedBadge variant="neutral">{product.category}</SimplifiedBadge>
            )}
          </div>
          
          {/* Price */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-3xl font-bold text-blue-600">{formatPrice(product.priceMinor)}</p>
          </div>
          
          {/* Description */}
          {product.description && (
            <SimplifiedCard>
              <SimplifiedCardContent>
                <div 
                  className="text-gray-600"
                  dangerouslySetInnerHTML={{ __html: product.description }}
                />
              </SimplifiedCardContent>
            </SimplifiedCard>
          )}
          
          {/* Quantity Selector */}
          <div className="flex items-center gap-4">
            <label className="font-medium text-gray-900">Quantity:</label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-10 h-10 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-gray-50"
              >
                -
              </button>
              <span className="w-12 text-center font-medium">{quantity}</span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="w-10 h-10 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-gray-50"
              >
                +
              </button>
            </div>
          </div>
          
          {/* Total */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total:</span>
              <span className="text-2xl font-bold text-gray-900">
                {formatPrice(product.priceMinor * quantity)}
              </span>
            </div>
          </div>
          
          {/* Buy Button */}
          <SimplifiedButton
            variant="primary"
            fullWidth
            size="lg"
            onClick={handleBuyNow}
          >
            Buy Now
          </SimplifiedButton>
          
          {/* Trust Badges */}
          <div className="flex items-center justify-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <span className="text-green-600">✓</span>
              <span>Secure Payment</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-600">✓</span>
              <span>Fast Delivery</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-600">✓</span>
              <span>Quality Guaranteed</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
