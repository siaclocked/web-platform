import Link from "next/link";
import { Clock, Calendar, Users, FileText, Shield, Zap } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-background" />
        <div className="relative max-w-6xl mx-auto px-4 py-16 sm:py-24">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-primary rounded-2xl mb-6">
              <Clock className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">
              Clocked
            </h1>
            <p className="text-xl text-foreground-muted max-w-2xl mx-auto mb-8">
              The modern worker scheduling platform. Generate smart schedules,
              track time accurately, and manage your team effortlessly.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/login"
                className="inline-flex items-center justify-center px-8 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary-hover transition-colors"
              >
                Get Started
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center px-8 py-3 border border-border text-foreground font-medium rounded-lg hover:bg-background-tertiary transition-colors"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-foreground text-center mb-12">
          Everything you need to manage your workforce
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <FeatureCard
            icon={<Calendar className="w-6 h-6" />}
            title="Smart Scheduling"
            description="AI-powered schedule generation with constraint optimization. Automatically create fair, efficient schedules."
          />
          <FeatureCard
            icon={<Clock className="w-6 h-6" />}
            title="Time Tracking"
            description="Accurate clock-in/out with GPS verification. Track worked hours and manage timesheets easily."
          />
          <FeatureCard
            icon={<Users className="w-6 h-6" />}
            title="Team Management"
            description="Manage workers, skills, and multiple locations. Assign shifts based on availability and qualifications."
          />
          <FeatureCard
            icon={<FileText className="w-6 h-6" />}
            title="Document Center"
            description="Centralize employee documents with secure storage. Share contracts, certificates, and more."
          />
          <FeatureCard
            icon={<Shield className="w-6 h-6" />}
            title="Role-Based Access"
            description="Secure access control for admins, managers, and workers. Everyone sees what they need."
          />
          <FeatureCard
            icon={<Zap className="w-6 h-6" />}
            title="Real-time Updates"
            description="Instant notifications for schedule changes, shift reminders, and important updates."
          />
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-background-secondary border-t border-border">
        <div className="max-w-6xl mx-auto px-4 py-16 text-center">
          <h2 className="text-2xl font-bold text-foreground mb-4">
            Ready to streamline your scheduling?
          </h2>
          <p className="text-foreground-muted mb-8">
            Join thousands of businesses using Clocked to manage their workforce.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center px-8 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary-hover transition-colors"
          >
            Start Free Trial
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-foreground-muted">
          <p>&copy; {new Date().getFullYear()} Clocked. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="p-6 bg-background-secondary border border-border rounded-xl">
      <div className="w-12 h-12 bg-primary-muted rounded-lg flex items-center justify-center text-primary mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-foreground-muted">{description}</p>
    </div>
  );
}
