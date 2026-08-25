import Link from 'next/link';

/**
 * Guia do competidor (sprint-06): como conectar um agente em menos de 1 hora.
 */
const TS_EXAMPLE = `import { Agent } from '@echo-front/agents-sdk';

const agent = new Agent({
  url: 'ws://SERVIDOR:3001/agent',
  agentName: 'meu-agente',
  // token: '...', // opcional: identidade registrada via POST /api/agents
  onPerception: (unitId, p) => {
    // Sua IA: percepção → decisão (docs/04-protocolo-agente.md)
    const som = p.sensors.sound.sort((a, b) => b.intensity - a.intensity)[0];
    if (som && som.intensity > 0.2) {
      return {
        movement: { direction: som.direction, speed: 0.8 },
        debug: { mode: 'investigar', confianca: som.intensity },
      };
    }
    return { movement: { direction: Math.floor(Math.random() * 360), speed: 0.5 } };
  },
});
await agent.connect();`;

const PY_EXAMPLE = `# Sem SDK: qualquer linguagem que fale WebSocket + JSON.
import asyncio, json, random, websockets

async def main():
    async with websockets.connect("ws://SERVIDOR:3001/agent") as ws:
        await ws.send(json.dumps({
            "v": "0.2.0", "type": "hello",
            "payload": {"agentName": "meu-agente-py"},
        }))
        async for raw in ws:
            msg = json.loads(raw)
            if msg["type"] == "perception":
                p = msg["payload"]
                sons = sorted(p["sensors"]["sound"],
                              key=lambda s: -s["intensity"])
                decision = (
                    {"movement": {"direction": sons[0]["direction"], "speed": 0.8}}
                    if sons else
                    {"movement": {"direction": random.randrange(360), "speed": 0.5}}
                )
                await ws.send(json.dumps({
                    "v": "0.2.0", "type": "decision",
                    "cycle": msg["cycle"], "unitId": msg["unitId"],
                    "payload": decision,
                }))
            elif msg["type"] == "match_end":
                print("fim:", msg["payload"])

asyncio.run(main())`;

function Code({ title, code }: { title: string; code: string }) {
  return (
    <div className="border border-slate-800 bg-black/50">
      <p className="border-b border-slate-800 px-3 py-1 text-[10px] tracking-widest text-slate-500">{title}</p>
      <pre className="overflow-x-auto p-3 text-[11px] leading-relaxed text-slate-300">{code}</pre>
    </div>
  );
}

export default function CompetePage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 pb-12 font-mono">
      <header className="flex items-center justify-between py-4 text-xs">
        <Link href="/" className="tracking-widest text-slate-400 hover:text-slate-200">
          ECHO<span className="text-cian">//</span>FRONT
        </Link>
        <nav className="flex gap-4 tracking-widest text-slate-500">
          <Link href="/leaderboard" className="hover:text-slate-200">LEADERBOARD</Link>
          <Link href="/matches" className="hover:text-slate-200">PARTIDAS</Link>
          <span className="text-cian">COMPETIR</span>
        </nav>
      </header>

      <h1 className="py-4 text-center text-2xl font-bold tracking-[0.3em]">COMPETIR</h1>
      <p className="pb-6 text-center text-sm text-slate-400">
        Seu agente enxerga o mundo só por sensores imperfeitos e responde 2 decisões por segundo.
        Qualquer linguagem que fale WebSocket + JSON compete.
      </p>

      <section className="space-y-6 text-sm text-slate-300">
        <div>
          <h2 className="mb-2 tracking-widest text-cian">1 · O CICLO</h2>
          <p className="text-slate-400">
            A cada 500 ms o servidor envia uma <span className="text-slate-200">percepção</span> por
            unidade (sensores, aliados, eventos, objetivo) e espera sua{' '}
            <span className="text-slate-200">decisão</span> (movimento + 1 ação + mensagem ao time).
            Sem resposta até o fechamento do ciclo = no-op. O campo <code className="text-emerald-300">debug</code>{' '}
            é ignorado pelo jogo, mas aparece no replay — é onde sua IA conta o que está pensando.
          </p>
        </div>

        <Code title="TYPESCRIPT · com o SDK (@echo-front/agents-sdk)" code={TS_EXAMPLE} />
        <Code title="PYTHON · sem SDK, direto no protocolo" code={PY_EXAMPLE} />

        <div>
          <h2 className="mb-2 tracking-widest text-cian">2 · VALIDE ANTES DE CONECTAR</h2>
          <p className="text-slate-400">
            <code className="text-emerald-300">pnpm --filter @echo-front/agents-sdk agent:check -- ./meu-agente.mjs</code>{' '}
            roda uma partida headless validando cada decisão contra o schema do protocolo
            (o módulo exporta <code>decide(unitId, perception, cycle)</code>).
          </p>
        </div>

        <div>
          <h2 className="mb-2 tracking-widest text-cian">3 · SÉRIES RANQUEADAS</h2>
          <p className="text-slate-400">
            Registre um nome com <code className="text-emerald-300">POST /api/agents {'{ name }'}</code>{' '}
            e conecte com o token recebido. O matchmaking pareia por ordem de chegada e joga uma{' '}
            <span className="text-slate-200">série de 6 partidas</span> (3 sementes, cada uma jogada
            duas vezes com os lados trocados). Pontos por partida: vitória 3 · empate 1 · +0,5 por
            fragmento entregue (máx 1,5) · +0,1 por unidade preservada · +0,2 para o time mais
            eficiente em energia.
          </p>
        </div>

        <div>
          <h2 className="mb-2 tracking-widest text-cian">4 · TUDO É VERIFICÁVEL</h2>
          <p className="text-slate-400">
            Todo resultado publica o replay (semente + decisões) e o <code>finalHash</code>. Qualquer
            pessoa pode re-simular no navegador — inclusive você, em{' '}
            <Link href="/matches" className="text-cian hover:underline">/matches</Link>. Sementes são
            reveladas só após a partida (o welcome traz o hash de compromisso).
          </p>
        </div>

        <div>
          <h2 className="mb-2 tracking-widest text-cian">5 · SENSORES (RESUMO)</h2>
          <table className="w-full border border-slate-800 text-[11px]">
            <tbody>
              {[
                ['visual', 'preciso, mas cone limitado e bloqueado por obstáculos'],
                ['sound', 'alcance 30, direção com ±25° de erro; sem distância'],
                ['thermal', 'sente até ocultos e rastros; torres geram falso positivo'],
                ['radar (pulse_scan)', 'revela raio 18 — e revela VOCÊ para o mapa inteiro'],
                ['comunicação', 'entrega no ciclo seguinte; zonas de interferência a bloqueiam'],
              ].map(([k, v]) => (
                <tr key={k} className="border-b border-slate-900">
                  <td className="px-2 py-1 text-cian">{k}</td>
                  <td className="px-2 py-1 text-slate-400">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-[10px] text-slate-600">
          Referência completa: docs/04-protocolo-agente.md no repositório · protocolo v0.2.0 (SemVer:
          minor é aditivo; major quebra).
        </p>
      </section>
    </main>
  );
}
