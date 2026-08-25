'use client';

/**
 * Espectador ao vivo: consome o canal /spectate do servidor (estado
 * onisciente por ciclo) e renderiza com a mesma arena do replay.
 */
import { useEffect, useRef, useState } from 'react';
import type { MatchState } from '@echo-front/sim';
import ArenaView, { type ViewMode } from './ArenaView';

export default function LiveViewer({ wsUrl }: { wsUrl: string }) {
  const [pair, setPair] = useState<{ prev: MatchState; cur: MatchState } | null>(null);
  const state = pair?.cur ?? null;
  const prev = pair?.prev ?? null;
  const [status, setStatus] = useState('conectando…');
  const [mode, setMode] = useState<ViewMode>('all');
  const [selected, setSelected] = useState<string | undefined>();
  const progressRef = useRef(0);
  const [progress, setProgress] = useState(0);
  const lastAtRef = useRef(0);

  useEffect(() => {
    const ws = new WebSocket(wsUrl);
    ws.onopen = () => setStatus('conectado — aguardando partida');
    ws.onclose = () => setStatus('desconectado');
    ws.onerror = () => setStatus(`sem conexão com ${wsUrl}`);
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string) as {
          type: string;
          state?: MatchState;
          message?: string;
          winner?: string;
        };
        if (msg.type === 'spectate_state' && msg.state) {
          setPair((p) => ({ prev: p?.cur ?? msg.state!, cur: msg.state! }));
          lastAtRef.current = performance.now();
          setStatus('ao vivo');
        } else if (msg.type === 'spectate_idle') {
          setStatus(msg.message ?? 'nenhuma partida em andamento');
        } else if (msg.type === 'spectate_end') {
          setStatus(`fim de partida — vencedor: ${msg.winner ?? '?'}`);
        }
      } catch {
        /* ignora frames malformados */
      }
    };
    return () => ws.close();
  }, [wsUrl]);

  // Interpolação: progresso 0→1 dentro dos ~500 ms entre estados.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      progressRef.current = Math.min(1, (performance.now() - lastAtRef.current) / 500);
      setProgress(progressRef.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '1') setMode('all');
      if (e.key === '2') setMode('cian');
      if (e.key === '3') setMode('magenta');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="mx-auto max-w-[1200px] px-4 font-mono">
      <p className="py-3 text-center text-xs tracking-widest text-slate-400">{status}</p>
      {state && prev ? (
        <>
          <div className="mb-2 flex items-center justify-center gap-6 text-sm">
            <span className="text-2xl font-bold text-cian">{state.score.cian}</span>
            <span className="text-xs text-slate-500">ciclo {state.cycle}</span>
            <span className="text-2xl font-bold text-magenta">{state.score.magenta}</span>
          </div>
          <div className="border border-slate-800 bg-black/30">
            <ArenaView
              state={state}
              prevState={prev}
              progress={progress}
              mode={mode}
              selectedUnitId={selected}
              onSelectUnit={setSelected}
            />
          </div>
          <p className="py-2 text-center text-[10px] text-slate-600">
            1 geral · 2 cian · 3 magenta — modo: {mode}
          </p>
        </>
      ) : (
        <div className="flex h-64 items-center justify-center border border-dashed border-slate-700 text-sm text-slate-600">
          para uma partida local: pnpm --filter @echo-front/server start && pnpm --filter
          @echo-front/agents-sdk match
        </div>
      )}
    </div>
  );
}
