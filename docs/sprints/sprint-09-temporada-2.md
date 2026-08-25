# Sprint 9 — Temporada 2: Bots Multi-Modo e Torneio nos Três Modos

**Duração:** 1 semana · **Meta:** os bots de referência jogam qualquer modo, e o torneio oficial passa a cobrir Data Run, Core Siege e Silent Hunt.

**Status: ✅ concluída em 2026-08-25.**

## Entregas

### Bots multi-modo (`agents-sdk`)
- **Rotina de cerco compartilhada** (`siegeRoutine`): quando `objective.mode === 'core_siege'`, courier/trickster/ghost varrem os sítios candidatos do inimigo (nearest-first, descartando os já visitados), confirmam o núcleo pela leitura `core` da visão, **avisam o time** (`core_<x>_<y>` via `message_to_team`) e convergem para o strike — com hipótese posicional publicada em `debug.hypotheses`.
- **Cota de pulsos respeitada**: todos os bots que pulsam (courier, trickster, hunter) checam `objective.pulses_left` antes do `pulse_scan` — no Silent Hunt param exatamente na cota.
- Quita os dois débitos da Sprint 8 (bot de cerco e exposição da cota).

### Protocolo 0.5.0
- `objective.pulses_left` (opcional): pulsos restantes da unidade quando o modo limita (`maxPulsesPerMatch > 0`). Campo derivado — estado e golden replays inalterados.

### Torneio Temporada 2
- `MatchResult.mode` persistido; `match_start` informa o modo real.
- `tournament --modes data_run,core_siege,silent_hunt`: round-robin dos 4 bots em CADA modo — **72 partidas ao vivo (24 por modo), zero divergência de replay**, em ~184 s acelerado.
- Classificação (pontos/Elo agregados nos três modos): 1º trickster 123,8 · 2º ghost 110,4 · 3º courier 89,2 · 4º hunter 13,2 — 17 partidas de cerco terminaram em `core_destroyed`.
- `/matches` ganhou a coluna **MODO**; replays de cerco assistíveis no viewer (núcleos sorteados desenhados do estado, verificação de hash no browser confirmada num replay de cerco).
- Replays g5/g6 da Temporada 1 removidos do site (movidos para `apps/web/public/_to_delete` no disco — apague a pasta).

## Débitos / Próximos
- O hunter segue sem jogar objetivo em data_run (13,2 pts) — candidato a aposentadoria do roster ranqueado ou upgrade.
- Herdados: npm publish do SDK, sandbox Docker, rate limit por IP.

## Retro
O investimento das sprints anteriores compôs: a rotina de cerco reutiliza a leitura `core` (S8), as mensagens de time (S2), o `hypotheses` (S7) e o `pulses_left` só existiu porque o protocolo é versionado desde a S0 — nenhuma peça precisou ser retrabalhada para os bots virarem multi-modo em uma sprint curta.
