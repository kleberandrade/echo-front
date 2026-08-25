import Link from 'next/link';
import LiveViewer from '../../../components/LiveViewer';

const WS_URL = process.env.NEXT_PUBLIC_ECHO_WS ?? 'ws://localhost:3001/spectate';

export default function WatchDemo() {
  return (
    <main className="min-h-screen">
      <header className="flex items-center justify-between px-6 py-3 font-mono text-xs">
        <Link href="/" className="tracking-widest text-slate-400 hover:text-slate-200">
          ECHO<span className="text-cian">//</span>FRONT
        </Link>
        <span className="tracking-[0.3em] text-magenta">AO VIVO</span>
      </header>
      <LiveViewer wsUrl={WS_URL} />
    </main>
  );
}
