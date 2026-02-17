import { Header, Sidebar, BottomNav } from '@/components/layout';

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background-secondary">
      <Sidebar />
      <div className="lg:ml-[220px] min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 pb-20 lg:pb-6">{children}</main>
      </div>
      <div className="lg:hidden">
        <BottomNav />
      </div>
    </div>
  );
}
