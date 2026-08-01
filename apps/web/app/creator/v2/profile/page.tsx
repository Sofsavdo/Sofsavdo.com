/**
 * Simplified Profile Page
 * 
 * A clean, simple profile page for creators.
 * Shows and allows editing of basic profile information.
 */

'use client';

import { useState, useEffect } from 'react';
import { SimplifiedCard, SimplifiedCardHeader, SimplifiedCardTitle, SimplifiedCardContent } from '@/components/simplified/simplified-card';
import { SimplifiedButton } from '@/components/simplified/simplified-button';
import { SimplifiedInput } from '@/components/simplified/simplified-input';
import { SimplifiedLoading } from '@/components/simplified/simplified-loading';
import { creatorsV2Service, type SimplifiedCreatorProfileDto, type UpdateSimplifiedCreatorProfileDto } from '@/services/v2/creators-v2.service';

export default function SimplifiedProfilePage() {
  const [profile, setProfile] = useState<SimplifiedCreatorProfileDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  
  // Form state
  const [displayName, setDisplayName] = useState('');
  const [city, setCity] = useState('');
  const [socialLink, setSocialLink] = useState('');
  const [payoutMethod, setPayoutMethod] = useState('');
  const [payoutDetails, setPayoutDetails] = useState('');
  
  useEffect(() => {
    loadProfile();
  }, []);
  
  const loadProfile = async () => {
    setLoading(true);
    try {
      const data = await creatorsV2Service.getMyProfile();
      setProfile(data);
      
      // Initialize form state
      setDisplayName(data.displayName);
      setCity(data.city || '');
      setSocialLink(data.socialLink || '');
      setPayoutMethod(data.payoutMethod || '');
      setPayoutDetails(data.payoutDetails || '');
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleSave = async () => {
    setSaving(true);
    try {
      const dto: UpdateSimplifiedCreatorProfileDto = {
        displayName,
        city: city || undefined,
        socialLink: socialLink || undefined,
        payoutMethod: payoutMethod || undefined,
        payoutDetails: payoutDetails || undefined,
      };
      
      const updated = await creatorsV2Service.updateMyProfile(dto);
      setProfile(updated);
      setEditing(false);
    } catch (error) {
      console.error('Failed to update profile:', error);
      alert('Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  
  const handleCancel = () => {
    if (profile) {
      setDisplayName(profile.displayName);
      setCity(profile.city || '');
      setSocialLink(profile.socialLink || '');
      setPayoutMethod(profile.payoutMethod || '');
      setPayoutDetails(profile.payoutDetails || '');
    }
    setEditing(false);
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
            <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
            <div className="flex gap-2">
              <SimplifiedButton variant="outline" onClick={() => {/* Navigate to products */}}>
                Products
              </SimplifiedButton>
              <SimplifiedButton variant="outline" onClick={() => {/* Navigate to earnings */}}>
                My Earnings
              </SimplifiedButton>
            </div>
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {profile && (
          <div className="space-y-6">
            {/* Profile Card */}
            <SimplifiedCard>
              <SimplifiedCardHeader>
                <div className="flex items-center justify-between">
                  <SimplifiedCardTitle>Profile Information</SimplifiedCardTitle>
                  {!editing && (
                    <SimplifiedButton variant="outline" onClick={() => setEditing(true)}>
                      Edit
                    </SimplifiedButton>
                  )}
                </div>
              </SimplifiedCardHeader>
              <SimplifiedCardContent>
                {editing ? (
                  <div className="space-y-4">
                    <SimplifiedInput
                      label="Display Name"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                    />
                    
                    <SimplifiedInput
                      label="City"
                      placeholder="Tashkent"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                    />
                    
                    <SimplifiedInput
                      label="Social Media Link"
                      placeholder="https://instagram.com/malika"
                      value={socialLink}
                      onChange={(e) => setSocialLink(e.target.value)}
                    />
                    
                    <div className="flex gap-2">
                      <SimplifiedButton
                        variant="outline"
                        onClick={handleCancel}
                        disabled={saving}
                      >
                        Cancel
                      </SimplifiedButton>
                      <SimplifiedButton
                        variant="primary"
                        onClick={handleSave}
                        loading={saving}
                      >
                        Save Changes
                      </SimplifiedButton>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-gray-600">Name</p>
                      <p className="font-medium text-gray-900">{profile.displayName}</p>
                    </div>
                    
                    {profile.city && (
                      <div>
                        <p className="text-sm text-gray-600">City</p>
                        <p className="font-medium text-gray-900">{profile.city}</p>
                      </div>
                    )}
                    
                    {profile.socialLink && (
                      <div>
                        <p className="text-sm text-gray-600">Social Media</p>
                        <a
                          href={profile.socialLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {profile.socialLink}
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </SimplifiedCardContent>
            </SimplifiedCard>
            
            {/* Earnings Summary */}
            <SimplifiedCard>
              <SimplifiedCardHeader>
                <SimplifiedCardTitle>Earnings Summary</SimplifiedCardTitle>
              </SimplifiedCardHeader>
              <SimplifiedCardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Available</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatPrice(profile.availableEarningsMinor)}
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-600">Pending</p>
                    <p className="text-2xl font-bold text-yellow-600">
                      {formatPrice(profile.pendingEarningsMinor)}
                    </p>
                  </div>
                </div>
              </SimplifiedCardContent>
            </SimplifiedCard>
            
            {/* Payout Method */}
            <SimplifiedCard>
              <SimplifiedCardHeader>
                <SimplifiedCardTitle>Payout Method</SimplifiedCardTitle>
              </SimplifiedCardHeader>
              <SimplifiedCardContent>
                {editing ? (
                  <div className="space-y-4">
                    <SimplifiedInput
                      label="Payout Method"
                      value={payoutMethod}
                      onChange={(e) => setPayoutMethod(e.target.value)}
                      helperText="card or bank"
                    />
                    
                    <SimplifiedInput
                      label="Payout Details"
                      placeholder="Card number or bank account"
                      value={payoutDetails}
                      onChange={(e) => setPayoutDetails(e.target.value)}
                      helperText="This information is secure and encrypted"
                    />
                  </div>
                ) : (
                  <div>
                    {profile.payoutMethod ? (
                      <div className="space-y-2">
                        <div>
                          <p className="text-sm text-gray-600">Method</p>
                          <p className="font-medium text-gray-900 capitalize">{profile.payoutMethod}</p>
                        </div>
                        
                        {profile.payoutDetails && (
                          <div>
                            <p className="text-sm text-gray-600">Details</p>
                            <p className="font-medium text-gray-900">{profile.payoutDetails}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-gray-600">No payout method configured</p>
                    )}
                  </div>
                )}
              </SimplifiedCardContent>
            </SimplifiedCard>
          </div>
        )}
      </div>
    </div>
  );
}
