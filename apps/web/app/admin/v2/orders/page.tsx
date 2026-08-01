/**
 * Simplified Admin Orders Management Page
 * 
 * A clean, simple orders management page for admins.
 * List, view, and update order status.
 */

'use client';

import { useState, useEffect } from 'react';
import { SimplifiedCard, SimplifiedCardHeader, SimplifiedCardTitle, SimplifiedCardContent } from '@/components/simplified/simplified-card';
import { SimplifiedButton } from '@/components/simplified/simplified-button';
import { SimplifiedInput } from '@/components/simplified/simplified-input';
import { SimplifiedLoading } from '@/components/simplified/simplified-loading';
import { SimplifiedBadge } from '@/components/simplified/simplified-badge';
import { SimplifiedModal } from '@/components/simplified/simplified-modal';
import { ordersV2Service, type SimplifiedOrderDto, type UpdateOrderStatusDto } from '@/services/v2/orders-v2.service';

export default function SimplifiedAdminOrdersPage() {
  const [orders, setOrders] = useState<SimplifiedOrderDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<SimplifiedOrderDto | null>(null);
  const [updating, setUpdating] = useState(false);
  
  useEffect(() => {
    loadOrders();
  }, []);
  
  const loadOrders = async () => {
    setLoading(true);
    try {
      const response = await ordersV2Service.list({ status: statusFilter || undefined });
      setOrders(response.items);
    } catch (error) {
      console.error('Failed to load orders:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleViewOrder = (order: SimplifiedOrderDto) => {
    setSelectedOrder(order);
  };
  
  const handleUpdateStatus = async (status: string) => {
    if (!selectedOrder) return;
    
    setUpdating(true);
    try {
      await ordersV2Service.updateStatus(selectedOrder.id, { status: status as any });
      setSelectedOrder(null);
      await loadOrders();
    } catch (error) {
      console.error('Failed to update order status:', error);
      alert('Failed to update order status. Please try again.');
    } finally {
      setUpdating(false);
    }
  };
  
  const formatPrice = (minor: number) => {
    return (minor / 100).toLocaleString('uz-UZ') + " so'm";
  };
  
  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'PAID': return 'success';
      case 'SHIPPED': return 'info';
      case 'DELIVERED': return 'success';
      case 'CANCELLED': return 'error';
      case 'REFUNDED': return 'warning';
      default: return 'neutral';
    }
  };
  
  const filteredOrders = orders.filter(order =>
    order.customerName.toLowerCase().includes(search.toLowerCase()) ||
    order.customerPhone.includes(search)
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
            <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
            <div className="flex gap-2">
              <SimplifiedButton variant="outline" onClick={() => {/* Navigate to dashboard */}}>
                Dashboard
              </SimplifiedButton>
              <SimplifiedButton variant="outline" onClick={() => {/* Navigate to products */}}>
                Products
              </SimplifiedButton>
              <SimplifiedButton variant="outline" onClick={() => {/* Navigate to creators */}}>
                Creators
              </SimplifiedButton>
              <SimplifiedButton variant="outline" onClick={() => {/* Navigate to earnings */}}>
                Earnings
              </SimplifiedButton>
              <SimplifiedButton variant="outline" onClick={() => {/* Navigate to settings */}}>
                Settings
              </SimplifiedButton>
            </div>
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Filters */}
          <div className="flex gap-4">
            <SimplifiedInput
              placeholder="Search by name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1"
            />
            <SimplifiedInput
              placeholder="Filter by status..."
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-48"
            />
            <SimplifiedButton variant="primary" onClick={loadOrders}>
              Filter
            </SimplifiedButton>
          </div>
          
          {/* Orders Table */}
          <SimplifiedCard>
            <SimplifiedCardContent>
              {filteredOrders.length === 0 ? (
                <p className="text-center text-gray-600 py-8">
                  {search || statusFilter ? 'No orders found matching your filters.' : 'No orders yet.'}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Order ID</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Customer</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Items</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Total</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Date</th>
                        <th className="text-right py-3 px-4 font-medium text-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrders.map((order) => (
                        <tr key={order.id} className="border-b border-gray-100 last:border-0">
                          <td className="py-3 px-4 font-medium text-gray-900">
                            #{order.id.slice(-6)}
                          </td>
                          <td className="py-3 px-4">
                            <div>
                              <p className="font-medium text-gray-900">{order.customerName}</p>
                              <p className="text-sm text-gray-600">{order.customerPhone}</p>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-gray-600">
                            {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                          </td>
                          <td className="py-3 px-4 font-medium text-gray-900">
                            {formatPrice(order.totalMinor)}
                          </td>
                          <td className="py-3 px-4">
                            <SimplifiedBadge variant={getStatusVariant(order.status)}>
                              {order.status}
                            </SimplifiedBadge>
                          </td>
                          <td className="py-3 px-4 text-gray-600">
                            {new Date(order.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <SimplifiedButton
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewOrder(order)}
                            >
                              View
                            </SimplifiedButton>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SimplifiedCardContent>
          </SimplifiedCard>
        </div>
        
        {/* Order Detail Modal */}
        {selectedOrder && (
          <SimplifiedModal
            isOpen={!!selectedOrder}
            onClose={() => setSelectedOrder(null)}
            title={`Order #${selectedOrder.id.slice(-6)}`}
            size="lg"
          >
            <div className="space-y-6">
              {/* Customer Info */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-2">Customer Information</h3>
                <div className="space-y-1">
                  <p className="text-gray-600"><span className="font-medium">Name:</span> {selectedOrder.customerName}</p>
                  <p className="text-gray-600"><span className="font-medium">Phone:</span> {selectedOrder.customerPhone}</p>
                  {selectedOrder.customerAddress && (
                    <p className="text-gray-600"><span className="font-medium">Address:</span> {selectedOrder.customerAddress}</p>
                  )}
                </div>
              </div>
              
              {/* Order Items */}
              <div>
                <h3 className="font-medium text-gray-900 mb-2">Order Items</h3>
                <div className="space-y-2">
                  {selectedOrder.items.map((item, index) => (
                    <div key={index} className="flex justify-between py-2 border-b border-gray-100">
                      <div>
                        <p className="font-medium text-gray-900">{item.title}</p>
                        <p className="text-sm text-gray-600">Qty: {item.quantity}</p>
                      </div>
                      <p className="font-medium text-gray-900">{formatPrice(item.totalMinor)}</p>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between py-2 mt-2 font-bold text-gray-900">
                  <span>Total</span>
                  <span>{formatPrice(selectedOrder.totalMinor)}</span>
                </div>
              </div>
              
              {/* Order Status */}
              <div>
                <h3 className="font-medium text-gray-900 mb-2">Update Status</h3>
                <div className="flex gap-2 flex-wrap">
                  {['PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'].map((status) => (
                    <SimplifiedButton
                      key={status}
                      variant={selectedOrder.status === status ? 'primary' : 'outline'}
                      size="sm"
                      onClick={() => handleUpdateStatus(status)}
                      loading={updating}
                      disabled={updating}
                    >
                      {status}
                    </SimplifiedButton>
                  ))}
                </div>
              </div>
              
              {/* Payment Info */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-2">Payment Information</h3>
                <div className="space-y-1">
                  <p className="text-gray-600"><span className="font-medium">Method:</span> {selectedOrder.paymentMethod}</p>
                  <p className="text-gray-600"><span className="font-medium">Date:</span> {new Date(selectedOrder.createdAt).toLocaleString()}</p>
                </div>
              </div>
              
              <div className="flex gap-2">
                <SimplifiedButton
                  variant="outline"
                  fullWidth
                  onClick={() => setSelectedOrder(null)}
                >
                  Close
                </SimplifiedButton>
              </div>
            </div>
          </SimplifiedModal>
        )}
      </div>
    </div>
  );
}
