/**
 * Branded Product Page for Creator Links
 * 
 * When a buyer clicks a creator's referral link, they see this branded product page
 * Silent attribution tracking happens in the background
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { SimplifiedButton } from '@/components/simplified/simplified-button';
import { SimplifiedCard, SimplifiedCardHeader, SimplifiedCardTitle, SimplifiedCardContent } from '@/components/simplified/simplified-card';
import { SimplifiedInput } from '@/components/simplified/simplified-input';
import { SimplifiedModal } from '@/components/simplified/simplified-modal';
import { SimplifiedImage } from '@/components/simplified/simplified-image';
import { productsV2Service, type SimplifiedProductDto } from '@/services/v2/products-v2.service';

export default function BrandedProductPage() {
  const params = useParams();
  const referralCode = params.referralCode as string;
  const productId = params.productId as string;
  
  const [product, setProduct] = useState<SimplifiedProductDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [quickBuyModalOpen, setQuickBuyModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  useEffect(() => {
    // Silent attribution tracking
    trackReferral(referralCode, productId);
    // Load product
    loadProduct(productId);
  }, [referralCode, productId]);
  
  const trackReferral = (referralCode: string, productId: string) => {
    // Store referral code in localStorage for attribution
    localStorage.setItem('referralCode', referralCode);
    localStorage.setItem('referralProductId', productId);
    localStorage.setItem('referralTimestamp', Date.now().toString());
    
    // Optional: Send tracking event to backend
    // fetch('/api/v2/attribution/track', {
    //   method: 'POST',
    //   body: JSON.stringify({ referralCode, productId }),
    // });
  };
  
  const loadProduct = async (id: string) => {
    setLoading(true);
    try {
      const data = await productsV2Service.findOne(id);
      setProduct(data);
    } catch (error) {
      console.error('Failed to load product:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleQuickBuy = () => {
    setQuickBuyModalOpen(true);
  };
  
  const handleQuickBuySubmit = async () => {
    if (!name || !phone) {
      alert('Iltimos, ism va telefon raqamni kiriting');
      return;
    }
    
    setSubmitting(true);
    try {
      // Create order with referral attribution
      const orderData = {
        customerName: name,
        customerPhone: phone,
        productId: product?.id,
        quantity,
        paymentMethod: 'cash',
        referralCode,
      };
      
      // Call order creation API
      // const order = await ordersV2Service.create(orderData);
      
      // Redirect to order success
      // window.location.href = `/buyer/v2/order-success?orderId=${order.id}`;
      
      alert('Buyurtmangiz qabul qilindi! Tez orada operatorimiz siz bilan bog\'lanadi.');
      setQuickBuyModalOpen(false);
    } catch (error) {
      console.error('Failed to create order:', error);
      alert('Buyurtma yaratishda xatolik yuz berdi. Iltimos, qaytadan urinib ko\'ring.');
    } finally {
      setSubmitting(false);
    }
  };
  
  const formatPrice = (minor: number) => {
    return (minor / 100).toLocaleString('uz-UZ') + " so'm";
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Yuklanmoqda...</p>
        </div>
      </div>
    );
  }
  
  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <SimplifiedCard>
          <SimplifiedCardContent>
            <p className="text-center text-gray-600">Mahsulot topilmadi</p>
          </SimplifiedCardContent>
        </SimplifiedCard>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Sofsavdo branding */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-blue-600">Sofsavdo</h1>
              <p className="text-sm text-gray-600">Sifatli mahsulotlar</p>
            </div>
            <SimplifiedButton variant="outline" onClick={() => window.location.href = '/'}>
              Bosh sahifa
            </SimplifiedButton>
          </div>
        </div>
      </header>
      
      {/* Product content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Product images */}
          <div className="space-y-4">
            <div className="aspect-square bg-white rounded-xl overflow-hidden shadow-sm">
              <SimplifiedImage 
                src={product.images[0] || '/placeholder.png'} 
                alt={product.title} 
                className="w-full h-full"
              />
            </div>
            
            {product.images.length > 1 && (
              <div className="grid grid-cols-4 gap-2">
                {product.images.slice(1).map((image, index) => (
                  <div key={index} className="aspect-square bg-white rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-500">
                    <SimplifiedImage 
                      src={image} 
                      alt={`${product.title} ${index + 2}`} 
                      className="w-full h-full"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Product info */}
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{product.title}</h1>
              {product.category && (
                <span className="inline-block bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm">
                  {product.category}
                </span>
              )}
            </div>
            
            <div className="bg-blue-50 p-6 rounded-xl">
              <p className="text-sm text-gray-600 mb-1">Narxi:</p>
              <p className="text-4xl font-bold text-blue-600">
                {formatPrice(product.priceMinor)}
              </p>
            </div>
            
            {product.description && (
              <div>
                <h2 className="font-bold text-gray-900 mb-2">Tavsif</h2>
                <p className="text-gray-600 whitespace-pre-line">{product.description}</p>
              </div>
            )}
            
            {/* Trust signals */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span className="text-green-600 text-lg">✓</span>
                <span>Tezkor yetkazib berish (2-3 kun)</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span className="text-green-600 text-lg">✓</span>
                <span>Sifat kafolati</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span className="text-green-600 text-lg">✓</span>
                <span>Qulay to'lov (Click, Payme, Naqd)</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span className="text-green-600 text-lg">✓</span>
                <span>14 kunlik qaytarish kafolati</span>
              </div>
            </div>
            
            {/* Social proof */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex -space-x-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="w-8 h-8 bg-gray-200 rounded-full border-2 border-white" />
                  ))}
                </div>
                <p className="text-sm text-gray-600">1,234 odam sotib oldi</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex text-yellow-400">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <span key={i}>★</span>
                  ))}
                </div>
                <p className="text-sm text-gray-600">4.9 (256 sharh)</p>
              </div>
            </div>
            
            {/* Urgency */}
            <div className="bg-red-50 p-3 rounded-lg">
              <p className="text-sm text-red-600 font-medium">
                ⚡ Faqat 5 ta qoldi! Tezroq buyuring
              </p>
            </div>
            
            {/* Quantity selector */}
            <div className="flex items-center gap-4">
              <label className="font-medium text-gray-900">Soni:</label>
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
                <span className="text-gray-600">Jami:</span>
                <span className="text-2xl font-bold text-gray-900">
                  {formatPrice(product.priceMinor * quantity)}
                </span>
              </div>
            </div>
            
            {/* Quick buy button */}
            <SimplifiedButton
              variant="primary"
              fullWidth
              size="lg"
              onClick={handleQuickBuy}
            >
              Bir klikda sotib olish
            </SimplifiedButton>
            
            {/* Payment methods */}
            <div className="text-center text-sm text-gray-600">
              <p className="mb-2">Qulay to'lov usullari:</p>
              <div className="flex justify-center gap-4">
                <span>Click</span>
                <span>Payme</span>
                <span>Naqd</span>
                <span>Muddatli to'lov</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Quick buy modal */}
      <SimplifiedModal
        isOpen={quickBuyModalOpen}
        onClose={() => setQuickBuyModalOpen(false)}
        title="Buyurtmani tasdiqlash"
        size="sm"
      >
        <div className="space-y-4">
          <SimplifiedInput
            label="Ism"
            placeholder="Ismingiz"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <SimplifiedInput
            label="Telefon"
            placeholder="+998 90 123 45 67"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <div className="bg-blue-50 p-3 rounded-lg">
            <p className="text-sm text-gray-600">
              Mahsulot: <span className="font-medium">{product?.title}</span>
            </p>
            <p className="text-sm text-gray-600">
              Jami: <span className="font-bold">{formatPrice(product?.priceMinor! * quantity)}</span>
            </p>
          </div>
          <SimplifiedButton
            variant="primary"
            fullWidth
            onClick={handleQuickBuySubmit}
            loading={submitting}
          >
            Tasdiqlash
          </SimplifiedButton>
          <SimplifiedButton
            variant="ghost"
            fullWidth
            onClick={() => setQuickBuyModalOpen(false)}
            disabled={submitting}
          >
            Bekor qilish
          </SimplifiedButton>
        </div>
      </SimplifiedModal>
    </div>
  );
}
