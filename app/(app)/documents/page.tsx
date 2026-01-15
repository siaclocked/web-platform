'use client';

import { PageContainer } from '@/components/layout';
import { Card, CardContent, Badge, Button } from '@/components/ui';
import { FileText, Download, Clock, AlertTriangle } from 'lucide-react';

interface Document {
  id: string;
  name: string;
  type: string;
  uploadedAt: string;
  expiresAt?: string;
  isNew: boolean;
}

const mockDocuments: Document[] = [
  {
    id: '1',
    name: 'Employment Contract',
    type: 'PDF',
    uploadedAt: '2024-01-10',
    isNew: false,
  },
  {
    id: '2',
    name: 'Safety Training Certificate',
    type: 'PDF',
    uploadedAt: '2024-01-15',
    expiresAt: '2025-01-15',
    isNew: true,
  },
  {
    id: '3',
    name: 'ID Badge Photo',
    type: 'JPG',
    uploadedAt: '2024-01-05',
    isNew: false,
  },
];

export default function DocumentsPage() {
  const handleDownload = (doc: Document) => {
    // Here you would get a signed URL from Supabase storage
    console.log('Downloading:', doc.name);
  };

  const isExpiringSoon = (expiresAt?: string) => {
    if (!expiresAt) return false;
    const daysUntilExpiry = Math.floor(
      (new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    return daysUntilExpiry <= 30;
  };

  return (
    <PageContainer
      title="My Documents"
      description="Documents shared with you by your manager"
    >
      <div className="space-y-3">
        {mockDocuments.map((doc) => (
          <Card key={doc.id}>
            <CardContent className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary-muted rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-primary" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-foreground truncate">
                    {doc.name}
                  </p>
                  {doc.isNew && <Badge variant="info">New</Badge>}
                </div>
                <div className="flex items-center gap-3 text-sm text-foreground-muted">
                  <span>{doc.type}</span>
                  <span>•</span>
                  <span>Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}</span>
                </div>
                {doc.expiresAt && (
                  <div
                    className={`flex items-center gap-1 text-xs mt-1 ${
                      isExpiringSoon(doc.expiresAt)
                        ? 'text-warning'
                        : 'text-foreground-muted'
                    }`}
                  >
                    {isExpiringSoon(doc.expiresAt) ? (
                      <AlertTriangle className="w-3 h-3" />
                    ) : (
                      <Clock className="w-3 h-3" />
                    )}
                    Expires {new Date(doc.expiresAt).toLocaleDateString()}
                  </div>
                )}
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleDownload(doc)}
              >
                <Download className="w-4 h-4" />
              </Button>
            </CardContent>
          </Card>
        ))}

        {mockDocuments.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="w-12 h-12 text-foreground-muted mx-auto mb-4" />
              <p className="text-foreground-muted">No documents available</p>
            </CardContent>
          </Card>
        )}
      </div>
    </PageContainer>
  );
}
