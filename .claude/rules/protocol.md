---
description: Contrato Zod do protocolo agente ↔ servidor
alwaysApply: false
paths: packages/protocol/**/*.ts
---

# packages/protocol

Schemas Zod são a fonte canônica. Doc humano: `docs/04-protocolo-agente.md`. Versão em `PROTOCOL_VERSION`.

- Envelope: `{ v, type, cycle?, unitId?, payload }`
- Servidor→agente: `welcome`, `perception`, `match_start`, `match_end`, `error`
- Agente→servidor: `hello`, `decision`
- Campos de protocolo em `snake_case` (`carrying_fragment`, `message_to_team`)
- Direções em graus (0 = leste, anti-horário). `confidence` em `[0, 1]`
- `debug` na decisão é ignorado pela simulação; só vai para o replay/espectador
- Payload inválido → `error` + no-op. Não “consertar” o payload no schema

Versionamento SemVer no campo `v`:

- Aditivo (campo opcional novo) = minor
- Renomear/remover/mudar semântica = major
- Atualizar o doc e fixtures de parse no mesmo PR
