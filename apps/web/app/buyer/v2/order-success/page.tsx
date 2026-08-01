/**
 * Simplified Buyer Order Success Page
 * 
 * A clean, simple order confirmation page for buyers.
 * Shows order confirmation and next steps.
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { SimplifiedCard, SimplifiedCardHeader, SimplifiedCardTitle, SimplifiedCardContent } from '@/components/simplified/simplified-card';
import { SimplifiedButton } from '@/components/simplified/simplified-button';
import { SimplifiedLoading } from '@/components/simplified/simplified-loading';
import { ordersV2Service, type SimplifiedOrderDto } from '@/services/v2/orders-v2.service';

function OrderSuccessContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId') || '';
  
  const [order, setOrder] = useState<SimplifiedOrderDto | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (orderId) {
      loadOrder();
    }
  }, [orderId]);
  
  const loadOrder = async () => {
    setLoading(true);
    try {
      const data = await ordersV2Service.findOne(orderId);
      setOrder(data);
    } catch (error) {
      console.error('Failed to load order:', error);
    } finally {
      setLoading(false);
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
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-gray-900">Sofsavdo</h1>
        </div>
      </div>
      
      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="space-y-6">
          {/* Success Message */}
          <div className="text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Order Confirmed!</h1>
            <p className="text-gray-600">Thank you for your purchase</p>
          </div>
          
          {/* Order Details */}
          {order && (
            <SimplifiedCard>
              <SimplifiedCardHeader>
                <SimplifiedCardTitle>Order Details</SimplifiedCardTitle>
              </SimplifiedCardHeader>
              <SimplifiedCardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Order ID:</span>
                    <span className="font-medium text-gray-900">#{order.id.slice(-6)}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status:</span>
                    <span className="font-medium text-green-600">{order.status}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total:</span>
                    <span className="font-bold text-gray-900">{formatPrice(order.totalMinor)}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600">Payment Method:</span>
                    <span className="font-medium text-gray-900 capitalize">{order.paymentMethod}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600">Date:</span>
                    <span className="font-medium text-gray-900">{new Date(order.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              </SimplifiedCardContent>
            </SimplifiedCard>
          )}
          
          {/* Next Steps */}
          <SimplifiedCard>
            <SimplifiedCardHeader>
              <SimplifiedCardTitle>What's Next?</SimplifiedCardTitle>
            </SimplifiedCardHeader>
            <SimplifiedCardContent>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-blue-600 text-sm font-bold">1</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">We'll call you to confirm</p>
                    <p className="text-sm text-gray-600">Within 30 minutes to verify your order</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-blue-600 text-sm font-bold">2</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Your order is prepared</p>
                    <p className="text-sm text-gray-600">We'll prepare your items for delivery</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-blue-600 text-sm font-bold">3</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Delivery within 2-3 days</p>
                    <p className="text-sm text-gray-600">Fast delivery to your address</p>
                  </div>
                </div>
              </div>
            </SimplifiedCardContent>
          </SimplifiedCard>
          
          {/* Contact Support */}
          <SimplifiedCard className="bg-blue-50 border-blue-200">
            <SimplifiedCardContent>
              <div className="text-center">
                <p className="font-medium text-gray-900 mb-1">Need help?</p>
                <p className="text-sm text-gray-600 mb-2">Contact our support team</p>
                <p className="text-blue-600 font-medium">+998 90 123 45 67</p>
              </div>
            </SimplifiedCardContent>
          </SimplifiedCard>
          
          {/* Continue Shopping */}
          <SimplifiedButton
            variant="primary"
            fullWidth
            onClick={() => {/* Navigate to products */}}
          >
            Continue Shopping
          </SimplifiedButton>
        </div>
      </div>
    </div>
  );
}

export default function SimplifiedBuyerOrderSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <SimplifiedLoading size="lg" />
      </div>
    }>
      <OrderSuccessContent />
    </Suspense>
  );
}
