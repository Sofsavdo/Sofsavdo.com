'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SimplifiedAdminOrdersPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to main admin orders page
    router.replace('/admin/orders');
  }, [router]);

  return null;
}
