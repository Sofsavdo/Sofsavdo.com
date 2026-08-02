'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SimplifiedNotificationsPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to main creator notifications page
    router.replace('/creator/notifications');
  }, [router]);

  return null;
}
