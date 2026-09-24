'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import { Sidebar } from './Sidebar';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
      if (!data.session && pathname !== '/login') router.replace('/login');
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (!newSession && pathname !== '/login') router.replace('/login');
    });
    return () => sub.subscription.unsubscribe();
  }, [pathname, router]);

  if (pathname === '/login') return <>{children}</>;
  if (!ready || !session) return null;

  return (
    <div className="app">
      <Sidebar />
      <main>{children}</main>
    </div>
  );
}
