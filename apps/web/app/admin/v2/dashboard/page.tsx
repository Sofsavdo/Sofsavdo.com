'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SimplifiedAdminDashboardPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to main admin dashboard
    router.replace('/admin/dashboard');
  }, [router]);

  return null;
}
