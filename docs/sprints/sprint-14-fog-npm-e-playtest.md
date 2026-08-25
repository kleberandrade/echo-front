# Sprint 14 — Fog com Envelhecimento, Prontos pro npm e Guia de Playtest

**Duração:** curta (três débitos herdados, quitados juntos por pedido explícito) · **Meta:** fechar os três últimos itens deixados conscientemente em aberto nas sprints 4, 7 e 10: fog sem memória, pacotes nunca publicados no npm, e nenhum playtest com gente de fora do projeto.

**Status: ✅ concluída em 2026-08-25** (fog e npm — código, testes, docs). Playtest com leigos **não pode ser fechado por mim**: exige testadores humanos reais, fora do meu alcance nesta sessão — o que dá pra fazer é deixar um roteiro pronto pra rodar (ver `docs/10-guia-playtest.md`).

## 1. Fog com envelhecimento (débito da sprint-04)

**O problema:** `buildPerception` (`packages/sim/src/sensors.ts`) sempre foi uma função DERIVADA — lê o estado, não guarda nada. `sensors.visual` só reportava quem está visível **agora**; perder um inimigo de vista apagava qualquer rastro dele no próximo ciclo, mesmo que a unidade "devesse lembrar" onde o viu por último. Isso empobrecia o jogo de percepção que é a proposta central do projeto: sem memória, não existe a decisão "ainda vou na direção que vi ele pela última vez, ou desisto?".

**A correção:**

- `Unit` ganha `knownEnemies: EnemyMemory[]` (`packages/sim/src/types.ts`) — última posição vista de cada inimigo (unidade/decoy/núcleo), atualizada todo ciclo em `step.ts` (mesmo bloco que já atualizava `lastAllies`, mesmo padrão).
- `currentlyVisibleTargets` (novo, `packages/sim/src/geometry.ts` — módulo já compartilhado entre `step.ts` e `sensors.ts`, evita import circular) calcula, com identidade verdadeira, quem está no cone/LOS de uma unidade agora; usado tanto pra atualizar a memória quanto pra excluir da leitura exposta quem já está em `sensors.visual`.
- Memória expira depois de `cfg.sensors.enemyMemoryCycles` ciclos sem reavistamento (padrão 12 = 6 s).
- Exposto ao agente via `sensors.memory` (novo campo, `@echo-front/protocol`): direção/distância recalculadas da posição atual até a posição lembrada; `confidence` decai com `cycles_since_seen`.
- `SIM_VERSION` 0.6.0 → 0.7.0, `PROTOCOL_VERSION` 0.5.0 → 0.6.0 (aditivo — `isCompatibleVersion` só olha o major, então continua compatível).

**Efeito colateral esperado (não é bug):** `Unit` ganhou um campo novo, então o hash canônico de QUALQUER estado mudou — golden replays regenerados (`node dist/cli.js --seed golden-{alpha,beta,gamma} ...`), replay demo do site regenerado, e o torneio amistoso publicado em `apps/web/public/data`/`public/replays` rerodado do zero (108 partidas, 0 divergências). Isso é o mesmo processo já documentado no checklist de release (`docs/08-deploy.md`) pra qualquer sprint que mude o comportamento do sim — só que dessa vez tocou também os dados publicados do torneio amistoso, não só os goldens.

**Verificação:**

- `pnpm -r test`: 109+ testes verdes (protocol, sim com goldens regenerados, agents-sdk, server e2e).
- `pnpm --filter @echo-front/web smoke`: replay demo regenerado, hash reverificado **no browser** (paridade Node×browser), scrub até o fim, placar renderizado — screenshot confirma.
- Reprodução manual do cenário de corrida do sandbox Docker (sprint-13) contra o novo sim: sem regressão.

## 2. Pacotes prontos pro npm (débito da sprint-07)

`protocol`, `sim` e `agents-sdk` nunca tiveram `LICENSE`, `README.md` nem metadados de publish — e eram `"private": true`, o que bloqueia `npm publish` de propósito.

- **`LICENSE`** (MIT, escolhida pelo usuário) na raiz e copiada em cada pacote.
- **`README.md`** por pacote: o que é, instalação, exemplo de uso, link pra doc de referência.
- **`package.json`**: removido `"private": true`; adicionado `description`, `keywords`, `license`, `repository` (com `directory`), `homepage`, `bugs`, `author`, `files` (só `dist`/`README.md`/`LICENSE` no tarball) e `publishConfig: { access: "public" }` (necessário — escopo `@echo-front` é restrito por padrão no npm).
- **Dependência interna**: `sim`/`agents-sdk` continuam com `"@echo-front/protocol": "workspace:*"` no `package.json` do repo — isso é resolvido automaticamente pra um range real (`0.1.0`, a versão publicada) pelo `pnpm publish`, confirmado inspecionando o tarball gerado (`pnpm pack`).
- **`pnpm publish --dry-run --no-git-checks`** rodado nos três pacotes: tarball limpo (só `dist/README.md/LICENSE/package.json`), sem arquivos supérfluos.

**Debitado de propósito — não fiz:** rodar o `npm publish` de verdade. Publicar no npm é uma versão que não pode ser removida do registro (só "unpublish" dentro de 72h, com restrições) e exige estar autenticado com a conta/organização npm do usuário — decisão e credencial que só cabem a ele. Os três pacotes estão prontos; falta só rodar, na ordem (`protocol` → `sim` → `agents-sdk`, por causa da dependência):

```bash
cd packages/protocol && npm login   # se ainda não estiver logado
pnpm publish --no-git-checks
cd ../sim && pnpm publish --no-git-checks
cd ../agents-sdk && pnpm publish --no-git-checks
```

## 3. Playtest com gente de fora do projeto (débito da sprint-10)

Isso não é algo que dá pra "implementar" — precisa de pessoas reais jogando. O que ficou pronto: **`docs/10-guia-playtest.md`**, um roteiro autocontido (o que preparar, como recrutar 3-5 pessoas, roteiro de sessão de ~30 min, perguntas-chave, o que fazer com o feedback) pra rodar quando o usuário tiver disponibilidade — sem exigir que eu esteja presente na sessão.

## Débitos / Próximos

- **Playtest em si**: agendar e rodar (guia pronto em `docs/10-guia-playtest.md`).
- **`npm publish`**: rodar os três comandos acima quando o usuário decidir (não depende de mais nenhum trabalho técnico).
- Nenhum débito técnico novo introduzido por esta sprint.

## Retro

Os três itens tinham motivos bem diferentes pra estarem represados: fog era trabalho de engine que exigia parar pra desenhar direito (evitar import circular, decidir o que conta como "memória" vs. leitura ao vivo, aceitar o custo de invalidar todo replay existente); npm era só burocracia de metadados que nunca "doía" o suficiente pra priorizar; playtest é o único dos três que não é trabalho de código — é o lembrete de que nem todo débito técnico se resolve escrevendo mais código.
