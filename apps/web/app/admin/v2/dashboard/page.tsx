/**
 * Simplified Admin Dashboard Page
 * 
 * A clean, simple dashboard for admins.
 * Shows key metrics: revenue, orders, creators, commissions.
 */

'use client';

import { useState, useEffect } from 'react';
import { SimplifiedCard, SimplifiedCardHeader, SimplifiedCardTitle, SimplifiedCardContent } from '@/components/simplified/simplified-card';
import { SimplifiedButton } from '@/components/simplified/simplified-button';
import { SimplifiedLoading } from '@/components/simplified/simplified-loading';

export default function SimplifiedAdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  
  // Placeholder metrics - will be fetched from API in Phase 2
  const metrics = {
    todayRevenue: 15000000,
    monthRevenue: 450000000,
    totalOrders: 1234,
    activeCreators: 56,
    pendingPayouts: 25000000,
  };
  
  useEffect(() => {
    // Simulate loading
    setTimeout(() => setLoading(false), 1000);
  }, []);
  
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
      {/*Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <div className="flex gap-2">
              <SimplifiedButton variant="outline" onClick={() => {/* Navigate to products */}}>
                Products
              </SimplifiedButton>
              <SimplifiedButton variant="outline" onClick={() => {/* Navigate to orders */}}>
                Orders
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
          {/* Key Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SimplifiedCard>
              <SimplifiedCardContent>
                <p className="text-sm text-gray-600">Today's Revenue</p>
                <p className="text-2xl font-bold text-green-600 mt-1">
                  {formatPrice(metrics.todayRevenue)}
                </p>
              </SimplifiedCardContent>
            </SimplifiedCard>
            
            <SimplifiedCard>
              <SimplifiedCardContent>
                <p className="text-sm text-gray-600">This Month's Revenue</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">
                  {formatPrice(metrics.monthRevenue)}
                </p>
              </SimplifiedCardContent>
            </SimplifiedCard>
            
            <SimplifiedCard>
              <SimplifiedCardContent>
                <p className="text-sm text-gray-600">Total Orders</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {metrics.totalOrders.toLocaleString()}
                </p>
              </SimplifiedCardContent>
            </SimplifiedCard>
            
            <SimplifiedCard>
              <SimplifiedCardContent>
                <p className="text-sm text-gray-600">Active Creators</p>
                <p className="text-2xl font-bold text-purple-600 mt-1">
                  {metrics.activeCreators}
                </p>
              </SimplifiedCardContent>
            </SimplifiedCard>
          </div>
          
          {/* Pending Payouts Alert */}
          {metrics.pendingPayouts > 0 && (
            <SimplifiedCard className="border-yellow-200 bg-yellow-50">
              <SimplifiedCardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-yellow-900">Pending Payouts</p>
                    <p className="text-sm text-yellow-700">
                      {formatPrice(metrics.pendingPayouts)} awaiting processing
                    </p>
                  </div>
                  <SimplifiedButton
                    variant="primary"
                    onClick={() => {/* Navigate to earnings */}}
                  >
                    Review
                  </SimplifiedButton>
                </div>
              </SimplifiedCardContent>
            </SimplifiedCard>
          )}
          
          {/* Quick Actions */}
          <SimplifiedCard>
            <SimplifiedCardHeader>
              <SimplifiedCardTitle>Quick Actions</SimplifiedCardTitle>
            </SimplifiedCardHeader>
            <SimplifiedCardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <SimplifiedButton
                  variant="outline"
                  onClick={() => {/* Navigate to add product */}}
                >
                  Add New Product
                </SimplifiedButton>
                
                <SimplifiedButton
                  variant="outline"
                  onClick={() => {/* Navigate to pending orders */}}
                >
                  Process Orders
                </SimplifiedButton>
                
                <SimplifiedButton
                  variant="outline"
                  onClick={() => {/* Navigate to creator applications */}}
                >
                  Review Applications
                </SimplifiedButton>
              </div>
            </SimplifiedCardContent>
          </SimplifiedCard>
          
          {/* Recent Activity */}
          <SimplifiedCard>
            <SimplifiedCardHeader>
              <SimplifiedCardTitle>Recent Activity</SimplifiedCardTitle>
            </SimplifiedCardHeader>
            <SimplifiedCardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <div>
                    <p className="font-medium text-gray-900">New order #1234</p>
                    <p className="text-sm text-gray-600">2 minutes ago</p>
                  </div>
                  <span className="text-green-600 font-medium">+250,000 so'm</span>
                </div>
                
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <div>
                    <p className="font-medium text-gray-900">Creator Malika joined</p>
                    <p className="text-sm text-gray-600">15 minutes ago</p>
                  </div>
                  <span className="text-blue-600 font-medium">New Creator</span>
                </div>
                
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <div>
                    <p className="font-medium text-gray-900">Payout request #567</p>
                    <p className="text-sm text-gray-600">1 hour ago</p>
                  </div>
                  <span className="text-yellow-600 font-medium">Pending</span>
                </div>
                
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-medium text-gray-900">Product "Face Serum" updated</p>
                    <p className="text-sm text-gray-600">3 hours ago</p>
                  </div>
                  <span className="text-gray-600 font-medium">Updated</span>
                </div>
              </div>
            </SimplifiedCardContent>
          </SimplifiedCard>
        </div>
      </div>
    </div>
  );
}
