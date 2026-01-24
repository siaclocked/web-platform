'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PageContainer } from '@/components/layout';
import { Card, CardContent, Button, Input, Avatar, Badge } from '@/components/ui';
import { BackButton } from '@/components/ui';
import { User, Mail, Phone, Clock, Edit2, Save, X, Calendar } from 'lucide-react';

interface WorkerProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  role: string;
  avatar_url?: string;
  hourly_rate?: number;
  companies: {
    id: string;
    name: string;
  };
  created_at: string;
}

interface WorkSession {
  id: string;
  start_time: string;
  end_time?: string;
  place: {
    name: string;
  };
  total_hours?: number;
}

export default function WorkerProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const [recentSessions, setRecentSessions] = useState<WorkSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
  });
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchProfile();
    fetchRecentSessions();
  }, []);

  const fetchProfile = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profile, error } = await supabase
        .from('users')
        .select(`
          *,
          companies:company_id (
            id,
            name
          )
        `)
        .eq('id', user.id)
        .single();

      if (error) throw error;

      setProfile(profile);
      setEditForm({
        first_name: profile.first_name,
        last_name: profile.last_name,
        phone: profile.phone || '',
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
      setError('Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRecentSessions = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      const { data: sessions, error } = await supabase
        .from('work_sessions')
        .select(`
          *,
          place:place_id (
            name
          )
        `)
        .eq('worker_id', user.id)
        .order('start_time', { ascending: false })
        .limit(5);

      if (error) throw error;

      setRecentSessions(sessions || []);
    } catch (error) {
      console.error('Error fetching sessions:', error);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    setError('');
    setSuccess('');
  };

  const handleCancel = () => {
    setIsEditing(false);
    if (profile) {
      setEditForm({
        first_name: profile.first_name,
        last_name: profile.last_name,
        phone: profile.phone || '',
      });
    }
    setError('');
    setSuccess('');
  };

  const handleSave = async () => {
    if (!profile) return;

    setSaveLoading(true);
    setError('');
    setSuccess('');

    try {
      const supabase = createClient();
      
      const { error } = await supabase
        .from('users')
        .update({
          first_name: editForm.first_name,
          last_name: editForm.last_name,
          phone: editForm.phone || null,
        })
        .eq('id', profile.id);

      if (error) throw error;

      setSuccess('Profile updated successfully');
      setIsEditing(false);
      fetchProfile();
    } catch (error) {
      console.error('Error updating profile:', error);
      setError('Failed to update profile');
    } finally {
      setSaveLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const calculateHours = (startTime: string, endTime?: string) => {
    if (!endTime) return 'In progress';
    const start = new Date(startTime);
    const end = new Date(endTime);
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    return hours.toFixed(1);
  };

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </PageContainer>
    );
  }

  if (!profile) {
    return (
      <PageContainer>
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-foreground-muted">Profile not found</p>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <BackButton href="/worker" />
          {!isEditing ? (
            <Button onClick={handleEdit} variant="secondary" size="sm">
              <Edit2 className="w-4 h-4 mr-2" />
              Edit Profile
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button onClick={handleCancel} variant="outline" size="sm">
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleSave} size="sm" isLoading={saveLoading}>
                <Save className="w-4 h-4 mr-2" />
                Save
              </Button>
            </div>
          )}
        </div>

        {/* Profile Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-4 mb-6">
              <Avatar
                src={profile.avatar_url}
                name={`${profile.first_name} ${profile.last_name}`}
                size="xl"
              />
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-foreground mb-1">
                  {profile.first_name} {profile.last_name}
                </h1>
                <p className="text-foreground-muted mb-2">{profile.email}</p>
                <div className="flex items-center gap-2">
                  <Badge variant="info">Worker</Badge>
                  <span className="text-sm text-foreground-muted">
                    at {profile.companies?.name}
                  </span>
                </div>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-danger-muted/20 border border-danger/30 rounded-lg">
                <p className="text-sm text-danger">{error}</p>
              </div>
            )}

            {success && (
              <div className="mb-4 p-3 bg-success-muted/20 border border-success/30 rounded-lg">
                <p className="text-sm text-success">{success}</p>
              </div>
            )}

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    First Name
                  </label>
                  {isEditing ? (
                    <Input
                      value={editForm.first_name}
                      onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                      placeholder="First name"
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-foreground-muted" />
                      <span>{profile.first_name}</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Last Name
                  </label>
                  {isEditing ? (
                    <Input
                      value={editForm.last_name}
                      onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                      placeholder="Last name"
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-foreground-muted" />
                      <span>{profile.last_name}</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Email
                </label>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-foreground-muted" />
                  <span>{profile.email}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Phone
                </label>
                {isEditing ? (
                  <Input
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    placeholder="Phone number"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-foreground-muted" />
                    <span>{profile.phone || 'Not provided'}</span>
                  </div>
                )}
              </div>

              {profile.hourly_rate && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Hourly Rate
                  </label>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-foreground-muted" />
                    <span>${profile.hourly_rate}/hour</span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Member Since
                </label>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-foreground-muted" />
                  <span>{formatDate(profile.created_at)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Work Sessions */}
        {recentSessions.length > 0 && (
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">
                Recent Work Sessions
              </h2>
              <div className="space-y-3">
                {recentSessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-3 bg-background-secondary rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-foreground">
                        {session.place?.name || 'Unknown Location'}
                      </p>
                      <p className="text-sm text-foreground-muted">
                        {formatDate(session.start_time)} • {formatTime(session.start_time)}
                        {session.end_time && ` - ${formatTime(session.end_time)}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-foreground">
                        {calculateHours(session.start_time, session.end_time)}h
                      </p>
                      {!session.end_time && (
                        <Badge variant="success">Active</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PageContainer>
  );
}
