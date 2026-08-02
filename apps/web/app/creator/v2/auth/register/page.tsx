'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SimplifiedRegisterPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to main creator register page
    router.replace('/creator/auth/register');
  }, [router]);

  return null;
}
