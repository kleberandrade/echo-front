# Sprint 7 — Hardening, Débitos e CI/CD

**Duração:** 1 semana · **Meta:** quitar os débitos técnicos acumulados nas sprints 2–6 e fechar o pipeline de CI/CD com deploy no Vercel.

**Status: ✅ concluída em 2026-08-25.**

## Débitos quitados

| Origem | Débito | Solução |
|---|---|---|
| Sprint 2 | Canal `/spectate` sem schema | Protocolo **0.3.0**: `SpectateMessageSchema` (state/idle/end); server emite frames conformes e o `LiveViewer` valida com o schema |
| Sprint 2 | `allies` stale com posições atuais | `lastAllies` no estado: fora de interferência a unidade atualiza seu quadro; dentro, a percepção entrega o ÚLTIMO snapshot (posições defasadas de verdade) |
| Sprint 3 | `strike` ignorava `target` | Mira honrada: entre inimigos no alcance, atinge o mais próximo do ponto de mira (trickster já mira o alvo visual) |
| Sprint 4 | Smoke fora do CI | Job `smoke` no GitHub Actions: instala Chromium do Playwright, valida replay demo (placar + hash no browser), screenshots como artifact |
| Sprint 5 | Crença × realidade posicional | Convenção `debug.hypotheses[] = {position, confidence, label}` nos bots; arena renderiza marcadores ✕ com linha de crença e seta de intenção (decidida × executada) |
| Sprint 6 | Delay anti-coaching | `spectateDelayMs` no `AgentServer` (frames de espectador atrasados) |
| Sprint 6 / doc 04 | Kick por payloads inválidos | Contadores por socket: aviso a partir do 3º, desconexão no 10º (partida segue em no-op); payload válido zera a contagem |

## CI/CD

- **`.github/workflows/ci.yml`** (dois jobs): `ci` = typecheck + build + testes (90 testes, golden replays, e2e de séries); `smoke` = replay demo no Chromium com validação de placar e paridade Node×browser a cada push/PR.
- **Vercel**: `apps/web/vercel.json` com install/build do monorepo via turbo; configuração passo a passo, variáveis (`NEXT_PUBLIC_ECHO_API`, `NEXT_PUBLIC_ECHO_WS`) e deploy do server em [docs/08-deploy.md](../08-deploy.md).
- Golden replays regenerados (`lastAllies` no estado) — SIM **0.5.0**; replay demo e os 36 replays do torneio re-gerados na nova versão (zero divergência mantido).

## Nota de instalação do CI (uma vez)

A ponte remota não pode escrever em `.github/` nem `.npmrc` no disco — os dois foram commitados direto no índice do git (plumbing). Após o pull/checkout eles se materializam; num clone local basta:

```bash
git checkout -- .github .npmrc
```

## Débitos remanescentes (assumidos)

- Publicação do `agents-sdk` no npm + repo template (exige conta npm).
- Sandbox de containers Docker e rate limiting por IP para torneio oficial.
- Fog com envelhecimento de informação; roster ranqueado exigir bots de objetivo; playtest com leigos.
- `known_fragments` sem memória entre ciclos (decisão de design: memória é do agente).

## Retro

Trocar "posição atual com flag stale" pelo snapshot real transformou a zona de interferência numa mecânica honesta: agora dá para ver, no replay, um observer navegando com um mapa mental 5 ciclos velho. E o CI rodando o smoke com hash no browser fecha o ciclo que começou na Sprint 1: qualquer regressão de determinismo quebra o build antes de chegar à main.
