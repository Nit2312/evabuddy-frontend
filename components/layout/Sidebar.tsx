'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap,
  Bot,
  FolderKanban,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Rocket,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: Zap, exact: true },
  { href: '/dashboard/copilot', label: 'AI Copilot', icon: Bot, badge: 'AI' },
  { href: '/dashboard/projects', label: 'Projects', icon: FolderKanban },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

const sidebarWidth = 240;
const sidebarCollapsedWidth = 64;

interface SidebarProps {
  className?: string;
  onNavigate?: () => void;
  showCollapseToggle?: boolean;
}

export default function Sidebar({ className, onNavigate, showCollapseToggle = true }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const router = useRouter();
  const isCollapsed = showCollapseToggle && collapsed;

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const initials = (user?.displayName || user?.email || 'U')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <motion.aside
      className={cn(
        'flex shrink-0 flex-col border-r border-border bg-card overflow-hidden relative',
        className
      )}
      initial={false}
      animate={{ width: isCollapsed ? sidebarCollapsedWidth : sidebarWidth }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <div className="flex h-14 items-center gap-2 border-b border-border px-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
          <Rocket className="h-4 w-4" />
        </div>
        <AnimatePresence initial={false}>
          {!isCollapsed && (
            <motion.span
              className="font-semibold text-sm truncate"
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.15 }}
            >
              OpsCopilot
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        <div className="mb-1 px-2 py-1.5">
          <AnimatePresence initial={false}>
            {!isCollapsed && (
              <motion.span
                className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                Workspace
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <div className="space-y-0.5">
          {navItems.map((item) => {
            const active = isActive(item.href, item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                title={isCollapsed ? item.label : undefined}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <AnimatePresence initial={false}>
                  {!isCollapsed && (
                    <motion.span
                      className="truncate flex-1"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
                {!isCollapsed && item.badge && (
                  <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-border p-2">
        <button
          type="button"
          onClick={handleLogout}
          title={isCollapsed ? 'Sign out' : 'Click to sign out'}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
            isCollapsed && 'justify-center'
          )}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary">
            {initials}
          </div>
          <AnimatePresence initial={false}>
            {!isCollapsed && (
              <motion.div
                className="min-w-0 flex-1 text-left"
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.15 }}
              >
                <div className="truncate font-medium text-foreground">
                  {user?.displayName || 'User'}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {user?.email}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {!isCollapsed && <LogOut className="h-4 w-4 shrink-0 opacity-50" />}
        </button>
      </div>

      {showCollapseToggle && (
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="absolute -right-px top-1/2 z-10 flex h-14 w-4 -translate-y-1/2 items-center justify-center rounded-l-md border border-l-0 border-border bg-card text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
        >
          {isCollapsed ? (
            <PanelLeftOpen className="h-3.5 w-3.5" strokeWidth={2.25} />
          ) : (
            <PanelLeftClose className="h-3.5 w-3.5" strokeWidth={2.25} />
          )}
        </button>
      )}
    </motion.aside>
  );
}
