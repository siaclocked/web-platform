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
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore, useAppStore } from '@/lib/store';

const workerNavItems = [
  { href: '/worker', icon: Home, label: 'Home' },
  { href: '/worker/schedule', icon: Calendar, label: 'Schedule' },
  { href: '/worker/clock-in', icon: Clock, label: 'Clock In' },
  { href: '/worker/profile', icon: User, label: 'Profile' },
];

const managerNavItems = [
  { href: '/manager', icon: Home, label: 'Home' },
  { href: '/manager/places', icon: MapPin, label: 'Places' },
  { href: '/manager/workers', icon: Users, label: 'Workers' },
  { href: '/manager/schedule', icon: Calendar, label: 'Schedules' },
  { href: '/manager/timesheets', icon: ClipboardList, label: 'Create' },
];

const adminNavItems = [
  { href: '/company', icon: Home, label: 'Home' },
  { href: '/company/places', icon: MapPin, label: 'Places' },
  { href: '/company/settings', icon: Settings, label: 'Company' },
  { href: '/company/managers', icon: Users, label: 'Managers' },
];

export function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const { unreadCount } = useAppStore();

  const navItems =
    user?.role === 'admin'
      ? adminNavItems
      : user?.role === 'manager'
      ? managerNavItems
      : workerNavItems;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background-secondary border-t border-border z-40 safe-area-pb">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isHome = item.href === '/manager' || item.href === '/worker' || item.href === '/company';
          const isActive = isHome
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + '/');

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[64px]',
                isActive
                  ? 'text-primary'
                  : 'text-foreground-muted hover:text-foreground'
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
        <Link
          href={`/${user?.role === 'admin' ? 'company' : user?.role || 'worker'}/notifications`}
          className={cn(
            'flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[64px] relative',
            pathname?.includes('/notifications')
              ? 'text-primary'
              : 'text-foreground-muted hover:text-foreground'
          )}
        >
          <div className="relative">
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
          <span className="text-xs font-medium">Alerts</span>
        </Link>
      </div>
    </nav>
  );
}
