/**
 * Daromad (Earnings) Page
 * 
 * Simplified earnings page showing available balance, pending earnings, and withdrawal.
 */

'use client';

import { useState, useEffect } from 'react';
import { SimplifiedCard, SimplifiedCardHeader, SimplifiedCardTitle, SimplifiedCardContent } from '@/components/simplified/simplified-card';
import { SimplifiedButton } from '@/components/simplified/simplified-button';
import { SimplifiedLoading } from '@/components/simplified/simplified-loading';
import { SimplifiedModal } from '@/components/simplified/simplified-modal';
import { SimplifiedInput } from '@/components/simplified/simplified-input';
import { creatorsV2Service, type CreatorEarningsDto } from '@/services/v2/creators-v2.service';

export default function EarningsPage() {
  const [loading, setLoading] = useState(true);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  
  const [earnings, setEarnings] = useState<CreatorEarningsDto | null>(null);
  
  useEffect(() => {
    loadEarnings();
  }, []);
  
  const loadEarnings = async () => {
    setLoading(true);
    try {
      const data = await creatorsV2Service.getMyEarnings();
      setEarnings(data);
    } catch (error) {
      console.error('Failed to load earnings:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleWithdraw = async () => {
    if (!earnings) return;
    
    const amount = parseInt(withdrawAmount, 10);
    if (!amount || amount <= 0) {
      alert('Iltimos, to\'g\'ri miqdorni kiriting');
      return;
    }
    
    if (amount > earnings.availableBalanceMinor) {
      alert('Balansda yetarli mablag\' yo\'q');
      return;
    }
    
    setWithdrawing(true);
    try {
      await creatorsV2Service.requestWithdrawal(amount);
      
      setWithdrawModalOpen(false);
      setWithdrawAmount('');
      await loadEarnings();
      
      alert('Muvaffaqiyatli! Pul kartangizga o\'tkazildi.');
    } catch (error) {
      console.error('Withdrawal failed:', error);
      alert('Xatolik yuz berdi. Iltimos, qaytadan urinib ko\'ring.');
    } finally {
      setWithdrawing(false);
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

  if (!earnings) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Daromad ma'lumotlarini yuklab bo'lmadi</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Daromad</h1>
        <p className="text-gray-600">Balansingiz va daromadingiz</p>
      </div>
      
      {/* Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <SimplifiedCard>
          <SimplifiedCardContent>
            <p className="text-sm text-gray-600">Mavjud balans</p>
            <p className="text-2xl font-bold text-green-600 mt-1">
              {formatPrice(earnings.availableBalanceMinor)}
            </p>
            <p className="text-xs text-gray-500 mt-1">Yechib olish mumkin</p>
          </SimplifiedCardContent>
        </SimplifiedCard>
        
        <SimplifiedCard>
          <SimplifiedCardContent>
            <p className="text-sm text-gray-600">Kutilayotgan daromad</p>
            <p className="text-2xl font-bold text-yellow-600 mt-1">
              {formatPrice(earnings.pendingEarningsMinor)}
            </p>
            <p className="text-xs text-gray-500 mt-1">Tasdiqlanmoqda</p>
          </SimplifiedCardContent>
        </SimplifiedCard>
        
        <SimplifiedCard>
          <SimplifiedCardContent>
            <p className="text-sm text-gray-600">Jami daromad</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">
              {formatPrice(earnings.totalEarningsMinor)}
            </p>
            <p className="text-xs text-gray-500 mt-1">Barcha vaqt</p>
          </SimplifiedCardContent>
        </SimplifiedCard>
      </div>
      
      {/* Withdraw Button */}
      <SimplifiedCard className="mb-6">
        <SimplifiedCardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Balansni yechib olish</p>
              <p className="text-sm text-gray-600">Minimum 10,000 so'm</p>
            </div>
            <SimplifiedButton
              variant="primary"
              onClick={() => setWithdrawModalOpen(true)}
              disabled={earnings.availableBalanceMinor < 10000}
            >
              Yechib olish
            </SimplifiedButton>
          </div>
        </SimplifiedCardContent>
      </SimplifiedCard>
      
      {/* Transactions */}
      <SimplifiedCard>
        <SimplifiedCardHeader>
          <SimplifiedCardTitle>Oxirgi tranzaksiyalar</SimplifiedCardTitle>
        </SimplifiedCardHeader>
        <SimplifiedCardContent>
          <div className="space-y-3">
            {earnings.transactions.length === 0 ? (
              <p className="text-center text-gray-600 py-4">Tranzaksiyalar yo'q</p>
            ) : (
              earnings.transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0"
                >
                  <div>
                    <p className="font-medium text-gray-900">{tx.description}</p>
                    <p className="text-sm text-gray-600">{tx.date}</p>
                  </div>
                  <p className={`font-semibold ${tx.type === 'sale' ? 'text-green-600' : 'text-red-600'}`}>
                    {tx.type === 'sale' ? '+' : ''}{formatPrice(tx.amountMinor)}
                  </p>
                </div>
              ))
            )}
          </div>
        </SimplifiedCardContent>
      </SimplifiedCard>
      
      {/* Withdraw Modal */}
      <SimplifiedModal
        isOpen={withdrawModalOpen}
        onClose={() => setWithdrawModalOpen(false)}
        title="Balansni yechib olish"
        size="sm"
      >
        <div className="space-y-4">
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Mavjud balans</p>
            <p className="text-2xl font-bold text-green-600">
              {formatPrice(earnings.availableBalanceMinor)}
            </p>
          </div>
          
          <SimplifiedInput
            label="Miqdor (so'm)"
            type="number"
            placeholder="10000"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            helperText="Minimum: 10,000 so'm"
          />
          
          <div className="flex gap-2">
            <SimplifiedButton
              variant="outline"
              fullWidth
              onClick={() => setWithdrawModalOpen(false)}
            >
              Bekor qilish
            </SimplifiedButton>
            <SimplifiedButton
              variant="primary"
              fullWidth
              onClick={handleWithdraw}
              loading={withdrawing}
              disabled={!withdrawAmount}
            >
              Tasdiqlash
            </SimplifiedButton>
          </div>
        </div>
      </SimplifiedModal>
    </div>
  );
}
