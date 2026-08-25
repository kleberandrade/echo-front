# 04 — Protocolo do Agente

Contrato entre o simulador e os agentes. Versão do protocolo: **`0.1.0`** (pré-lançamento; breaking changes permitidos até `1.0.0`). Schemas Zod canônicos vivem em `packages/protocol` — este doc é a referência humana.

## Transporte

- **WebSocket**, mensagens JSON UTF-8, uma mensagem por frame.
- Handshake: agente conecta em `wss://<server>/agent?token=...` e envia `hello`; servidor responde `welcome` com `matchId`, `unitIds` controladas, `protocolVersion`, `seedPublic` (hash da semente — a semente real só é publicada após a partida).
- A cada ciclo de decisão o servidor envia **uma percepção por unidade**; o agente tem **350 ms** para responder cada uma. Sem resposta → no-op (mantém movimento anterior, sem ação).

## Envelope

Toda mensagem tem envelope:

```json
{ "v": "0.1.0", "type": "perception", "cycle": 118, "unitId": "cian_runner_1", "payload": {} }
```

Tipos servidor→agente: `welcome`, `perception`, `match_start`, `match_end`, `error`.
Tipos agente→servidor: `hello`, `decision`.

## Percepção (`perception.payload`)

```json
{
  "self": {
    "position": [42, 18],
    "heading": 90,
    "energy": 71,
    "integrity": 86,
    "carrying_fragment": false,
    "signature": "low",
    "class": "runner",
    "cooldowns": { "pulse_scan": 0, "deploy_decoy": 3, "hide": 0 }
  },
  "sensors": {
    "visual": [
      {
        "type": "unit",
        "class_guess": "observer",
        "direction": 83,
        "distance": 21,
        "confidence": 0.9
      },
      { "type": "movement", "direction": 83, "distance": 21, "confidence": 0.5 }
    ],
    "thermal": [{ "intensity": 0.74, "direction": 110 }],
    "sound": [{ "intensity": 0.41, "direction": 270 }],
    "radar": [],
    "memory": [
      {
        "type": "unit",
        "class_guess": "warden",
        "direction": 205,
        "distance": 12,
        "cycles_since_seen": 4,
        "confidence": 0.61
      }
    ]
  },
  "allies": [
    {
      "unitId": "cian_observer_1",
      "position": [38, 22],
      "energy": 55,
      "integrity": 100,
      "carrying_fragment": false
    }
  ],
  "team_messages": [
    { "from": "cian_observer_1", "cycle": 117, "data": "possible_enemy_near_relay_2" }
  ],
  "events": ["relay_2_activated", "communication_interference"],
  "objective": {
    "mode": "data_run",
    "score": { "cian": 1, "magenta": 0 },
    "time_remaining_cycles": 62,
    "known_fragments": [{ "position": [55, 20], "state": "spawned", "confidence": 1.0 }]
  }
}
```

Notas de design:

- **Direções** em graus (0 = leste, sentido anti-horário), **distâncias** em unidades lógicas do mapa.
- `confidence` aparece onde o simulador injeta incerteza; o agente decide se confia.
- `allies` só tem dados completos se a comunicação estiver funcional; sob `communication_interference`, `allies` chega vazio ou defasado.
- Decoys **não são marcados**: um decoy bem construído é indistinguível nas leituras de som/radar. Distinguir é problema do agente.
- `visual` fora do cone/oclusão simplesmente não aparece — ausência de leitura não é ausência de inimigo.
- `memory` (sprint-14, fog com envelhecimento — docs/05-simulacao.md): última posição conhecida de um inimigo que já esteve em `visual` antes mas saiu de vista — não duplica quem já está em `visual` agora. `direction`/`distance` são recalculadas da posição ATUAL da unidade até a posição LEMBRADA (defasada); `confidence` decai com `cycles_since_seen` até a entrada expirar (some da lista, não fica em 0 pra sempre).

## Decisão (`decision.payload`)

```json
{
  "movement": { "direction": 95, "speed": 0.7 },
  "action": "deploy_decoy",
  "target": [55, 20],
  "message_to_team": "possible_enemy_near_relay_2",
  "debug": { "confidence_enemy_behind_tower": 0.72 }
}
```

| Campo                | Obrigatório      | Regras                                                                                                     |
| -------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------- |
| `movement.direction` | não              | graus; omitido = mantém rumo                                                                               |
| `movement.speed`     | não              | 0.0–1.0 (multiplicado pela velocidade da classe); >1.0 é clampado                                          |
| `action`             | não              | uma por ciclo: `pulse_scan` \| `deploy_decoy` \| `hide` \| `speed_boost` \| `strike` \| `pickup` \| `drop` |
| `target`             | se a ação exigir | posição alvo; validada por alcance                                                                         |
| `message_to_team`    | não              | string ≤ 64 bytes; entregue no próximo ciclo se comunicação ok                                             |
| `debug`              | não              | **ignorado pela simulação**; gravado no replay e exibido no espectador ("72% de confiança…")               |

Validação: payloads que falham no schema → `error` + no-op. Ação sem energia suficiente → no-op da ação (movimento ainda vale). Três payloads inválidos consecutivos → aviso; dez → desconexão (a partida segue com a unidade em no-op).

## Eventos globais (`events`)

Strings estáveis, documentadas aqui, ex.: `match_start`, `fragment_spawned`, `fragment_delivered:<team>`, `pulse_scan_detected` (com leitura direcional no sensor `radar`), `relay_<n>_activated`, `communication_interference`, `unit_destroyed:<unitId>`.

## Versionamento e compatibilidade

- SemVer no campo `v`. Servidor rejeita `hello` com major incompatível.
- Aditivo (novos campos opcionais) = minor. Breaking (renomear/remover/alterar semântica) = major.
- `packages/protocol` publica os schemas; o agente de exemplo do `agents-sdk` é o teste de conformidade vivo.

## Decisões

- 2026-08-25 — `debug` como canal de confiança da IA: dá o "replay com nível de confiança" sem afetar a simulação, e sem obrigar ninguém a preenchê-lo.
- 2026-08-25 — Percepção por unidade (não por time): força a comunicação a ser uma escolha com custo, como no design; um "cérebro de time" precisa reconstruir o quadro global a partir de mensagens.
- 2026-08-25 — Semente publicada só após a partida (hash antes): permite verificação sem permitir pré-cálculo do ruído dos sensores.
