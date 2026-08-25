'use client';

/**
 * Painéis do HUD no estilo do concept: cantos chanfrados, barras segmentadas,
 * card de unidade, action bar com cooldowns e event feed com ícones.
 */
import type { DecisionPayload } from '@echo-front/protocol';
import { DEFAULT_CONFIG, type MatchState, type Unit } from '@echo-front/sim';

const CFG = DEFAULT_CONFIG;
const CUT = {
  clipPath:
    'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))',
};

export function Panel({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`border border-slate-700/60 bg-[#060a12]/90 backdrop-blur-sm ${className}`}
      style={CUT}
    >
      {children}
    </div>
  );
}

export function SegBar({ value, max, color }: { value: number; max: number; color: string }) {
  const segs = 5;
  const filled = Math.round((segs * value) / max);
  return (
    <span className="flex items-center gap-[3px]">
      {Array.from({ length: segs }, (_, i) => (
        <span
          key={i}
          className="h-[7px] w-[16px]"
          style={{
            background: i < filled ? color : '#1b2635',
            boxShadow: i < filled ? `0 0 6px ${color}66` : 'none',
          }}
        />
      ))}
      <span className="ml-2 text-[10px] text-slate-400">
        {Math.round(value)}/{max}
      </span>
    </span>
  );
}

export function UnitCard({ unit, decision }: { unit: Unit; decision?: DecisionPayload }) {
  const stats = CFG.classes[unit.class];
  const teamColor = unit.team === 'cian' ? '#22d3ee' : '#e64ce6';
  const speedLabel =
    unit.speed === 0
      ? 'PARADO'
      : unit.speed > 700
        ? 'MUITO ALTA'
        : unit.speed > 400
          ? 'ALTA'
          : 'BAIXA';
  return (
    <Panel className="w-64 p-4 text-[11px]">
      <p className="mb-3 text-sm font-bold tracking-[0.25em]" style={{ color: teamColor }}>
        {unit.team.toUpperCase()} {unit.class.toUpperCase()}
      </p>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="tracking-widest text-slate-500">INTEGRITY</span>
          <SegBar value={unit.integrity} max={stats.maxIntegrity} color={teamColor} />
        </div>
        <div className="flex items-center justify-between">
          <span className="tracking-widest text-slate-500">ENERGY</span>
          <SegBar value={unit.energy} max={stats.maxEnergy} color={teamColor} />
        </div>
        <div className="flex items-center justify-between">
          <span className="tracking-widest text-slate-500">SIGNATURE</span>
          <span style={{ color: teamColor }}>
            {unit.hiddenCycles > 0
              ? 'NONE'
              : unit.speed > 700
                ? 'HIGH'
                : unit.speed > 0
                  ? 'MEDIUM'
                  : 'LOW'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="tracking-widest text-slate-500">SPEED</span>
          <span style={{ color: teamColor }}>{speedLabel}</span>
        </div>
        <div className="mt-2 border-t border-slate-800 pt-2">
          <p className="mb-1 tracking-widest text-slate-500">SENSORS</p>
          <div className="flex gap-3 text-[10px]">
            <span className="text-slate-300">◉ RADAR</span>
            <span className="text-slate-300">≋ THERMAL</span>
            <span className="text-slate-300">◎ SONAR</span>
          </div>
        </div>
        {decision?.debug !== undefined && (
          <div className="mt-2 border-t border-slate-800 pt-2">
            <p className="mb-1 tracking-widest text-slate-500">DECISÃO DA IA</p>
            <p className="text-emerald-300/90">
              {String(
                (decision.debug as Record<string, unknown>).mode ?? decision.action ?? 'mover',
              )}
            </p>
            {Object.entries(decision.debug as Record<string, unknown>)
              .filter(([k, v]) => k !== 'mode' && (typeof v === 'number' || typeof v === 'string'))
              .slice(0, 3)
              .map(([k, v]) => (
                <p key={k} className="text-slate-400">
                  {k}:{' '}
                  <span className="text-slate-200">
                    {typeof v === 'number' ? v.toFixed(2) : String(v)}
                  </span>
                </p>
              ))}
            {decision.message_to_team && (
              <p className="text-slate-400">✉ {decision.message_to_team}</p>
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}

const ACTIONS = [
  { key: 'pulse_scan', label: 'PULSE SCAN', icon: '◉' },
  { key: 'speed_boost', label: 'SPEED BOOST', icon: '≫' },
  { key: 'deploy_decoy', label: 'DECOY ECHO', icon: '△' },
  { key: 'hide', label: 'HIDE', icon: '⬡' },
] as const;

export function ActionBar({ unit, decision }: { unit?: Unit; decision?: DecisionPayload }) {
  return (
    <div className="flex items-end gap-3">
      {ACTIONS.map((a, i) => {
        const cd = unit?.cooldowns[a.key] ?? 0;
        const active = decision?.action === a.key;
        return (
          <div key={a.key} className="flex flex-col items-center gap-1">
            <div
              className={`flex h-16 w-16 flex-col items-center justify-center border text-center ${
                active
                  ? 'border-cyan-300 bg-cyan-400/15'
                  : cd > 0
                    ? 'border-slate-800 bg-black/60 opacity-50'
                    : 'border-slate-700 bg-black/60'
              }`}
              style={CUT}
            >
              <span className={`text-xl ${active ? 'text-cian' : 'text-slate-300'}`}>{a.icon}</span>
              <span className="mt-1 px-1 text-[7px] tracking-widest text-slate-400">{a.label}</span>
              {cd > 0 && <span className="text-[9px] text-amber">{cd}</span>}
            </div>
            <span className="border border-slate-800 px-[6px] text-[9px] text-slate-500">
              {i + 1}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const EVENT_ICONS: [RegExp, string][] = [
  [/pulse_scan/, '◉'],
  [/decoy/, '≋'],
  [/fragment_delivered/, '◆'],
  [/fragment/, '◇'],
  [/unit_destroyed/, '✕'],
  [/strike/, '⚔'],
  [/match/, '▸'],
];

export function eventIcon(e: string): string {
  for (const [re, icon] of EVENT_ICONS) if (re.test(e)) return icon;
  return '·';
}

export function eventColor(e: string): string {
  if (e.includes('cian')) return '#22d3ee';
  if (e.includes('magenta')) return '#e64ce6';
  if (e.includes('fragment')) return '#f5b942';
  return '#94a3b8';
}

export function fmtEvent(e: string): string {
  return e.replaceAll('_', ' ').replace(':', ' · ');
}

export function fmtClock(cyclesLeft: number): string {
  const s = Math.ceil(cyclesLeft / 2);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function ScorePips({
  score,
  color,
  flip = false,
}: {
  score: number;
  color: string;
  flip?: boolean;
}) {
  const pips = Array.from({ length: CFG.fragments.deliveriesToWin }, (_, i) => (
    <span
      key={i}
      className="inline-block h-2 w-2 rounded-full"
      style={{
        background: i < score ? color : '#1b2635',
        boxShadow: i < score ? `0 0 6px ${color}` : 'none',
      }}
    />
  ));
  return (
    <span className={`flex items-center gap-1 ${flip ? 'flex-row-reverse' : ''}`}>{pips}</span>
  );
}

export type { MatchState };
