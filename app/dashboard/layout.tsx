'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Sidebar from '@/components/layout/Sidebar';
import { Navbar } from '@/components/layout/Navbar';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!mobileSidebarOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [mobileSidebarOpen]);

  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-4 w-32" />
        <span className="text-sm text-muted-foreground">Loading workspace...</span>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar className="hidden md:flex" />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Navbar onOpenMobileSidebar={() => setMobileSidebarOpen(true)} />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close navigation menu"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <Sidebar
            className="relative z-10 h-full w-[82vw] max-w-[280px]"
            onNavigate={() => setMobileSidebarOpen(false)}
            showCollapseToggle={false}
          />
        </div>
      )}
    </div>
  );
}
