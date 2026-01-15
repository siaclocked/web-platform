'use client';

import { useState } from 'react';
import { PageContainer } from '@/components/layout';
import { Card, CardContent, Button, Input, Modal, Badge, Avatar, Select } from '@/components/ui';
import { Plus, Search, Phone, MapPin, Star, MoreVertical, UserPlus } from 'lucide-react';
import Link from 'next/link';

interface Worker {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  skills: string[];
  places: string[];
  hourlyRate: number;
  rating: number;
  status: 'active' | 'inactive' | 'pending';
}

const mockWorkers: Worker[] = [
  {
    id: '1',
    firstName: 'John',
    lastName: 'Doe',
    phone: '+1 234 567 8901',
    skills: ['Waiter', 'Bartender'],
    places: ['Downtown Restaurant'],
    hourlyRate: 18,
    rating: 4.8,
    status: 'active',
  },
  {
    id: '2',
    firstName: 'Sarah',
    lastName: 'Miller',
    phone: '+1 234 567 8902',
    skills: ['Cook'],
    places: ['Downtown Restaurant', 'Mall Location'],
    hourlyRate: 22,
    rating: 4.5,
    status: 'active',
  },
  {
    id: '3',
    firstName: 'Mike',
    lastName: 'Johnson',
    phone: '+1 234 567 8903',
    skills: ['Security'],
    places: ['Airport Branch'],
    hourlyRate: 20,
    rating: 4.2,
    status: 'inactive',
  },
  {
    id: '4',
    firstName: 'Emily',
    lastName: 'Brown',
    phone: '+1 234 567 8904',
    skills: ['Waiter'],
    places: ['Mall Location'],
    hourlyRate: 16,
    rating: 0,
    status: 'pending',
  },
];

const skillOptions = [
  { value: 'waiter', label: 'Waiter' },
  { value: 'cook', label: 'Cook' },
  { value: 'bartender', label: 'Bartender' },
  { value: 'security', label: 'Security' },
];

const placeOptions = [
  { value: '1', label: 'Downtown Restaurant' },
  { value: '2', label: 'Mall Location' },
  { value: '3', label: 'Airport Branch' },
];

export default function WorkersPage() {
  const [workers, setWorkers] = useState(mockWorkers);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newWorker, setNewWorker] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    hourlyRate: '',
  });

  const filteredWorkers = workers.filter(
    (worker) =>
      worker.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      worker.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      worker.phone.includes(searchQuery)
  );

  const handleAddWorker = () => {
    if (!newWorker.firstName || !newWorker.phone) return;

    const worker: Worker = {
      id: Date.now().toString(),
      firstName: newWorker.firstName,
      lastName: newWorker.lastName,
      phone: newWorker.phone,
      skills: [],
      places: [],
      hourlyRate: parseFloat(newWorker.hourlyRate) || 15,
      rating: 0,
      status: 'pending',
    };

    setWorkers([...workers, worker]);
    setShowAddModal(false);
    setNewWorker({ firstName: '', lastName: '', phone: '', hourlyRate: '' });
  };

  const getStatusVariant = (status: Worker['status']) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'inactive':
        return 'default';
      case 'pending':
        return 'warning';
    }
  };

  return (
    <PageContainer
      title="Workers"
      description={`${workers.length} total workers`}
      action={
        <Button size="sm" onClick={() => setShowAddModal(true)}>
          <UserPlus className="w-4 h-4 mr-1" />
          Add
        </Button>
      }
    >
      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground-muted" />
        <Input
          placeholder="Search workers..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Workers List */}
      <div className="space-y-3">
        {filteredWorkers.map((worker) => (
          <Card key={worker.id}>
            <CardContent className="flex items-center gap-3">
              <Avatar
                name={`${worker.firstName} ${worker.lastName}`}
                size="md"
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-foreground">
                    {worker.firstName} {worker.lastName}
                  </h3>
                  <Badge variant={getStatusVariant(worker.status)}>
                    {worker.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-sm text-foreground-muted">
                  <Phone className="w-3 h-3" />
                  <span>{worker.phone}</span>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {worker.skills.map((skill) => (
                    <Badge key={skill} variant="info">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="text-right">
                {worker.rating > 0 && (
                  <div className="flex items-center gap-1 text-warning mb-1">
                    <Star className="w-4 h-4 fill-current" />
                    <span className="text-sm font-medium">{worker.rating}</span>
                  </div>
                )}
                <p className="text-sm text-foreground-muted">
                  ${worker.hourlyRate}/hr
                </p>
              </div>

              <button className="p-2 hover:bg-background-tertiary rounded-lg transition-colors">
                <MoreVertical className="w-5 h-5 text-foreground-muted" />
              </button>
            </CardContent>
          </Card>
        ))}

        {filteredWorkers.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-foreground-muted">No workers found</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add Worker Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add New Worker"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="First Name"
              placeholder="John"
              value={newWorker.firstName}
              onChange={(e) =>
                setNewWorker({ ...newWorker, firstName: e.target.value })
              }
            />
            <Input
              label="Last Name"
              placeholder="Doe"
              value={newWorker.lastName}
              onChange={(e) =>
                setNewWorker({ ...newWorker, lastName: e.target.value })
              }
            />
          </div>
          <Input
            label="Phone Number"
            placeholder="+1 234 567 8900"
            value={newWorker.phone}
            onChange={(e) =>
              setNewWorker({ ...newWorker, phone: e.target.value })
            }
          />
          <Input
            label="Hourly Rate ($)"
            type="number"
            placeholder="15"
            value={newWorker.hourlyRate}
            onChange={(e) =>
              setNewWorker({ ...newWorker, hourlyRate: e.target.value })
            }
          />
          <p className="text-xs text-foreground-muted">
            An OTP will be sent to the worker&apos;s phone to complete registration
          </p>
          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setShowAddModal(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleAddWorker}
              disabled={!newWorker.firstName || !newWorker.phone}
            >
              Add Worker
            </Button>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}
