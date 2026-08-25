import Link from 'next/link';

export default function WatchDemo() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="font-mono text-xs tracking-[0.4em] text-magenta">MODO ESPECTADOR</p>
      <h1 className="font-mono text-3xl font-bold tracking-widest">/watch/demo</h1>
      <p className="max-w-xl text-slate-400">
        A arena PixiJS chega na Sprint 4: fog of war, cones de sensores, ondas de radar e o event
        feed ao vivo. Este é o placeholder da Sprint 0.
      </p>
      <div className="flex h-64 w-full items-center justify-center border border-dashed border-slate-700 bg-black/40 font-mono text-sm text-slate-600">
        [ arena 64×36 — em construção ]
      </div>
      <Link href="/" className="font-mono text-xs tracking-widest text-cian hover:underline">
        ← VOLTAR
      </Link>
    </main>
  );
}
