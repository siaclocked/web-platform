'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageContainer } from '@/components/layout';
import { Card, CardContent, Button, Input, Select, Badge } from '@/components/ui';
import {
  Calendar,
  Wand2,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { format, addDays } from 'date-fns';

type SolverStatus = 'idle' | 'solving' | 'optimal' | 'feasible' | 'infeasible';

const placeOptions = [
  { value: '1', label: 'Downtown Restaurant' },
  { value: '2', label: 'Mall Location' },
  { value: '3', label: 'Airport Branch' },
];

export default function CreateSchedulePage() {
  const router = useRouter();
  const [selectedPlace, setSelectedPlace] = useState('');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(
    format(addDays(new Date(), 6), 'yyyy-MM-dd')
  );
  const [solverStatus, setSolverStatus] = useState<SolverStatus>('idle');
  const [diagnostics, setDiagnostics] = useState<string[]>([]);

  const handleGenerate = async () => {
    if (!selectedPlace) return;

    setSolverStatus('solving');
    setDiagnostics([]);

    // Simulate solver API call
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Mock response
    const mockStatus: SolverStatus = 'optimal';
    setSolverStatus(mockStatus);

    if (mockStatus === 'optimal') {
      setDiagnostics([
        'Schedule generated successfully',
        '15 shifts created',
        '100% coverage achieved',
      ]);
    } else if (mockStatus === 'feasible') {
      setDiagnostics([
        'Schedule generated with some gaps',
        '12 shifts created',
        '2 coverage gaps on Tuesday evening',
      ]);
    } else {
      setDiagnostics([
        'Could not generate a valid schedule',
        'Not enough team members available',
        'Consider adjusting constraints or adding more team members',
      ]);
    }
  };

  const getStatusColor = () => {
    switch (solverStatus) {
      case 'optimal':
        return 'text-success';
      case 'feasible':
        return 'text-warning';
      case 'infeasible':
        return 'text-danger';
      default:
        return 'text-foreground-muted';
    }
  };

  const getStatusIcon = () => {
    switch (solverStatus) {
      case 'solving':
        return <Loader2 className="w-5 h-5 animate-spin" />;
      case 'optimal':
        return <CheckCircle className="w-5 h-5" />;
      case 'feasible':
        return <AlertCircle className="w-5 h-5" />;
      case 'infeasible':
        return <AlertCircle className="w-5 h-5" />;
      default:
        return null;
    }
  };

  return (
    <PageContainer>
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-background-tertiary rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-foreground-muted" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Create Schedule</h1>
          <p className="text-foreground-muted">
            Generate an optimized schedule using AI
          </p>
        </div>
      </div>

      {/* Configuration */}
      <Card className="mb-4">
        <CardContent>
          <h3 className="font-semibold text-foreground mb-4">Configuration</h3>

          <div className="space-y-4">
            <Select
              label="Place"
              options={placeOptions}
              value={selectedPlace}
              onChange={(e) => setSelectedPlace(e.target.value)}
              placeholder="Select a location..."
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Start Date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <Input
                label="End Date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Solver Options */}
      <Card className="mb-4">
        <CardContent>
          <h3 className="font-semibold text-foreground mb-4">
            Optimization Settings
          </h3>

          <div className="space-y-3">
            <label className="flex items-center gap-3 p-3 bg-background-tertiary rounded-lg cursor-pointer">
              <input
                type="checkbox"
                defaultChecked
                className="w-5 h-5 rounded accent-primary"
              />
              <div>
                <p className="font-medium text-foreground">Minimize changes</p>
                <p className="text-xs text-foreground-muted">
                  Keep existing assignments when possible
                </p>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 bg-background-tertiary rounded-lg cursor-pointer">
              <input
                type="checkbox"
                defaultChecked
                className="w-5 h-5 rounded accent-primary"
              />
              <div>
                <p className="font-medium text-foreground">
                  Respect availability
                </p>
                <p className="text-xs text-foreground-muted">
                  Only schedule team members when they&apos;re available
                </p>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 bg-background-tertiary rounded-lg cursor-pointer">
              <input
                type="checkbox"
                defaultChecked
                className="w-5 h-5 rounded accent-primary"
              />
              <div>
                <p className="font-medium text-foreground">Balance hours</p>
                <p className="text-xs text-foreground-muted">
                  Distribute work hours fairly among team members
                </p>
              </div>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Generate Button */}
      <Button
        onClick={handleGenerate}
        disabled={!selectedPlace || solverStatus === 'solving'}
        isLoading={solverStatus === 'solving'}
        className="w-full mb-4"
        size="lg"
      >
        <Wand2 className="w-5 h-5 mr-2" />
        {solverStatus === 'solving' ? 'Generating...' : 'Generate Schedule'}
      </Button>

      {/* Results */}
      {solverStatus !== 'idle' && solverStatus !== 'solving' && (
        <Card>
          <CardContent>
            <div className={`flex items-center gap-2 mb-4 ${getStatusColor()}`}>
              {getStatusIcon()}
              <span className="font-semibold capitalize">{solverStatus}</span>
            </div>

            <div className="space-y-2">
              {diagnostics.map((msg, index) => (
                <p
                  key={index}
                  className={`text-sm ${
                    index === 0 ? 'text-foreground' : 'text-foreground-muted'
                  }`}
                >
                  {msg}
                </p>
              ))}
            </div>

            {(solverStatus === 'optimal' || solverStatus === 'feasible') && (
              <div className="flex gap-3 mt-6">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => router.push('/schedules')}
                >
                  View Schedule
                </Button>
                <Button className="flex-1">Publish Now</Button>
              </div>
            )}

            {solverStatus === 'infeasible' && (
              <Button variant="secondary" className="w-full mt-6">
                Adjust Settings
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </PageContainer>
  );
}
