/**
 * Simplified Notifications Page
 * 
 * A clean, simple notifications page for creators.
 * Shows notifications with ability to mark as read.
 */

'use client';

import { useState, useEffect } from 'react';
import { SimplifiedCard, SimplifiedCardHeader, SimplifiedCardTitle, SimplifiedCardContent } from '@/components/simplified/simplified-card';
import { SimplifiedButton } from '@/components/simplified/simplified-button';
import { SimplifiedLoading } from '@/components/simplified/simplified-loading';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'earnings';
  date: string;
  read: boolean;
}

export default function SimplifiedNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadNotifications();
  }, []);
  
  const loadNotifications = async () => {
    setLoading(true);
    try {
      // TODO: Load from API
      const mockData: Notification[] = [
        {
          id: '1',
          title: 'New sale!',
          message: 'You earned 25,000 so\'m from Serum sale',
          type: 'earnings',
          date: '2 hours ago',
          read: false,
        },
        {
          id: '2',
          title: 'Payout processed',
          message: 'Your withdrawal of 100,000 so\'m has been processed',
          type: 'success',
          date: '1 day ago',
          read: false,
        },
        {
          id: '3',
          title: 'New product available',
          message: 'Check out the new Vitamin C serum - 25% commission',
          type: 'info',
          date: '2 days ago',
          read: true,
        },
        {
          id: '4',
          title: 'Weekly summary',
          message: 'You earned 150,000 so\'m this week. Keep it up!',
          type: 'info',
          date: '3 days ago',
          read: true,
        },
        {
          id: '5',
          title: 'Payment reminder',
          message: 'Don\'t forget to update your payout method',
          type: 'warning',
          date: '5 days ago',
          read: true,
        },
      ];
      setNotifications(mockData);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleMarkAsRead = (id: string) => {
    setNotifications(notifications.map(n => 
      n.id === id ? { ...n, read: true } : n
    ));
  };
  
  const handleMarkAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };
  
  const getTypeIcon = (type: Notification['type']) => {
    switch (type) {
      case 'earnings': return '💰';
      case 'success': return '✅';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '📢';
    }
  };
  
  const getTypeColor = (type: Notification['type']) => {
    switch (type) {
      case 'earnings': return 'text-green-600';
      case 'success': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'info': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };
  
  const unreadCount = notifications.filter(n => !n.read).length;
  
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
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex gap-2">
              {unreadCount > 0 && (
                <SimplifiedButton
                  variant="outline"
                  size="sm"
                  onClick={handleMarkAllAsRead}
                >
                  Mark all as read
                </SimplifiedButton>
              )}
              <SimplifiedButton variant="outline" size="sm" onClick={() => {/* Navigate to products */}}>
                Products
              </SimplifiedButton>
              <SimplifiedButton variant="outline" size="sm" onClick={() => {/* Navigate to earnings */}}>
                Earnings
              </SimplifiedButton>
            </div>
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {notifications.length === 0 ? (
          <SimplifiedCard>
            <SimplifiedCardContent>
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🔔</div>
                <p className="text-gray-600">No notifications yet</p>
              </div>
            </SimplifiedCardContent>
          </SimplifiedCard>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <SimplifiedCard
                key={notification.id}
                className={!notification.read ? 'border-blue-400 border-2' : ''}
              >
                <SimplifiedCardContent className="pt-4">
                  <div className="flex items-start gap-4">
                    <div className="text-2xl flex-shrink-0">
                      {getTypeIcon(notification.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <p className={`font-semibold ${!notification.read ? 'text-gray-900' : 'text-gray-600'}`}>
                            {notification.title}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-400 mt-2">
                            {notification.date}
                          </p>
                        </div>
                        {!notification.read && (
                          <SimplifiedButton
                            variant="outline"
                            size="sm"
                            onClick={() => handleMarkAsRead(notification.id)}
                          >
                            Mark as read
                          </SimplifiedButton>
                        )}
                      </div>
                    </div>
                  </div>
                </SimplifiedCardContent>
              </SimplifiedCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
