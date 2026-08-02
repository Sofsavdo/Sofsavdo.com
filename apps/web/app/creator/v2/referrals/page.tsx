'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SimplifiedReferralsPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to main creator referrals page
    router.replace('/creator/referrals');
  }, [router]);

  return null;
}
