/**
 * Mening Oqimlarim (My Streams) Page
 * 
 * Shows creator's active streams with their referral links and stats.
 */

'use client';

import { useState, useEffect } from 'react';
import { SimplifiedCard, SimplifiedCardHeader, SimplifiedCardTitle, SimplifiedCardContent } from '@/components/simplified/simplified-card';
import { SimplifiedButton } from '@/components/simplified/simplified-button';
import { SimplifiedLoading } from '@/components/simplified/simplified-loading';
import { SimplifiedBadge } from '@/components/simplified/simplified-badge';
import Link from 'next/link';

interface MyStream {
  id: string;
  productId: string;
  productName: string;
  productImage: string;
  productPriceMinor: number;
  commissionPercent: number;
  referralLink: string;
  totalClicks: number;
  totalSales: number;
  totalEarningsMinor: number;
  createdAt: Date;
}

export default function MyStreamsPage() {
  const [streams, setStreams] = useState<MyStream[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadStreams();
  }, []);
  
  const loadStreams = async () => {
    setLoading(true);
    try {
      // TODO: Load from API
      const mockData: MyStream[] = [
        {
          id: '1',
          productId: 'p1',
          productName: 'Face Serum for Glowing Skin',
          productImage: 'https://via.placeholder.com/150',
          productPriceMinor: 150000,
          commissionPercent: 20,
          referralLink: 'https://sofsavdo.com/buyer/v2/f/p1',
          totalClicks: 156,
          totalSales: 12,
          totalEarningsMinor: 360000,
          createdAt: new Date('2024-07-15'),
        },
        {
          id: '2',
          productId: 'p2',
          productName: 'Vitamin C Serum',
          productImage: 'https://via.placeholder.com/150',
          productPriceMinor: 120000,
          commissionPercent: 25,
          referralLink: 'https://sofsavdo.com/buyer/v2/f/p2',
          totalClicks: 89,
          totalSales: 5,
          totalEarningsMinor: 150000,
          createdAt: new Date('2024-07-20'),
        },
      ];
      setStreams(mockData);
    } catch (error) {
      console.error('Failed to load streams:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const formatPrice = (minor: number) => {
    return (minor / 100).toLocaleString('uz-UZ') + " so'm";
  };
  
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
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Mening Oqimlarim</h1>
        <p className="text-gray-600">Sizning faol oqimlaringiz va ularning statistikasi</p>
      </div>
      
      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <SimplifiedCard>
          <SimplifiedCardContent>
            <p className="text-sm text-gray-600">Jami oqimlar</p>
            <p className="text-2xl font-bold text-gray-900">{streams.length}</p>
          </SimplifiedCardContent>
        </SimplifiedCard>
        
        <SimplifiedCard>
          <SimplifiedCardContent>
            <p className="text-sm text-gray-600">Jami bosishlar</p>
            <p className="text-2xl font-bold text-blue-600">
              {streams.reduce((sum, s) => sum + s.totalClicks, 0)}
            </p>
          </SimplifiedCardContent>
        </SimplifiedCard>
        
        <SimplifiedCard>
          <SimplifiedCardContent>
            <p className="text-sm text-gray-600">Jami daromad</p>
            <p className="text-2xl font-bold text-green-600">
              {formatPrice(streams.reduce((sum, s) => sum + s.totalEarningsMinor, 0))}
            </p>
          </SimplifiedCardContent>
        </SimplifiedCard>
      </div>
      
      {/* Streams List */}
      <div className="space-y-4">
        {streams.length === 0 ? (
          <SimplifiedCard>
            <SimplifiedCardContent>
              <div className="text-center py-12">
                <p className="text-gray-600 mb-4">Hali oqimlar yo'q</p>
                <Link href="/creator/streams">
                  <SimplifiedButton variant="primary">
                    Oqim yaratish
                  </SimplifiedButton>
                </Link>
              </div>
            </SimplifiedCardContent>
          </SimplifiedCard>
        ) : (
          streams.map((stream) => (
            <SimplifiedCard key={stream.id}>
              <SimplifiedCardContent>
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="w-24 h-24 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                    <img
                      src={stream.productImage}
                      alt={stream.productName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-2">{stream.productName}</h3>
                    
                    <div className="flex flex-wrap gap-4 mb-3">
                      <div>
                        <p className="text-xs text-gray-600">Narx</p>
                        <p className="font-medium text-gray-900">{formatPrice(stream.productPriceMinor)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Komissiya</p>
                        <SimplifiedBadge variant="success">{stream.commissionPercent}%</SimplifiedBadge>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Bosishlar</p>
                        <p className="font-medium text-gray-900">{stream.totalClicks}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Sotuvlar</p>
                        <p className="font-medium text-gray-900">{stream.totalSales}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Daromad</p>
                        <p className="font-medium text-green-600">{formatPrice(stream.totalEarningsMinor)}</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Link href={`/creator/my-streams/${stream.productId}`}>
                        <SimplifiedButton variant="primary" size="sm">
                          Batafsil
                        </SimplifiedButton>
                      </Link>
                      <SimplifiedButton variant="outline" size="sm">
                        Havolani nusxa olish
                      </SimplifiedButton>
                    </div>
                  </div>
                </div>
              </SimplifiedCardContent>
            </SimplifiedCard>
          ))
        )}
      </div>
      
      {/* Add New Stream Button */}
      {streams.length > 0 && (
        <div className="mt-6">
          <Link href="/creator/streams">
            <SimplifiedButton variant="outline" fullWidth>
              + Yangi oqim qo'shish
            </SimplifiedButton>
          </Link>
        </div>
      )}
    </div>
  );
}
