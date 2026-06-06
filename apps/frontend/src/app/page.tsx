import { ActivityStream } from '../components/dashboard/ActivityStream';
import { DealPanel } from '../components/dashboard/DealPanel';
import { Filters } from '../components/dashboard/Filters';

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden px-4 py-5 sm:px-6 lg:px-8">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-[-10%] top-[-20%] h-96 w-96 rounded-full bg-cyan-300/40 blur-3xl" />
        <div className="absolute bottom-[-20%] right-[-10%] h-[30rem] w-[30rem] rounded-full bg-amber-200/50 blur-3xl" />
      </div>

      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <Filters />
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.85fr)] lg:items-start">
          <ActivityStream />
          <DealPanel />
        </div>
      </div>
    </main>
  );
}
