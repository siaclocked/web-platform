'use client';

import { useState } from 'react';
import { PageContainer } from '@/components/layout';
import { Card, CardContent, Button, Input, Modal, Badge, Avatar } from '@/components/ui';
import { UserPlus, Phone, Mail, MoreVertical, Trash2 } from 'lucide-react';

interface Manager {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  placesCount: number;
  status: 'active' | 'pending';
}

const mockManagers: Manager[] = [
  {
    id: '1',
    firstName: 'Alice',
    lastName: 'Johnson',
    phone: '+1 234 567 8901',
    email: 'alice@example.com',
    placesCount: 2,
    status: 'active',
  },
  {
    id: '2',
    firstName: 'Bob',
    lastName: 'Smith',
    phone: '+1 234 567 8902',
    email: 'bob@example.com',
    placesCount: 1,
    status: 'active',
  },
  {
    id: '3',
    firstName: 'Carol',
    lastName: 'Williams',
    phone: '+1 234 567 8903',
    email: 'carol@example.com',
    placesCount: 0,
    status: 'pending',
  },
];

export default function ManagersPage() {
  const [managers, setManagers] = useState(mockManagers);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newManager, setNewManager] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
  });

  const handleAddManager = () => {
    if (!newManager.firstName || !newManager.phone) return;

    const manager: Manager = {
      id: Date.now().toString(),
      firstName: newManager.firstName,
      lastName: newManager.lastName,
      phone: newManager.phone,
      email: newManager.email,
      placesCount: 0,
      status: 'pending',
    };

    setManagers([...managers, manager]);
    setShowAddModal(false);
    setNewManager({ firstName: '', lastName: '', phone: '', email: '' });
  };

  const handleRemoveManager = (id: string) => {
    setManagers(managers.filter((m) => m.id !== id));
  };

  return (
    <PageContainer
      title="Managers"
      description="Manage manager accounts"
      action={
        <Button size="sm" onClick={() => setShowAddModal(true)}>
          <UserPlus className="w-4 h-4 mr-1" />
          Add
        </Button>
      }
    >
      <div className="space-y-3">
        {managers.map((manager) => (
          <Card key={manager.id}>
            <CardContent className="flex items-center gap-3">
              <Avatar
                name={`${manager.firstName} ${manager.lastName}`}
                size="md"
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-foreground">
                    {manager.firstName} {manager.lastName}
                  </h3>
                  <Badge
                    variant={manager.status === 'active' ? 'success' : 'warning'}
                  >
                    {manager.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-sm text-foreground-muted">
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {manager.phone}
                  </span>
                  {manager.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      {manager.email}
                    </span>
                  )}
                </div>
                <p className="text-xs text-foreground-muted mt-1">
                  Managing {manager.placesCount} place
                  {manager.placesCount !== 1 ? 's' : ''}
                </p>
              </div>

              <button
                onClick={() => handleRemoveManager(manager.id)}
                className="p-2 hover:bg-danger-muted rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4 text-danger" />
              </button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add Manager Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add New Manager"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="First Name"
              placeholder="Alice"
              value={newManager.firstName}
              onChange={(e) =>
                setNewManager({ ...newManager, firstName: e.target.value })
              }
            />
            <Input
              label="Last Name"
              placeholder="Johnson"
              value={newManager.lastName}
              onChange={(e) =>
                setNewManager({ ...newManager, lastName: e.target.value })
              }
            />
          </div>
          <Input
            label="Phone Number"
            placeholder="+1 234 567 8900"
            value={newManager.phone}
            onChange={(e) =>
              setNewManager({ ...newManager, phone: e.target.value })
            }
          />
          <Input
            label="Email (Optional)"
            type="email"
            placeholder="alice@example.com"
            value={newManager.email}
            onChange={(e) =>
              setNewManager({ ...newManager, email: e.target.value })
            }
          />
          <p className="text-xs text-foreground-muted">
            An OTP will be sent to the manager&apos;s phone to complete registration
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
              onClick={handleAddManager}
              disabled={!newManager.firstName || !newManager.phone}
            >
              Add Manager
            </Button>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}
