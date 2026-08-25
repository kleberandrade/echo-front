import Link from 'next/link';
import ReplayViewer from '../../../components/ReplayViewer';

export default async function ReplayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="min-h-screen">
      <header className="flex items-center justify-between px-6 py-3 font-mono text-xs">
        <Link href="/" className="tracking-widest text-slate-400 hover:text-slate-200">
          ECHO<span className="text-cian">//</span>FRONT
        </Link>
        <span className="tracking-[0.3em] text-slate-500">REPLAY · {id}</span>
      </header>
      <ReplayViewer replayUrl={`/replays/${id}.replay.jsonl`} />
    </main>
  );
}
