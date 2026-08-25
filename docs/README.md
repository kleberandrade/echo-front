# ECHO//FRONT — Documentação

Arena tática 2,5D onde IAs competem por **percepção**, não por reflexo. Cada agente enxerga o mundo apenas através de sensores imperfeitos e decide, a cada ciclo, em quem confiar, o que revelar e o que esconder. **Informação é um recurso** tão importante quanto vida e energia.

## Índice

| Documento                                                | Conteúdo                                                     |
| -------------------------------------------------------- | ------------------------------------------------------------ |
| [01-visao.md](./01-visao.md)                             | Visão do produto, pilares, público e diferenciais            |
| [02-game-design.md](./02-game-design.md)                 | Regras, unidades, sensores, ações, modos de jogo             |
| [03-arquitetura.md](./03-arquitetura.md)                 | Monorepo, Next.js + PixiJS, NestJS, deploy no Vercel         |
| [04-protocolo-agente.md](./04-protocolo-agente.md)       | Contrato JSON percepção → decisão, WebSocket, versionamento  |
| [05-simulacao.md](./05-simulacao.md)                     | Loop de ticks, determinismo, modelo dos sensores, replay     |
| [06-espectador-e-visual.md](./06-espectador-e-visual.md) | Direção de arte, modo espectador, replay com confiança da IA |
| [07-campeonato.md](./07-campeonato.md)                   | Formato de torneio, pontuação, submissão de agentes          |
| [08-deploy.md](./08-deploy.md)                           | Deploy (Vercel + server), CI/CD e checklist de release       |
| [10-guia-playtest.md](./10-guia-playtest.md)             | Roteiro pra rodar um playtest com gente de fora do projeto   |
| [sprints/](./sprints/README.md)                          | Roadmap de desenvolvimento                                   |

## Estado atual

- **Fase:** MVP completo + competição (sprints 0–7 concluídas; marcos M1–M4 atingidos).
- **Entregue:** simulador determinístico (SIM 0.5.0) com 4 sensores e Data Run, bots de referência equilibrados, espectador PixiJS no visual do concept com fog e camada de crença, séries ranqueadas via WebSocket com replays verificáveis, leaderboard e primeiro torneio amistoso (36 partidas, zero divergência).
- **Stack:** monorepo pnpm + Turborepo · `apps/web` (Next.js + PixiJS, deploy Vercel) · `apps/server` (NestJS, simulador autoritativo) · `packages/protocol` (schemas v0.3.0) · `packages/sim` · `packages/agents-sdk`.

## Convenções

- Documentação em português; identificadores de código, eventos e campos de protocolo em inglês (`pulse_scan`, `carrying_fragment`).
- Toda decisão de design relevante vira uma seção "Decisões" no doc correspondente, com data.
- Sprints têm critérios de aceite verificáveis; nada é "feito" sem demo reproduzível.
