'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageContainer } from '@/components/layout';
import { Card, CardContent, Button, Input, Avatar, Badge } from '@/components/ui';
import { useAuthStore } from '@/lib/store';
import { createClient } from '@/lib/supabase/client';
import {
  User,
  Phone,
  Mail,
  Clock,
  DollarSign,
  LogOut,
  ChevronRight,
  Edit2,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export default function ProfilePage() {
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  const [isEditing, setIsEditing] = useState(false);
  const [firstName, setFirstName] = useState(user?.first_name || '');
  const [lastName, setLastName] = useState(user?.last_name || '');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    router.push('/login');
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('users')
        .update({
          first_name: firstName,
          last_name: lastName,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      setUser({ ...user, first_name: firstName, last_name: lastName });
      setIsEditing(false);
    } catch (err) {
      console.error('Error updating profile:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return (
      <PageContainer title="Profile">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-foreground-muted">Please log in to view your profile</p>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  const displayName = `${user.first_name} ${user.last_name}`;

  return (
    <PageContainer>
      {/* Profile Header */}
      <Card className="mb-4">
        <CardContent className="flex flex-col items-center py-6">
          <Avatar name={displayName} src={user.avatar_url} size="xl" />
          <h2 className="text-xl font-bold text-foreground mt-4">{displayName}</h2>
          <Badge className="mt-2">
            {user.role === 'admin'
              ? 'Company Admin'
              : user.role === 'manager'
              ? 'Manager'
              : 'Worker'}
          </Badge>
        </CardContent>
      </Card>

      {/* Personal Info */}
      <Card className="mb-4">
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">Personal Information</h3>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="text-primary text-sm flex items-center gap-1"
            >
              <Edit2 className="w-4 h-4" />
              {isEditing ? 'Cancel' : 'Edit'}
            </button>
          </div>

          {isEditing ? (
            <div className="space-y-4">
              <Input
                label="First Name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
              <Input
                label="Last Name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
              <Button
                onClick={handleSaveProfile}
                isLoading={isLoading}
                className="w-full"
              >
                Save Changes
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-foreground-muted" />
                <div>
                  <p className="text-xs text-foreground-muted">Full Name</p>
                  <p className="text-foreground">{displayName}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-foreground-muted" />
                <div>
                  <p className="text-xs text-foreground-muted">Phone</p>
                  <p className="text-foreground">{user.phone}</p>
                </div>
              </div>
              {user.email && (
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-foreground-muted" />
                  <div>
                    <p className="text-xs text-foreground-muted">Email</p>
                    <p className="text-foreground">{user.email}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Hours & Pay (Worker only) */}
      {user.role === 'worker' && (
        <Card className="mb-4">
          <CardContent>
            <h3 className="font-semibold text-foreground mb-4">Hours & Pay</h3>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-background-tertiary rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-5 h-5 text-primary" />
                  <span className="text-sm text-foreground-muted">This Month</span>
                </div>
                <p className="text-2xl font-bold text-foreground">42h</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="success">38h approved</Badge>
                </div>
              </div>

              <div className="bg-background-tertiary rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-5 h-5 text-success" />
                  <span className="text-sm text-foreground-muted">Estimate</span>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency((user.hourly_rate || 15) * 42)}
                </p>
                <p className="text-xs text-foreground-muted mt-1">
                  @ {formatCurrency(user.hourly_rate || 15)}/hr
                </p>
              </div>
            </div>

            <button className="w-full flex items-center justify-between p-3 bg-background-tertiary rounded-lg">
              <span className="text-foreground">View detailed hours</span>
              <ChevronRight className="w-5 h-5 text-foreground-muted" />
            </button>
          </CardContent>
        </Card>
      )}

      {/* Logout */}
      <Button
        variant="outline"
        className="w-full border-danger text-danger hover:bg-danger-muted"
        onClick={handleLogout}
      >
        <LogOut className="w-4 h-4 mr-2" />
        Sign Out
      </Button>
    </PageContainer>
  );
}
