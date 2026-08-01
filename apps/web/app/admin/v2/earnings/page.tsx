/**
 * Simplified Admin Earnings Overview Page
 * 
 * A clean, simple earnings overview page for admins.
 * Shows creator earnings, payouts, and commission overview.
 */

'use client';

import { useState, useEffect } from 'react';
import { SimplifiedCard, SimplifiedCardHeader, SimplifiedCardTitle, SimplifiedCardContent } from '@/components/simplified/simplified-card';
import { SimplifiedButton } from '@/components/simplified/simplified-button';
import { SimplifiedInput } from '@/components/simplified/simplified-input';
import { SimplifiedLoading } from '@/components/simplified/simplified-loading';
import { SimplifiedBadge } from '@/components/simplified/simplified-badge';
import { SimplifiedModal } from '@/components/simplified/simplified-modal';

export default function SimplifiedAdminEarningsPage() {
  const [loading, setLoading] = useState(true);
  const [selectedPayout, setSelectedPayout] = useState<any | null>(null);
  const [processing, setProcessing] = useState(false);
  
  // Placeholder data - will be fetched from API in Phase 2
  const stats = {
    totalCommissionPaid: 450000000,
    pendingPayouts: 25000000,
    thisMonthCommission: 35000000,
    activeCreators: 56,
  };
  
  const payouts = [
    {
      id: '1',
      creatorName: 'Malika',
      creatorId: 'c1',
      amountMinor: 5000000,
      payoutMethod: 'card',
      payoutDetails: '****1234',
      status: 'REQUESTED',
      requestedAt: '2024-08-01',
    },
    {
      id: '2',
      creatorName: 'Aziza',
      creatorId: 'c2',
      amountMinor: 3500000,
      payoutMethod: 'bank',
      payoutDetails: '****5678',
      status: 'PROCESSING',
      requestedAt: '2024-07-30',
    },
    {
      id: '3',
      creatorName: 'Nilufar',
      creatorId: 'c3',
      amountMinor: 2000000,
      payoutMethod: 'card',
      payoutDetails: '****9012',
      status: 'PAID',
      requestedAt: '2024-07-25',
      processedAt: '2024-07-27',
    },
  ];
  
  useEffect(() => {
    // Simulate loading
    setTimeout(() => setLoading(false), 1000);
  }, []);
  
  const handleProcessPayout = async (payout: any) => {
    setSelectedPayout(payout);
  };
  
  const handleApprove = async () => {
    if (!selectedPayout) return;
    
    setProcessing(true);
    try {
      // Placeholder - will call API in Phase 2
      await new Promise(resolve => setTimeout(resolve, 1000));
      setSelectedPayout(null);
      alert('Payout approved successfully!');
    } catch (error) {
      console.error('Failed to approve payout:', error);
      alert('Failed to approve payout. Please try again.');
    } finally {
      setProcessing(false);
    }
  };
  
  const handleReject = async () => {
    if (!selectedPayout) return;
    
    setProcessing(true);
    try {
      // Placeholder - will call API in Phase 2
      await new Promise(resolve => setTimeout(resolve, 1000));
      setSelectedPayout(null);
      alert('Payout rejected.');
    } catch (error) {
      console.error('Failed to reject payout:', error);
      alert('Failed to reject payout. Please try again.');
    } finally {
      setProcessing(false);
    }
  };
  
  const formatPrice = (minor: number) => {
    return (minor / 100).toLocaleString('uz-UZ') + " so'm";
  };
  
  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'REQUESTED': return 'warning';
      case 'PROCESSING': return 'info';
      case 'PAID': return 'success';
      case 'FAILED': return 'error';
      case 'CANCELLED': return 'neutral';
      default: return 'neutral';
    }
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
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Earnings</h1>
            <div className="flex gap-2">
              <SimplifiedButton variant="outline" onClick={() => {/* Navigate to dashboard */}}>
                Dashboard
              </SimplifiedButton>
              <SimplifiedButton variant="outline" onClick={() => {/* Navigate to products */}}>
                Products
              </SimplifiedButton>
              <SimplifiedButton variant="outline" onClick={() => {/* Navigate to orders */}}>
                Orders
              </SimplifiedButton>
              <SimplifiedButton variant="outline" onClick={() => {/* Navigate to creators */}}>
                Creators
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
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SimplifiedCard>
              <SimplifiedCardContent>
                <p className="text-sm text-gray-600">Total Commission Paid</p>
                <p className="text-2xl font-bold text-green-600 mt-1">
                  {formatPrice(stats.totalCommissionPaid)}
                </p>
              </SimplifiedCardContent>
            </SimplifiedCard>
            
            <SimplifiedCard>
              <SimplifiedCardContent>
                <p className="text-sm text-gray-600">Pending Payouts</p>
                <p className="text-2xl font-bold text-yellow-600 mt-1">
                  {formatPrice(stats.pendingPayouts)}
                </p>
              </SimplifiedCardContent>
            </SimplifiedCard>
            
            <SimplifiedCard>
              <SimplifiedCardContent>
                <p className="text-sm text-gray-600">This Month's Commission</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">
                  {formatPrice(stats.thisMonthCommission)}
                </p>
              </SimplifiedCardContent>
            </SimplifiedCard>
            
            <SimplifiedCard>
              <SimplifiedCardContent>
                <p className="text-sm text-gray-600">Active Creators</p>
                <p className="text-2xl font-bold text-purple-600 mt-1">
                  {stats.activeCreators}
                </p>
              </SimplifiedCardContent>
            </SimplifiedCard>
          </div>
          
          {/* Pending Payouts Alert */}
          {stats.pendingPayouts > 0 && (
            <SimplifiedCard className="border-yellow-200 bg-yellow-50">
              <SimplifiedCardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-yellow-900">Pending Payouts</p>
                    <p className="text-sm text-yellow-700">
                      {formatPrice(stats.pendingPayouts)} awaiting approval
                    </p>
                  </div>
                  <SimplifiedButton
                    variant="primary"
                    onClick={() => {/* Scroll to payouts */}}
                  >
                    Review
                  </SimplifiedButton>
                </div>
              </SimplifiedCardContent>
            </SimplifiedCard>
          )}
          
          {/* Payout Requests */}
          <SimplifiedCard>
            <SimplifiedCardHeader>
              <SimplifiedCardTitle>Payout Requests</SimplifiedCardTitle>
            </SimplifiedCardHeader>
            <SimplifiedCardContent>
              {payouts.length === 0 ? (
                <p className="text-center text-gray-600 py-8">No payout requests yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Creator</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Amount</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Method</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Details</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Requested</th>
                        <th className="text-right py-3 px-4 font-medium text-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payouts.map((payout) => (
                        <tr key={payout.id} className="border-b border-gray-100 last:border-0">
                          <td className="py-3 px-4 font-medium text-gray-900">
                            {payout.creatorName}
                          </td>
                          <td className="py-3 px-4 font-medium text-gray-900">
                            {formatPrice(payout.amountMinor)}
                          </td>
                          <td className="py-3 px-4 text-gray-600 capitalize">
                            {payout.payoutMethod}
                          </td>
                          <td className="py-3 px-4 text-gray-600">
                            {payout.payoutDetails}
                          </td>
                          <td className="py-3 px-4">
                            <SimplifiedBadge variant={getStatusVariant(payout.status)}>
                              {payout.status}
                            </SimplifiedBadge>
                          </td>
                          <td className="py-3 px-4 text-gray-600">
                            {new Date(payout.requestedAt).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {payout.status === 'REQUESTED' && (
                              <SimplifiedButton
                                variant="primary"
                                size="sm"
                                onClick={() => handleProcessPayout(payout)}
                              >
                                Review
                              </SimplifiedButton>
                            )}
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
        
        {/* Payout Review Modal */}
        {selectedPayout && (
          <SimplifiedModal
            isOpen={!!selectedPayout}
            onClose={() => setSelectedPayout(null)}
            title="Review Payout Request"
            size="sm"
          >
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="space-y-2">
                  <p className="text-gray-600"><span className="font-medium">Creator:</span> {selectedPayout.creatorName}</p>
                  <p className="text-gray-600"><span className="font-medium">Amount:</span> {formatPrice(selectedPayout.amountMinor)}</p>
                  <p className="text-gray-600"><span className="font-medium">Method:</span> {selectedPayout.payoutMethod}</p>
                  <p className="text-gray-600"><span className="font-medium">Details:</span> {selectedPayout.payoutDetails}</p>
                  <p className="text-gray-600"><span className="font-medium">Requested:</span> {new Date(selectedPayout.requestedAt).toLocaleDateString()}</p>
                </div>
              </div>
              
              <div className="flex gap-2">
                <SimplifiedButton
                  variant="outline"
                  fullWidth
                  onClick={handleReject}
                  loading={processing}
                  disabled={processing}
                >
                  Reject
                </SimplifiedButton>
                <SimplifiedButton
                  variant="primary"
                  fullWidth
                  onClick={handleApprove}
                  loading={processing}
                  disabled={processing}
                >
                  Approve & Pay
                </SimplifiedButton>
              </div>
              
              <SimplifiedButton
                variant="ghost"
                fullWidth
                onClick={() => setSelectedPayout(null)}
                disabled={processing}
              >
                Cancel
              </SimplifiedButton>
            </div>
          </SimplifiedModal>
        )}
      </div>
    </div>
  );
}
