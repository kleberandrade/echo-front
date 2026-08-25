---
description: Convenções da documentação e sprints
alwaysApply: false
paths: docs/**/*.md
---

# docs

- Português no texto. Identificadores de código e protocolo em inglês, com backticks.
- Decisão de design relevante → seção **Decisões** com data (`YYYY-MM-DD`).
- Sprints: critérios de aceite verificáveis. Sem demo reproduzível, o item não está feito.
- Débito consciente na seção **Débitos** da sprint — nada de débito invisível.
- Mudança de comportamento do sim ou do protocolo atualiza o doc no mesmo PR.
- `packages/protocol` vence em caso de divergência com o texto; o doc deve ser corrigido.
