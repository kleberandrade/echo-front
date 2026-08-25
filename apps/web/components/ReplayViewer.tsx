'use client';

/**
 * Replay com scrubbing e HUD no estilo do concept art: placar com pips no
 * topo, event feed à direita, card da unidade e action bar sobrepostos à
 * arena, minimapa no canto e balão de crença da IA sobre a unidade
 * selecionada ("72% de confiança…").
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_CONFIG, decideWinner } from '@echo-front/sim';
import ArenaView, { projPoint, type ViewMode } from './ArenaView';
import Minimap from './Minimap';
import {
  ActionBar,
  Panel,
  ScorePips,
  UnitCard,
  eventColor,
  eventIcon,
  fmtClock,
  fmtEvent,
} from './hud';
import { decisionAt, eventsUpTo, loadReplay, type LoadedReplay } from '../lib/replay';

const SPEEDS = [0.5, 1, 2, 4, 8];

export default function ReplayViewer({ replayUrl }: { replayUrl: string }) {
  const [loaded, setLoaded] = useState<LoadedReplay | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
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
    () => (loaded ? eventsUpTo(loaded.states, idx + 1).slice(0, 26) : []),
    [loaded, idx],
  );

  if (error) return <p className="p-8 font-mono text-sm text-red-400">{error}</p>;
  if (!loaded || !state || !prevState)
    return <p className="p-8 font-mono text-sm text-slate-500">carregando replay…</p>;

  const selectedUnit = selected ? state.units.find((u) => u.id === selected) : undefined;
  const decision = selected ? decisionAt(loaded.replay, idx, selected) : undefined;
  const ended = idx + 1 >= loaded.states.length - 1 && state.ended;

  const seek = (v: number) => {
    cursorRef.current = v;
    setCursor(v);
  };

  // Balão de crença sobre a unidade selecionada.
  let belief: { x: number; y: number; text: string } | undefined;
  if (selectedUnit && decision?.debug) {
    const dbg = decision.debug as Record<string, unknown>;
    const conf = Object.entries(dbg).find(([k, v]) => typeof v === 'number' && /conf/i.test(k));
    const mode_ = dbg.mode !== undefined ? String(dbg.mode) : (decision.action ?? '');
    const text = conf
      ? `${Math.round((conf[1] as number) * 100)}% · ${mode_.replaceAll('_', ' ')}`
      : mode_.replaceAll('_', ' ');
    if (text) {
      const [sx, sy] = projPoint(selectedUnit.x / 1000, selectedUnit.y / 1000);
      belief = { x: sx, y: sy - 46, text };
    }
  }

  return (
    <div className="mx-auto max-w-[1420px] px-4 pb-6 font-mono">
      {/* Placar */}
      <div className="flex items-center justify-center gap-5 py-3 text-sm">
        <span className="tracking-[0.35em] text-cian">CIAN</span>
        <ScorePips score={state.score.cian} color="#22d3ee" />
        <Panel className="px-4 py-1 text-center">
          <span className="text-2xl font-bold text-cian">{state.score.cian}</span>
          <span className="mx-3 text-xl text-slate-200">
            {fmtClock(DEFAULT_CONFIG.totalCycles - state.cycle)}
          </span>
          <span className="text-2xl font-bold text-magenta">{state.score.magenta}</span>
          <p className="text-[9px] tracking-widest text-slate-500">
            CICLO {state.cycle}/{DEFAULT_CONFIG.totalCycles}
            {loaded.verified ? ' · REPLAY VERIFICADO ✓' : ' · HASH DIVERGENTE ✗'}
          </p>
        </Panel>
        <ScorePips score={state.score.magenta} color="#e64ce6" flip />
        <span className="tracking-[0.35em] text-magenta">MAGENTA</span>
        {ended && (
          <span className="border border-amber-400/50 px-2 py-1 text-[10px] text-amber">
            {fmtEvent(state.endReason ?? '')} · VENCEDOR {decideWinner(state).toUpperCase()}
          </span>
        )}
      </div>

      <div className="flex gap-3">
        {/* Arena com overlays */}
        <div className="relative min-w-0 flex-1 border border-slate-800/70 bg-black/30">
          <ArenaView
            state={state}
            prevState={prevState}
            progress={progress}
            mode={mode}
            selectedUnitId={selected}
            onSelectUnit={setSelected}
          />
          <p className="pointer-events-none absolute left-3 top-2 text-[10px] tracking-[0.35em] text-slate-500">
            ECHO<span className="text-cian">//</span>FRONT · AI SPECTATOR MODE
          </p>

          {belief && (
            <div
              className="pointer-events-none absolute -translate-x-1/2 border border-emerald-400/40 bg-black/80 px-2 py-[2px] text-[10px] text-emerald-300"
              style={{ left: belief.x, top: belief.y }}
            >
              {belief.text}
            </div>
          )}

          {selectedUnit && (
            <div className="absolute bottom-3 left-3">
              <UnitCard unit={selectedUnit} decision={decision} />
            </div>
          )}

          <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
            <ActionBar unit={selectedUnit} decision={decision} />
          </div>

          <div className="absolute bottom-3 right-3 flex flex-col items-end gap-1">
            <Panel className="p-1">
              <Minimap state={state} />
            </Panel>
            <div className="flex items-center gap-2 text-[9px] tracking-widest text-slate-500">
              <span>⬡ FOG OF WAR</span>
              {(['all', 'cian', 'magenta'] as const).map((m, i) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`border px-1 ${mode === m ? 'border-cyan-400/60 text-cian' : 'border-slate-800 text-slate-600'}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Event feed */}
        <Panel className="w-64 shrink-0 p-3 text-[11px]">
          <p className="mb-2 tracking-[0.3em] text-slate-400">EVENT FEED</p>
          <ul className="max-h-[500px] space-y-[6px] overflow-y-auto">
            {feed.map(([c, e], i) => (
              <li key={`${c}-${e}-${i}`}>
                <button
                  onClick={() => seek(c)}
                  className="flex items-start gap-2 text-left hover:brightness-150"
                >
                  <span className="mt-[1px] text-sm" style={{ color: eventColor(e) }}>
                    {eventIcon(e)}
                  </span>
                  <span>
                    <span className="mr-1 text-slate-600">
                      {fmtClock(DEFAULT_CONFIG.totalCycles - c)}
                    </span>
                    <span style={{ color: eventColor(e) }}>{fmtEvent(e).toUpperCase()}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Panel>
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
