'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SimplifiedLeaderboardPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to main creator leaderboard page
    router.replace('/creator/leaderboard');
  }, [router]);

  return null;
}
