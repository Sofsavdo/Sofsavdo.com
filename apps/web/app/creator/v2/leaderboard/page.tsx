/**
 * Simplified Leaderboard Page
 * 
 * A clean, simple leaderboard page for creators.
 * Shows top creators by earnings.
 */

'use client';

import { useState, useEffect } from 'react';
import { SimplifiedCard, SimplifiedCardHeader, SimplifiedCardTitle, SimplifiedCardContent } from '@/components/simplified/simplified-card';
import { SimplifiedButton } from '@/components/simplified/simplified-button';
import { SimplifiedLoading } from '@/components/simplified/simplified-loading';

interface LeaderboardEntry {
  rank: number;
  name: string;
  avatar?: string;
  earningsMinor: number;
  isCurrentUser?: boolean;
}

export default function SimplifiedLeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<'week' | 'month' | 'all'>('month');
  
  useEffect(() => {
    loadLeaderboard();
  }, [timeframe]);
  
  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/creator/leaderboard');
      if (!response.ok) throw new Error('Failed to load leaderboard');
      const data = await response.json();
      setLeaderboard(data);
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
      setLeaderboard([]);
    } finally {
      setLoading(false);
    }
  };
  
  const formatPrice = (minor: number) => {
    return (minor / 100).toLocaleString('uz-UZ') + " so'm";
  };
  
  const getRankBadge = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
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
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <h1 className="text-2xl font-bold text-gray-900">Leaderboard</h1>
            <div className="flex gap-2">
              <SimplifiedButton
                variant={timeframe === 'week' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setTimeframe('week')}
              >
                This Week
              </SimplifiedButton>
              <SimplifiedButton
                variant={timeframe === 'month' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setTimeframe('month')}
              >
                This Month
              </SimplifiedButton>
              <SimplifiedButton
                variant={timeframe === 'all' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setTimeframe('all')}
              >
                All Time
              </SimplifiedButton>
            </div>
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Top 3 Podium */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {leaderboard.slice(0, 3).map((entry) => (
              <SimplifiedCard
                key={entry.rank}
                className={entry.rank === 1 ? 'border-yellow-400 border-2' : ''}
              >
                <SimplifiedCardContent className="pt-6">
                  <div className="text-center">
                    <div className="text-4xl mb-2">{getRankBadge(entry.rank)}</div>
                    <div className="w-16 h-16 bg-gray-200 rounded-full mx-auto mb-3 flex items-center justify-center">
                      <span className="text-2xl">👤</span>
                    </div>
                    <p className="font-bold text-gray-900">{entry.name}</p>
                    <p className="text-lg font-semibold text-green-600 mt-2">
                      {formatPrice(entry.earningsMinor)}
                    </p>
                  </div>
                </SimplifiedCardContent>
              </SimplifiedCard>
            ))}
          </div>
          
          {/* Full Leaderboard */}
          <SimplifiedCard>
            <SimplifiedCardHeader>
              <SimplifiedCardTitle>All Creators</SimplifiedCardTitle>
            </SimplifiedCardHeader>
            <SimplifiedCardContent>
              <div className="space-y-2">
                {leaderboard.map((entry) => (
                  <div
                    key={entry.rank}
                    className={`flex items-center justify-between py-3 px-4 rounded-lg ${
                      entry.isCurrentUser ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-lg">👤</span>
                      </div>
                      <div>
                        <p className={`font-medium ${entry.isCurrentUser ? 'text-blue-600' : 'text-gray-900'}`}>
                          {entry.name}
                        </p>
                        {entry.isCurrentUser && (
                          <p className="text-xs text-blue-600">You</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-semibold text-green-600">
                          {formatPrice(entry.earningsMinor)}
                        </p>
                      </div>
                      <div className="w-8 text-center font-bold text-gray-500">
                        {getRankBadge(entry.rank)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </SimplifiedCardContent>
          </SimplifiedCard>
          
          {/* Your Position */}
          {leaderboard.find(e => e.isCurrentUser) && (
            <SimplifiedCard className="border-blue-400 border-2">
              <SimplifiedCardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-xl">👤</span>
                    </div>
                    <div>
                      <p className="font-bold text-blue-600">Your Position</p>
                      <p className="text-sm text-gray-600">Keep going to climb higher!</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-blue-600">
                      #{leaderboard.find(e => e.isCurrentUser)?.rank}
                    </p>
                    <p className="text-sm text-gray-600">
                      {formatPrice(leaderboard.find(e => e.isCurrentUser)?.earningsMinor || 0)}
                    </p>
                  </div>
                </div>
              </SimplifiedCardContent>
            </SimplifiedCard>
          )}
        </div>
      </div>
    </div>
  );
}
