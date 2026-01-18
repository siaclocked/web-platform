import { Header } from '@/components/layout';

export default function WorkerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pb-20">{children}</main>
    </div>
  );
}
