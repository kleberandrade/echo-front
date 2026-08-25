# 05 — Simulação

Especificação do núcleo determinístico (`packages/sim`).

## Tempo

| Conceito | Valor MVP |
|---|---|
| Tick | 100 ms (10 ticks/s) |
| Ciclo de decisão | 5 ticks (2 decisões/s por unidade) |
| Partida (Data Run) | 90 s = 900 ticks = 180 ciclos |
| Timeout de decisão | 350 ms após envio da percepção |

O servidor coleta decisões de forma assíncrona durante o ciclo; todas as decisões válidas recebidas até o fechamento do ciclo são aplicadas **juntas** no primeiro tick do ciclo seguinte. Latência de rede dentro do timeout não dá vantagem.

## Pipeline de um tick

Ordem fixa (determinismo):

1. **Aplicar decisões** do ciclo (apenas no 1º tick do ciclo), em ordem lexicográfica de `unitId`: rumo/velocidade, iniciar ações.
2. **Física/movimento**: integrar posições, colisões com obstáculos e bordas (unidades não se atropelam; param adjacentes).
3. **Ações em andamento**: ticks de `hide`, vida de decoys, paredes temporárias, cooldowns.
4. **Regras de objetivo**: captura de fragmento (contagem de ciclos adjacentes), entrega no núcleo, pontuação.
5. **Energia**: regeneração base, bônus de torre, drenos contínuos (`speed_boost`).
6. **Combate**: resolver `strike` (alcance, dano, destruição de unidade → drop de fragmento).
7. **Eventos**: gerar eventos globais do tick.
8. **Percepção** (apenas no último tick do ciclo): calcular leituras de sensores por unidade e emitir pacotes.

## Estado canônico

```ts
interface MatchState {
  cycle: number; tick: number;
  seed: string;               // semente da partida
  rngState: number;           // estado do PRNG (serializável)
  units: Unit[];              // ordenadas por unitId
  fragments: Fragment[];
  decoys: Decoy[];
  walls: TempWall[];
  map: MapRef;                // id + versão do mapa (dados estáticos ficam fora do estado)
  score: { cian: number; magenta: number };
  events: GameEvent[];        // eventos do tick corrente
}
```

`step(state, decisions, cfg) → { state', perceptions?, events }` é **pura**: sem I/O, sem relógio, sem aleatoriedade externa. Todo ruído vem do PRNG interno do estado.

## Modelo dos sensores

### Visão
- Cone de 90° centrado no `heading`, alcance 14 (Observer: 120°/18).
- Raycast na grade contra obstáculos e paredes temporárias; oclusão total (MVP, sem penumbra).
- Alvo com `hide` ativo: invisível. Decoy: **visível como decoy** (visão é o contra-decoy).
- Leitura: tipo (`unit`/`decoy`/`fragment`), `class_guess` com `confidence` decrescente com a distância.

### Som
- Fontes: movimento (proporcional a `speed` × assinatura da classe), `speed_boost` (alto), `strike`, decoys (emitem perfil sonoro configurado).
- Alcance 30, atravessa obstáculos com atenuação de 40% por obstáculo.
- Jitter direcional: ±25° uniforme via PRNG. Sem estimativa de distância — só `intensity` (0–1).

### Radar ativo (`pulse_scan`)
- Snapshot de todas as entidades (unidades não-ocultas, decoys com assinatura de radar, fragmentos) num raio 18, com posição quantizada em células de 2×2 (imprecisão fixa).
- Custo 25 (Observer 15), cooldown 5 ciclos.
- Efeito colateral: todas as unidades no mapa recebem no ciclo leitura `radar: [{ type: "pulse_origin", direction, distance_band }]` + evento global `pulse_scan_detected`.

### Térmico (pós-MVP)
- Intensidade por classe/atividade; rastros residuais por 3 ciclos onde a unidade passou; torres de energia são fontes fixas (falso positivo intencional).
- Detecta unidades com `hide` (contramedida da camuflagem), sem identificar tipo.

### Comunicação
- `message_to_team` entregue no ciclo seguinte a todos os aliados **fora** de zona de interferência.
- Em zona de interferência: mensagem descartada silenciosamente e `allies` do receptor fica defasado (último estado conhecido, com `stale: true`).
- Interceptação pelo Disruptor: pós-MVP.

## Determinismo e PRNG

- PRNG: xoshiro128** com estado no `MatchState`; cada subsistema deriva um stream próprio (`hash(seed, "sound", cycle, unitId)`) para que a ordem de consumo não acople subsistemas.
- Proibições no `packages/sim`: `Math.random`, `Date`, `performance`, iteração de `Map`/`Set` (usar arrays ordenados), floats em acumuladores de longo prazo (posições em fixed-point ×1000).
- **Golden replays** no CI: `fixtures/*.replay.jsonl` re-simulados; hash do estado final comparado byte a byte.

## Formato de replay

JSONL, uma linha por registro:

```
{"h":{"protocol":"0.1.0","sim":"0.1.0","map":"arena_alpha@1","seed":"...","teams":{...}}}
{"c":0,"d":{"cian_observer_1":{...decisão...},"magenta_runner_1":{...}},"dbg":{"cian_observer_1":{...}}}
{"c":1,"d":{...},"dbg":{...}}
...
{"end":{"score":{"cian":2,"magenta":1},"reason":"fragments_delivered","finalHash":"ab34..."}}
```

- Reproduzir = carregar header, re-executar `step` com as decisões gravadas.
- `dbg` preserva os campos `debug` dos agentes para o espectador ("72% de confiança…").
- `finalHash` permite validar integridade sem confiar no arquivo.

## Balanceamento por simulação em massa

CLI `pnpm sim:batch` roda N partidas headless entre bots de referência variando parâmetros (custos, alcances, ruído) e exporta CSV: taxa de vitória por estratégia, uso de energia, frequência de detecção. Meta de saúde do MVP: nenhuma estratégia de referência com winrate > 65% contra o campo.

## Decisões

- 2026-08-25 — Percepção só no fim do ciclo (não a cada tick): mantém o volume de mensagens baixo e dá às ações contínuas granularidade interna sem expor micro-informação.
- 2026-08-25 — Posições em fixed-point: elimina divergência float entre Node do servidor e browser no replay.
- 2026-08-25 — Streams de PRNG por subsistema: mudar a ordem de avaliação de um subsistema não altera o ruído dos demais (refactors seguros).
