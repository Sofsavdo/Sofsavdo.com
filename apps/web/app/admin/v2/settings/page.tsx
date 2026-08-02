'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SimplifiedAdminSettingsPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to main admin settings page
    router.replace('/admin/settings');
  }, [router]);

  return null;
}
