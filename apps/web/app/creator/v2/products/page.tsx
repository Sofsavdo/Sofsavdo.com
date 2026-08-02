'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SimplifiedProductsPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to main creator streams page
    router.replace('/creator/streams');
  }, [router]);

  return null;
}
