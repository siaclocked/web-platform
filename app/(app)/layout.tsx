import { Header, BottomNav } from '@/components/layout';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>{children}</main>
      <BottomNav />
    </div>
  );
}
