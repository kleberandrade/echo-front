# echo_front_agent_sdk

SDK Dart para escrever agentes do [ECHO//FRONT](https://github.com/kleberandrade/echo-front) —
conecta via WebSocket, faz o handshake do protocolo e chama sua função de
decisão a cada percepção recebida. Equivalente ao
[`@echo-front/agents-sdk`](https://www.npmjs.com/package/@echo-front/agents-sdk)
(TypeScript) e ao
[`echo-front-agent-sdk`](https://pypi.org/project/echo-front-agent-sdk/)
(Python), pra quem prefere Dart — incluindo pra agentes escritos em Flutter.

## Instalação

```bash
dart pub add echo_front_agent_sdk
```

## Uso

```dart
import 'package:echo_front_agent_sdk/echo_front_agent_sdk.dart';

Decision? decide(String unitId, Perception perception) {
  // perception['sensors']['visual' | 'thermal' | 'sound' | 'radar' | 'memory']
  // — ver docs/04-protocolo-agente.md
  final sound = (perception['sensors']['sound'] as List).cast<Map<String, dynamic>>()
    ..sort((a, b) => (b['intensity'] as num).compareTo(a['intensity'] as num));
  if (sound.isNotEmpty && (sound.first['intensity'] as num) > 0.2) {
    return {
      'movement': {'direction': sound.first['direction'], 'speed': 0.8},
    };
  }
  return {
    'movement': {'direction': 0, 'speed': 0.5},
  };
}

Future<void> main() async {
  final agent = Agent(AgentOptions(
    url: 'ws://localhost:3001/agent',
    agentName: 'meu-bot',
    onPerception: decide,
  ));
  await agent.connect(); // roda até a partida terminar (ou a conexão cair)
}
```

`onPerception` pode devolver um `Decision` diretamente ou um
`Future<Decision?>` — o SDK aguarda automaticamente os dois casos. Devolva
`null` pra deixar a unidade em no-op naquele ciclo.

### Reconexão

Por padrão uma queda de conexão simplesmente termina `connect()` — igual aos
SDKs TypeScript e Python. Pra sobreviver a instabilidade de rede ou a um
orquestrador que ainda não subiu, ligue `reconnect: true`:

```dart
final agent = Agent(AgentOptions(
  url: 'ws://localhost:3001/agent',
  agentName: 'meu-bot',
  onPerception: decide,
  reconnect: true, // backoff linear: 1s, 2s, 3s... até um teto de 5s
  reconnectMaxAttempts: 30,
));
```

`connect()` nunca reconecta depois de um `match_end` recebido — isso não é
uma falha, é o fim normal da partida.

## Diferença em relação aos SDKs TypeScript e Python

No cliente TS, `connect()` resolve assim que o handshake é enviado e o resto
roda em background via eventos do `ws`. Aqui — como no SDK Python — a
`Future` de `connect()` só completa quando a sessão (ou, com
`reconnect: true`, todas as tentativas de reconexão) se encerra. Se precisar
continuar fazendo outra coisa em paralelo, não dê `await` nela diretamente:

```dart
unawaited(agent.connect());
```

## Documentação

Guia completo pra escrever um agente (protocolo, sensores, exemplos
comentados): [`docs/04-protocolo-agente.md`](https://github.com/kleberandrade/echo-front/blob/main/docs/04-protocolo-agente.md).
Guia do competidor (como validar e conectar, séries ranqueadas, pontuação):
a página [`/compete`](https://echo-front.vercel.app/compete) do site.

Este SDK não replica os schemas de validação do protocolo (isso fica a
cargo do `@echo-front/protocol`, em TypeScript) — percepções e decisões
trafegam como `Map<String, dynamic>` puro; o servidor valida cada decisão
enviada e responde com um `error` (`code: invalid_payload`) se o payload não
bater com o schema.

## Desenvolvimento

```bash
dart pub get
dart test
dart analyze
```

## Licença

MIT — ver [LICENSE](./LICENSE).
