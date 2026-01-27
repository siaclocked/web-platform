'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PageContainer } from '@/components/layout';
import { Card, CardContent, Button, Badge, Input, Select } from '@/components/ui';
import { FileText, Upload, Download, Trash2, Users, Calendar, AlertCircle } from 'lucide-react';

interface Document {
  id: string;
  name: string;
  file_type: string;
  file_size: number;
  worker_id: string;
  worker_name?: string;
  expires_at: string | null;
  is_archived: boolean;
  created_at: string;
}

interface Worker {
  id: string;
  first_name: string;
  last_name: string;
}

export default function ManagerDocumentsPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState('');
  const [documentName, setDocumentName] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchDocuments();
    fetchWorkers();
  }, []);

  const fetchDocuments = async () => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/login');
        return;
      }

      const response = await fetch('/api/documents', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents || []);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchWorkers = async () => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) return;

      const response = await fetch('/api/manager/workers', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setWorkers(data.workers || []);
      }
    } catch (error) {
      console.error('Error fetching workers:', error);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !selectedWorker || !documentName) {
      setError('Please fill in all required fields');
      return;
    }

    setUploading(true);
    setError('');
    setSuccess('');

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/login');
        return;
      }

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('worker_id', selectedWorker);
      formData.append('name', documentName);
      if (expiresAt) {
        formData.append('expires_at', expiresAt);
      }

      const response = await fetch('/api/documents', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      if (response.ok) {
        setSuccess('Document uploaded successfully');
        setSelectedFile(null);
        setDocumentName('');
        setExpiresAt('');
        setSelectedWorker('');
        fetchDocuments();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to upload document');
      }
    } catch (error) {
      console.error('Error uploading document:', error);
      setError('Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const getWorkerName = (workerId: string) => {
    const worker = workers.find(w => w.id === workerId);
    return worker ? `${worker.first_name} ${worker.last_name}` : 'Unknown';
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

  return (
    <PageContainer>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Documents</h1>
          <p className="text-foreground-muted">Upload and manage worker documents</p>
        </div>

        {/* Upload Form */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold mb-4">Upload New Document</h2>
            <form onSubmit={handleUpload} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Worker *</label>
                  <Select
                    value={selectedWorker}
                    onChange={(e) => setSelectedWorker(e.target.value)}
                    placeholder="Select worker"
                    options={workers.map((worker) => ({
                      value: worker.id,
                      label: `${worker.first_name} ${worker.last_name}`
                    }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Document Name *</label>
                  <Input
                    value={documentName}
                    onChange={(e) => setDocumentName(e.target.value)}
                    placeholder="e.g., Employment Contract"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">File *</label>
                  <input
                    type="file"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-primary file:text-white file:cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Expiration Date (optional)</label>
                  <Input
                    type="date"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 bg-danger/10 border border-danger/30 rounded-md text-danger text-sm">
                  {error}
                </div>
              )}

              {success && (
                <div className="p-3 bg-success/10 border border-success/30 rounded-md text-success text-sm">
                  {success}
                </div>
              )}

              <Button type="submit" isLoading={uploading}>
                <Upload className="w-4 h-4 mr-2" />
                Upload Document
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Documents List */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold mb-4">All Documents ({documents.length})</h2>
            
            {documents.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="w-12 h-12 text-foreground-muted mx-auto mb-4" />
                <p className="text-foreground-muted">No documents uploaded yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-4 bg-background-secondary rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                        <FileText className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-medium text-foreground">{doc.name}</h4>
                        <div className="flex items-center gap-3 text-sm text-foreground-muted">
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {getWorkerName(doc.worker_id)}
                          </span>
                          <span>{formatFileSize(doc.file_size || 0)}</span>
                          <span>{formatDate(doc.created_at)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {doc.expires_at && (
                        <Badge variant={isExpired(doc.expires_at) ? 'danger' : 'warning'}>
                          {isExpired(doc.expires_at) ? 'Expired' : `Expires ${formatDate(doc.expires_at)}`}
                        </Badge>
                      )}
                      <Badge variant="success">Active</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
