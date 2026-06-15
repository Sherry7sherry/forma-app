import BottomNav from '@/components/nav/BottomNav'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-cream max-w-lg mx-auto relative">
      <main className="pb-24">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
