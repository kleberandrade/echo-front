# Sprint 10 — Hunter Joga o Objetivo

**Duração:** curta (item único de débito) · **Meta:** quitar o débito recorrente desde a Sprint 8: "hunter não joga o objetivo em data_run" — sem perder a identidade agressiva do bot.

**Status: ✅ concluída em 2026-08-25.**

## Entregas

### `hunterBot` joga o objetivo (`agents-sdk`)
Antes, fora de contato visual/radar/som o hunter só varria o mapa em rota espiral sem propósito — nunca buscava, carregava ou entregava fragmento. Isso o deixava matematicamente fora de competição em `data_run` (13,2 pts na Temporada 2, 1V-35D).

Mudanças em `packages/agents-sdk/src/bots.ts`:
- `hunterBot(team)` agora recebe o time (como courier/trickster/ghost) e delega para `siegeRoutine` em `core_siege`.
- **Contato de perto vira ataque real**: quando há visão de inimigo a ≤2,5 e energia > 35, ataca com `strike` (antes só perseguia — nunca golpeava).
- **Filtro de leitura visual**: a perseguição só considera leituras `unit`/`movement`; um fragmento ou núcleo à vista não sequestra mais a rotina de caça (o hunter ficava "perseguindo" um fragmento parado, sem nunca pará-lo capturar).
- **Objetivo tem prioridade sobre som**: entrega o fragmento carregado e persegue o fragmento conhecido mais próximo antes de perseguir um som — um inimigo parado emite ruído ambiente constante (e o sensor de som não filtra o próprio aliado se movendo por perto), então perseguir som sem limite travava o bot indefinidamente.
- **Pulso proativo**: sem fragmento conhecido, pulsa (`pulse_scan`) sempre que possível em vez de vagar — garante que o hunter mapeia a área com regularidade, não só quando "sobra" energia depois de perder o interesse em uma ameaça.
- **Correção de emperramento**: um som impreciso (jitter ±25°) pode mirar repetidamente numa direção bloqueada por obstáculo perto do spawn e travar a unidade parada; depois de 2 ciclos sem deslocamento a perseguição de som é abandonada em favor da varredura.
- **Varredura útil**: a rota de "sem pista nenhuma" agora patrulha os spawns de fragmento conhecidos do mapa (como courier/trickster), em vez de girar num padrão sem relação com o objetivo.

### Testes
Dois novos casos em `bots.test.ts`: hunter entrega fragmento contra oponente passivo em `data_run` (`score.cian > 0`); hunter delega corretamente para o cerco em `core_siege` (dano ao núcleo). Os testes originais (determinismo, replay, assimetria de informação via pulso) continuam verdes sem alteração.

### Torneio — Temporada 2 (re-rodada com o hunter novo)
72 partidas nos três modos, **zero divergência de replay**. Classificação:

| # | Bot | Pontos | Elo | V | D | Frags |
|---|---|---|---|---|---|---|
| 1 | trickster | 109,3 | 1055 | 23 | 13 | 61 |
| 2 | ghost | 87,0 | 1012 | 17 | 19 | 49 |
| 3 | **hunter** | **80,4** | **1001** | **17** | **19** | **43** |
| 4 | courier | 76,1 | 933 | 15 | 21 | 43 |

O hunter saiu da lanterna isolada (13,2 pts, 1V-35D) para 3º lugar competitivo (80,4 pts, 17V-19D — mesmo saldo de vitórias do ghost), sem perder o perfil ofensivo: segue sendo o bot com **menos vitórias sem abate** (7, contra 12–15 dos demais), ou seja, ele ainda resolve boa parte das partidas batendo, não só entregando fragmentos.

Screenshots capturados (`/matches` com a nova rodada, `/leaderboard` com o hunter em 3º) confirmam a UI consistente com os dados exportados.

## Débitos / Próximos
- **Débito reavaliado, não quitado**: publicação do `agents-sdk` no npm. `package.json` está `"private": true` e depende de `@echo-front/protocol`/`@echo-front/sim` via `workspace:*` — publicar de verdade exige ou publicar as três pacotes (versionamento independente, mudança maior) ou empacotar as dependências internas. Não é só rodar `npm publish`; fica para uma sprint dedicada a empacotamento.
- Herdados: sandbox Docker e rate limit por IP para torneio oficial; fog com envelhecimento de informação; playtest com leigos.

## Retro
O bug real não era "o hunter não tem código de objetivo" — era três problemas empilhados que só apareceram ao tentar fazê-lo jogar pra valer: leitura visual sem filtro de tipo sequestrando a perseguição, som sem filtro de time prendendo o bot atrás de obstáculo, e uma varredura de "não sei o que fazer" que não cobria terreno útil. Cada um foi encontrado rodando partidas headless contra um oponente passivo e inspecionando as transições de modo ciclo a ciclo — o `debug.mode` de cada bot (convenção da Sprint 7) se pagou de novo, desta vez como ferramenta de debug e não só de espectador.
