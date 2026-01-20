'use client';

import { useState, useEffect } from 'react';
import { PageContainer } from '@/components/layout';
import { Card, CardContent, Button, Badge } from '@/components/ui';
import { BackButton } from '@/components/ui';
import { ClipboardList, Download, Calendar, Users, Clock, CheckCircle, X } from 'lucide-react';

interface Timesheet {
  id: string;
  worker_name: string;
  worker_id: string;
  period: string;
  total_hours: number;
  approved_hours: number;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export default function ManagerTimesheetsPage() {
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('current');

  useEffect(() => {
    fetchTimesheets();
  }, []);

  const fetchTimesheets = async () => {
    try {
      // Mock data for now - replace with actual API call
      const mockTimesheets: Timesheet[] = [
        {
          id: '1',
          worker_name: 'John Doe',
          worker_id: 'worker-1',
          period: '2024-01',
          total_hours: 160,
          approved_hours: 160,
          status: 'approved',
          created_at: new Date().toISOString(),
        },
        {
          id: '2',
          worker_name: 'Jane Smith',
          worker_id: 'worker-2',
          period: '2024-01',
          total_hours: 152,
          approved_hours: 152,
          status: 'pending',
          created_at: new Date(Date.now() - 86400000).toISOString(),
        },
      ];
      setTimesheets(mockTimesheets);
    } catch (error) {
      console.error('Error fetching timesheets:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (timesheetId: string) => {
    try {
      // Mock approval - replace with actual API call
      setTimesheets(prev => 
        prev.map(t => 
          t.id === timesheetId ? { ...t, status: 'approved' as const } : t
        )
      );
    } catch (error) {
      console.error('Error approving timesheet:', error);
    }
  };

  const handleReject = async (timesheetId: string) => {
    try {
      // Mock rejection - replace with actual API call
      setTimesheets(prev => 
        prev.map(t => 
          t.id === timesheetId ? { ...t, status: 'rejected' as const } : t
        )
      );
    } catch (error) {
      console.error('Error rejecting timesheet:', error);
    }
  };

  const handleExport = async () => {
    try {
      // Mock export - replace with actual API call
      console.log('Exporting timesheets for period:', selectedPeriod);
    } catch (error) {
      console.error('Error exporting timesheets:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'success';
      case 'rejected':
        return 'danger';
      case 'pending':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-4 h-4" />;
      case 'rejected':
        return <X className="w-4 h-4" />;
      case 'pending':
        return <Clock className="w-4 h-4" />;
      default:
        return null;
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

  return (
    <PageContainer>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <BackButton href="/manager" label="Back to Dashboard" className="mb-4" />
          <h1 className="text-2xl font-bold text-foreground">Timesheets</h1>
          <p className="text-foreground-muted">
            Review and approve worker timesheets
          </p>
        </div>

        {/* Period Selector */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm font-medium">Period:</span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={selectedPeriod === 'current' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedPeriod('current')}
                >
                  Current Month
                </Button>
                <Button
                  variant={selectedPeriod === 'previous' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedPeriod('previous')}
                >
                  Previous Month
                </Button>
                <Button
                  variant={selectedPeriod === 'all' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedPeriod('all')}
                >
                  All Time
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 text-center">
              <ClipboardList className="w-8 h-8 mx-auto mb-2 text-primary" />
              <div className="text-2xl font-bold text-foreground">
                {timesheets.filter(t => t.status === 'pending').length}
              </div>
              <p className="text-sm text-muted-foreground">Pending</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 text-success" />
              <div className="text-2xl font-bold text-foreground">
                {timesheets.filter(t => t.status === 'approved').length}
              </div>
              <p className="text-sm text-muted-foreground">Approved</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <Users className="w-8 h-8 mx-auto mb-2 text-info" />
              <div className="text-2xl font-bold text-foreground">
                {timesheets.length}
              </div>
              <p className="text-sm text-muted-foreground">Total</p>
            </CardContent>
          </Card>
        </div>

        {/* Export Button */}
        <div className="mb-6">
          <Button onClick={handleExport} className="w-full">
            <Download className="w-4 h-4 mr-2" />
            Export Timesheets
          </Button>
        </div>

        {/* Timesheets List */}
        <div className="space-y-4">
          {timesheets.map((timesheet) => (
            <Card key={timesheet.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-medium text-foreground">
                      {timesheet.worker_name}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {timesheet.period}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={getStatusColor(timesheet.status)}>
                      {timesheet.status}
                    </Badge>
                    {getStatusIcon(timesheet.status)}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Total Hours</p>
                    <p className="font-medium">
                      {timesheet.total_hours}h
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Approved Hours</p>
                    <p className="font-medium">
                      {timesheet.approved_hours}h
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <p className="font-medium">
                      {timesheet.status}
                    </p>
                  </div>
                </div>

                {timesheet.status === 'pending' && (
                  <div className="flex gap-2 mt-4">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleApprove(timesheet.id)}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleReject(timesheet.id)}
                    >
                      Reject
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </PageContainer>
  );
}
