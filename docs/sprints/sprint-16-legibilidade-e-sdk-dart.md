# Sprint 16 — Legibilidade das Tabelas em /compete e SDK Dart

**Duração:** curta (dois pedidos pontuais do usuário) · **Meta:** corrigir a legibilidade das tabelas de `/compete` (o grid de fundo do site brigava com o texto) e adicionar um terceiro SDK oficial, em Dart, ao lado do TypeScript e do Python.

**Status: ✅ concluída em 2026-08-26** — código e docs prontos; **débito consciente**: os testes do SDK Dart não puderam ser executados nesta sessão (ver seção 2).

## 1. Legibilidade das tabelas em /compete

**O problema:** `body` tem a classe `grid-bg` (`apps/web/app/globals.css`) — um grid de linhas ciano bem sutil (`rgba(34, 211, 238, 0.05)`) aplicado ao site inteiro, parte da identidade visual. As tabelas de `/compete` (`DataTable`, e a tabela de sensores na seção 8) não tinham fundo próprio — eram transparentes, então o grid aparecia por trás do texto (principalmente as células em `text-slate-400`/`text-slate-500`, mais apagadas), atrapalhando a leitura.

**A correção:** as duas tabelas ganharam `bg-black/50` — a mesma classe que o bloco `<Code>` (exemplos TypeScript/Python/Dart) já usava, então o tratamento visual fica consistente com o resto da página em vez de introduzir um estilo novo. Confirmado visualmente com um screenshot do Chromium antes/depois — grid e texto param de brigar, sem perder o efeito do grid nas áreas ao redor.

## 2. SDK Dart (`packages/agents-sdk-dart`, `echo_front_agent_sdk`)

Terceiro SDK oficial, ao lado do `@echo-front/agents-sdk` (TypeScript) e do `echo-front-agent-sdk` (Python, sprint-14) — mesmo protocolo (`docs/04-protocolo-agente.md`, v0.6.0), pensado inclusive pra agentes em Flutter.

- **`Agent`/`AgentOptions`** (`lib/src/agent.dart`): handshake (`hello`/`welcome`), callback `onPerception` (síncrono ou `Future`), `onWelcome`/`onMessage`/`onClose`, reconexão opcional (`reconnect: true`) com o mesmo backoff linear dos outros dois SDKs (1s, 2s, 3s... teto de 5s, desiste após 30 tentativas, nunca reconecta depois de `match_end`).
- Usa `package:web_socket_channel` (`WebSocketChannel.connect`), universal — funciona tanto em Dart puro (VM/AOT) quanto em Flutter web/mobile/desktop.
- Segue o mesmo modelo do SDK Python (não o TypeScript): `connect()` é uma `Future` que só completa quando a sessão — ou, com `reconnect: true`, todas as tentativas — termina, em vez de resolver assim que o handshake é enviado. Documentado explicitamente no README e no doc comment da biblioteca, com o mesmo aviso de "rode com `unawaited()` se precisar continuar fazendo outra coisa em paralelo".
- Testes (`test/agent_test.dart`) espelham a mesma bateria do SDK Python (`test_agent.py`): handshake + decisão ida-e-volta, `onPerception` assíncrono aguardado corretamente, no-op quando devolve `null`, mensagem malformada é ignorada, reconexão desiste após o máximo de tentativas, `close()` interrompe o loop de reconexão. Servidor fake local via `dart:io` (`HttpServer` + `WebSocketTransformer`) e `package:async` (`StreamQueue`) pra sequenciar as trocas de mensagem, sem depender do `apps/server` real.
- `/compete` ganhou um terceiro bloco de exemplo (`DART_EXAMPLE`) ao lado do TypeScript e do Python, e o texto da seção de erros/reconexão passou a citar os "três SDKs oficiais".

### Débito consciente: testes não executados nesta sessão

O ambiente desta sessão (sandbox na nuvem + a ponte com o dispositivo do usuário) não tem o Dart SDK instalado, e não há acesso de rede pra baixá-lo (`storage.googleapis.com`, de onde o Dart SDK é distribuído, não está liberado). Não deu pra rodar `dart pub get`, `dart test` nem `dart analyze` — diferente dos SDKs TypeScript e Python, cujas suítes passaram de verdade antes de serem publicadas.

O código foi escrito com cuidado redobrado por causa disso: seguindo de perto a estrutura já testada dos SDKs TypeScript e Python (mesma máquina de estados de reconexão, mesmo tratamento de mensagem malformada), e a API do `web_socket_channel` (`WebSocketChannel.connect`, `channel.ready`, `channel.stream`, `channel.sink`) foi conferida contra a documentação oficial do pacote antes de usar, não de memória. Ainda assim, **rodar `dart pub get && dart test && dart analyze` é o primeiro passo antes de publicar** — não fica pendurado em "deveria funcionar".

## Verificação

- `pnpm --filter @echo-front/web typecheck` e `pnpm --filter @echo-front/web build`: verdes.
- Screenshot do Chromium (headless, via Playwright já usado no smoke test) confirmando visualmente a correção das tabelas e o novo bloco de código Dart.
- SDK Dart: revisão manual cuidadosa (balanceamento de chaves/parênteses, tipos, API do `web_socket_channel` contra a doc oficial) — **não** validado por `dart analyze`/`dart test` de verdade (ver débito acima).

## Débitos / Próximos

- Rodar `dart pub get && dart test && dart analyze` em `packages/agents-sdk-dart` assim que possível (máquina do usuário, ou CI) — primeiro passo antes de cogitar `dart pub publish`.
- Igual à sprint-14 com o pacote Python: publicar de verdade (`dart pub publish`) é decisão e credencial do usuário — fora do escopo desta sessão.
