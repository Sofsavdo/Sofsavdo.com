/**
 * Simplified Referrals Page
 * 
 * A clean, simple referrals page for creators.
 * Allows creators to invite friends and track their referrals.
 */

'use client';

import { useState, useEffect } from 'react';
import { SimplifiedCard, SimplifiedCardHeader, SimplifiedCardTitle, SimplifiedCardContent } from '@/components/simplified/simplified-card';
import { SimplifiedButton } from '@/components/simplified/simplified-button';
import { SimplifiedInput } from '@/components/simplified/simplified-input';
import { SimplifiedLoading } from '@/components/simplified/simplified-loading';

export default function SimplifiedReferralsPage() {
  const [referralCode, setReferralCode] = useState('');
  const [referralLink, setReferralLink] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  
  useEffect(() => {
    loadReferralInfo();
  }, []);
  
  const loadReferralInfo = async () => {
    setLoading(true);
    try {
      // TODO: Load from API
      setReferralCode('MALIKA123');
      setReferralLink('https://sofsavdo.com/r/MALIKA123');
    } catch (error) {
      console.error('Failed to load referral info:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const handleShareTelegram = () => {
    const text = `Sofsavdo orqali daromad toping! Mening havolam orqali qo'shiling: ${referralLink}`;
    window.open(`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(text)}`, '_blank');
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
            <h1 className="text-2xl font-bold text-gray-900">Invite Friends</h1>
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
          {/* Referral Link Card */}
          <SimplifiedCard>
            <SimplifiedCardHeader>
              <SimplifiedCardTitle>Your Referral Link</SimplifiedCardTitle>
            </SimplifiedCardHeader>
            <SimplifiedCardContent>
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">Share this link with friends:</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={referralLink}
                      readOnly
                      className="flex-1 bg-white border border-gray-300 rounded-lg px-4 py-2 text-sm"
                    />
                    <SimplifiedButton
                      variant="primary"
                      onClick={handleCopyLink}
                    >
                      {copied ? 'Copied!' : 'Copy'}
                    </SimplifiedButton>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <SimplifiedButton
                    variant="outline"
                    fullWidth
                    onClick={handleShareTelegram}
                  >
                    Share on Telegram
                  </SimplifiedButton>
                  <SimplifiedButton
                    variant="outline"
                    fullWidth
                    onClick={() => {/* Share on WhatsApp */}}
                  >
                    Share on WhatsApp
                  </SimplifiedButton>
                </div>
              </div>
            </SimplifiedCardContent>
          </SimplifiedCard>
          
          {/* Referral Stats */}
          <SimplifiedCard>
            <SimplifiedCardHeader>
              <SimplifiedCardTitle>Your Referrals</SimplifiedCardTitle>
            </SimplifiedCardHeader>
            <SimplifiedCardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Total Referrals</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">12</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Active Referrals</p>
                  <p className="text-2xl font-bold text-green-600 mt-1">8</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Earnings from Referrals</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">150,000 so'm</p>
                </div>
              </div>
            </SimplifiedCardContent>
          </SimplifiedCard>
          
          {/* How it works */}
          <SimplifiedCard>
            <SimplifiedCardHeader>
              <SimplifiedCardTitle>How It Works</SimplifiedCardTitle>
            </SimplifiedCardHeader>
            <SimplifiedCardContent>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-600 font-bold">1</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Share your link</p>
                    <p className="text-sm text-gray-600">Send your referral link to friends via Telegram, WhatsApp, or social media</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-600 font-bold">2</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Friends join Sofsavdo</p>
                    <p className="text-sm text-gray-600">When they sign up using your link, they become your referral</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-600 font-bold">3</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Earn bonus</p>
                    <p className="text-sm text-gray-600">You earn 5% of your referrals' earnings for the first 30 days</p>
                  </div>
                </div>
              </div>
            </SimplifiedCardContent>
          </SimplifiedCard>
        </div>
      </div>
    </div>
  );
}
