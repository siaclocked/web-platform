'use client';

import { cn } from '@/lib/utils';
import {
  Home,
  Calendar,
  Clock,
  User,
  Users,
  MapPin,
  ClipboardList,
  Settings,
  Bell,
  Eye,
  Layers,
  DollarSign,
  X,
  MoreHorizontal,
  Building2,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore, useAppStore } from '@/lib/store';
import { useEffect, useMemo, useRef, useState } from 'react';

const workerNavItems = [
  { href: '/worker', icon: Home, label: 'Home' },
  { href: '/worker/schedule', icon: Calendar, label: 'Schedule' },
  { href: '/worker/clock-in', icon: Clock, label: 'Clock In' },
  { href: '/worker/set-availability', icon: ClipboardList, label: 'Availability' },
  { href: '/worker/hours', icon: DollarSign, label: 'Hours' },
  { href: '/worker/notifications', icon: Bell, label: 'Alerts' },
  { href: '/worker/profile', icon: User, label: 'Profile' },
];

const managerNavItems = [
  { href: '/manager', icon: Home, label: 'Home' },
  { href: '/manager/schedule', icon: Calendar, label: 'Schedule' },
  { href: '/manager/workers', icon: Users, label: 'Team' },
  { href: '/manager/worker-availability', icon: Eye, label: 'Availability' },
  { href: '/manager/places', icon: MapPin, label: 'Places' },
  { href: '/manager/positions', icon: Layers, label: 'Positions' },
  { href: '/manager/worker-tracking', icon: Clock, label: 'Tracking' },
  { href: '/manager/notifications', icon: Bell, label: 'Alerts' },
];

// Admin inherits everything from manager, plus company-level controls
const adminNavItems = [
  ...managerNavItems,
  { href: '/company', icon: Building2, label: 'Company' },
  { href: '/company/managers', icon: Users, label: 'Mgrs' },
  { href: '/company/settings', icon: Settings, label: 'Settings' },
];

export function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const { unreadCount } = useAppStore();

  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const touchStartYRef = useRef<number | null>(null);

  const navItems = useMemo(
    () =>
      user?.role === 'admin'
        ? adminNavItems
        : user?.role === 'manager'
        ? managerNavItems
        : workerNavItems,
    [user?.role]
  );

  const primaryItems = useMemo(() => navItems.slice(0, 4), [navItems]);

  useEffect(() => {
    if (!isMoreOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMoreOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMoreOpen]);

  useEffect(() => {
    // Close the sheet on route change
    setIsMoreOpen(false);
  }, [pathname]);

  const isActiveHref = (href: string) => {
    const isHome = href === '/manager' || href === '/worker';
    return isHome ? pathname === href : pathname === href || pathname.startsWith(href + '/');
  };

  const renderNavLink = (item: { href: string; icon: any; label: string }, opts?: { compact?: boolean }) => {
    const Icon = item.icon;
    const isActive = isActiveHref(item.href);
    const isNotifications = item.href.endsWith('/notifications');

    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          'flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 rounded-lg transition-colors min-w-[56px] relative',
          isActive
            ? 'text-primary'
            : 'text-foreground-muted hover:text-foreground'
        )}
      >
        <div className="relative">
          <Icon className={cn(opts?.compact ? 'w-5 h-5' : 'w-6 h-6')} />
          {isNotifications && unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
        <span className={cn('font-medium leading-tight text-center', opts?.compact ? 'text-[10px]' : 'text-xs')}>{item.label}</span>
      </Link>
    );
  };

  return (
    <>
      {isMoreOpen && (
        <div
          className="fixed inset-0 z-50"
          aria-hidden="true"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setIsMoreOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            className="absolute left-0 right-0 bottom-0 bg-background border-t border-border rounded-t-2xl shadow-xl safe-area-pb"
            onTouchStart={(e) => {
              touchStartYRef.current = e.touches?.[0]?.clientY ?? null;
            }}
            onTouchMove={(e) => {
              const startY = touchStartYRef.current;
              const y = e.touches?.[0]?.clientY;
              if (startY == null || y == null) return;
              if (y - startY > 80) {
                setIsMoreOpen(false);
                touchStartYRef.current = null;
              }
            }}
            onTouchEnd={() => {
              touchStartYRef.current = null;
            }}
          >
            <div className="max-w-lg mx-auto px-4 pt-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-1.5 rounded-full bg-border" />
                  <span className="text-sm font-semibold text-foreground">Menu</span>
                </div>
                <button
                  type="button"
                  className="p-2 rounded-lg hover:bg-background-secondary"
                  onClick={() => setIsMoreOpen(false)}
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-4 gap-3 py-4">
                {navItems.map((item) => renderNavLink(item))}
              </div>
            </div>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 bg-background-secondary border-t border-border z-40 safe-area-pb">
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
          {primaryItems.map((item) => renderNavLink(item, { compact: true }))}
          <button
            type="button"
            onClick={() => setIsMoreOpen(true)}
            className={cn(
              'flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[64px]',
              isMoreOpen ? 'text-primary' : 'text-foreground-muted hover:text-foreground'
            )}
            aria-label="Open menu"
          >
            <MoreHorizontal className="w-5 h-5" />
            <span className="text-xs font-medium">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
