'use client';

import { redirect } from 'next/navigation';

export default function AdminEarningsRedirect() {
  redirect('/admin/v2/earnings');
}
