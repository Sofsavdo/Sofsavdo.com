/**
 * Simplified Products Catalog Page
 * 
 * A clean, simple product catalog for creators.
 * Shows products with key info: title, price, commission, earnings.
 * One click to get sharing link.
 */

'use client';

import { useState, useEffect } from 'react';
import { SimplifiedProductCard } from '@/components/simplified/simplified-product-card';
import { SimplifiedInput } from '@/components/simplified/simplified-input';
import { SimplifiedButton } from '@/components/simplified/simplified-button';
import { SimplifiedCard, SimplifiedCardHeader, SimplifiedCardTitle, SimplifiedCardContent } from '@/components/simplified/simplified-card';
import { SimplifiedLoading } from '@/components/simplified/simplified-loading';
import { productsV2Service, type SimplifiedProductDto } from '@/services/v2/products-v2.service';
import { creatorsV2Service } from '@/services/v2/creators-v2.service';

export default function SimplifiedProductsPage() {
  const [products, setProducts] = useState<SimplifiedProductDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [copiedProductId, setCopiedProductId] = useState<string | null>(null);
  
  useEffect(() => {
    loadProducts();
  }, []);
  
  const loadProducts = async () => {
    setLoading(true);
    try {
      const response = await productsV2Service.list({ status: 'ACTIVE' });
      setProducts(response.items);
    } catch (error) {
      console.error('Failed to load products:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleGetLink = async (productId: string) => {
    try {
      const response = await creatorsV2Service.generateSharingLink(productId);
      
      // Copy to clipboard
      await navigator.clipboard.writeText(response.link);
      setCopiedProductId(productId);
      
      // Reset after 2 seconds
      setTimeout(() => setCopiedProductId(null), 2000);
    } catch (error) {
      console.error('Failed to generate link:', error);
      alert('Failed to generate link. Please try again.');
    }
  };
  
  const filteredProducts = products.filter(product =>
    product.title.toLowerCase().includes(search.toLowerCase())
  );
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <SimplifiedLoading size="lg" />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Products</h1>
            <div className="flex gap-2">
              <SimplifiedButton variant="outline" onClick={() => {/* Navigate to earnings */}}>
                My Earnings
              </SimplifiedButton>
              <SimplifiedButton variant="outline" onClick={() => {/* Navigate to profile */}}>
                Profile
              </SimplifiedButton>
            </div>
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Search */}
        <div className="mb-6">
          <SimplifiedInput
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        {/* Products Grid */}
        {filteredProducts.length === 0 ? (
          <SimplifiedCard>
            <SimplifiedCardContent>
              <p className="text-center text-gray-600">
                {search ? 'No products found matching your search.' : 'No products available.'}
              </p>
            </SimplifiedCardContent>
          </SimplifiedCard>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product) => (
              <SimplifiedProductCard
                key={product.id}
                title={product.title}
                image={product.images[0] || '/placeholder.png'}
                priceMinor={product.priceMinor}
                commissionPercent={product.commissionPercent}
                estimatedEarningsMinor={product.estimatedEarningsPerSaleMinor}
                onGetLink={() => handleGetLink(product.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
