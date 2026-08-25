'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Panel } from '../../components/hud';
import { fetchStandings, type StandingRow } from '../../lib/api';

export default function LeaderboardPage() {
  const [rows, setRows] = useState<StandingRow[] | null>(null);
  const [meta, setMeta] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStandings()
      .then((d) => {
        setRows(d.standings);
        if (d.generatedAt) setMeta(new Date(d.generatedAt).toLocaleString('pt-BR'));
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 font-mono">
      <header className="flex items-center justify-between py-4 text-xs">
        <Link href="/" className="tracking-widest text-slate-400 hover:text-slate-200">
          ECHO<span className="text-cian">//</span>FRONT
        </Link>
        <nav className="flex gap-4 tracking-widest text-slate-500">
          <span className="text-cian">LEADERBOARD</span>
          <Link href="/matches" className="hover:text-slate-200">PARTIDAS</Link>
          <Link href="/compete" className="hover:text-slate-200">COMPETIR</Link>
        </nav>
      </header>

      <h1 className="py-4 text-center text-2xl font-bold tracking-[0.3em]">LEADERBOARD</h1>
      {meta && <p className="pb-4 text-center text-[10px] text-slate-600">torneio amistoso · atualizado {meta}</p>}
      {error && <p className="text-center text-sm text-red-400">{error}</p>}

      {rows && (
        <Panel className="overflow-x-auto p-4">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] tracking-widest text-slate-500">
                <th className="py-2">#</th>
                <th>AGENTE</th>
                <th className="text-right">PONTOS</th>
                <th className="text-right">V</th>
                <th className="text-right">E</th>
                <th className="text-right">D</th>
                <th className="text-right">FRAGS</th>
                <th className="text-right" title="vitórias sem destruir unidades">
                  SEM ABATE
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.agent} className="border-b border-slate-900">
                  <td className="py-2 text-slate-500">{i + 1}</td>
                  <td className={i === 0 ? 'text-amber' : 'text-slate-200'}>
                    {i === 0 ? '◆ ' : ''}
                    {r.agent}
                  </td>
                  <td className="text-right text-cian">{r.points.toFixed(1)}</td>
                  <td className="text-right text-emerald-400">{r.wins}</td>
                  <td className="text-right text-slate-400">{r.draws}</td>
                  <td className="text-right text-red-400">{r.losses}</td>
                  <td className="text-right text-amber">{r.fragmentsDelivered}</td>
                  <td className="text-right text-fuchsia-300">{r.noKillWins}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
      <p className="py-4 text-center text-[10px] text-slate-600">
        pontuação: vitória 3 · empate 1 · +0,5/fragmento (máx 1,5) · +0,1/unidade viva · +0,2 eficiência —{' '}
        todo resultado tem replay re-simulável com hash verificado
      </p>
    </main>
  );
}
