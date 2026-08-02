'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SimplifiedEarningsPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to main creator earnings page
    router.replace('/creator/earnings');
  }, [router]);

  return null;
}
