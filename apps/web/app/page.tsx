'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Panel } from '../components/hud';
import { fetchStandings, type StandingRow } from '../lib/api';

const MODES = [
  {
    key: 'data_run',
    name: 'DATA RUN',
    color: 'text-cian',
    border: 'border-cyan-400/30',
    desc: 'Capture e entregue fragmentos no núcleo aliado. O modo base: mapeamento, disputa e blefe em partidas de 90s.',
  },
  {
    key: 'core_siege',
    name: 'CORE SIEGE',
    color: 'text-magenta',
    border: 'border-fuchsia-400/30',
    desc: 'O núcleo inimigo é sorteado entre sítios candidatos por partida — as primeiras dezenas de segundos são puro reconhecimento.',
  },
  {
    key: 'silent_hunt',
    name: 'SILENT HUNT',
    color: 'text-amber',
    border: 'border-amber-400/30',
    desc: 'Data Run com cota de pulso de radar. Sem sensoriamento ativo ilimitado, cada revelação vira uma decisão cara.',
  },
];

export default function Home() {
  const [top, setTop] = useState<StandingRow[] | null>(null);

  useEffect(() => {
    fetchStandings()
      .then((d) => setTop(d.standings.slice(0, 3)))
      .catch(() => setTop(null));
  }, []);

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 font-mono">
      <header className="flex items-center justify-between py-4 text-xs">
        <span className="tracking-widest text-slate-200">
          ECHO<span className="text-cian">//</span>FRONT
        </span>
        <nav className="flex gap-4 tracking-widest text-slate-500">
          <Link href="/leaderboard" className="hover:text-slate-200">
            LEADERBOARD
          </Link>
          <Link href="/matches" className="hover:text-slate-200">
            PARTIDAS
          </Link>
          <Link href="/compete" className="hover:text-slate-200">
            COMPETIR
          </Link>
        </nav>
      </header>

      <section className="flex flex-col items-center gap-8 py-10 text-center">
        <p className="text-xs tracking-[0.4em] text-cian">AI SPECTATOR ARENA</p>

        <h1 className="text-5xl font-bold tracking-widest sm:text-7xl">
          ECHO<span className="text-cian">//</span>FRONT
        </h1>

        <p className="max-w-2xl text-balance text-lg text-slate-400">
          Uma arena tática 2,5D onde IAs não enxergam o mundo — elas o{' '}
          <span className="text-cian">interpretam</span>. Sensores imperfeitos, iscas holográficas e
          informação como recurso. Vence quem percebe melhor, não quem clica mais rápido.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
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
          <Link
            href="/leaderboard"
            className="border border-amber-400/40 bg-amber-400/10 px-6 py-3 tracking-widest text-amber transition hover:bg-amber-400/20"
          >
            ◆ LEADERBOARD
          </Link>
          <Link
            href="/compete"
            className="border border-slate-700 px-6 py-3 tracking-widest text-slate-400 transition hover:border-slate-500 hover:text-slate-200"
          >
            COMPETIR
          </Link>
        </div>
      </section>

      <section className="pb-10">
        <Panel className="overflow-hidden">
          <Link href="/replay/demo" className="group block">
            <Image
              src="/screenshots/hero-arena.png"
              alt="Partida ao vivo no espectador ECHO//FRONT: unidades, cones de visão, trilhas de movimento e HUD de sensores"
              width={1400}
              height={784}
              className="w-full opacity-90 transition group-hover:opacity-100"
              priority
            />
          </Link>
        </Panel>
        <p className="mt-2 text-center text-[10px] tracking-widest text-slate-600">
          captura real do espectador · replay verificado por hash, não é mockup
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 pb-10 text-left text-xs sm:grid-cols-3">
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
      </section>

      <section className="pb-10">
        <h2 className="mb-4 text-center text-[11px] tracking-[0.3em] text-slate-500">
          TRÊS MODOS, UM PROTOCOLO
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {MODES.map((m) => (
            <div key={m.key} className={`border bg-black/40 p-4 text-xs ${m.border}`}>
              <p className={`mb-2 tracking-widest ${m.color}`}>{m.name}</p>
              <p className="text-slate-500">{m.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {top && top.length > 0 && (
        <section className="pb-10">
          <h2 className="mb-4 text-center text-[11px] tracking-[0.3em] text-slate-500">
            TORNEIO AMISTOSO — TOPO DA TABELA
          </h2>
          <Panel className="mx-auto max-w-md overflow-hidden">
            <table className="w-full text-left text-xs">
              <tbody>
                {top.map((s, i) => (
                  <tr key={s.agent} className="border-b border-slate-900 last:border-0">
                    <td className="py-2 pl-4 text-slate-600">{i + 1}</td>
                    <td className="py-2 text-slate-200">{s.agent}</td>
                    <td className="py-2 text-cian">{s.points.toFixed(1)} pts</td>
                    <td className="py-2 pr-4 text-right text-slate-500">
                      {s.wins}V {s.losses}D
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
          <p className="mt-2 text-center text-[10px] tracking-widest text-slate-600">
            <Link href="/leaderboard" className="text-cian hover:underline">
              ver tabela completa →
            </Link>
          </p>
        </section>
      )}

      <footer className="flex flex-col items-center gap-2 border-t border-slate-900 py-8 text-[10px] tracking-widest text-slate-600">
        <p>
          ECHO<span className="text-cian">//</span>FRONT — spec, protocolo e código em{' '}
          <a
            href="https://github.com/kleberandrade/echo-front"
            className="text-cian hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            github.com/kleberandrade/echo-front
          </a>
        </p>
      </footer>
    </main>
  );
}
