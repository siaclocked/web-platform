'use client';

import { useState, useEffect } from 'react';
import { PageContainer } from '@/components/layout';
import { Card, CardContent, Button, Input, Avatar } from '@/components/ui';
import { Users, ArrowLeft, Search } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { AvailabilityCalendar } from '@/components/availability-calendar';

interface WorkerItem {
  id: string;
  name: string;
}

export default function ManagerTeamAvailabilityPage() {
  const [workers, setWorkers] = useState<WorkerItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWorker, setSelectedWorker] = useState<WorkerItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchWorkers();
  }, []);

  const fetchWorkers = async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch('/api/manager/worker-availability', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setWorkers(data.workers || []);
      }
    } catch (err) {
      console.error('Error fetching workers:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </PageContainer>
    );
  }

  if (!selectedWorker) {
    return (
      <PageContainer>
        <div className="max-w-5xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground">Team Availability</h1>
            <p className="text-foreground-muted">Select a team member to view or edit their availability calendar</p>
          </div>

          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-foreground-muted w-4 h-4" />
              <Input
                type="text"
                placeholder="Search team members..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {workers.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Users className="w-12 h-12 mx-auto mb-4 text-foreground-muted" />
                <h3 className="text-lg font-medium mb-2">No team members found</h3>
                <p className="text-foreground-muted">Add team members to your company to see their availability.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {workers.filter(w => w.name.toLowerCase().includes(searchTerm.toLowerCase())).map(worker => (
                <Card
                  key={worker.id}
                  className="cursor-pointer hover:border-primary/40 transition-colors"
                  onClick={() => setSelectedWorker(worker)}
                >
                  <CardContent className="p-4 flex items-center gap-3">
                    <Avatar name={worker.name} size="md" />
                    <div>
                      <h3 className="font-medium text-foreground">{worker.name}</h3>
                      <p className="text-xs text-foreground-muted">Click to edit availability</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="max-w-5xl mx-auto">
        <Button variant="outline" size="sm" onClick={() => setSelectedWorker(null)} className="mb-3">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Team
        </Button>
        <AvailabilityCalendar
          apiEndpoint="/api/manager/worker-availability"
          targetWorkerId={selectedWorker.id}
          heading={selectedWorker.name}
          description="Set or update availability on their behalf. They're available by default — only mark exceptions."
        />
      </div>
    </PageContainer>
  );
}
