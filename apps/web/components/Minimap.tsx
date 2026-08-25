'use client';

/**
 * Minimapa SVG (canto inferior direito, como no concept).
 */
import { ARENA_ALPHA, type MatchState } from '@echo-front/sim';

const MAP = ARENA_ALPHA;

export default function Minimap({ state }: { state: MatchState }) {
  return (
    <svg
      viewBox={`0 0 ${MAP.width} ${MAP.height}`}
      className="h-[104px] w-[184px]"
      style={{ background: 'rgba(2,6,12,0.85)' }}
    >
      <rect x="0.5" y="0.5" width={MAP.width - 1} height={MAP.height - 1} fill="none" stroke="#155e6e" strokeWidth="0.6" />
      {MAP.obstacles.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill="#1c2733" stroke="#2a4155" strokeWidth="0.3" />
      ))}
      {MAP.interferenceZones.map((z, i) => (
        <circle key={i} cx={z.x} cy={z.y} r={z.radius} fill="none" stroke="#9d5ce6" strokeWidth="0.4" strokeDasharray="1 1" opacity="0.7" />
      ))}
      {(['cian', 'magenta'] as const).map((team) => (
        <circle key={team} cx={MAP.cores[team].x} cy={MAP.cores[team].y} r="1.6" fill={team === 'cian' ? '#22d3ee' : '#e64ce6'} />
      ))}
      {state.fragments
        .filter((f) => f.state === 'spawned' || f.state === 'dropped')
        .map((f) => (
          <rect key={f.id} x={f.x / 1000 - 0.9} y={f.y / 1000 - 0.9} width="1.8" height="1.8" fill="#f5b942" transform={`rotate(45 ${f.x / 1000} ${f.y / 1000})`} />
        ))}
      {state.decoys.map((d) => (
        <circle key={d.id} cx={d.x / 1000} cy={d.y / 1000} r="0.8" fill="none" stroke={d.team === 'cian' ? '#22d3ee' : '#e64ce6'} strokeWidth="0.35" strokeDasharray="0.6 0.6" />
      ))}
      {state.units
        .filter((u) => u.alive)
        .map((u) => (
          <circle
            key={u.id}
            cx={u.x / 1000}
            cy={u.y / 1000}
            r={u.class === 'observer' ? 1.1 : 0.9}
            fill={u.team === 'cian' ? '#22d3ee' : '#e64ce6'}
            opacity={u.hiddenCycles > 0 ? 0.35 : 1}
          />
        ))}
    </svg>
  );
}
