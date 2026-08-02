'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SimplifiedAdminCreatorsPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to main admin creators page
    router.replace('/admin/creators');
  }, [router]);

  return null;
}
