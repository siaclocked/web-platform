'use client';

import { cn } from '@/lib/utils';
import {
  Home,
  Calendar,
  Clock,
  FileText,
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
  { href: '/dashboard', icon: Home, label: 'Home' },
  { href: '/schedule', icon: Calendar, label: 'Schedule' },
  { href: '/time-tracking', icon: Clock, label: 'Clock In' },
  { href: '/documents', icon: FileText, label: 'Documents' },
  { href: '/profile', icon: User, label: 'Profile' },
];

const managerNavItems = [
  { href: '/dashboard', icon: Home, label: 'Home' },
  { href: '/places', icon: MapPin, label: 'Places' },
  { href: '/workers', icon: Users, label: 'Workers' },
  { href: '/schedules', icon: Calendar, label: 'Schedules' },
  { href: '/timesheets', icon: ClipboardList, label: 'Timesheets' },
];

const adminNavItems = [
  { href: '/dashboard', icon: Home, label: 'Home' },
  { href: '/company', icon: Settings, label: 'Company' },
  { href: '/managers', icon: Users, label: 'Managers' },
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
          const isActive = pathname === item.href;

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
          href="/notifications"
          className={cn(
            'flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[64px] relative',
            pathname === '/notifications'
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
