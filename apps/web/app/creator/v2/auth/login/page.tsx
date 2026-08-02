'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SimplifiedLoginPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to main creator login page
    router.replace('/creator/auth/login');
  }, [router]);

  return null;
}
