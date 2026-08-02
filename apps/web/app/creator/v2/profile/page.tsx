'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SimplifiedProfilePage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to main creator profile page
    router.replace('/creator/profile');
  }, [router]);

  return null;
}
