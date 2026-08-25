# Sprints — Roadmap de Desenvolvimento

Sprints de **2 semanas**, projeto solo/dupla. Cada sprint termina com uma **demo reproduzível** — se não dá para mostrar rodando, não está pronto. Sprints 0–4 entregam o vertical slice do MVP; 5–6 preparam o lançamento competitivo.

| Sprint                                         | Nome                                | Entrega principal                                                                    |
| ---------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------ |
| [0](./sprint-00-fundacao.md)                   | Fundação                            | Monorepo, CI, protocolo v0.1, deploy vazio no Vercel                                 |
| [1](./sprint-01-simulador.md)                  | Simulador determinístico            | `packages/sim` com movimento, energia, golden replays                                |
| [2](./sprint-02-sensores-e-agentes.md)         | Sensores e agentes                  | Percepção completa, gateway WS, 2 bots de exemplo                                    |
| [3](./sprint-03-data-run.md)                   | Data Run jogável                    | Fragmentos, ações especiais, partida 90 s ponta a ponta                              |
| [4](./sprint-04-visual-e-replay.md)            | Visual e replay                     | Arena PixiJS, fog, overlays, replay no browser — **MVP completo**                    |
| [5](./sprint-05-espectador-e-balanceamento.md) | Espectador avançado e balanceamento | Visões por time/unidade, camada de confiança, sim em massa                           |
| [6](./sprint-06-competicao.md)                 | Competição                          | Partidas públicas por WS, leaderboard, docs para competidores                        |
| [7](./sprint-07-hardening.md)                  | Hardening                           | Débitos técnicos quitados, CI com smoke, deploy Vercel                               |
| [8](./sprint-08-temporada-1.md)                | Temporada 1                         | Modos Core Siege e Silent Hunt, rating Elo                                           |
| [9](./sprint-09-temporada-2.md)                | Temporada 2                         | Bots multi-modo, torneio nos três modos                                              |
| [10](./sprint-10-hunter-objetivo.md)           | Hunter joga o objetivo              | Débito quitado: hunter compete em data_run (13,2 → 80,4 pts)                         |
| [11](./sprint-11-infra-e-landing.md)           | Infra de torneio, visual e landing  | Rate limit por IP, sandbox Docker, landing page redesenhada, bug de replay corrigido |

## Marcos

- **M1 (fim da Sprint 1):** simulação re-executável com hash idêntico.
- **M2 (fim da Sprint 3):** dois bots disputam uma partida completa de Data Run headless.
- **M3 (fim da Sprint 4):** MVP — partida assistível no navegador, replay funcional, site no Vercel. 🎯
- **M4 (fim da Sprint 6):** primeiro torneio amistoso com agentes externos.

## Ritos e regras de trabalho

- Planning no 1º dia (escolher itens do backlog da sprint), review/demo no último, retro curta escrita no fim do arquivo da sprint.
- Backlog vive nos arquivos de sprint como checklists; o que não couber desce para a próxima.
- Definition of Done global: código com testes no que é lógica pura (`sim`, `protocol`), lint limpo, CI verde, demo gravável, docs atualizados quando o comportamento mudou.
- Débito consciente é anotado na seção "Débitos" da sprint — nada de débito invisível.
