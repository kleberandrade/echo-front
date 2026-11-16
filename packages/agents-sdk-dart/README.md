# ECHO//FRONT Dart agent SDK

A WebSocket client for the ECHO//FRONT tactical arena. It sends the handshake,
delivers perceptions, and sends decisions returned by your callback. Protocol
version `0.6.0` is shared with the TypeScript and Python SDKs.

## Requirements and installation

Dart 3.11+ (below 4.0), a running ECHO//FRONT server, and access to pub.dev:

```sh
cd packages/agents-sdk-dart
dart pub get
```

For another Dart project, reference this checkout using a path dependency:

```yaml
dependencies:
  echo_front_agent_sdk:
    path: ../echo-front/packages/agents-sdk-dart
```

## Quick start

Start the server with the [root quick start](../../README.md). From this SDK
folder, start two agents in separate terminals:

```sh
dart run example/runner.dart ws://localhost:3001/agent dart-cyan
dart run example/runner.dart ws://localhost:3001/agent dart-magenta
```

The [executable example](example/runner.dart) moves units at half speed; it is a
connection example rather than a competitive strategy. Run it with `--help` for
usage. Public matchmaking waits for a second agent.

## Callback API

```dart
import 'package:echo_front_agent_sdk/echo_front_agent_sdk.dart';

Future<void> main() async {
  final agent = Agent(AgentOptions(
    url: 'ws://localhost:3001/agent',
    agentName: 'my-agent',
    onPerception: (unitId, perception) => {
      'movement': {'direction': 0, 'speed': 0.5},
    },
  ));
  await agent.connect();
}
```

`onPerception(unitId, perception)` can return `Decision?` or `Future<Decision?>`.
Return `null` to send nothing for a cycle. `onWelcome(payload)`,
`onMessage(message)`, and `onClose()` support synchronous or asynchronous callbacks.
The optional `token` identifies a registered agent.

`connect()` completes when the session ends. To run concurrently, use
`unawaited(agent.connect())` with `dart:async`. `close()` shuts down the socket and
prevents retries. Receiving `match_end` suppresses reconnection; the session ends
when the server closes the socket. Callbacks should finish promptly.

## Reconnection, validation, and limitations

Reconnection defaults to false. Enable `reconnect: true` to use linear backoff
(`reconnectBackoff`, default one second), capped by `reconnectMaxBackoff` (five
seconds). `reconnectMaxAttempts` defaults to 30 total connection attempts, including
the first. Clean disconnects also consume the budget. A received `match_end` or
explicit `close()` stops retries.

Malformed JSON, binary frames, and invalid message envelopes are ignored before
callbacks. Perceptions require a nonempty string unit ID, a nonnegative integer
cycle, and an object payload. Complete schema validation belongs to the
TypeScript protocol package and authoritative server; Dart payloads remain
`Map<String, dynamic>`. `sendDecision` without a connection throws `StateError`.
The existing connection loop catches session failures, including callback errors;
use application logging in callbacks when diagnosing failures. The SDK does not
enforce a callback execution deadline or provide an execution sandbox.

## Tests and analysis

```sh
dart pub get
dart analyze
dart test
dart run example/runner.dart --help
```

Tests open real loopback sockets with an in-process server and verify handshake,
synchronous/asynchronous callbacks, no-op, malformed messages, bounded retries,
and shutdown. No running NestJS server is needed; permission to bind local ports
is required. Keep `pubspec.lock` to reproduce the validated development graph.
The browser/Flutter runtime has not been separately tested by these VM tests.

See the [protocol reference](../../docs/04-protocolo-agente.md) for schemas,
sensors, and decisions. Licensed under [MIT](LICENSE), preserving existing authorship.
