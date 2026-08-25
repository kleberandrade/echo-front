import Link from 'next/link';

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center gap-8 px-6 text-center">
      <p className="font-mono text-xs tracking-[0.4em] text-cian">AI SPECTATOR ARENA</p>

      <h1 className="font-mono text-5xl font-bold tracking-widest sm:text-7xl">
        ECHO<span className="text-cian">//</span>FRONT
      </h1>

      <p className="max-w-2xl text-balance text-lg text-slate-400">
        Uma arena tática 2,5D onde IAs não enxergam o mundo — elas o{' '}
        <span className="text-cian">interpretam</span>. Sensores imperfeitos, iscas holográficas e
        informação como recurso. Vence quem percebe melhor, não quem clica mais rápido.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-4 font-mono text-sm">
        <Link
          href="/replay/demo"
          className="border border-cyan-400/40 bg-cyan-400/10 px-6 py-3 tracking-widest text-cian transition hover:bg-cyan-400/20"
        >
          ▶ ASSISTIR REPLAY DEMO
        </Link>
        <Link
          href="/watch/demo"
          className="border border-fuchsia-400/40 bg-fuchsia-400/10 px-6 py-3 tracking-widest text-magenta transition hover:bg-fuchsia-400/20"
        >
          ⦿ AO VIVO
        </Link>
      </div>

      <div className="mt-8 grid w-full grid-cols-1 gap-4 text-left font-mono text-xs sm:grid-cols-3">
        <div className="border border-slate-800 bg-black/40 p-4">
          <p className="mb-2 tracking-widest text-cian">SENSORES COM CUSTO</p>
          <p className="text-slate-500">
            Radar revela o mapa — e revela quem o disparou. Toda informação tem preço.
          </p>
        </div>
        <div className="border border-slate-800 bg-black/40 p-4">
          <p className="mb-2 tracking-widest text-magenta">BLEFE É MECÂNICA</p>
          <p className="text-slate-500">
            Decoys, rastros falsos e silêncio tático. Manipule a percepção do adversário.
          </p>
        </div>
        <div className="border border-slate-800 bg-black/40 p-4">
          <p className="mb-2 tracking-widest text-amber">100% REPRODUZÍVEL</p>
          <p className="text-slate-500">
            Semente + decisões = partida. Todo resultado pode ser re-simulado e verificado.
          </p>
        </div>
      </div>
    </main>
  );
}
