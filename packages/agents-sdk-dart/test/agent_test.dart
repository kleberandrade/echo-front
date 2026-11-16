/// Testes do [Agent] contra um servidor WebSocket local fake — sem depender
/// do `apps/server` real. Cobre: handshake (`hello` → `welcome`), percepção
/// → decisão (síncrona e assíncrona), no-op quando `onPerception` devolve
/// `null`, mensagem malformada é ignorada, e reconexão com backoff quando
/// `reconnect: true`. Mesma bateria dos SDKs TypeScript/Python
/// (agent-server e2e / test_agent.py), adaptada pro estilo de teste do Dart.
library;

import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:async/async.dart';
import 'package:echo_front_agent_sdk/echo_front_agent_sdk.dart';
import 'package:test/test.dart';

/// Sobe um servidor WebSocket local numa porta livre e devolve
/// `(server, url)`. `handler` roda uma vez por conexão recebida.
Future<(HttpServer, String)> _serve(
  FutureOr<void> Function(StreamQueue<dynamic> incoming, WebSocket ws) handler,
) async {
  final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
  server.listen((request) async {
    final ws = await WebSocketTransformer.upgrade(request);
    final queue = StreamQueue<dynamic>(ws);
    try {
      await handler(queue, ws);
    } finally {
      await ws.close();
      await queue.cancel();
    }
  });
  final url = 'ws://127.0.0.1:${server.port}/agent';
  return (server, url);
}

void main() {
  test('handshake e decisão vão e voltam certinho', () async {
    final receivedHello = <String, dynamic>{};
    final welcomes = <Map<String, dynamic>>[];

    final (server, url) = await _serve((incoming, ws) async {
      final hello =
          jsonDecode(await incoming.next as String) as Map<String, dynamic>;
      receivedHello.addAll(hello);
      expect(hello['type'], 'hello');
      expect(hello['v'], protocolVersion);
      expect((hello['payload'] as Map)['agentName'], 'test-agent');

      ws.add(
        jsonEncode({
          'v': protocolVersion,
          'type': 'welcome',
          'payload': {'matchId': 'm1'},
        }),
      );
      ws.add(
        jsonEncode({
          'v': protocolVersion,
          'type': 'perception',
          'cycle': 3,
          'unitId': 'cian_runner_1',
          'payload': {
            'sensors': {'sound': []},
          },
        }),
      );

      final decision =
          jsonDecode(await incoming.next as String) as Map<String, dynamic>;
      expect(decision['type'], 'decision');
      expect(decision['unitId'], 'cian_runner_1');
      expect(decision['cycle'], 3);
      expect((decision['payload'] as Map)['movement']['direction'], 42);

      ws.add(
        jsonEncode({'v': protocolVersion, 'type': 'match_end', 'payload': {}}),
      );
    });

    try {
      final agent = Agent(
        AgentOptions(
          url: url,
          agentName: 'test-agent',
          onPerception: (unitId, perception) {
            expect(unitId, 'cian_runner_1');
            return {
              'movement': {'direction': 42, 'speed': 1},
            };
          },
          onWelcome: (w) => welcomes.add(w),
        ),
      );
      await agent.connect().timeout(const Duration(seconds: 5));
      expect(welcomes, [
        {'matchId': 'm1'},
      ]);
      expect((receivedHello['payload'] as Map)['agentName'], 'test-agent');
    } finally {
      await server.close(force: true);
    }
  });

  test('onPerception assíncrono é aguardado', () async {
    final (server, url) = await _serve((incoming, ws) async {
      await incoming.next; // hello
      ws.add(
        jsonEncode({
          'v': protocolVersion,
          'type': 'perception',
          'cycle': 0,
          'unitId': 'u1',
          'payload': {},
        }),
      );
      final decision =
          jsonDecode(await incoming.next as String) as Map<String, dynamic>;
      expect((decision['payload'] as Map)['debug'], {'mode': 'async'});
      ws.add(
        jsonEncode({'v': protocolVersion, 'type': 'match_end', 'payload': {}}),
      );
    });

    try {
      final agent = Agent(
        AgentOptions(
          url: url,
          agentName: 'a',
          onPerception: (unitId, perception) async {
            await Future<void>.delayed(Duration.zero);
            return {
              'debug': {'mode': 'async'},
            };
          },
        ),
      );
      await agent.connect().timeout(const Duration(seconds: 5));
    } finally {
      await server.close(force: true);
    }
  });

  test('nenhuma decisão é enviada quando onPerception devolve null', () async {
    final (server, url) = await _serve((incoming, ws) async {
      await incoming.next; // hello
      ws.add(
        jsonEncode({
          'v': protocolVersion,
          'type': 'perception',
          'cycle': 0,
          'unitId': 'u1',
          'payload': {},
        }),
      );
      // nenhuma decisão deve chegar — em vez disso, fecha a partida.
      await expectLater(
        incoming.next.timeout(const Duration(milliseconds: 300)),
        throwsA(isA<TimeoutException>()),
      );
      ws.add(
        jsonEncode({'v': protocolVersion, 'type': 'match_end', 'payload': {}}),
      );
    });

    try {
      final agent = Agent(
        AgentOptions(
          url: url,
          agentName: 'a',
          onPerception: (unitId, perception) => null,
        ),
      );
      await agent.connect().timeout(const Duration(seconds: 5));
    } finally {
      await server.close(force: true);
    }
  });

  test('mensagem malformada do servidor é ignorada', () async {
    final (server, url) = await _serve((incoming, ws) async {
      await incoming.next; // hello
      ws.add('isso não é json válido {{{');
      ws.add(
        jsonEncode({'v': protocolVersion, 'type': 'match_end', 'payload': {}}),
      );
    });

    try {
      final agent = Agent(AgentOptions(url: url, agentName: 'a'));
      await agent.connect().timeout(
        const Duration(seconds: 5),
      ); // não deve lançar
    } finally {
      await server.close(force: true);
    }
  });

  test('reconexão com backoff desiste depois do máximo de tentativas', () async {
    // Nenhum servidor escutando nesta porta — toda tentativa de conexão falha.
    final agent = Agent(
      AgentOptions(
        url: 'ws://127.0.0.1:1/agent',
        agentName: 'a',
        reconnect: true,
        reconnectBackoff: const Duration(milliseconds: 10),
        reconnectMaxBackoff: const Duration(milliseconds: 20),
        reconnectMaxAttempts: 3,
      ),
    );
    await agent.connect().timeout(
      const Duration(seconds: 5),
    ); // desiste sozinho, não trava
  });

  test('close() interrompe o loop de reconexão', () async {
    final agent = Agent(
      AgentOptions(
        url: 'ws://127.0.0.1:1/agent',
        agentName: 'a',
        reconnect: true,
        reconnectBackoff: const Duration(milliseconds: 50),
        reconnectMaxAttempts: 1000,
      ),
    );
    final future = agent.connect();
    await Future<void>.delayed(const Duration(milliseconds: 50));
    await agent.close();
    await future.timeout(const Duration(seconds: 5));
  });
  test('clean disconnects exhaust the connection attempt budget', () async {
    var connections = 0;
    final (server, url) = await _serve((incoming, ws) async {
      await incoming.next;
      connections += 1;
    });
    final agent = Agent(
      AgentOptions(
        url: url,
        agentName: 'a',
        reconnect: true,
        reconnectMaxAttempts: 3,
        reconnectBackoff: const Duration(milliseconds: 10),
      ),
    );
    try {
      await agent.connect().timeout(const Duration(seconds: 1));
      expect(connections, 3);
    } finally {
      await agent.close();
      await server.close(force: true);
    }
  });

  test('invalid perception envelopes are ignored before callbacks', () async {
    final messages = <ServerMessage>[];
    final (server, url) = await _serve((incoming, ws) async {
      await incoming.next;
      for (final invalid in [
        null,
        [],
        42,
        {'type': 'perception', 'unitId': 4, 'cycle': 0, 'payload': {}},
        {'type': 'perception', 'unitId': 'u1', 'cycle': -1, 'payload': {}},
        {'type': 'perception', 'unitId': 'u1', 'cycle': 0, 'payload': []},
      ]) {
        ws.add(jsonEncode(invalid));
      }
      ws.add(jsonEncode({'type': 'match_end', 'payload': {}}));
    });
    try {
      final agent = Agent(
        AgentOptions(url: url, agentName: 'a', onMessage: messages.add),
      );
      await agent.connect().timeout(const Duration(seconds: 2));
      expect(messages.map((message) => message['type']), ['match_end']);
    } finally {
      await server.close(force: true);
    }
  });
}
