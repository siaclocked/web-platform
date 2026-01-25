'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PageContainer } from '@/components/layout';
import { Card, CardContent, Button, Badge } from '@/components/ui';
import { BackButton } from '@/components/ui';
import { FileText, Download, Calendar, Eye, EyeOff, AlertCircle } from 'lucide-react';

interface Document {
  id: string;
  name: string;
  type: string;
  uploadedAt: string;
  expiresAt: string | null;
  status: 'ACTIVE' | 'EXPIRED' | 'ARCHIVED';
  downloadUrl: string | null;
  hasRead: boolean;
}

export default function MyDocumentsPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/login');
        return;
      }

      // Mock documents for demonstration
      const mockDocuments: Document[] = [
        {
          id: '1',
          name: 'Employment Contract',
          type: 'PDF',
          uploadedAt: '2024-01-15T10:00:00Z',
          expiresAt: '2025-01-15T23:59:59Z',
          status: 'ACTIVE',
          downloadUrl: '#',
          hasRead: false
        },
        {
          id: '2',
          name: 'Employee Handbook',
          type: 'PDF',
          uploadedAt: '2024-01-10T14:30:00Z',
          expiresAt: null,
          status: 'ACTIVE',
          downloadUrl: '#',
          hasRead: true
        },
        {
          id: '3',
          name: 'Safety Training Certificate',
          type: 'PDF',
          uploadedAt: '2023-12-01T09:15:00Z',
          expiresAt: '2024-12-01T23:59:59Z',
          status: 'EXPIRED',
          downloadUrl: '#',
          hasRead: true
        },
        {
          id: '4',
          name: 'Tax Forms 2024',
          type: 'PDF',
          uploadedAt: '2024-01-20T16:45:00Z',
          expiresAt: '2025-04-15T23:59:59Z',
          status: 'ACTIVE',
          downloadUrl: '#',
          hasRead: false
        }
      ];

      setDocuments(mockDocuments);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (document: Document) => {
    setDownloading(document.id);
    try {
      // In a real implementation, this would generate a signed URL and download the file
      console.log('Downloading document:', document.name);
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate download
      
      // Mark as read
      setDocuments(prev => prev.map(doc => 
        doc.id === document.id ? { ...doc, hasRead: true } : doc
      ));
    } catch (error) {
      console.error('Error downloading document:', error);
    } finally {
      setDownloading(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'success';
      case 'EXPIRED': return 'danger';
      case 'ARCHIVED': return 'warning';
      default: return 'default';
    }
  };

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
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

  const activeDocuments = documents.filter(doc => doc.status === 'ACTIVE');
  const expiredDocuments = documents.filter(doc => doc.status === 'EXPIRED');
  const archivedDocuments = documents.filter(doc => doc.status === 'ARCHIVED');

  return (
    <PageContainer>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <BackButton href="/worker" />
        </div>

        {/* Active Documents */}
        {activeDocuments.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Active Documents</h2>
            {activeDocuments.map((document) => (
              <Card key={document.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-10 h-10 bg-primary-muted rounded-lg flex items-center justify-center">
                        <FileText className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-foreground">{document.name}</h3>
                          {!document.hasRead && (
                            <div className="w-2 h-2 bg-accent rounded-full" />
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-foreground-muted">
                          <span>{document.type}</span>
                          <span>Uploaded {formatDate(document.uploadedAt)}</span>
                          {document.expiresAt && (
                            <span className={isExpired(document.expiresAt) ? 'text-danger' : ''}>
                              Expires {formatDate(document.expiresAt)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={getStatusVariant(document.status)}>
                        {document.status}
                      </Badge>
                      <Button
                        size="sm"
                        onClick={() => handleDownload(document)}
                        isLoading={downloading === document.id}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        {downloading === document.id ? 'Downloading...' : 'Download'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Expired Documents */}
        {expiredDocuments.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Expired Documents</h2>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-4 text-warning">
                  <AlertCircle className="w-5 h-5" />
                  <span className="text-sm">These documents have expired and may need renewal</span>
                </div>
                <div className="space-y-3">
                  {expiredDocuments.map((document) => (
                    <div key={document.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4 text-foreground-muted" />
                        <div>
                          <h4 className="font-medium text-foreground">{document.name}</h4>
                          <p className="text-sm text-foreground-muted">
                            Expired {formatDate(document.expiresAt!)}
                          </p>
                        </div>
                      </div>
                      <Badge variant="danger">EXPIRED</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Archived Documents */}
        {archivedDocuments.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Archived Documents</h2>
            <Card>
              <CardContent className="p-4">
                <div className="space-y-3">
                  {archivedDocuments.map((document) => (
                    <div key={document.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4 text-foreground-muted" />
                        <div>
                          <h4 className="font-medium text-foreground">{document.name}</h4>
                          <p className="text-sm text-foreground-muted">
                            Archived {formatDate(document.uploadedAt)}
                          </p>
                        </div>
                      </div>
                      <Badge variant="warning">ARCHIVED</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* No Documents */}
        {documents.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center">
              <FileText className="w-12 h-12 text-foreground-muted mx-auto mb-4" />
              <p className="text-foreground-muted">No documents available</p>
              <p className="text-sm text-foreground-muted mt-1">
                Your manager will upload documents here for you to access
              </p>
            </CardContent>
          </Card>
        )}

        {/* Summary */}
        {documents.length > 0 && (
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold text-foreground mb-3">Document Summary</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-success">{activeDocuments.length}</p>
                  <p className="text-xs text-foreground-muted">Active</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-danger">{expiredDocuments.length}</p>
                  <p className="text-xs text-foreground-muted">Expired</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-warning">{archivedDocuments.length}</p>
                  <p className="text-xs text-foreground-muted">Archived</p>
                </div>
              </div>
              {!documents.some(doc => doc.hasRead) && (
                <div className="mt-4 p-3 bg-accent/20 rounded-lg">
                  <p className="text-sm text-accent">
                    You have unread documents. Please review them to stay informed.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </PageContainer>
  );
}
