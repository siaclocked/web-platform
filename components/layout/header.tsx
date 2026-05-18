'use client';

import { useAuthStore, useAppStore } from '@/lib/store';
import { Avatar, Button } from '@/components/ui';
import { Bell, LogOut, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export function Header() {
  const { user } = useAuthStore();
  const { unreadCount } = useAppStore();
  const router = useRouter();

  const handleLogout = async () => {
    const { createClient } = await import('@/lib/supabase/client');
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (!user) return null;

  const displayName = `${user.first_name} ${user.last_name}`;

  return (
    <header className="sticky top-0 z-40 bg-background border-b border-border">
      <div className="flex items-center justify-between h-14 px-4 lg:px-6">
        {/* Mobile logo — only on small screens where sidebar is hidden */}
        <div className="flex items-center gap-3 lg:hidden">
          <Link href={`/${user.role === 'admin' ? 'manager' : user.role}`} className="flex items-center gap-2">
            <span className="text-xl font-black tracking-tight text-foreground" style={{ fontFamily: "'Georgia', serif" }}>
              CLOCKED
            </span>
          </Link>
        </div>

        {/* Spacer for desktop layout */}
        <div className="hidden lg:flex flex-1" />

        {/* Right side: notifications + avatar + logout */}
        <div className="flex items-center gap-2">
          <Link
            href={`/${user.role === 'admin' ? 'company' : user.role}/notifications`}
            className="relative p-2 rounded-lg hover:bg-background-secondary transition-colors"
          >
            <Bell className="w-5 h-5 text-foreground-muted" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>

          <Link
            href={`/${user.role === 'admin' ? 'company' : user.role}/profile`}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-background-secondary transition-colors"
          >
            <Avatar name={displayName} src={user.avatar_url} size="sm" />
            <span className="hidden sm:inline text-sm font-medium text-foreground">
              {displayName}
            </span>
            <ChevronDown className="hidden sm:block w-4 h-4 text-foreground-muted" />
          </Link>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="p-2 text-foreground-muted hover:text-foreground"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
