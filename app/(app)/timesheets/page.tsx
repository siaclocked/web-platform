'use client';

import { useState } from 'react';
import { PageContainer } from '@/components/layout';
import { Card, CardContent, Button, Badge, Avatar, Select, Modal, Input } from '@/components/ui';
import {
  Clock,
  CheckCircle,
  XCircle,
  Download,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Filter,
} from 'lucide-react';
import { format, subMonths, addMonths } from 'date-fns';

interface TimesheetEntry {
  id: string;
  workerId: string;
  workerName: string;
  date: string;
  startTime: string;
  endTime: string;
  totalHours: number;
  status: 'pending' | 'approved' | 'rejected';
  notes?: string;
}

const mockEntries: TimesheetEntry[] = [
  {
    id: '1',
    workerId: '1',
    workerName: 'John Doe',
    date: '2024-01-15',
    startTime: '09:00',
    endTime: '17:15',
    totalHours: 8.25,
    status: 'pending',
  },
  {
    id: '2',
    workerId: '1',
    workerName: 'John Doe',
    date: '2024-01-14',
    startTime: '10:00',
    endTime: '18:30',
    totalHours: 8.5,
    status: 'approved',
  },
  {
    id: '3',
    workerId: '2',
    workerName: 'Sarah Miller',
    date: '2024-01-15',
    startTime: '08:00',
    endTime: '16:00',
    totalHours: 8,
    status: 'pending',
  },
  {
    id: '4',
    workerId: '3',
    workerName: 'Mike Johnson',
    date: '2024-01-15',
    startTime: '14:00',
    endTime: '22:30',
    totalHours: 8.5,
    status: 'rejected',
    notes: 'Clock-in time discrepancy',
  },
];

const placeOptions = [
  { value: 'all', label: 'All Places' },
  { value: '1', label: 'Downtown Restaurant' },
  { value: '2', label: 'Mall Location' },
];

const statusOptions = [
  { value: 'all', label: 'All Status' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

export default function TimesheetsPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [entries, setEntries] = useState(mockEntries);
  const [selectedPlace, setSelectedPlace] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimesheetEntry | null>(null);
  const [editReason, setEditReason] = useState('');
  const [newStartTime, setNewStartTime] = useState('');
  const [newEndTime, setNewEndTime] = useState('');

  const filteredEntries = entries.filter((entry) => {
    if (selectedStatus !== 'all' && entry.status !== selectedStatus) return false;
    return true;
  });

  const pendingCount = entries.filter((e) => e.status === 'pending').length;
  const totalHours = entries.reduce((sum, e) => sum + e.totalHours, 0);
  const approvedHours = entries
    .filter((e) => e.status === 'approved')
    .reduce((sum, e) => sum + e.totalHours, 0);

  const handleApprove = (id: string) => {
    setEntries(
      entries.map((e) => (e.id === id ? { ...e, status: 'approved' as const } : e))
    );
  };

  const handleReject = (id: string) => {
    setEntries(
      entries.map((e) => (e.id === id ? { ...e, status: 'rejected' as const } : e))
    );
  };

  const handleEdit = (entry: TimesheetEntry) => {
    setEditingEntry(entry);
    setNewStartTime(entry.startTime);
    setNewEndTime(entry.endTime);
    setEditReason('');
    setShowEditModal(true);
  };

  const handleSaveEdit = () => {
    if (!editingEntry || !editReason) return;

    setEntries(
      entries.map((e) =>
        e.id === editingEntry.id
          ? {
              ...e,
              startTime: newStartTime,
              endTime: newEndTime,
              notes: editReason,
            }
          : e
      )
    );
    setShowEditModal(false);
    setEditingEntry(null);
  };

  const handleExport = () => {
    console.log('Exporting CSV...');
  };

  const getStatusVariant = (status: TimesheetEntry['status']) => {
    switch (status) {
      case 'approved':
        return 'success';
      case 'rejected':
        return 'danger';
      default:
        return 'warning';
    }
  };

  return (
    <PageContainer
      title="Timesheets"
      action={
        <Button variant="secondary" size="sm" onClick={handleExport}>
          <Download className="w-4 h-4 mr-1" />
          Export
        </Button>
      }
    >
      {/* Month Navigation */}
      <Card className="mb-4">
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-2 hover:bg-background-tertiary rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-foreground-muted" />
            </button>
            <h2 className="text-lg font-semibold text-foreground">
              {format(currentMonth, 'MMMM yyyy')}
            </h2>
            <button
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-2 hover:bg-background-tertiary rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-foreground-muted" />
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 bg-background-tertiary rounded-lg">
              <p className="text-2xl font-bold text-foreground">
                {totalHours.toFixed(1)}h
              </p>
              <p className="text-xs text-foreground-muted">Total</p>
            </div>
            <div className="text-center p-3 bg-success-muted/20 rounded-lg">
              <p className="text-2xl font-bold text-success">
                {approvedHours.toFixed(1)}h
              </p>
              <p className="text-xs text-foreground-muted">Approved</p>
            </div>
            <div className="text-center p-3 bg-warning-muted/20 rounded-lg">
              <p className="text-2xl font-bold text-warning">{pendingCount}</p>
              <p className="text-xs text-foreground-muted">Pending</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Select
          options={placeOptions}
          value={selectedPlace}
          onChange={(e) => setSelectedPlace(e.target.value)}
        />
        <Select
          options={statusOptions}
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
        />
      </div>

      {/* Entries */}
      <div className="space-y-3">
        {filteredEntries.map((entry) => (
          <Card key={entry.id}>
            <CardContent className="flex items-center gap-3">
              <Avatar name={entry.workerName} size="md" />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-foreground">{entry.workerName}</p>
                  <Badge variant={getStatusVariant(entry.status)}>
                    {entry.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-sm text-foreground-muted">
                  <span>{format(new Date(entry.date), 'MMM d')}</span>
                  <span>•</span>
                  <span>
                    {entry.startTime} - {entry.endTime}
                  </span>
                </div>
                {entry.notes && (
                  <p className="text-xs text-warning mt-1">{entry.notes}</p>
                )}
              </div>

              <div className="text-right">
                <p className="font-semibold text-foreground">
                  {entry.totalHours}h
                </p>
              </div>

              {entry.status === 'pending' && (
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEdit(entry)}
                    className="p-2 hover:bg-background-tertiary rounded-lg transition-colors"
                  >
                    <Edit2 className="w-4 h-4 text-foreground-muted" />
                  </button>
                  <button
                    onClick={() => handleApprove(entry.id)}
                    className="p-2 hover:bg-success-muted rounded-lg transition-colors"
                  >
                    <CheckCircle className="w-4 h-4 text-success" />
                  </button>
                  <button
                    onClick={() => handleReject(entry.id)}
                    className="p-2 hover:bg-danger-muted rounded-lg transition-colors"
                  >
                    <XCircle className="w-4 h-4 text-danger" />
                  </button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Approve All Button */}
      {pendingCount > 0 && (
        <div className="fixed bottom-20 left-0 right-0 p-4 bg-background/80 backdrop-blur-sm border-t border-border">
          <Button
            className="w-full"
            onClick={() => {
              entries.forEach((e) => {
                if (e.status === 'pending') handleApprove(e.id);
              });
            }}
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Approve All Pending ({pendingCount})
          </Button>
        </div>
      )}

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Timesheet Entry"
      >
        {editingEntry && (
          <div className="space-y-4">
            <div className="p-3 bg-background-tertiary rounded-lg">
              <p className="font-medium text-foreground">
                {editingEntry.workerName}
              </p>
              <p className="text-sm text-foreground-muted">
                {format(new Date(editingEntry.date), 'EEEE, MMMM d, yyyy')}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Start Time"
                type="time"
                value={newStartTime}
                onChange={(e) => setNewStartTime(e.target.value)}
              />
              <Input
                label="End Time"
                type="time"
                value={newEndTime}
                onChange={(e) => setNewEndTime(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Reason for Edit (Required)
              </label>
              <textarea
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="Explain why you're editing this entry..."
                className="w-full px-4 py-3 rounded-lg resize-none"
                rows={3}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setShowEditModal(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleSaveEdit}
                disabled={!editReason.trim()}
              >
                Save Changes
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </PageContainer>
  );
}
