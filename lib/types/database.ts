export type UserRole = 'admin' | 'manager' | 'worker';
export type ScheduleStatus = 'DRAFT' | 'PUBLISHED';
export type AvailabilityType = 'full_day' | 'time_range' | 'vacation';
export type NotificationAudience = 'NEXT_IN_SKILL' | 'NEXT_SHIFT_ALL';
export type TimesheetStatus = 'pending' | 'approved' | 'rejected';

export interface Company {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  phone: string;
  email?: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  company_id: string;
  avatar_url?: string;
  hourly_rate?: number;
  created_at: string;
  updated_at: string;
}

export interface Place {
  id: string;
  company_id: string;
  name: string;
  address?: string;
  timezone: string;
  settings: PlaceSettings;
  created_at: string;
  updated_at: string;
}

export interface PlaceSettings {
  max_hours_per_day: number;
  min_hours_per_block: number;
  max_hours_per_block: number;
  min_rest_between_shifts: number;
  schedule_granularity_minutes: number;
  grace_period_minutes: number;
}

export interface Skill {
  id: string;
  company_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface WorkerSkill {
  id: string;
  worker_id: string;
  skill_id: string;
  rating: number;
  created_at: string;
}

export interface WorkerPlace {
  id: string;
  worker_id: string;
  place_id: string;
  is_active: boolean;
  created_at: string;
}

export interface Schedule {
  id: string;
  place_id: string;
  start_date: string;
  end_date: string;
  status: ScheduleStatus;
  created_by: string;
  published_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ScheduleHistory {
  id: string;
  schedule_id: string;
  snapshot: object;
  published_at: string;
  published_by: string;
}

export interface Shift {
  id: string;
  schedule_id: string;
  worker_id: string;
  place_id: string;
  skill_id: string;
  start_time: string;
  end_time: string;
  is_locked: boolean;
  is_open: boolean;
  created_at: string;
  updated_at: string;
}

export interface ShiftInterest {
  id: string;
  shift_id: string;
  worker_id: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface Availability {
  id: string;
  worker_id: string;
  place_id: string;
  date: string;
  type: AvailabilityType;
  start_time?: string;
  end_time?: string;
  is_paid_leave: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface WorkSession {
  id: string;
  worker_id: string;
  place_id: string;
  skill_id: string;
  shift_id?: string;
  start_time: string;
  end_time?: string;
  is_scheduled: boolean;
  handoff_note?: string;
  handoff_audience?: NotificationAudience;
  created_at: string;
  updated_at: string;
}

export interface Timesheet {
  id: string;
  worker_id: string;
  place_id: string;
  month: string;
  year: number;
  total_hours: number;
  approved_hours: number;
  status: TimesheetStatus;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
}

export interface TimesheetEdit {
  id: string;
  work_session_id: string;
  edited_by: string;
  previous_start: string;
  previous_end?: string;
  new_start: string;
  new_end?: string;
  reason: string;
  created_at: string;
}

export interface Document {
  id: string;
  worker_id: string;
  uploaded_by: string;
  name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  expires_at?: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  metadata?: object;
  created_at: string;
}

export interface CoverageTemplate {
  id: string;
  place_id: string;
  skill_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  min_workers: number;
  created_at: string;
  updated_at: string;
}
