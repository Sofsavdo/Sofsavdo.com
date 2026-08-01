/**
 * Mening Oqimlarim (My Streams) Detail Page
 * 
 * Shows creator's stream for a specific product with referral link ready to share.
 */

'use client';

import { useState, useEffect } from 'react';
import { SimplifiedCard, SimplifiedCardHeader, SimplifiedCardTitle, SimplifiedCardContent } from '@/components/simplified/simplified-card';
import { SimplifiedButton } from '@/components/simplified/simplified-button';
import { SimplifiedLoading } from '@/components/simplified/simplified-loading';
import { SimplifiedBadge } from '@/components/simplified/simplified-badge';
import { productsV2Service, type SimplifiedProductDto } from '@/services/v2/products-v2.service';
import { creatorsV2Service } from '@/services/v2/creators-v2.service';

export default function MyStreamDetailPage({ params }: { params: { id: string } }) {
  const [product, setProduct] = useState<SimplifiedProductDto | null>(null);
  const [referralLink, setReferralLink] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  
  useEffect(() => {
    loadStream();
  }, [params.id]);
  
  const loadStream = async () => {
    setLoading(true);
    try {
      const productData = await productsV2Service.findOne(params.id);
      setProduct(productData);
      
      // Generate referral link using product slug
      const link = `${window.location.origin}/buyer/v2/f/${productData.id}`;
      setReferralLink(link);
    } catch (error) {
      console.error('Failed to load stream:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };
  
  const handleShareTelegram = () => {
    const text = `Bu mahsulotni ko'ring: ${product?.title}\n\n${referralLink}`;
    window.open(`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(text)}`, '_blank');
  };
  
  const handleShareWhatsApp = () => {
    const text = `Bu mahsulotni ko'ring: ${product?.title}\n\n${referralLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
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
  
  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <SimplifiedCard>
          <SimplifiedCardContent>
            <p className="text-center text-gray-600">Mahsulot topilmadi</p>
          </SimplifiedCardContent>
        </SimplifiedCard>
      </div>
    );
  }
  
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Mening Oqimim</h1>
        <p className="text-gray-600">Referal havolani oling va tarqating</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Product Info */}
        <SimplifiedCard>
          <SimplifiedCardContent className="p-4">
            <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-4">
              <img
                src={product.images[0] || '/placeholder.png'}
                alt={product.title}
                className="w-full h-full object-cover"
              />
            </div>
            
            <h2 className="text-xl font-bold text-gray-900 mb-2">{product.title}</h2>
            
            <div className="flex items-center gap-4 mb-4">
              <span className="text-2xl font-bold text-blue-600">{formatPrice(product.priceMinor)}</span>
              <SimplifiedBadge variant="success">{product.commissionPercent}% komissiya</SimplifiedBadge>
            </div>
            
            {product.description && (
              <p className="text-gray-600 text-sm">{product.description}</p>
            )}
          </SimplifiedCardContent>
        </SimplifiedCard>
        
        {/* Referral Link */}
        <div className="space-y-4">
          <SimplifiedCard>
            <SimplifiedCardHeader>
              <SimplifiedCardTitle>Referal havola</SimplifiedCardTitle>
            </SimplifiedCardHeader>
            <SimplifiedCardContent>
              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <p className="text-sm text-gray-600 mb-2">Sizning havolangiz:</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={referralLink}
                    readOnly
                    className="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                  <SimplifiedButton
                    variant="outline"
                    onClick={handleCopyLink}
                  >
                    {copied ? 'Nusxa olindi!' : 'Nusxa olish'}
                  </SimplifiedButton>
                </div>
              </div>
              
              <div className="bg-blue-50 p-4 rounded-lg mb-4">
                <p className="text-sm text-blue-900 font-medium mb-1">Qancha topishingiz mumkin:</p>
                <p className="text-2xl font-bold text-blue-600">
                  {formatPrice(product.estimatedEarningsPerSaleMinor)}
                </p>
                <p className="text-xs text-blue-700 mt-1">har bir sotuvdan</p>
              </div>
            </SimplifiedCardContent>
          </SimplifiedCard>
          
          <SimplifiedCard>
            <SimplifiedCardHeader>
              <SimplifiedCardTitle>Ijtimoiy tarmoqlarda ulashish</SimplifiedCardTitle>
            </SimplifiedCardHeader>
            <SimplifiedCardContent>
              <div className="flex gap-2">
                <SimplifiedButton
                  variant="outline"
                  fullWidth
                  onClick={handleShareTelegram}
                >
                  Telegram
                </SimplifiedButton>
                <SimplifiedButton
                  variant="outline"
                  fullWidth
                  onClick={handleShareWhatsApp}
                >
                  WhatsApp
                </SimplifiedButton>
              </div>
            </SimplifiedCardContent>
          </SimplifiedCard>
          
          <SimplifiedCard>
            <SimplifiedCardHeader>
              <SimplifiedCardTitle>Qanday ishlaydi?</SimplifiedCardTitle>
            </SimplifiedCardHeader>
            <SimplifiedCardContent>
              <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
                <li>Havolani nusxa oling</li>
                <li>Ijtimoiy tarmoqlarda ulashing</li>
                <li>Siz havola orqali kelgan har bir sotuvdan komissiya olasiz</li>
                <li>Daromad "Daromad" bo'limida ko'rinadi</li>
              </ol>
            </SimplifiedCardContent>
          </SimplifiedCard>
        </div>
      </div>
    </div>
  );
}
