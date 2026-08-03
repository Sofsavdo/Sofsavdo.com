/**
 * Market Page - Product Catalog
 *
 * Mobile-first product catalog for buyers to browse all products.
 * Simple, clean design optimized for mobile shopping.
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { SimplifiedCard, SimplifiedCardContent } from '@/components/simplified/simplified-card';
import { SimplifiedButton } from '@/components/simplified/simplified-button';
import { SimplifiedInput } from '@/components/simplified/simplified-input';
import { SimplifiedLoading } from '@/components/simplified/simplified-loading';
import { SimplifiedBadge } from '@/components/simplified/simplified-badge';
import { getCatalog } from '@/lib/api';

export default function MarketPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const response = await getCatalog({ page: 1 });
      setProducts(response.items);
    } catch (error) {
      console.error('Failed to load products:', error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };
  
  const formatPrice = (minor: number) => {
    return (minor / 100).toLocaleString('uz-UZ') + " so'm";
  };

  const categories = ['all', ...new Set(products.map(p => p.productType).filter(Boolean))];

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.offer.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || product.productType === selectedCategory;
    return matchesSearch && matchesCategory;
  });
  
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
          <h1 className="text-2xl font-bold text-gray-900">Mahsulotlar</h1>
          <p className="text-sm text-gray-600">Eng yaxshi mahsulotlar va xizmatlar</p>
        </div>
      </div>
      
      {/* Search and Filters */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <SimplifiedInput
            placeholder="Mahsulot qidiring..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-3"
          />
          
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap flex-shrink-0 ${
                selectedCategory === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Barchasi
            </button>
            {categories.filter(c => c !== 'all').map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category || 'all')}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap flex-shrink-0 ${
                  selectedCategory === category
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      {/* Products Grid */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {filteredProducts.length === 0 && !loading ? (
          <div className="text-center py-12">
            <p className="text-gray-600 mb-4">
              {search ? 'Mahsulot topilmadi' : 'Mahsulotlar yo\'q'}
            </p>
            <button onClick={loadProducts} className="text-blue-600 hover:underline">
              Qayta yuklash
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredProducts.map((product) => (
              <Link key={product.id} href={`/catalog?offer=${product.offer.slug}`}>
                <SimplifiedCard className="hover:shadow-lg transition-shadow cursor-pointer">
                  <SimplifiedCardContent className="p-3">
                    <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-3">
                      <img
                        src={product.offer.heroImage || '/placeholder.png'}
                        alt={product.offer.name}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <h3 className="font-semibold text-gray-900 text-sm mb-2 line-clamp-2 min-h-[2.5rem]">
                      {product.offer.name}
                    </h3>

                    <div className="flex items-center justify-between mb-2">
                      <span className="text-lg font-bold text-blue-600">
                        {formatPrice(product.offer.priceMinor)}
                      </span>
                    </div>

                    <SimplifiedButton variant="primary" fullWidth size="sm">
                      Sotib olish
                    </SimplifiedButton>
                  </SimplifiedCardContent>
                </SimplifiedCard>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
