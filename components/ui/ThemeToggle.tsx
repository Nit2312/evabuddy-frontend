'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';

type Theme = 'light' | 'dark' | 'system';

export function ThemeToggle({ className }: { className?: string }) {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme, resolvedTheme } = useTheme();

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className={cn('flex items-center gap-1 rounded-lg border border-border bg-muted/50 p-1', className)}>
        <div className="h-8 w-8 animate-pulse rounded-md bg-muted" />
      </div>
    );
  }

  const options: { value: Theme; icon: React.ReactNode; label: string }[] = [
    { value: 'light', icon: <Sun className="h-4 w-4" />, label: 'Light' },
    { value: 'dark', icon: <Moon className="h-4 w-4" />, label: 'Dark' },
    { value: 'system', icon: <Monitor className="h-4 w-4" />, label: 'System' },
  ];

  return (
    <div
      className={cn(
        'flex items-center gap-0.5 rounded-lg border border-border bg-muted/50 p-1',
        className
      )}
      role="group"
      aria-label="Theme toggle"
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => setTheme(opt.value)}
          title={`${opt.label} mode`}
          aria-label={`${opt.label} mode`}
          className={cn(
            'rounded-md p-2 text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            (theme ?? 'system') === opt.value &&
              'bg-background text-foreground shadow-sm'
          )}
        >
          {opt.icon}
        </button>
      ))}
    </div>
  );
}
