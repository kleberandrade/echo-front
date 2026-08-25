/**
 * Dados de competição: usa a API do server quando NEXT_PUBLIC_ECHO_API está
 * definida; senão, os JSONs estáticos exportados pelo torneio (o site no
 * Vercel funciona sem o server no ar).
 */
export interface StandingRow {
  agent: string;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  matches: number;
  fragmentsDelivered: number;
  noKillWins: number;
}

export interface MatchRow {
  matchId: string;
  seriesId: string;
  game: number;
  seed: string;
  finalHash: string;
  agents: { cian: string; magenta: string };
  score: { cian: number; magenta: number };
  winner: 'cian' | 'magenta' | 'draw';
  reason: string;
  points: { cian: number; magenta: number };
  stats: { kills: number };
  finishedAt: string;
}

const API = process.env.NEXT_PUBLIC_ECHO_API ?? '';

export async function fetchStandings(): Promise<{ standings: StandingRow[]; generatedAt?: string }> {
  const url = API ? `${API}/api/leaderboard` : '/data/standings.json';
  const r = await fetch(url);
  if (!r.ok) throw new Error(`leaderboard indisponível (${r.status})`);
  return (await r.json()) as { standings: StandingRow[]; generatedAt?: string };
}

export async function fetchMatches(): Promise<{ matches: MatchRow[] }> {
  const url = API ? `${API}/api/matches` : '/data/matches.json';
  const r = await fetch(url);
  if (!r.ok) throw new Error(`histórico indisponível (${r.status})`);
  return (await r.json()) as { matches: MatchRow[] };
}
