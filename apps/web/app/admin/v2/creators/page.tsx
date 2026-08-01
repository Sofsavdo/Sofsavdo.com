/**
 * Simplified Admin Creators Management Page
 * 
 * A clean, simple creators management page for admins.
 * List, view, and manage creator accounts.
 */

'use client';

import { useState, useEffect } from 'react';
import { SimplifiedCard, SimplifiedCardHeader, SimplifiedCardTitle, SimplifiedCardContent } from '@/components/simplified/simplified-card';
import { SimplifiedButton } from '@/components/simplified/simplified-button';
import { SimplifiedInput } from '@/components/simplified/simplified-input';
import { SimplifiedLoading } from '@/components/simplified/simplified-loading';
import { SimplifiedBadge } from '@/components/simplified/simplified-badge';
import { SimplifiedModal } from '@/components/simplified/simplified-modal';

export default function SimplifiedAdminCreatorsPage() {
  const [creators, setCreators] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCreator, setSelectedCreator] = useState<any | null>(null);
  
  // Placeholder data - will be fetched from API in Phase 2
  const placeholderCreators = [
    {
      id: '1',
      displayName: 'Malika',
      city: 'Tashkent',
      socialLink: 'https://instagram.com/malika',
      totalOrders: 45,
      totalEarningsMinor: 25000000,
      status: 'ACTIVE',
      createdAt: '2024-01-15',
    },
    {
      id: '2',
      displayName: 'Aziza',
      city: 'Samarkand',
      socialLink: 'https://instagram.com/aziza',
      totalOrders: 32,
      totalEarningsMinor: 18000000,
      status: 'ACTIVE',
      createdAt: '2024-02-20',
    },
    {
      id: '3',
      displayName: 'Nilufar',
      city: 'Bukhara',
      socialLink: 'https://instagram.com/nilufar',
      totalOrders: 28,
      totalEarningsMinor: 15000000,
      status: 'PENDING',
      createdAt: '2024-03-10',
    },
  ];
  
  useEffect(() => {
    // Simulate loading
    setTimeout(() => {
      setCreators(placeholderCreators);
      setLoading(false);
    }, 1000);
  }, []);
  
  const handleViewCreator = (creator: any) => {
    setSelectedCreator(creator);
  };
  
  const formatPrice = (minor: number) => {
    return (minor / 100).toLocaleString('uz-UZ') + " so'm";
  };
  
  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'success';
      case 'PENDING': return 'warning';
      case 'SUSPENDED': return 'error';
      default: return 'neutral';
    }
  };
  
  const filteredCreators = creators.filter(creator =>
    creator.displayName.toLowerCase().includes(search.toLowerCase()) ||
    creator.city?.toLowerCase().includes(search.toLowerCase())
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
            <h1 className="text-2xl font-bold text-gray-900">Creators</h1>
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
          {/* Search */}
          <div className="flex gap-4">
            <SimplifiedInput
              placeholder="Search creators..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1"
            />
          </div>
          
          {/* Creators Table */}
          <SimplifiedCard>
            <SimplifiedCardContent>
              {filteredCreators.length === 0 ? (
                <p className="text-center text-gray-600 py-8">
                  {search ? 'No creators found matching your search.' : 'No creators yet.'}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Creator</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">City</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Orders</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Total Earnings</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Joined</th>
                        <th className="text-right py-3 px-4 font-medium text-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCreators.map((creator) => (
                        <tr key={creator.id} className="border-b border-gray-100 last:border-0">
                          <td className="py-3 px-4">
                            <div>
                              <p className="font-medium text-gray-900">{creator.displayName}</p>
                              {creator.socialLink && (
                                <a
                                  href={creator.socialLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-blue-600 hover:underline"
                                >
                                  View Profile
                                </a>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-gray-600">
                            {creator.city || '-'}
                          </td>
                          <td className="py-3 px-4 font-medium text-gray-900">
                            {creator.totalOrders}
                          </td>
                          <td className="py-3 px-4 font-medium text-gray-900">
                            {formatPrice(creator.totalEarningsMinor)}
                          </td>
                          <td className="py-3 px-4">
                            <SimplifiedBadge variant={getStatusVariant(creator.status)}>
                              {creator.status}
                            </SimplifiedBadge>
                          </td>
                          <td className="py-3 px-4 text-gray-600">
                            {new Date(creator.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <SimplifiedButton
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewCreator(creator)}
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
        
        {/* Creator Detail Modal */}
        {selectedCreator && (
          <SimplifiedModal
            isOpen={!!selectedCreator}
            onClose={() => setSelectedCreator(null)}
            title={selectedCreator.displayName}
            size="lg"
          >
            <div className="space-y-6">
              {/* Creator Info */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-2">Creator Information</h3>
                <div className="space-y-1">
                  <p className="text-gray-600"><span className="font-medium">Name:</span> {selectedCreator.displayName}</p>
                  <p className="text-gray-600"><span className="font-medium">City:</span> {selectedCreator.city || '-'}</p>
                  {selectedCreator.socialLink && (
                    <p className="text-gray-600">
                      <span className="font-medium">Social:</span>{' '}
                      <a href={selectedCreator.socialLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        {selectedCreator.socialLink}
                      </a>
                    </p>
                  )}
                  <p className="text-gray-600"><span className="font-medium">Status:</span> {selectedCreator.status}</p>
                  <p className="text-gray-600"><span className="font-medium">Joined:</span> {new Date(selectedCreator.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
              
              {/* Performance */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-2">Performance</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Total Orders</p>
                    <p className="text-2xl font-bold text-gray-900">{selectedCreator.totalOrders}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Earnings</p>
                    <p className="text-2xl font-bold text-green-600">{formatPrice(selectedCreator.totalEarningsMinor)}</p>
                  </div>
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex gap-2">
                <SimplifiedButton
                  variant="outline"
                  fullWidth
                  onClick={() => {/* Navigate to creator earnings */}}
                >
                  View Earnings
                </SimplifiedButton>
                <SimplifiedButton
                  variant="outline"
                  fullWidth
                  onClick={() => {/* Suspend creator */}}
                >
                  {selectedCreator.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                </SimplifiedButton>
              </div>
              
              <div className="flex gap-2">
                <SimplifiedButton
                  variant="outline"
                  fullWidth
                  onClick={() => setSelectedCreator(null)}
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
