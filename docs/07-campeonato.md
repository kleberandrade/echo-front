# 07 — Campeonato

Formato competitivo (pós-MVP; Sprint 6 entrega a base).

## Submissão de agentes

| Fase                   | Formato                                           | Uso                                                   |
| ---------------------- | ------------------------------------------------- | ----------------------------------------------------- |
| MVP / friendly matches | WebSocket ao vivo (agente roda na máquina do dev) | Desenvolvimento e testes                              |
| Torneio oficial        | **Container Docker** submetido ao orquestrador    | Isola rede, limita CPU/RAM, garante reprodutibilidade |

Contrato do container: imagem expõe um processo que conecta ao WS local do orquestrador (`AGENT_WS_URL` via env). Limites de referência: 1 vCPU, 512 MB, sem rede externa, 350 ms por decisão.

## Reprodutibilidade

- Todas as partidas usam **sementes conhecidas** (publicadas com hash antes, valor depois — ver protocolo).
- Cada confronto roda em série de N partidas com sementes distintas e **lados espelhados** (cada semente jogada 2×, trocando Cian/Magenta) para anular assimetrias residuais do mapa.
- Todo resultado oficial acompanha o replay; qualquer pessoa pode re-simular e validar o `finalHash`.

## Pontuação

Por partida (Data Run):

| Critério                                                  | Pontos               |
| --------------------------------------------------------- | -------------------- |
| Vitória                                                   | 3                    |
| Empate                                                    | 1                    |
| Fragmento entregue                                        | +0.5 cada (máx. 1.5) |
| Unidades preservadas ao fim                               | +0.1 cada            |
| Eficiência energética (menor consumo entre os dois times) | +0.2                 |

Métricas de mérito exibidas no leaderboard (não pontuam, mas contam a história): precisão das inferências (hipóteses `debug` vs. verdade da simulação), tempo médio de reação a eventos, taxa de vitória contra estilos distintos de estratégia, decoys "comprados" pelo adversário.

## Estrutura de torneio

1. **Fase de grupos**: round-robin em pools de 4–6 agentes, séries de 6 partidas (3 sementes × 2 lados).
2. **Playoffs**: eliminação dupla, séries de 10 partidas.
3. **Desafios especiais** (rodadas temáticas): composição restrita ("apenas 3 das 6 classes"), espelho ("mesmas unidades para todos"), Silent Hunt, Energy Crisis.

## Anti-abuso

- Sem rede externa no container: impede coordenação fora do canal `message_to_team`.
- Timeout rígido + orçamento de CPU: iguala condições de hardware.
- Semente oculta até o fim: impede pré-cálculo do ruído.
- Replays públicos: a comunidade audita comportamentos estranhos (collusion entre agentes do mesmo autor em grupos é tratada por regulamento).
- **Rate limiting por IP** (sprint-11): `AgentServer` recusa novas conexões acima de um teto por minuto e por conexões simultâneas, por IP — protege o canal ao vivo (WS público) contra flood, independente do sandbox de containers abaixo.

## Sandbox Docker (sprint-11)

`apps/server/src/tournament/container-orchestrator.ts` implementa o contrato descrito acima: `ContainerOrchestrator.start(spec)` sobe a imagem do competidor numa rede Docker `--internal` (sem rota para a internet) com `--cpus 1 --memory 512m --pids-limit 128 --cap-drop ALL --security-opt no-new-privileges`, injetando `AGENT_WS_URL`/`AGENT_NAME`/`AGENT_TOKEN` via env — sem publicar porta (o container disca para o orquestrador, nunca o contrário). Exemplo de imagem mínima em `apps/server/docker/sandbox-agent/`.

## Roadmap do campeonato

1. Sprint 6: friendly matches por WS + leaderboard simples.
2. Depois: orquestrador de containers, filas de matchmaking, temporadas com ranking Elo/Glicko, página de perfil de agente com estatísticas de inferência.
