/**
 * Oqimlar (Streams) Page
 * 
 * Shows all products and services available for creators to promote.
 * Creator can select a product/service to create their stream.
 */

'use client';

import { useState, useEffect } from 'react';
import { SimplifiedCard, SimplifiedCardHeader, SimplifiedCardTitle, SimplifiedCardContent } from '@/components/simplified/simplified-card';
import { SimplifiedButton } from '@/components/simplified/simplified-button';
import { SimplifiedInput } from '@/components/simplified/simplified-input';
import { SimplifiedLoading } from '@/components/simplified/simplified-loading';
import { SimplifiedBadge } from '@/components/simplified/simplified-badge';
import { productsV2Service, type SimplifiedProductDto } from '@/services/v2/products-v2.service';
import Link from 'next/link';

export default function StreamsPage() {
  const [products, setProducts] = useState<SimplifiedProductDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
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
  
  const formatPrice = (minor: number) => {
    return (minor / 100).toLocaleString('uz-UZ') + " so'm";
  };
  
  const filteredProducts = products.filter(product =>
    product.title.toLowerCase().includes(search.toLowerCase())
  );
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <SimplifiedLoading size="lg" />
      </div>
    );
  }
  
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Oqimlar</h1>
        <p className="text-gray-600">Barcha mahsulotlar va xizmatlarni ko'ring va oqim yarating</p>
      </div>
      
      <div className="mb-6">
        <SimplifiedInput
          placeholder="Mahsulot qidiring..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProducts.map((product) => (
          <SimplifiedCard key={product.id} className="hover:shadow-md transition-shadow">
            <SimplifiedCardContent className="p-4">
              <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-4">
                <img
                  src={product.images[0] || '/placeholder.png'}
                  alt={product.title}
                  className="w-full h-full object-cover"
                />
              </div>
              
              <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">{product.title}</h3>
              
              <div className="flex items-center justify-between mb-3">
                <span className="text-lg font-bold text-blue-600">{formatPrice(product.priceMinor)}</span>
                <SimplifiedBadge variant="success">{product.commissionPercent}% komissiya</SimplifiedBadge>
              </div>
              
              <Link href={`/creator/my-streams/${product.id}`}>
                <SimplifiedButton variant="primary" fullWidth>
                  Oqim yaratish
                </SimplifiedButton>
              </Link>
            </SimplifiedCardContent>
          </SimplifiedCard>
        ))}
      </div>
      
      {filteredProducts.length === 0 && (
        <SimplifiedCard>
          <SimplifiedCardContent>
            <p className="text-center text-gray-600 py-8">
              {search ? 'Mahsulot topilmadi' : 'Mahsulotlar yo\'q'}
            </p>
          </SimplifiedCardContent>
        </SimplifiedCard>
      )}
    </div>
  );
}
