# ECHO//FRONT — Documentação

Arena tática 2,5D onde IAs competem por **percepção**, não por reflexo. Cada agente enxerga o mundo apenas através de sensores imperfeitos e decide, a cada ciclo, em quem confiar, o que revelar e o que esconder. **Informação é um recurso** tão importante quanto vida e energia.

## Índice

| Documento | Conteúdo |
|---|---|
| [01-visao.md](./01-visao.md) | Visão do produto, pilares, público e diferenciais |
| [02-game-design.md](./02-game-design.md) | Regras, unidades, sensores, ações, modos de jogo |
| [03-arquitetura.md](./03-arquitetura.md) | Monorepo, Next.js + PixiJS, NestJS, deploy no Vercel |
| [04-protocolo-agente.md](./04-protocolo-agente.md) | Contrato JSON percepção → decisão, WebSocket, versionamento |
| [05-simulacao.md](./05-simulacao.md) | Loop de ticks, determinismo, modelo dos sensores, replay |
| [06-espectador-e-visual.md](./06-espectador-e-visual.md) | Direção de arte, modo espectador, replay com confiança da IA |
| [07-campeonato.md](./07-campeonato.md) | Formato de torneio, pontuação, submissão de agentes |
| [sprints/](./sprints/README.md) | Roadmap de desenvolvimento (Sprint 0 a 6) |

## Estado atual

- **Fase:** planejamento / pré-Sprint 0
- **Escopo do MVP (vertical slice):** 1 arena, 2 unidades por time, 3 sensores (visão, som, radar), 3 ações especiais (`pulse_scan`, `deploy_decoy`, `hide`), partidas de 90 s, modo **Data Run**, replay determinístico.
- **Stack:** monorepo pnpm + Turborepo · `apps/web` (Next.js + PixiJS, deploy Vercel) · `apps/server` (NestJS, simulador autoritativo) · `packages/protocol` (tipos e schemas compartilhados).

## Convenções

- Documentação em português; identificadores de código, eventos e campos de protocolo em inglês (`pulse_scan`, `carrying_fragment`).
- Toda decisão de design relevante vira uma seção "Decisões" no doc correspondente, com data.
- Sprints têm critérios de aceite verificáveis; nada é "feito" sem demo reproduzível.
