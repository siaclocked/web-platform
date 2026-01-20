'use client';

import { useState, useEffect } from 'react';
import { PageContainer } from '@/components/layout';
import { Card, CardContent, Button, Badge } from '@/components/ui';
import { BackButton } from '@/components/ui';
import { TrendingUp, Download, Calendar, Users, FileText, CheckCircle, Clock } from 'lucide-react';

interface Report {
  id: string;
  title: string;
  type: 'timesheet_summary' | 'attendance' | 'productivity' | 'scheduling';
  period: string;
  status: 'ready' | 'generating' | 'completed';
  created_at: string;
  data?: any;
}

export default function ManagerReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      // Mock data for now - replace with actual API call
      const mockReports: Report[] = [
        {
          id: '1',
          title: 'January Timesheet Summary',
          type: 'timesheet_summary',
          period: '2024-01',
          status: 'completed',
          created_at: new Date().toISOString(),
        },
        {
          id: '2',
          title: 'Attendance Report',
          type: 'attendance',
          period: '2024-01',
          status: 'ready',
          created_at: new Date(Date.now() - 172800000).toISOString(),
        },
        {
          id: '3',
          title: 'Productivity Analysis',
          type: 'productivity',
          period: '2024-01',
          status: 'generating',
          created_at: new Date(Date.now() - 345600000).toISOString(),
        },
      ];
      setReports(mockReports);
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerate = async (reportId: string) => {
    try {
      // Mock generation - replace with actual API call
      setReports(prev => 
        prev.map(r => 
          r.id === reportId ? { ...r, status: 'generating' as const } : r
        )
      );
      
      // Simulate completion after 3 seconds
      setTimeout(() => {
        setReports(prev => 
          prev.map(r => 
            r.id === reportId ? { ...r, status: 'completed' as const } : r
          )
        );
      }, 3000);
    } catch (error) {
      console.error('Error generating report:', error);
    }
  };

  const handleDownload = async (reportId: string) => {
    try {
      // Mock download - replace with actual API call
      console.log('Downloading report:', reportId);
    } catch (error) {
      console.error('Error downloading report:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready':
        return 'success';
      case 'generating':
        return 'warning';
      case 'completed':
        return 'default';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ready':
        return <CheckCircle className="w-4 h-4" />;
      case 'generating':
        return <Clock className="w-4 h-4" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'timesheet_summary':
        return <FileText className="w-5 h-5" />;
      case 'attendance':
        return <Users className="w-5 h-5" />;
      case 'productivity':
        return <TrendingUp className="w-5 h-5" />;
      default:
        return <FileText className="w-5 h-5" />;
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
          <h1 className="text-2xl font-bold text-foreground">Reports</h1>
          <p className="text-foreground-muted">
            View and download various reports
          </p>
        </div>

        {/* Reports List */}
        <div className="space-y-4">
          {reports.map((report) => (
            <Card key={report.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {getTypeIcon(report.type)}
                    <div>
                      <h3 className="font-medium text-foreground">
                        {report.title}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {report.period}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={getStatusColor(report.status)}>
                      {report.status}
                    </Badge>
                    {getStatusIcon(report.status)}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {new Date(report.created_at).toLocaleString()}
                  </p>
                  <div className="flex gap-2">
                    {report.status === 'ready' && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleGenerate(report.id)}
                      >
                        Generate
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(report.id)}
                    >
                      <Download className="w-4 h-4 mr-2" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </PageContainer>
  );
}
