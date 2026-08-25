# 10 — Guia de Playtest (com gente de fora do projeto)

Débito desde a sprint-10: até agora, todo mundo que jogou/assistiu ECHO//FRONT já conhecia o projeto por dentro. Isso esconde problemas óbvios pra quem não sabe o que está acontecendo — é exatamente o que este roteiro serve pra pegar.

## O que preparar antes

- **Build rodando**: `./scripts/start.sh` local (server + web), ou o site publicado, se já houver deploy. Ter `/watch/demo` ou `/replay/demo` prontos como fallback caso a partida ao vivo falhe.
- **2-3 bots de referência já compilados** (`@echo-front/agents-sdk`: `hunterBot`, `wandererBot`, `courierBot`) — o playtester não precisa escrever código pra "jogar"; ele **assiste** uma partida entre bots e tenta entender o que está vendo. (Assistibilidade é o alvo do teste — não a experiência de programar um agente, que é outro tipo de teste, pra depois.)
- **Gravação de tela** (o problema geralmente aparece na cara de quem testa, mas passa despercebido de quem está conduzindo).

## Quem recrutar

3 a 5 pessoas é o suficiente pra achar os problemas mais gritantes (regra geral de teste de usabilidade — depois de ~5 pessoas os achados começam a se repetir). Perfil ideal pra este teste especificamente: **não precisa saber programar** — o objetivo é validar se o jogo se explica sozinho pra um espectador, não se é fácil escrever um bot. Amigos, familiares, colegas de outras áreas servem bem.

## Roteiro de sessão (~30 min por pessoa)

1. **Sem explicação nenhuma (5 min)**: manda a pessoa abrir o site e "entender o que está rolando" sozinha, olhando uma partida ao vivo ou o replay demo. Fique quieto, só observe — anote tudo que ela clica, pergunta, ou onde trava. Isso é o dado mais valioso da sessão.
2. **Pergunta aberta**: "o que você acha que tá acontecendo aqui?" — antes de explicar qualquer coisa. Erros de entendimento aqui = problema de design, não de falta de tutorial.
3. **Explicação rápida (2 min)**: aí sim, explica o conceito (times, fragmentos, sensores imperfeitos, fog).
4. **Segunda observação (10 min)**: deixa a pessoa acompanhar outra partida (ou continuar a mesma) já sabendo as regras — o objetivo agora é ver se a UI (event feed, placar, fog of war, cooldowns) ajuda a acompanhar ou é ruído.
5. **Perguntas guiadas (10 min)** — ver seção abaixo.

## Perguntas-chave (fazer nesta ordem, sem pular)

- Em que momento você entendeu quem tava ganhando?
- Teve algum momento que você perdeu o fio da partida? Qual?
- O que aquele [aponte pra um elemento específico da UI] significa, na sua opinião? (não corrija na hora — anote o que ela responde, mesmo errado)
- Se você tivesse que explicar esse jogo pra outra pessoa em uma frase, o que você diria?
- O que você mudaria primeiro?

## O que fazer com o feedback

- **Padrão que se repete em 2+ pessoas** → vira item de backlog de verdade, não sugestão isolada.
- **Confusão de UI** (não entendeu um elemento visual) é prioridade sobre **confusão de regra** (não entendeu uma mecânica) — UI é mais barato de arrumar e afeta todo mundo, regra é mais estrutural.
- Guarde as gravações — um clipe de 15s de alguém travado numa tela vale mais que uma frase de resumo pra convencer sobre prioridade depois.

## Depois do playtest

Registrar os achados como uma sprint normal (`docs/sprints/`) — o quê foi testado, quantas pessoas, principais achados, o que virou item de backlog e o que foi descartado (com o porquê — nem todo feedback deve virar mudança).
