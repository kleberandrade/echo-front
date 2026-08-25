'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Panel } from '../../components/hud';
import { fetchMatches, type MatchRow } from '../../lib/api';

export default function MatchesPage() {
  const [rows, setRows] = useState<MatchRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMatches()
      .then((d) => setRows([...d.matches].reverse()))
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 font-mono">
      <header className="flex items-center justify-between py-4 text-xs">
        <Link href="/" className="tracking-widest text-slate-400 hover:text-slate-200">
          ECHO<span className="text-cian">//</span>FRONT
        </Link>
        <nav className="flex gap-4 tracking-widest text-slate-500">
          <Link href="/leaderboard" className="hover:text-slate-200">LEADERBOARD</Link>
          <span className="text-cian">PARTIDAS</span>
          <Link href="/compete" className="hover:text-slate-200">COMPETIR</Link>
        </nav>
      </header>

      <h1 className="py-4 text-center text-2xl font-bold tracking-[0.3em]">PARTIDAS</h1>
      {error && <p className="text-center text-sm text-red-400">{error}</p>}

      {rows && (
        <Panel className="overflow-x-auto p-4">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] tracking-widest text-slate-500">
                <th className="py-2">PARTIDA</th>
                <th>MODO</th>
                <th>CIAN</th>
                <th className="text-center">PLACAR</th>
                <th>MAGENTA</th>
                <th>FIM</th>
                <th className="text-right">REPLAY</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.matchId} className="border-b border-slate-900">
                  <td className="py-2 text-slate-500">
                    {m.matchId}
                    <span className="ml-1 text-slate-700">g{m.game}</span>
                  </td>
                  <td className="text-[10px] tracking-wider text-slate-400">
                    {(m.mode ?? 'data_run').replaceAll('_', ' ')}
                  </td>
                  <td className={m.winner === 'cian' ? 'font-bold text-cian' : 'text-cian/60'}>
                    {m.agents.cian}
                  </td>
                  <td className="text-center text-slate-200">
                    {m.score.cian} × {m.score.magenta}
                  </td>
                  <td className={m.winner === 'magenta' ? 'font-bold text-magenta' : 'text-magenta/60'}>
                    {m.agents.magenta}
                  </td>
                  <td className="text-slate-500">{m.reason.replaceAll('_', ' ')}</td>
                  <td className="text-right">
                    <Link href={`/replay/${m.matchId}`} className="text-cian hover:underline">
                      ▶ assistir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
      <p className="py-4 text-center text-[10px] text-slate-600">
        {rows ? `${rows.length} partidas · ` : ''}cada replay re-simula no seu navegador e valida o finalHash
      </p>
    </main>
  );
}
