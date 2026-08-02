'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SimplifiedAdminEarningsPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to main admin earnings page
    router.replace('/admin/commissions');
  }, [router]);

  return null;
}
