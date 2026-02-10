'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, CardContent } from '@/components/ui';
import { Building2, Users, User, ArrowRight, Clock } from 'lucide-react';

type UserRole = 'company' | 'manager' | 'worker';

interface RoleOption {
  id: UserRole;
  title: string;
  description: string;
  icon: React.ReactNode;
  features: string[];
}

export default function SelectRolePage() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const roleOptions: RoleOption[] = [
    {
      id: 'company',
      title: 'Company',
      description: 'Manage your entire organization and oversee all operations',
      icon: <Building2 className="w-8 h-8" />,
      features: [
        'Email & password authentication',
        'Add and remove Managers',
        'View all schedules',
        'Intervene in schedules when needed',
        'Full company oversight'
      ]
    },
    {
      id: 'manager',
      title: 'Manager',
      description: 'Create schedules and manage workers at your locations',
      icon: <Users className="w-8 h-8" />,
      features: [
        'Email OTP authentication',
        'Create and manage schedules',
        'Add events and assign workers',
        'Create open shifts for filling',
        'Manage worker accounts'
      ]
    },
    {
      id: 'worker',
      title: 'Worker',
      description: 'View your schedule and manage your work assignments',
      icon: <User className="w-8 h-8" />,
      features: [
        'Email OTP authentication',
        'View assigned schedules',
        'Fill open shifts',
        'Request schedule changes',
        'View pay stubs',
        'Receive notifications'
      ]
    }
  ];

  const handleRoleSelect = async (role: UserRole) => {
    setSelectedRole(role);
    setIsLoading(true);

    // Redirect to appropriate login/signup page based on role
    setTimeout(() => {
      switch (role) {
        case 'company':
          router.push('/signup/company');
          break;
        case 'manager':
          router.push('/login/manager');
          break;
        case 'worker':
          router.push('/login/worker');
          break;
      }
    }, 300);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Clocked</h1>
            </div>
            <Button
              variant="ghost"
              onClick={() => router.back()}
              className="text-foreground-muted hover:text-foreground"
            >
              Back
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-4">
            Choose Your Role
          </h2>
          <p className="text-lg text-foreground-muted max-w-2xl mx-auto">
            Select the role that best describes your position in the organization.
            Each role has specific features and permissions tailored to your needs.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {roleOptions.map((role) => (
            <Card
              key={role.id}
              className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
                selectedRole === role.id
                  ? 'ring-2 ring-primary bg-primary-muted/10'
                  : 'hover:bg-background-secondary'
              }`}
              onClick={() => !isLoading && handleRoleSelect(role.id)}
            >
              <CardContent className="p-6">
                <div className="text-center mb-6">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
                    selectedRole === role.id
                      ? 'bg-primary text-white'
                      : 'bg-background-tertiary text-primary'
                  }`}>
                    {role.icon}
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    {role.title}
                  </h3>
                  <p className="text-sm text-foreground-muted">
                    {role.description}
                  </p>
                </div>

                <div className="space-y-2 mb-6">
                  {role.features.map((feature, index) => (
                    <div key={index} className="flex items-start space-x-2">
                      <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0" />
                      <p className="text-sm text-foreground-muted">{feature}</p>
                    </div>
                  ))}
                </div>

                <Button
                  className="w-full"
                  disabled={isLoading}
                  isLoading={selectedRole === role.id && isLoading}
                >
                  {selectedRole === role.id && isLoading ? (
                    'Redirecting...'
                  ) : (
                    <>
                      Select {role.title}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm text-foreground-muted">
            Not sure which role to choose?{' '}
            <button className="text-primary hover:text-primary-hover underline">
              Contact your administrator
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
