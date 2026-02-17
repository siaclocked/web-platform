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
  Search,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/store';

const managerNavItems = [
  { href: '/manager', icon: Home, label: 'Overview' },
  { href: '/manager/schedule', icon: Calendar, label: 'Scheduling' },
  { href: '/manager/workers', icon: Users, label: 'Employees' },
  { href: '/manager/timesheets', icon: ClipboardList, label: 'Create Schedule' },
  { href: '/manager/places', icon: MapPin, label: 'Places' },
  { href: '/manager/positions', icon: Layers, label: 'Positions' },
  { href: '/manager/coverage-templates', icon: FileText, label: 'Coverage' },
  { href: '/manager/reports', icon: DollarSign, label: 'Reports' },
  { href: '/manager/notifications', icon: Bell, label: 'Notifications' },
];

const workerNavItems = [
  { href: '/worker', icon: Home, label: 'Overview' },
  { href: '/worker/schedule', icon: Calendar, label: 'Schedule' },
  { href: '/worker/time-tracking', icon: Clock, label: 'Time Tracking' },
  { href: '/worker/set-availability', icon: ClipboardList, label: 'Availability' },
  { href: '/worker/hours', icon: DollarSign, label: 'My Hours' },
  { href: '/worker/notifications', icon: Bell, label: 'Notifications' },
  { href: '/worker/profile', icon: User, label: 'Profile' },
];

const adminNavItems = [
  { href: '/company', icon: Home, label: 'Overview' },
  { href: '/company/places', icon: MapPin, label: 'Places' },
  { href: '/company/settings', icon: Settings, label: 'Settings' },
  { href: '/company/managers', icon: Users, label: 'Managers' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuthStore();

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

      {/* Search */}
      <div className="px-4 mb-2">
        <div className="relative">
          <input
            type="text"
            placeholder="Search"
            className="w-full text-sm py-2 pl-3 pr-8 rounded-lg border border-border bg-background text-foreground placeholder:text-foreground-muted"
          />
          <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === pathname ||
            (item.href !== '/' && pathname.startsWith(item.href + '/'));
          const isExactActive = item.href === pathname;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mb-0.5',
                (isActive || isExactActive)
                  ? 'bg-primary-muted text-foreground'
                  : 'text-foreground-muted hover:text-foreground hover:bg-background-secondary'
              )}
            >
              <Icon className="w-[18px] h-[18px]" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
