'use client';

import { useState } from 'react';
import { PageContainer } from '@/components/layout';
import { Card, CardContent, Button, Input, Modal, Badge } from '@/components/ui';
import { MapPin, Plus, Settings, Users, Clock, ChevronRight, Trash2 } from 'lucide-react';

interface Place {
  id: string;
  name: string;
  address: string;
  workerCount: number;
  isActive: boolean;
}

const mockPlaces: Place[] = [
  {
    id: '1',
    name: 'Downtown Restaurant',
    address: '123 Main St, New York, NY',
    workerCount: 8,
    isActive: true,
  },
  {
    id: '2',
    name: 'Mall Location',
    address: '456 Shopping Center, New York, NY',
    workerCount: 5,
    isActive: true,
  },
  {
    id: '3',
    name: 'Airport Branch',
    address: 'JFK Airport, Terminal 4',
    workerCount: 3,
    isActive: false,
  },
];

export default function PlacesPage() {
  const [places, setPlaces] = useState(mockPlaces);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPlaceName, setNewPlaceName] = useState('');
  const [newPlaceAddress, setNewPlaceAddress] = useState('');

  const handleAddPlace = () => {
    if (!newPlaceName.trim()) return;

    const newPlace: Place = {
      id: Date.now().toString(),
      name: newPlaceName,
      address: newPlaceAddress,
      workerCount: 0,
      isActive: true,
    };

    setPlaces([...places, newPlace]);
    setShowAddModal(false);
    setNewPlaceName('');
    setNewPlaceAddress('');
  };

  return (
    <PageContainer
      title="Places"
      description="Manage your work locations"
      action={
        <Button size="sm" onClick={() => setShowAddModal(true)}>
          <Plus className="w-4 h-4 mr-1" />
          Add Place
        </Button>
      }
    >
      <div className="space-y-3">
        {places.map((place) => (
          <Card key={place.id}>
            <CardContent className="flex items-center gap-4">
              <div
                className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  place.isActive ? 'bg-primary-muted' : 'bg-background-tertiary'
                }`}
              >
                <MapPin
                  className={`w-6 h-6 ${
                    place.isActive ? 'text-primary' : 'text-foreground-muted'
                  }`}
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-foreground">{place.name}</h3>
                  {!place.isActive && (
                    <Badge variant="default">Inactive</Badge>
                  )}
                </div>
                <p className="text-sm text-foreground-muted truncate">
                  {place.address}
                </p>
                <div className="flex items-center gap-3 mt-1 text-xs text-foreground-muted">
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {place.workerCount} workers
                  </span>
                </div>
              </div>

              <button className="p-2 hover:bg-background-tertiary rounded-lg transition-colors">
                <Settings className="w-5 h-5 text-foreground-muted" />
              </button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add Place Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add New Place"
      >
        <div className="space-y-4">
          <Input
            label="Place Name"
            placeholder="e.g., Downtown Restaurant"
            value={newPlaceName}
            onChange={(e) => setNewPlaceName(e.target.value)}
          />
          <Input
            label="Address"
            placeholder="123 Main St, City, State"
            value={newPlaceAddress}
            onChange={(e) => setNewPlaceAddress(e.target.value)}
          />
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
              onClick={handleAddPlace}
              disabled={!newPlaceName.trim()}
            >
              Add Place
            </Button>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}
