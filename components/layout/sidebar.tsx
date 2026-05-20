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
  Building2,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore, useAppStore } from '@/lib/store';
import { roleHomeSegment } from '@/lib/utils';

const managerNavItems = [
  { href: '/manager', icon: Home, label: 'Dashboard' },
  { href: '/manager/schedule', icon: Calendar, label: 'Scheduling' },
  { href: '/manager/team', icon: Users, label: 'Team' },
  { href: '/manager/team-availability', icon: Eye, label: 'Team Availability' },
  { href: '/manager/places', icon: MapPin, label: 'Places' },
  { href: '/manager/positions', icon: Layers, label: 'Positions' },
  { href: '/manager/team-tracking', icon: Clock, label: 'Team Tracking' },
  { href: '/manager/notifications', icon: Bell, label: 'Notifications' },
];

const workerNavItems = [
  { href: '/team-member', icon: Home, label: 'Dashboard' },
  { href: '/team-member/schedule', icon: Calendar, label: 'Schedule' },
  { href: '/team-member/clock-in', icon: Clock, label: 'Clock In' },
  { href: '/team-member/set-availability', icon: ClipboardList, label: 'Availability' },
  { href: '/team-member/hours', icon: DollarSign, label: 'My Hours' },
  { href: '/team-member/notifications', icon: Bell, label: 'Notifications' },
  { href: '/team-member/profile', icon: User, label: 'Profile' },
];

// Admin inherits everything from manager, plus company-level controls
const adminNavItems = [
  ...managerNavItems,
  { href: '/company', icon: Building2, label: 'Company Overview' },
  { href: '/company/managers', icon: Users, label: 'Manage Managers' },
  { href: '/company/settings', icon: Settings, label: 'Company Settings' },
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
          href={`/${roleHomeSegment(user?.role)}`}
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
          const isHome = item.href === '/manager' || item.href === '/team-member';
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
