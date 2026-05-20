'use client';

import { useState } from 'react';
import { Card, CardContent, Input, Avatar } from '@/components/ui';
import { Users, Search } from 'lucide-react';

export interface WorkerPickerItem {
  id: string;
  name: string;
}

interface WorkerPickerProps {
  workers: WorkerPickerItem[];
  heading: string;
  description?: string;
  searchPlaceholder?: string;
  cardSubtext?: string;
  emptyTitle?: string;
  emptyMessage?: string;
  onSelect: (worker: WorkerPickerItem) => void;
}

// Reusable picker for "choose one team member to do X with."
// Renders a search box + a card grid of workers with avatars; clicking a card calls `onSelect`.
// Used so far by team-availability; tracking / per-worker schedule views are likely future adopters.
export function WorkerPicker({
  workers,
  heading,
  description,
  searchPlaceholder = 'Search team members...',
  cardSubtext,
  emptyTitle = 'No team members found',
  emptyMessage = 'Add team members to your company to see them here.',
  onSelect,
}: WorkerPickerProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = workers.filter(w => w.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">{heading}</h1>
        {description && <p className="text-foreground-muted">{description}</p>}
      </div>

      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-foreground-muted w-4 h-4" />
          <Input
            type="text"
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {workers.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <Users className="w-12 h-12 mx-auto mb-4 text-foreground-muted" />
            <h3 className="text-lg font-medium mb-2">{emptyTitle}</h3>
            <p className="text-foreground-muted">{emptyMessage}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(worker => (
            <Card
              key={worker.id}
              className="cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => onSelect(worker)}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <Avatar name={worker.name} size="md" />
                <div className="min-w-0">
                  <h3 className="font-medium text-foreground truncate">{worker.name}</h3>
                  {cardSubtext && (
                    <p className="text-xs text-foreground-muted">{cardSubtext}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
