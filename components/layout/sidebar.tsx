'use client';

import { cn } from '@/lib/utils';
import {
  Home,
  Calendar,
  Users,
  Clock,
  MapPin,
  ClipboardList,
  FileText,
  Settings,
  DollarSign,
  Layers,
  Bell,
  User,
  Eye,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore, useAppStore } from '@/lib/store';

const managerNavItems = [
  { href: '/manager', icon: Home, label: 'Dashboard' },
  { href: '/manager/schedule', icon: Calendar, label: 'Scheduling' },
  { href: '/manager/workers', icon: Users, label: 'Employees' },
  { href: '/manager/timesheets', icon: ClipboardList, label: 'Create Schedule' },
  { href: '/manager/worker-availability', icon: Eye, label: 'Worker Availability' },
  { href: '/manager/places', icon: MapPin, label: 'Places' },
  { href: '/manager/positions', icon: Layers, label: 'Positions' },
  { href: '/manager/worker-tracking', icon: Clock, label: 'Worker Tracking' },
  { href: '/manager/notifications', icon: Bell, label: 'Notifications' },
];

const workerNavItems = [
  { href: '/worker', icon: Home, label: 'Dashboard' },
  { href: '/worker/schedule', icon: Calendar, label: 'Schedule' },
  { href: '/worker/clock-in', icon: Clock, label: 'Clock In' },
  { href: '/worker/set-availability', icon: ClipboardList, label: 'Availability' },
  { href: '/worker/hours', icon: DollarSign, label: 'My Hours' },
  { href: '/worker/notifications', icon: Bell, label: 'Notifications' },
  { href: '/worker/profile', icon: User, label: 'Profile' },
];

const adminNavItems = [
  { href: '/company', icon: Home, label: 'Dashboard' },
  { href: '/company/places', icon: MapPin, label: 'Places' },
  { href: '/company/settings', icon: Settings, label: 'Settings' },
  { href: '/company/managers', icon: Users, label: 'Managers' },
];

export function Sidebar() {
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
    <aside className="hidden lg:flex flex-col fixed top-0 left-0 bottom-0 w-[220px] bg-background border-r border-border z-50">
      {/* Logo */}
      <div className="px-5 pt-6 pb-4">
        <Link
          href={`/${user?.role === 'admin' ? 'company' : user?.role || 'worker'}`}
          className="block"
        >
          <span className="text-2xl font-black tracking-tight text-foreground" style={{ fontFamily: "'Georgia', serif" }}>
            CLOCKED
          </span>
        </Link>
      </div>

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto px-3 py-2">
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
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mb-0.5',
                isActive
                  ? 'bg-primary-muted text-foreground'
                  : 'text-foreground-muted hover:text-foreground hover:bg-background-secondary'
              )}
            >
              <div className="relative">
                <Icon className="w-[18px] h-[18px]" />
                {item.label === 'Notifications' && unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </div>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
