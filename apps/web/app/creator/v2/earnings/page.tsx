/**
 * Simplified Earnings Page
 * 
 * A clean, simple earnings page for creators.
 * Shows available/pending earnings with withdrawal option.
 */

'use client';

import { useState, useEffect } from 'react';
import { SimplifiedCard, SimplifiedCardHeader, SimplifiedCardTitle, SimplifiedCardContent } from '@/components/simplified/simplified-card';
import { SimplifiedButton } from '@/components/simplified/simplified-button';
import { SimplifiedLoading } from '@/components/simplified/simplified-loading';
import { SimplifiedModal } from '@/components/simplified/simplified-modal';
import { SimplifiedInput } from '@/components/simplified/simplified-input';
import { earningsV2Service, type SimplifiedEarningsWithTransactionsDto, type SimplifiedTransactionDto } from '@/services/v2/earnings-v2.service';

export default function SimplifiedEarningsPage() {
  const [earnings, setEarnings] = useState<SimplifiedEarningsWithTransactionsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  
  useEffect(() => {
    loadEarnings();
  }, []);
  
  const loadEarnings = async () => {
    setLoading(true);
    try {
      const earningsData = await earningsV2Service.getMyEarningsWithTransactions();
      setEarnings(earningsData);
    } catch (error) {
      console.error('Failed to load earnings:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleWithdraw = async () => {
    const amount = parseInt(withdrawAmount, 10);
    if (!amount || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    
    if (!earnings || amount > earnings.availableMinor) {
      alert('Insufficient available earnings');
      return;
    }
    
    setWithdrawing(true);
    try {
      await earningsV2Service.createWithdrawal({
        amountMinor: amount,
      });
      
      setWithdrawModalOpen(false);
      setWithdrawAmount('');
      await loadEarnings();
      
      alert('Withdrawal request submitted successfully!');
    } catch (error) {
      console.error('Withdrawal failed:', error);
      alert('Failed to submit withdrawal request. Please try again.');
    } finally {
      setWithdrawing(false);
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
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">My Earnings</h1>
            <div className="flex gap-2">
              <SimplifiedButton variant="outline" onClick={() => {/* Navigate to products */}}>
                Products
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
        {earnings && (
          <div className="space-y-6">
            {/* Available Earnings Card */}
            <SimplifiedCard>
              <SimplifiedCardHeader>
                <SimplifiedCardTitle>Available to Withdraw</SimplifiedCardTitle>
              </SimplifiedCardHeader>
              <SimplifiedCardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-4xl font-bold text-green-600">
                      {formatPrice(earnings.availableMinor)}
                    </p>
                    <p className="text-gray-600 mt-1">
                      Pending: {formatPrice(earnings.pendingMinor)}
                    </p>
                  </div>
                  <SimplifiedButton
                    variant="primary"
                    onClick={() => setWithdrawModalOpen(true)}
                    disabled={earnings.availableMinor === 0}
                  >
                    Withdraw
                  </SimplifiedButton>
                </div>
              </SimplifiedCardContent>
            </SimplifiedCard>
            
            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <SimplifiedCard>
                <SimplifiedCardContent>
                  <p className="text-gray-600 text-sm">Total Earnings</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {formatPrice(earnings.totalLifetimeMinor)}
                  </p>
                </SimplifiedCardContent>
              </SimplifiedCard>
              
              <SimplifiedCard>
                <SimplifiedCardContent>
                  <p className="text-gray-600 text-sm">This Month</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {formatPrice(earnings.thisMonthMinor)}
                  </p>
                </SimplifiedCardContent>
              </SimplifiedCard>
              
              <SimplifiedCard>
                <SimplifiedCardContent>
                  <p className="text-gray-600 text-sm">Today</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {formatPrice(earnings.todayMinor)}
                  </p>
                </SimplifiedCardContent>
              </SimplifiedCard>
            </div>
            
            {/* Recent Transactions */}
            <SimplifiedCard>
              <SimplifiedCardHeader>
                <SimplifiedCardTitle>Recent Transactions</SimplifiedCardTitle>
              </SimplifiedCardHeader>
              <SimplifiedCardContent>
                {earnings.recentTransactions.length === 0 ? (
                  <p className="text-center text-gray-600">No transactions yet</p>
                ) : (
                  <div className="space-y-3">
                    {earnings.recentTransactions.map((transaction) => (
                      <div
                        key={transaction.id}
                        className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0"
                      >
                        <div>
                          <p className="font-medium text-gray-900">{transaction.description}</p>
                          <p className="text-sm text-gray-600">
                            {new Date(transaction.date).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p
                            className={`font-medium ${
                              transaction.amountMinor > 0 ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            {transaction.amountMinor > 0 ? '+' : ''}
                            {formatPrice(transaction.amountMinor)}
                          </p>
                          <p className="text-sm text-gray-600">{transaction.status}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SimplifiedCardContent>
            </SimplifiedCard>
          </div>
        )}
        
        {/* Withdraw Modal */}
        <SimplifiedModal
          isOpen={withdrawModalOpen}
          onClose={() => setWithdrawModalOpen(false)}
          title="Withdraw Earnings"
          size="sm"
        >
          {earnings && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Available to withdraw</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatPrice(earnings.availableMinor)}
                </p>
              </div>
              
              <SimplifiedInput
                label="Amount (in so'm)"
                type="number"
                placeholder="Enter amount"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                helperText="Minimum withdrawal: 10,000 so'm"
              />
              
              <div className="flex gap-2">
                <SimplifiedButton
                  variant="outline"
                  fullWidth
                  onClick={() => setWithdrawModalOpen(false)}
                >
                  Cancel
                </SimplifiedButton>
                <SimplifiedButton
                  variant="primary"
                  fullWidth
                  onClick={handleWithdraw}
                  loading={withdrawing}
                  disabled={!withdrawAmount}
                >
                  Withdraw
                </SimplifiedButton>
              </div>
            </div>
          )}
        </SimplifiedModal>
      </div>
    </div>
  );
}
