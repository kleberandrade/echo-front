'use client';

/**
 * Replay com scrubbing: o sim roda no browser (estados pré-computados por
 * ciclo), timeline, velocidades, event feed clicável, card de unidade com a
 * camada de decisão da IA (campo debug — "72% de confiança…").
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_CONFIG, decideWinner } from '@echo-front/sim';
import ArenaView, { type ViewMode } from './ArenaView';
import { decisionAt, eventsUpTo, loadReplay, type LoadedReplay } from '../lib/replay';

const SPEEDS = [0.5, 1, 2, 4, 8];

function fmtClock(cyclesLeft: number): string {
  const s = Math.ceil(cyclesLeft / 2);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export default function ReplayViewer({ replayUrl }: { replayUrl: string }) {
  const [loaded, setLoaded] = useState<LoadedReplay | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0); // índice de ciclo (float no play)
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [mode, setMode] = useState<ViewMode>('all');
  const [selected, setSelected] = useState<string | undefined>();
  const cursorRef = useRef(0);

  useEffect(() => {
    fetch(replayUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`replay não encontrado (${r.status})`);
        return r.text();
      })
      .then((text) => setLoaded(loadReplay(text)))
      .catch((e: Error) => setError(e.message));
  }, [replayUrl]);

  // Loop de reprodução: 2 ciclos/s × velocidade.
  useEffect(() => {
    if (!loaded || !playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const max = loaded.states.length - 1;
      cursorRef.current = Math.min(max, cursorRef.current + dt * 2 * speed);
      setCursor(cursorRef.current);
      if (cursorRef.current >= max) setPlaying(false);
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [loaded, playing, speed]);

  // Teclas 1/2/3 trocam a visão; espaço pausa.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '1') setMode('all');
      if (e.key === '2') setMode('cian');
      if (e.key === '3') setMode('magenta');
      if (e.key === ' ') {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const idx = Math.floor(cursor);
  const state = loaded?.states[Math.min(idx + 1, (loaded?.states.length ?? 1) - 1)];
  const prevState = loaded?.states[idx];
  const progress = cursor - idx;

  const feed = useMemo(
    () => (loaded ? eventsUpTo(loaded.states, idx + 1).slice(0, 28) : []),
    [loaded, idx],
  );

  if (error) {
    return <p className="p-8 font-mono text-sm text-red-400">{error}</p>;
  }
  if (!loaded || !state || !prevState) {
    return <p className="p-8 font-mono text-sm text-slate-500">carregando replay…</p>;
  }

  const selectedUnit = selected ? state.units.find((u) => u.id === selected) : undefined;
  const decision = selected ? decisionAt(loaded.replay, idx, selected) : undefined;
  const ended = idx + 1 >= loaded.states.length - 1 && state.ended;

  const seek = (v: number) => {
    cursorRef.current = v;
    setCursor(v);
  };

  return (
    <div className="mx-auto max-w-[1400px] px-4 pb-8 font-mono">
      {/* Placar */}
      <div className="flex items-center justify-center gap-6 py-3 text-sm">
        <span className="tracking-[0.3em] text-cian">CIAN</span>
        <span className="text-3xl font-bold text-cian">{state.score.cian}</span>
        <div className="text-center">
          <div className="text-xl">{fmtClock(DEFAULT_CONFIG.totalCycles - state.cycle)}</div>
          <div className="text-[10px] text-slate-500">
            ciclo {state.cycle}/{DEFAULT_CONFIG.totalCycles}
            {loaded.verified ? ' · replay verificado ✓' : ' · HASH DIVERGENTE ✗'}
          </div>
        </div>
        <span className="text-3xl font-bold text-magenta">{state.score.magenta}</span>
        <span className="tracking-[0.3em] text-magenta">MAGENTA</span>
        {ended && (
          <span className="ml-4 border border-amber-400/50 px-2 py-1 text-xs text-amber">
            fim: {state.endReason} · vencedor {decideWinner(state)}
          </span>
        )}
      </div>

      <div className="flex gap-4">
        {/* Card da unidade */}
        <aside className="w-56 shrink-0 space-y-3 text-xs">
          <div className="border border-slate-800 bg-black/40 p-3">
            <p className="mb-2 tracking-widest text-slate-400">UNIDADE</p>
            {selectedUnit ? (
              <>
                <p className={selectedUnit.team === 'cian' ? 'text-cian' : 'text-magenta'}>
                  {selectedUnit.id}
                </p>
                <p className="mt-2 text-slate-400">
                  integrity {selectedUnit.integrity} · energy {selectedUnit.energy}
                </p>
                <p className="text-slate-400">
                  speed {(selectedUnit.speed / 1000).toFixed(1)} · heading {selectedUnit.heading}°
                </p>
                <p className="text-slate-400">
                  {selectedUnit.carryingFragment ? '◆ carregando fragmento' : 'sem fragmento'}
                  {selectedUnit.hiddenCycles > 0 ? ' · oculto' : ''}
                </p>
              </>
            ) : (
              <p className="text-slate-600">clique numa unidade</p>
            )}
          </div>
          <div className="border border-slate-800 bg-black/40 p-3">
            <p className="mb-2 tracking-widest text-slate-400">DECISÃO DA IA</p>
            {decision ? (
              <>
                <p className="text-slate-300">
                  {decision.action ?? 'mover'}
                  {decision.movement
                    ? ` → ${decision.movement.direction ?? '·'}° @${decision.movement.speed ?? '·'}`
                    : ''}
                </p>
                {decision.message_to_team && (
                  <p className="mt-1 text-slate-400">✉ {decision.message_to_team}</p>
                )}
                {decision.debug && (
                  <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all text-[10px] text-emerald-300/80">
                    {JSON.stringify(decision.debug, null, 1)}
                  </pre>
                )}
              </>
            ) : (
              <p className="text-slate-600">sem decisão neste ciclo</p>
            )}
          </div>
          <div className="border border-slate-800 bg-black/40 p-3 text-[10px] text-slate-500">
            <p>1 visão geral · 2 time cian · 3 time magenta · espaço pausa</p>
            <p className="mt-1">
              modo atual: <span className="text-slate-300">{mode}</span>
            </p>
          </div>
        </aside>

        {/* Arena */}
        <div className="min-w-0 flex-1 border border-slate-800 bg-black/30">
          <ArenaView
            state={state}
            prevState={prevState}
            progress={progress}
            mode={mode}
            selectedUnitId={selected}
            onSelectUnit={setSelected}
          />
        </div>

        {/* Event feed */}
        <aside className="w-60 shrink-0 border border-slate-800 bg-black/40 p-3 text-xs">
          <p className="mb-2 tracking-widest text-slate-400">EVENT FEED</p>
          <ul className="max-h-[480px] space-y-1 overflow-y-auto">
            {feed.map(([c, e], i) => (
              <li key={`${c}-${e}-${i}`}>
                <button
                  onClick={() => seek(c)}
                  className={`text-left hover:underline ${
                    e.includes('cian') ? 'text-cian' : e.includes('magenta') ? 'text-magenta' : e.includes('fragment') ? 'text-amber' : 'text-slate-400'
                  }`}
                >
                  <span className="text-slate-600">{String(c).padStart(3, '0')}</span> {e}
                </button>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      {/* Timeline */}
      <div className="mt-3 flex items-center gap-3 text-xs">
        <button
          onClick={() => setPlaying((p) => !p)}
          className="border border-slate-700 px-3 py-1 text-slate-200 hover:border-slate-500"
        >
          {playing ? '❚❚' : '▶'}
        </button>
        {SPEEDS.map((s) => (
          <button
            key={s}
            onClick={() => setSpeed(s)}
            className={`px-2 py-1 ${speed === s ? 'text-cian underline' : 'text-slate-500 hover:text-slate-300'}`}
          >
            {s}×
          </button>
        ))}
        <input
          type="range"
          min={0}
          max={loaded.states.length - 1}
          step={0.01}
          value={cursor}
          onChange={(e) => seek(Number(e.target.value))}
          className="flex-1 accent-cyan-400"
        />
        <span className="w-20 text-right text-slate-500">ciclo {idx}</span>
      </div>
    </div>
  );
}
