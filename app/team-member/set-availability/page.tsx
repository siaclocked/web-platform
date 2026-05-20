'use client';

import { PageContainer } from '@/components/layout';
import { AvailabilityCalendar } from '@/components/availability-calendar';

export default function SetAvailabilityPage() {
  return (
    <PageContainer>
      <AvailabilityCalendar
        apiEndpoint="/api/worker/availability-calendar"
        heading="Availability"
        description="You're available by default. Mark only the days you're off, partially available, or on vacation."
      />
    </PageContainer>
  );
}
