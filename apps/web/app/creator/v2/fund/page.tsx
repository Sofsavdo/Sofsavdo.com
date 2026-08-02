'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SimplifiedFundPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to main creator fund page
    router.replace('/creator/fund');
  }, [router]);

  return null;
}
