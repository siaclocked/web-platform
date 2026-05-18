import { createClient } from '@supabase/supabase-js';

// Notification types
export const NOTIFICATION_TYPES = {
  TIMESHEET_PUBLISHED: 'TIMESHEET_PUBLISHED',
  SCHEDULE_CREATED: 'SCHEDULE_CREATED',
  SCHEDULE_INFEASIBLE: 'SCHEDULE_INFEASIBLE',
  AVAILABILITY_REMINDER: 'AVAILABILITY_REMINDER',
  SCHEDULE_CHANGED: 'SCHEDULE_CHANGED_FOR_WORKER',
  HANDOFF_NOTE: 'HANDOFF_NOTE_RECEIVED',
  OPEN_SHIFT_AVAILABLE: 'OPEN_SHIFT_AVAILABLE',
  OPEN_SHIFT_INTEREST: 'OPEN_SHIFT_INTEREST_SUBMITTED',
  TIMESHEET_APPROVED: 'TIMESHEET_APPROVED',
  TIMESHEET_EDITED: 'TIMESHEET_EDITED_BY_MANAGER',
  SCHEDULE_PUBLISHED: 'SCHEDULE_PUBLISHED',
  WORKER_AVAILABILITY_SET: 'WORKER_AVAILABILITY_SET',
} as const;

export type NotificationType = typeof NOTIFICATION_TYPES[keyof typeof NOTIFICATION_TYPES];

interface CreateNotificationParams {
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  metadata?: Record<string, any>;
}

interface BulkNotificationParams {
  userIds: string[];
  title: string;
  message: string;
  type: NotificationType;
  metadata?: Record<string, any>;
}

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}

export async function createNotification(params: CreateNotificationParams): Promise<{ success: boolean; error?: string }> {
  const supabase = getServiceClient();
  
  const { error } = await supabase
    .from('notifications')
    .insert({
      user_id: params.userId,
      title: params.title,
      message: params.message,
      type: params.type,
      metadata: params.metadata || {},
      is_read: false,
    });

  if (error) {
    console.error('Error creating notification:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function createBulkNotifications(params: BulkNotificationParams): Promise<{ success: boolean; count: number; error?: string }> {
  if (params.userIds.length === 0) {
    return { success: true, count: 0 };
  }

  const supabase = getServiceClient();
  
  const notifications = params.userIds.map(userId => ({
    user_id: userId,
    title: params.title,
    message: params.message,
    type: params.type,
    metadata: params.metadata || {},
    is_read: false,
  }));

  const { error } = await supabase
    .from('notifications')
    .insert(notifications);

  if (error) {
    console.error('Error creating bulk notifications:', error);
    return { success: false, count: 0, error: error.message };
  }

  return { success: true, count: params.userIds.length };
}

export async function notifyWorkersAtPlace(
  placeId: string,
  title: string,
  message: string,
  type: NotificationType,
  metadata?: Record<string, any>
): Promise<{ success: boolean; count: number; error?: string }> {
  const supabase = getServiceClient();

  // Get all workers assigned to this place
  const { data: workerPlaces, error: fetchError } = await supabase
    .from('worker_places')
    .select('worker_id')
    .eq('place_id', placeId)
    .eq('is_active', true);

  if (fetchError) {
    console.error('Error fetching workers for place:', fetchError);
    return { success: false, count: 0, error: fetchError.message };
  }

  if (!workerPlaces || workerPlaces.length === 0) {
    return { success: true, count: 0 };
  }

  const workerIds = workerPlaces.map(wp => wp.worker_id);
  
  return createBulkNotifications({
    userIds: workerIds,
    title,
    message,
    type,
    metadata,
  });
}

export async function notifyWorkersWithSkillAtPlace(
  placeId: string,
  skillIds: string[],
  title: string,
  message: string,
  type: NotificationType,
  metadata?: Record<string, any>
): Promise<{ success: boolean; count: number; error?: string }> {
  const supabase = getServiceClient();

  // Get workers at this place who have any of the specified skills
  const { data: workerPlaces, error: placeError } = await supabase
    .from('worker_places')
    .select('worker_id')
    .eq('place_id', placeId)
    .eq('is_active', true);

  if (placeError) {
    console.error('Error fetching workers for place:', placeError);
    return { success: false, count: 0, error: placeError.message };
  }

  if (!workerPlaces || workerPlaces.length === 0) {
    return { success: true, count: 0 };
  }

  const workerIdsAtPlace = workerPlaces.map(wp => wp.worker_id);

  // Get workers with the required skills
  const { data: workerSkills, error: skillError } = await supabase
    .from('worker_skills')
    .select('worker_id')
    .in('skill_id', skillIds)
    .in('worker_id', workerIdsAtPlace);

  if (skillError) {
    console.error('Error fetching worker skills:', skillError);
    return { success: false, count: 0, error: skillError.message };
  }

  if (!workerSkills || workerSkills.length === 0) {
    return { success: true, count: 0 };
  }

  // Deduplicate worker IDs
  const uniqueWorkerIds = [...new Set(workerSkills.map(ws => ws.worker_id))];

  return createBulkNotifications({
    userIds: uniqueWorkerIds,
    title,
    message,
    type,
    metadata,
  });
}

export async function notifyManager(
  managerId: string,
  title: string,
  message: string,
  type: NotificationType,
  metadata?: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  return createNotification({
    userId: managerId,
    title,
    message,
    type,
    metadata,
  });
}

export function formatTimesheetNotificationMessage(
  timesheetName: string,
  placeName: string,
  startDate: string,
  endDate: string,
  deadline: string
): string {
  const start = new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const end = new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const deadlineFormatted = new Date(deadline).toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  return `A new timesheet "${timesheetName}" for ${placeName} (${start} - ${end}) is now available. Please set your availability before ${deadlineFormatted}.`;
}
