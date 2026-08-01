/**
 * Simplified Admin Settings Page
 * 
 * A clean, simple settings page for admins.
 * Platform configuration and feature toggles.
 */

'use client';

import { useState, useEffect } from 'react';
import { SimplifiedCard, SimplifiedCardHeader, SimplifiedCardTitle, SimplifiedCardContent } from '@/components/simplified/simplified-card';
import { SimplifiedButton } from '@/components/simplified/simplified-button';
import { SimplifiedInput } from '@/components/simplified/simplified-input';
import { SimplifiedLoading } from '@/components/simplified/simplified-loading';

export default function SimplifiedAdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Settings state
  const [platformName, setPlatformName] = useState('Sofsavdo');
  const [commissionDefault, setCommissionDefault] = useState('20');
  const [minWithdrawal, setMinWithdrawal] = useState('10000');
  const [supportPhone, setSupportPhone] = useState('+998 90 123 45 67');
  const [supportEmail, setSupportEmail] = useState('support@sofsavdo.com');
  
  // Feature flags
  const [simplifiedRegistration, setSimplifiedRegistration] = useState(false);
  const [simplifiedProducts, setSimplifiedProducts] = useState(false);
  const [simplifiedEarnings, setSimplifiedEarnings] = useState(false);
  
  useEffect(() => {
    // Simulate loading
    setTimeout(() => setLoading(false), 1000);
  }, []);
  
  const handleSave = async () => {
    setSaving(true);
    try {
      // Placeholder - will call API in Phase 2
      await new Promise(resolve => setTimeout(resolve, 1000));
      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
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
            <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
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
          {/* Platform Settings */}
          <SimplifiedCard>
            <SimplifiedCardHeader>
              <SimplifiedCardTitle>Platform Settings</SimplifiedCardTitle>
            </SimplifiedCardHeader>
            <SimplifiedCardContent>
              <div className="space-y-4">
                <SimplifiedInput
                  label="Platform Name"
                  value={platformName}
                  onChange={(e) => setPlatformName(e.target.value)}
                />
                
                <SimplifiedInput
                  label="Default Commission (%)"
                  type="number"
                  value={commissionDefault}
                  onChange={(e) => setCommissionDefault(e.target.value)}
                  helperText="Default commission rate for new products"
                />
                
                <SimplifiedInput
                  label="Minimum Withdrawal (in so'm)"
                  type="number"
                  value={minWithdrawal}
                  onChange={(e) => setMinWithdrawal(e.target.value)}
                  helperText="Minimum amount creators can withdraw"
                />
              </div>
            </SimplifiedCardContent>
          </SimplifiedCard>
          
          {/* Contact Settings */}
          <SimplifiedCard>
            <SimplifiedCardHeader>
              <SimplifiedCardTitle>Contact Information</SimplifiedCardTitle>
            </SimplifiedCardHeader>
            <SimplifiedCardContent>
              <div className="space-y-4">
                <SimplifiedInput
                  label="Support Phone"
                  value={supportPhone}
                  onChange={(e) => setSupportPhone(e.target.value)}
                />
                
                <SimplifiedInput
                  label="Support Email"
                  type="email"
                  value={supportEmail}
                  onChange={(e) => setSupportEmail(e.target.value)}
                />
              </div>
            </SimplifiedCardContent>
          </SimplifiedCard>
          
          {/* Feature Flags */}
          <SimplifiedCard>
            <SimplifiedCardHeader>
              <SimplifiedCardTitle>Feature Flags</SimplifiedCardTitle>
            </SimplifiedCardHeader>
            <SimplifiedCardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b border-gray-100last:border-0">
                  <div>
                    <p className="font-medium text-gray-900">Simplified Registration</p>
                    <p className="text-sm text-gray-600">Enable the new 3-step registration flow</p>
                  </div>
                  <button
                    onClick={() => setSimplifiedRegistration(!simplifiedRegistration)}
                    className={`w-12 h-6 rounded-full transition-colors ${
                      simplifiedRegistration ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transition-transform ${
                        simplifiedRegistration ? 'translate-x-7' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                
                <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="font-medium text-gray-900">Simplified Products Catalog</p>
                    <p className="text-sm text-gray-600">Enable the new simplified product catalog</p>
                  </div>
                  <button
                    onClick={() => setSimplifiedProducts(!simplifiedProducts)}
                    className={`w-12 h-6 rounded-full transition-colors ${
                      simplifiedProducts ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transition-transform ${
                        simplifiedProducts ? 'translate-x-7' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                
                <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="font-medium text-gray-900">Simplified Earnings</p>
                    <p className="text-sm text-gray-600">Enable the new simplified earnings page</p>
                  </div>
                  <button
                    onClick={() => setSimplifiedEarnings(!simplifiedEarnings)}
                    className={`w-12 h-6 rounded-full transition-colors ${
                      simplifiedEarnings ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transition-transform ${
                        simplifiedEarnings ? 'translate-x-7' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </SimplifiedCardContent>
          </SimplifiedCard>
          
          {/* Save Button */}
          <div className="flex justify-end">
            <SimplifiedButton
              variant="primary"
              onClick={handleSave}
              loading={saving}
            >
              Save Settings
            </SimplifiedButton>
          </div>
        </div>
      </div>
    </div>
  );
}
