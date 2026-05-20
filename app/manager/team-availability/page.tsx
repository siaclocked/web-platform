'use client';

import { useState, useEffect } from 'react';
import { PageContainer } from '@/components/layout';
import { Button } from '@/components/ui';
import { ArrowLeft } from 'lucide-react';
import { authedFetch } from '@/lib/api';
import { AvailabilityCalendar } from '@/components/availability-calendar';
import { WorkerPicker, WorkerPickerItem } from '@/components/worker-picker';

export default function ManagerTeamAvailabilityPage() {
  const [workers, setWorkers] = useState<WorkerPickerItem[]>([]);
  const [selectedWorker, setSelectedWorker] = useState<WorkerPickerItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const response = await authedFetch('/api/manager/worker-availability');
        if (response.ok) {
          const data = await response.json();
          setWorkers(data.workers || []);
        }
      } catch (err) {
        console.error('Error fetching workers:', err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

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
        <WorkerPicker
          workers={workers}
          heading="Team Availability"
          description="Select a team member to view or edit their availability calendar"
          cardSubtext="Click to edit availability"
          emptyMessage="Add team members to your company to see their availability."
          onSelect={setSelectedWorker}
        />
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
