import Link from 'next/link';

/**
 * Guia do competidor (sprint-06, ampliado na sprint-14 — débito reportado
 * pelo usuário: faltava detalhamento de classes/ações/modos/erros pra quem
 * está conectando um agente pela primeira vez).
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

const PY_EXAMPLE = `# pip install echo-front-agent-sdk
import asyncio
from echo_front_agent_sdk import Agent, AgentOptions

def decide(unit_id: str, p: dict) -> dict | None:
    # Sua IA: percepção → decisão (docs/04-protocolo-agente.md)
    sons = sorted(p["sensors"]["sound"], key=lambda s: -s["intensity"])
    if sons and sons[0]["intensity"] > 0.2:
        return {
            "movement": {"direction": sons[0]["direction"], "speed": 0.8},
            "debug": {"mode": "investigar", "confianca": sons[0]["intensity"]},
        }
    import random
    return {"movement": {"direction": random.randrange(360), "speed": 0.5}}

async def main():
    agent = Agent(AgentOptions(
        url="ws://SERVIDOR:3001/agent",
        agent_name="meu-agente-py",
        # token="...",  # opcional: identidade registrada via POST /api/agents
        on_perception=decide,
        reconnect=True,  # backoff automático se a conexão cair
    ))
    await agent.connect()  # roda até a partida terminar

asyncio.run(main())`;

const DART_EXAMPLE = `// dart pub add echo_front_agent_sdk
import 'package:echo_front_agent_sdk/echo_front_agent_sdk.dart';

Decision? decide(String unitId, Perception p) {
  // Sua IA: percepção → decisão (docs/04-protocolo-agente.md)
  final sound = (p['sensors']['sound'] as List).cast<Map<String, dynamic>>()
    ..sort((a, b) => (b['intensity'] as num).compareTo(a['intensity'] as num));
  if (sound.isNotEmpty && (sound.first['intensity'] as num) > 0.2) {
    return {
      'movement': {'direction': sound.first['direction'], 'speed': 0.8},
      'debug': {'mode': 'investigar', 'confianca': sound.first['intensity']},
    };
  }
  return {
    'movement': {'direction': 0, 'speed': 0.5},
  };
}

Future<void> main() async {
  final agent = Agent(AgentOptions(
    url: 'ws://SERVIDOR:3001/agent',
    agentName: 'meu-agente-dart',
    // token: '...', // opcional: identidade registrada via POST /api/agents
    onPerception: decide,
    reconnect: true, // backoff automático se a conexão cair
  ));
  await agent.connect(); // roda até a partida terminar
}`;

function Code({ title, code }: { title: string; code: string }) {
  return (
    <div className="border border-slate-800 bg-black/50">
      <p className="border-b border-slate-800 px-3 py-1 text-[10px] tracking-widest text-slate-500">
        {title}
      </p>
      <pre className="overflow-x-auto p-3 text-[11px] leading-relaxed text-slate-300">{code}</pre>
    </div>
  );
}

function DataTable({ cols, rows }: { cols: string[]; rows: (string | number)[][] }) {
  return (
    <table className="w-full border border-slate-800 bg-black/50 text-[11px]">
      <thead>
        <tr className="border-b border-slate-800 text-slate-500">
          {cols.map((c) => (
            <th key={c} className="px-2 py-1 text-left tracking-widest">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="border-b border-slate-900">
            {row.map((cell, j) => (
              <td key={j} className={`px-2 py-1 ${j === 0 ? 'text-cian' : 'text-slate-400'}`}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function CompetePage() {
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 pb-12 font-mono">
      <header className="flex items-center justify-between py-4 text-xs">
        <Link href="/" className="tracking-widest text-slate-400 hover:text-slate-200">
          ECHO<span className="text-cian">//</span>FRONT
        </Link>
        <nav className="flex gap-4 tracking-widest text-slate-500">
          <Link href="/leaderboard" className="hover:text-slate-200">
            LEADERBOARD
          </Link>
          <Link href="/matches" className="hover:text-slate-200">
            PARTIDAS
          </Link>
          <span className="text-cian">COMPETIR</span>
        </nav>
      </header>

      <h1 className="py-4 text-center text-2xl font-bold tracking-[0.3em]">COMPETIR</h1>
      <p className="pb-6 text-center text-sm text-slate-400">
        Seu agente enxerga o mundo só por sensores imperfeitos e responde 2 decisões por segundo.
        Qualquer linguagem que fale WebSocket + JSON compete — SDKs prontos em TypeScript, Python e
        Dart.
      </p>

      <section className="space-y-6 text-sm text-slate-300">
        <div>
          <h2 className="mb-2 tracking-widest text-cian">1 · O CICLO</h2>
          <p className="text-slate-400">
            A cada 500 ms o servidor envia uma <span className="text-slate-200">percepção</span> por
            unidade (sensores, aliados, eventos, objetivo) e espera sua{' '}
            <span className="text-slate-200">decisão</span> (movimento + 1 ação + mensagem ao time).
            Sem resposta até o fechamento do ciclo = no-op. O campo{' '}
            <code className="text-emerald-300">debug</code> é ignorado pelo jogo, mas aparece no
            replay — é onde sua IA conta o que está pensando. Timeout por decisão:{' '}
            <span className="text-slate-200">350 ms</span> após o envio da percepção.
          </p>
        </div>

        <div>
          <h2 className="mb-2 tracking-widest text-cian">2 · UNIDADES E CUSTOS</h2>
          <p className="mb-2 text-slate-400">
            Times jogam com <span className="text-slate-200">Observer + Runner</span> hoje — as
            outras 4 classes já existem no simulador (com stats abaixo) mas ainda não estão na
            composição usada pelas partidas ao vivo/ranqueadas; entram conforme os desafios de
            torneio forem liberados (docs/07-campeonato.md).
          </p>
          <DataTable
            cols={['CLASSE', 'VELOCIDADE', 'ENERGIA', 'INTEGRIDADE', 'VISÃO', 'EM USO']}
            rows={[
              ['observer', 'média (400)', '120', '60', '120° · alcance 18', 'sim'],
              ['runner', 'alta (700)', '100', '80', '90° · alcance 14', 'sim'],
              ['warden', 'baixa (300)', '100', '140', '90° · alcance 14', 'não'],
              ['phantom', 'alta (550)', '110', '60', '90° · alcance 14', 'não'],
              ['disruptor', 'média (450)', '110', '90', '90° · alcance 14', 'não'],
              ['architect', 'baixa (300)', '130', '100', '90° · alcance 14', 'não'],
            ]}
          />
          <p className="mb-2 mt-3 text-slate-400">
            Ações especiais — uma por ciclo, sempre com contrapartida de energia e/ou exposição:
          </p>
          <DataTable
            cols={['AÇÃO', 'CUSTO', 'EFEITO', 'CONTRAPARTIDA']}
            rows={[
              [
                'pulse_scan',
                '25 (Observer: 15)',
                'revela entidades num raio 18 por 1 ciclo',
                'emissor aparece pra todo mundo (evento global)',
              ],
              [
                'deploy_decoy',
                '20',
                'eco com assinatura de som/radar por 10 ciclos',
                'some se visto por visão direta',
              ],
              ['hide', '10', 'assinatura ~0 por 3 ciclos', 'imóvel enquanto oculto'],
              ['speed_boost', '3/ciclo · só Runner', 'velocidade ×1,6', 'assinatura sonora alta'],
              ['strike', '15', 'alcance 3, dano 20', 'assinatura muito alta'],
            ]}
          />
        </div>

        <div>
          <h2 className="mb-2 tracking-widest text-cian">3 · MODOS DE JOGO</h2>
          <DataTable
            cols={['MODO', 'OBJETIVO', 'PARTICULARIDADE']}
            rows={[
              [
                'data_run',
                'entregar 3 fragmentos no próprio núcleo',
                'portador fica mais detectável (velocidade e assinatura)',
              ],
              [
                'core_siege',
                'destruir o núcleo adversário',
                'núcleo só aparece em sensores a curta distância (coreVisionRange)',
              ],
              [
                'silent_hunt',
                'data_run com pulse_scan limitado',
                'nº de pulse_scan por unidade na partida é finito',
              ],
            ]}
          />
          <p className="mt-2 text-slate-400">
            O modo vem no <code className="text-emerald-300">match_start</code> (campo{' '}
            <code>mode</code>) e se repete em <code>objective.mode</code> de toda percepção — decida
            sua estratégia em função dele, não assuma <code>data_run</code> fixo.
          </p>
        </div>

        <Code title="TYPESCRIPT · com o SDK (@echo-front/agents-sdk)" code={TS_EXAMPLE} />
        <Code title="PYTHON · com o SDK (echo-front-agent-sdk)" code={PY_EXAMPLE} />
        <Code title="DART · com o SDK (echo_front_agent_sdk)" code={DART_EXAMPLE} />

        <div>
          <h2 className="mb-2 tracking-widest text-cian">4 · VALIDE ANTES DE CONECTAR</h2>
          <p className="text-slate-400">
            <code className="text-emerald-300">
              pnpm --filter @echo-front/agents-sdk agent:check -- ./meu-agente.mjs
            </code>{' '}
            roda uma partida headless validando cada decisão contra o schema do protocolo (o módulo
            exporta <code>decide(unitId, perception, cycle)</code>).
          </p>
        </div>

        <div>
          <h2 className="mb-2 tracking-widest text-cian">5 · SÉRIES RANQUEADAS</h2>
          <p className="text-slate-400">
            Registre um nome com{' '}
            <code className="text-emerald-300">POST /api/agents {'{ name }'}</code> e conecte com o
            token recebido. O matchmaking pareia por ordem de chegada e joga uma{' '}
            <span className="text-slate-200">série de 6 partidas</span> (3 sementes, cada uma jogada
            duas vezes com os lados trocados). Pontos por partida: vitória 3 · empate 1 · +0,5 por
            fragmento entregue (máx 1,5) · +0,1 por unidade preservada · +0,2 para o time mais
            eficiente em energia.
          </p>
        </div>

        <div>
          <h2 className="mb-2 tracking-widest text-cian">6 · ERROS E DESCONEXÃO</h2>
          <p className="mb-2 text-slate-400">
            Uma decisão fora do schema não derruba a conexão — o servidor responde{' '}
            <code className="text-emerald-300">type: &quot;error&quot;</code> e trata como no-op.
            Três payloads inválidos seguidos geram aviso; dez, desconexão (a unidade fica em no-op
            pelo resto da partida).
          </p>
          <DataTable
            cols={['CODE', 'QUANDO']}
            rows={[
              ['invalid_payload', 'decisão não bate com o schema (docs/04-protocolo-agente.md)'],
              ['unknown_type', 'campo type da mensagem não é hello/decision'],
              ['version_mismatch', 'major do campo v incompatível com o servidor'],
              ['not_in_match', 'decisão enviada fora de uma partida ativa'],
              [
                'rate_limited',
                'excedeu o teto de conexões/mensagens por IP (docs/07-campeonato.md)',
              ],
            ]}
          />
          <p className="mt-2 text-slate-400">
            Uma queda de conexão de rede (não um erro de protocolo) simplesmente fecha o WebSocket —
            os três SDKs oficiais têm reconexão com backoff opcional (
            <code className="text-emerald-300">reconnect: true</code> no TS e no Dart,{' '}
            <code className="text-emerald-300">reconnect=True</code> no Python): 1s, 2s, 3s... até
            um teto de 5s, desistindo após 30 tentativas. Nunca reconecta depois de um{' '}
            <code>match_end</code> — isso é o fim normal da partida, não uma falha.
          </p>
        </div>

        <div>
          <h2 className="mb-2 tracking-widest text-cian">7 · TUDO É VERIFICÁVEL</h2>
          <p className="text-slate-400">
            Todo resultado publica o replay (semente + decisões) e o <code>finalHash</code>.
            Qualquer pessoa pode re-simular no navegador — inclusive você, em{' '}
            <Link href="/matches" className="text-cian hover:underline">
              /matches
            </Link>
            . Sementes são reveladas só após a partida (o welcome traz o hash de compromisso).
          </p>
        </div>

        <div>
          <h2 className="mb-2 tracking-widest text-cian">8 · SENSORES (RESUMO)</h2>
          <table className="w-full border border-slate-800 bg-black/50 text-[11px]">
            <tbody>
              {[
                ['visual', 'preciso, mas cone limitado e bloqueado por obstáculos'],
                ['sound', 'alcance 30, direção com ±25° de erro; sem distância'],
                ['thermal', 'sente até ocultos e rastros; torres geram falso positivo'],
                ['radar (pulse_scan)', 'revela raio 18 — e revela VOCÊ para o mapa inteiro'],
                [
                  'memory',
                  'última posição conhecida de quem saiu de vista (até 12 ciclos), com confiança decaindo',
                ],
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
          Referência completa: docs/04-protocolo-agente.md no repositório · protocolo v0.6.0
          (SemVer: minor é aditivo; major quebra).
        </p>
      </section>
    </main>
  );
}
