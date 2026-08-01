/**
 * Simplified Fund Page
 * 
 * A clean, simple fund page for creators.
 * Shows community fund and allows contributions.
 */

'use client';

import { useState, useEffect } from 'react';
import { SimplifiedCard, SimplifiedCardHeader, SimplifiedCardTitle, SimplifiedCardContent } from '@/components/simplified/simplified-card';
import { SimplifiedButton } from '@/components/simplified/simplified-button';
import { SimplifiedInput } from '@/components/simplified/simplified-input';
import { SimplifiedLoading } from '@/components/simplified/simplified-loading';
import { SimplifiedModal } from '@/components/simplified/simplified-modal';

export default function SimplifiedFundPage() {
  const [fundBalance, setFundBalance] = useState(0);
  const [myContributions, setMyContributions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [contributeModalOpen, setContributeModalOpen] = useState(false);
  const [contributeAmount, setContributeAmount] = useState('');
  const [contributing, setContributing] = useState(false);
  
  useEffect(() => {
    loadFundInfo();
  }, []);
  
  const loadFundInfo = async () => {
    setLoading(true);
    try {
      // TODO: Load from API
      setFundBalance(5000000); // 5 million so'm
      setMyContributions(100000); // 100k so'm
    } catch (error) {
      console.error('Failed to load fund info:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleContribute = async () => {
    const amount = parseInt(contributeAmount, 10);
    if (!amount || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    
    setContributing(true);
    try {
      // TODO: Call API to contribute
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      
      setContributeModalOpen(false);
      setContributeAmount('');
      setMyContributions(myContributions + amount);
      setFundBalance(fundBalance + amount);
      
      alert('Thank you for your contribution!');
    } catch (error) {
      console.error('Contribution failed:', error);
      alert('Failed to contribute. Please try again.');
    } finally {
      setContributing(false);
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
            <h1 className="text-2xl font-bold text-gray-900">Creator Fund</h1>
            <div className="flex gap-2">
              <SimplifiedButton variant="outline" onClick={() => {/* Navigate to products */}}>
                Products
              </SimplifiedButton>
              <SimplifiedButton variant="outline" onClick={() => {/* Navigate to earnings */}}>
                Earnings
              </SimplifiedButton>
            </div>
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Fund Balance Card */}
          <SimplifiedCard>
            <SimplifiedCardHeader>
              <SimplifiedCardTitle>Community Fund Balance</SimplifiedCardTitle>
            </SimplifiedCardHeader>
            <SimplifiedCardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-4xl font-bold text-purple-600">
                    {formatPrice(fundBalance)}
                  </p>
                  <p className="text-gray-600 mt-1">
                    Total contributions from all creators
                  </p>
                </div>
                <SimplifiedButton
                  variant="primary"
                  onClick={() => setContributeModalOpen(true)}
                >
                  Contribute
                </SimplifiedButton>
              </div>
            </SimplifiedCardContent>
          </SimplifiedCard>
          
          {/* My Contributions */}
          <SimplifiedCard>
            <SimplifiedCardHeader>
              <SimplifiedCardTitle>My Contributions</SimplifiedCardTitle>
            </SimplifiedCardHeader>
            <SimplifiedCardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Total Contributed</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {formatPrice(myContributions)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Rank</p>
                  <p className="text-2xl font-bold text-purple-600 mt-1">#15</p>
                </div>
              </div>
            </SimplifiedCardContent>
          </SimplifiedCard>
          
          {/* Recent Contributions */}
          <SimplifiedCard>
            <SimplifiedCardHeader>
              <SimplifiedCardTitle>Recent Contributions</SimplifiedCardTitle>
            </SimplifiedCardHeader>
            <SimplifiedCardContent>
              <div className="space-y-3">
                {[
                  { name: 'Malika', amount: 50000, time: '2 hours ago' },
                  { name: 'Aziz', amount: 100000, time: '5 hours ago' },
                  { name: 'Nilufar', amount: 25000, time: '1 day ago' },
                  { name: 'Jasur', amount: 75000, time: '2 days ago' },
                ].map((contribution, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{contribution.name}</p>
                      <p className="text-sm text-gray-600">{contribution.time}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-purple-600">
                        {formatPrice(contribution.amount)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </SimplifiedCardContent>
          </SimplifiedCard>
          
          {/* How it works */}
          <SimplifiedCard>
            <SimplifiedCardHeader>
              <SimplifiedCardTitle>How the Fund Works</SimplifiedCardTitle>
            </SimplifiedCardHeader>
            <SimplifiedCardContent>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-purple-600 font-bold">1</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Voluntary contributions</p>
                    <p className="text-sm text-gray-600">Creators can voluntarily contribute to the community fund</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-purple-600 font-bold">2</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Community support</p>
                    <p className="text-sm text-gray-600">The fund is used to support creators in need and organize community events</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-purple-600 font-bold">3</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Transparent</p>
                    <p className="text-sm text-gray-600">All contributions and fund usage are publicly visible</p>
                  </div>
                </div>
              </div>
            </SimplifiedCardContent>
          </SimplifiedCard>
        </div>
        
        {/* Contribute Modal */}
        <SimplifiedModal
          isOpen={contributeModalOpen}
          onClose={() => setContributeModalOpen(false)}
          title="Contribute to Fund"
          size="sm"
        >
          <div className="space-y-4">
            <div className="bg-purple-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Your current balance</p>
              <p className="text-2xl font-bold text-purple-600">
                250,000 so'm
              </p>
            </div>
            
            <SimplifiedInput
              label="Amount (in so'm)"
              type="number"
              placeholder="Enter amount"
              value={contributeAmount}
              onChange={(e) => setContributeAmount(e.target.value)}
              helperText="Minimum contribution: 1,000 so'm"
            />
            
            <div className="flex gap-2">
              <SimplifiedButton
                variant="outline"
                fullWidth
                onClick={() => setContributeModalOpen(false)}
              >
                Cancel
              </SimplifiedButton>
              <SimplifiedButton
                variant="primary"
                fullWidth
                onClick={handleContribute}
                loading={contributing}
                disabled={!contributeAmount}
              >
                Contribute
              </SimplifiedButton>
            </div>
          </div>
        </SimplifiedModal>
      </div>
    </div>
  );
}
