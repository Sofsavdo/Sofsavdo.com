/**
 * Simplified Buyer Checkout Page
 * 
 * A clean, simple checkout page for buyers.
 * Minimal form fields: name, phone, address.
 * Quick and easy checkout process.
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { SimplifiedCard, SimplifiedCardHeader, SimplifiedCardTitle, SimplifiedCardContent } from '@/components/simplified/simplified-card';
import { SimplifiedButton } from '@/components/simplified/simplified-button';
import { SimplifiedInput } from '@/components/simplified/simplified-input';
import { SimplifiedLoading } from '@/components/simplified/simplified-loading';
import { productsV2Service, type SimplifiedProductDto } from '@/services/v2/products-v2.service';
import { ordersV2Service, type CreateSimplifiedOrderDto } from '@/services/v2/orders-v2.service';

function CheckoutContent() {
  const searchParams = useSearchParams();
  const productId = searchParams.get('productId') || '';
  const quantityParam = searchParams.get('quantity') || '1';
  
  const [product, setProduct] = useState<SimplifiedProductDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [quantity, setQuantity] = useState(parseInt(quantityParam, 10));
  
  // Form state
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'click' | 'payme' | 'card'>('click');
  
  useEffect(() => {
    if (productId) {
      loadProduct();
    }
  }, [productId]);
  
  const loadProduct = async () => {
    setLoading(true);
    try {
      const data = await productsV2Service.findOne(productId);
      setProduct(data);
    } catch (error) {
      console.error('Failed to load product:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleSubmit = async () => {
    if (!product || !customerName || !customerPhone) {
      alert('Please fill in all required fields');
      return;
    }
    
    setSubmitting(true);
    try {
      const dto: CreateSimplifiedOrderDto = {
        customerName,
        customerPhone,
        customerAddress: customerAddress || undefined,
        productId: product.id,
        quantity,
        paymentMethod,
      };
      
      const order = await ordersV2Service.create(dto);
      
      // Redirect to success page
      window.location.href = `/buyer/v2/order-success?orderId=${order.id}`;
    } catch (error) {
      console.error('Failed to create order:', error);
      alert('Failed to create order. Please try again.');
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
  
  const total = product.priceMinor * quantity;
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900">Checkout</h1>
            <SimplifiedButton variant="outline" onClick={() => window.history.back()}>
              Back
            </SimplifiedButton>
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Order Form */}
          <div className="space-y-6">
            <SimplifiedCard>
              <SimplifiedCardHeader>
                <SimplifiedCardTitle>Delivery Information</SimplifiedCardTitle>
              </SimplifiedCardHeader>
              <SimplifiedCardContent>
                <div className="space-y-4">
                  <SimplifiedInput
                    label="Your Name"
                    placeholder="Malika"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    required
                  />
                  
                  <SimplifiedInput
                    label="Phone Number"
                    placeholder="+998 90 123 45 67"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    required
                    helperText="We'll call you to confirm delivery"
                  />
                  
                  <SimplifiedInput
                    label="Delivery Address"
                    placeholder="Street, apartment, city..."
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    helperText="Optional - we'll call to confirm"
                  />
                </div>
              </SimplifiedCardContent>
            </SimplifiedCard>
            
            <SimplifiedCard>
              <SimplifiedCardHeader>
                <SimplifiedCardTitle>Payment Method</SimplifiedCardTitle>
              </SimplifiedCardHeader>
              <SimplifiedCardContent>
                <div className="space-y-3">
                  {(['click', 'payme', 'card'] as const).map((method) => (
                    <button
                      key={method}
                      onClick={() => setPaymentMethod(method)}
                      className={`w-full p-4 rounded-lg border-2 text-left transition-colors ${
                        paymentMethod === method
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium capitalize">{method}</span>
                        {paymentMethod === method && (
                          <span className="text-blue-600">✓</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </SimplifiedCardContent>
            </SimplifiedCard>
          </div>
          
          {/* Order Summary */}
          <div className="space-y-6">
            <SimplifiedCard>
              <SimplifiedCardHeader>
                <SimplifiedCardTitle>Order Summary</SimplifiedCardTitle>
              </SimplifiedCardHeader>
              <SimplifiedCardContent>
                <div className="space-y-4">
                  {/* Product */}
                  <div className="flex gap-4 pb-4 border-b border-gray-100">
                    <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                      <img
                        src={product.images[0] || '/placeholder.png'}
                        alt={product.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{product.title}</p>
                      <p className="text-sm text-gray-600">Qty: {quantity}</p>
                      <p className="font-medium text-gray-900 mt-1">{formatPrice(product.priceMinor * quantity)}</p>
                    </div>
                  </div>
                  
                  {/* Total */}
                  <div className="flex justify-between items-center pt-4">
                    <span className="text-lg font-medium text-gray-900">Total</span>
                    <span className="text-2xl font-bold text-blue-600">{formatPrice(total)}</span>
                  </div>
                </div>
              </SimplifiedCardContent>
            </SimplifiedCard>
            
            {/* Submit Button */}
            <SimplifiedButton
              variant="primary"
              fullWidth
              size="lg"
              onClick={handleSubmit}
              loading={submitting}
              disabled={!customerName || !customerPhone}
            >
              {submitting ? 'Processing...' : 'Place Order'}
            </SimplifiedButton>
            
            {/* Trust Info */}
            <div className="text-center text-sm text-gray-600">
              <p>Your order will be confirmed by phone</p>
              <p>Delivery within 2-3 business days</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SimplifiedBuyerCheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <SimplifiedLoading size="lg" />
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  );
}
