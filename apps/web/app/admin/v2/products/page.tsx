'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SimplifiedAdminProductsPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to main admin products page
    router.replace('/admin/products');
  }, [router]);

  return null;
}
