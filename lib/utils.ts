import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatTime(date: Date | string): string {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateTime(date: Date | string): string {
  return `${formatDate(date)} ${formatTime(date)}`;
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export interface MonthGridCell {
  day: number;
  dateStr: string;
  isCurrentMonth: boolean;
  dow: number;
}

// Builds a 6-row × 7-col month grid (42 cells) for `year`/`month` (month is 0-indexed).
// Week starts on **Monday** — column 0 = Mon, column 6 = Sun. `dow` is still the raw JS
// day-of-week (0=Sun..6=Sat), so weekend detection (`dow === 0 || dow === 6`) is unaffected.
// Cells outside the target month are tagged `isCurrentMonth: false`.
export function buildMonthGrid(year: number, month: number): MonthGridCell[] {
  const jsFirstDay = new Date(year, month, 1).getDay(); // 0=Sun..6=Sat
  const mondayOffset = (jsFirstDay + 6) % 7;            // 0=Mon..6=Sun
  const gridStart = new Date(year, month, 1 - mondayOffset);
  const cells: MonthGridCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    cells.push({
      day: d.getDate(),
      dateStr: `${yyyy}-${mm}-${dd}`,
      isCurrentMonth: d.getMonth() === month && d.getFullYear() === year,
      dow: d.getDay(),
    });
  }
  return cells;
}

// Maps a user.role to the URL segment of their primary workspace.
// admin and manager both live in /manager/* (admin inherits per Task 2).
// worker lives in /team-member/* (renamed from /worker/*).
export function roleHomeSegment(role: string | null | undefined): 'manager' | 'team-member' {
  if (role === 'worker') return 'team-member';
  return 'manager';
}

export function isWithinGracePeriod(
  scheduledStart: Date,
  currentTime: Date,
  graceMinutes = 15
): boolean {
  const diff = Math.abs(currentTime.getTime() - scheduledStart.getTime());
  return diff <= graceMinutes * 60 * 1000;
}
