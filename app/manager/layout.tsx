import { Header } from '@/components/layout';

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pb-20">{children}</main>
    </div>
  );
}
