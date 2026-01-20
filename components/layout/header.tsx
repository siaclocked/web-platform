'use client';

import { useAuthStore, useAppStore } from '@/lib/store';
import { Avatar, Button } from '@/components/ui';
import { ChevronDown, Bell, LogOut } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export function Header() {
  const { user } = useAuthStore();
  const { selectedPlace, unreadCount } = useAppStore();
  const router = useRouter();

  const handleLogout = async () => {
    const { createClient } = await import('@/lib/supabase/client');
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (!user) return null;

  const displayName = `${user.first_name} ${user.last_name}`;
  const roleLabel =
    user.role === 'admin'
      ? 'Company Admin'
      : user.role === 'manager'
      ? 'Manager'
      : 'Worker';

  return (
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="flex items-center justify-between h-14 px-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <Link href={`/${user.role === 'admin' ? 'company' : user.role}`} className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">C</span>
            </div>
            <span className="font-semibold text-foreground hidden sm:inline">
              Clocked
            </span>
          </Link>

          {user.role === 'manager' && selectedPlace && (
            <button className="flex items-center gap-1 px-3 py-1.5 bg-background-tertiary rounded-lg text-sm ml-4">
              <span className="text-foreground-muted">Place:</span>
              <span className="text-foreground font-medium">
                {selectedPlace.name}
              </span>
              <ChevronDown className="w-4 h-4 text-foreground-muted" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/${user.role === 'admin' ? 'company' : user.role}/notifications`}
            className="relative p-2 rounded-lg hover:bg-background-tertiary transition-colors"
          >
            <Bell className="w-5 h-5 text-foreground-muted" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>

          <div className="flex items-center gap-3">
            <Link href={`/${user.role === 'admin' ? 'company' : user.role}/profile`} className="flex items-center gap-2">
              <Avatar name={displayName} src={user.avatar_url} size="sm" />
              <div className="hidden sm:block text-right">
                <p className="text-sm font-medium text-foreground">{displayName}</p>
                <p className="text-xs text-foreground-muted">{roleLabel}</p>
              </div>
            </Link>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="hidden sm:flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="sm:hidden p-2"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
