import Link from 'next/link';
import LiveViewer from '../../../components/LiveViewer';
import { watchTarget } from '../../../lib/watch-url';

const WS_URL = process.env.NEXT_PUBLIC_ECHO_WS ?? 'ws://localhost:3001/spectate';

export default async function WatchDemo({
  searchParams,
}: {
  searchParams: Promise<{ agent?: string | string[] }>;
}) {
  const target = watchTarget(WS_URL, (await searchParams).agent);
  return (
    <main className="min-h-screen">
      <header className="flex items-center justify-between px-6 py-3 font-mono text-xs">
        <Link href="/" className="tracking-widest text-slate-400 hover:text-slate-200">
          ECHO<span className="text-cian">//</span>FRONT
        </Link>
        <span className="tracking-[0.3em] text-magenta">
          AO VIVO{target.agent ? ` · ${target.agent}` : ''}
        </span>
      </header>
      <LiveViewer wsUrl={target.url} />
    </main>
  );
}
