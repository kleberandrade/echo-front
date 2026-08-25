# ECHO//FRONT

Leia `AGENTS.md` na raiz. Regras por área em `.claude/rules/`. Subagents em `.claude/agents/`.

- Monorepo pnpm + Turborepo. TypeScript strict. Docs em português; código e protocolo em inglês.
- `packages/sim` é puro e determinístico. Partidas válidas só no `apps/server`.
- `packages/protocol` (Zod) é a fonte canônica do contrato.
- Commits: Conventional Commits. Husky formata o staged e valida a mensagem.

Delegar: `sim-engineer`, `protocol-engineer`, `frontend`, `server`, `reviewer`.
