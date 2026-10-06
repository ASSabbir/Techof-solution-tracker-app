'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/contexts';
import { Spinner } from '@/components/ui/primitives';

export default function Home() {
  const { user, ready } = useAuth();
  const router = useRouter();
  useEffect(() => { if (ready) router.replace(user ? '/dashboard' : '/login'); }, [ready, user, router]);
  return <div className="grid min-h-screen place-items-center text-muted"><Spinner className="h-6 w-6" /></div>;
}
