# 01 — Visão do Produto

## O que é

**ECHO//FRONT** é uma arena competitiva para agentes de IA. Duas equipes (Cian e Magenta) controlam um núcleo e um pequeno esquadrão de unidades geométricas em uma arena 2,5D isométrica. O objetivo primário não é eliminar o adversário: é **localizar, capturar e transportar fragmentos de dados** até o próprio núcleo — enxergando o mundo apenas através de sensores imperfeitos.

A tese central: **a informação é um recurso**. Um agente pode vencer sem disparar um único ataque, manipulando a percepção do adversário — iscas no radar, rastros térmicos falsos, ruído em uma direção e avanço por outra.

## Por que isso é diferente

RTS e arenas de bots tradicionais dão aos agentes uma visão quase perfeita do estado do jogo; a disputa vira micro-otimização de APM e pathfinding. Em ECHO//FRONT:

1. **Percepção parcial e ruidosa.** Nenhum agente recebe coordenadas exatas de inimigos — apenas leituras de sensores com direção, intensidade e incerteza.
2. **Todo sensor tem um custo ou uma fraqueza.** Radar ativo revela o mundo, mas revela também quem o disparou. Comunicação compartilha informação, mas pode ser bloqueada ou interceptada.
3. **Blefe é mecânica de primeira classe.** Decoys, sinais falsos e mensagens forjadas são ações do jogo, não exploits.
4. **Assistir é parte do produto.** O modo espectador mostra o que cada IA acredita (e com que confiança), transformando partidas em narrativas legíveis: "72% de confiança de que existe um inimigo atrás da torre".

## Pilares de design

1. **Percepção antes de precisão** — vence quem interpreta melhor, não quem clica mais rápido.
2. **Cada revelação tem preço** — obter informação de qualidade exige expor-se.
3. **Determinismo e reprodutibilidade** — mesma semente + mesmos agentes = mesma partida, sempre. Sem isso não há campeonato justo nem replay confiável.
4. **Legível para humanos** — a beleza do jogo está em ver as IAs errarem, desconfiarem e blefarem; o visual e o replay existem para contar essa história.

## Público

- **Desenvolvedores competidores:** escrevem agentes em qualquer linguagem que fale o protocolo (WebSocket/JSON), do heurístico simples ao modelo treinado.
- **Espectadores:** acompanham partidas e replays sem precisar programar.
- **Organizadores de eventos/educadores:** usam o jogo como plataforma de ensino de IA, teoria da informação e tomada de decisão sob incerteza.

## Nome e identidade

Nome escolhido: **ECHO//FRONT** (candidatos considerados: Signal War, Neural Arena, Ghost Protocol, Vector Clash, Blindspot AI). "Echo" comunica a essência — lutar por meio de sinais, ecos e interpretações; "Front" dá o tom de linha de combate. Identidade visual: arena escura como uma placa eletrônica viva, ciano vs. magenta, formas geométricas translúcidas (detalhes em [06-espectador-e-visual.md](./06-espectador-e-visual.md)).

## Escopo do MVP (vertical slice)

| Dimensão | MVP | Visão completa |
|---|---|---|
| Arenas | 1 arena fixa | Múltiplas arenas + mutação de mapa |
| Unidades por time | 2 (Observer + Runner) | 3–4 de 6 classes |
| Sensores | Visão, som, radar ativo | + térmico, comunicação interceptável |
| Ações especiais | `pulse_scan`, `deploy_decoy`, `hide` | + escudos, construção, interferência |
| Modos | Data Run | 7 modos (ver game design) |
| Duração | 90 s | Configurável por modo |
| Espectador | Visão geral + event feed | Visões por time/unidade, replay com confiança |

## Métricas de sucesso do MVP

- Uma partida completa entre dois agentes de exemplo roda de ponta a ponta, é assistível no navegador e é 100% reproduzível a partir da semente.
- Um dev externo consegue escrever um agente funcional em menos de 1 hora usando apenas o doc de protocolo e o agente de exemplo.
- Uma estratégia baseada em engano (decoy) consegue vencer uma estratégia puramente reativa — prova de que informação-como-recurso funciona na prática.

## Riscos principais

| Risco | Mitigação |
|---|---|
| Simulação não determinística quebra replays e torneios | PRNG com semente única, ordem de processamento fixa, testes de golden replay desde a Sprint 1 |
| Protocolo instável frustra competidores | Versionamento semântico do protocolo, schemas Zod publicados em `packages/protocol` |
| Jogo ilegível para espectadores | Event feed + visualização de sensores desde o MVP; playtests de "assistibilidade" |
| Estratégia dominante trivial (ex.: radar spam) | Custos de energia calibrados por simulação em massa (Sprint 5) |
