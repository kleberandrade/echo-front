/// ECHO//FRONT — SDK de agentes (Dart).
///
/// Cliente WebSocket do protocolo (docs/04-protocolo-agente.md), equivalente
/// ao `@echo-front/agents-sdk` (TypeScript) e ao `echo-front-agent-sdk`
/// (Python): handshake, callbacks de percepção → decisão, e reconexão
/// opcional com backoff linear (mesmo padrão do SDK Python e do
/// `apps/server/docker/sandbox-agent/agent.mjs`, sprint-13: 1s, 2s, 3s...
/// até um teto de 5s, desistindo depois de um número máximo de tentativas —
/// e nunca reconecta depois de `match_end`, que não é uma falha).
///
/// Igual ao SDK Python, [Agent.connect] é uma `Future` que só completa
/// quando a sessão (ou, com `reconnect: true`, todas as tentativas de
/// reconexão) se encerra — diferente do SDK TypeScript, onde `connect()`
/// resolve assim que o handshake é enviado e o resto roda em background.
/// Rode em paralelo (sem `await`) se precisar continuar fazendo outra coisa:
///
/// ```dart
/// unawaited(agent.connect());
/// ```
library;

import 'dart:async';
import 'dart:convert';

import 'package:web_socket_channel/web_socket_channel.dart';

/// Versão do protocolo (docs/04-protocolo-agente.md) — mesma dos outros SDKs.
const String protocolVersion = '0.6.0';

/// Percepção recebida do servidor (`sensors.visual/thermal/sound/radar/memory`
/// — ver docs/04-protocolo-agente.md). Tipo solto de propósito: este SDK não
/// replica os schemas de validação do `@echo-front/protocol` — o servidor já
/// valida cada decisão enviada e devolve `error` (`code: invalid_payload`)
/// se o payload for inválido.
typedef Perception = Map<String, dynamic>;

/// Decisão enviada ao servidor (`movement` + no máximo 1 `action` + `message`
/// opcional pro time — ver docs/04-protocolo-agente.md).
typedef Decision = Map<String, dynamic>;

/// Mensagem crua recebida do servidor, já decodificada de JSON.
typedef ServerMessage = Map<String, dynamic>;

/// Callback de percepção → decisão, chamado a cada `perception` recebida.
/// Devolva um [Decision] pra responder, ou `null` pra deixar a unidade em
/// no-op neste ciclo. Pode ser síncrono ou devolver um `Future`.
typedef PerceptionCallback = FutureOr<Decision?> Function(String unitId, Perception perception);

/// Chamado quando o servidor confirma o handshake (mensagem `welcome`).
typedef WelcomeCallback = FutureOr<void> Function(Map<String, dynamic> welcome);

/// Chamado pra toda mensagem recebida do servidor, antes do despacho por tipo.
typedef MessageCallback = FutureOr<void> Function(ServerMessage message);

/// Chamado quando a conexão fecha (fim da sessão, com ou sem `match_end`).
typedef CloseCallback = FutureOr<void> Function();

/// Opções de conexão de um [Agent].
class AgentOptions {
  const AgentOptions({
    required this.url,
    required this.agentName,
    this.token,
    this.onPerception,
    this.onWelcome,
    this.onMessage,
    this.onClose,
    this.reconnect = false,
    this.reconnectBackoff = const Duration(seconds: 1),
    this.reconnectMaxBackoff = const Duration(seconds: 5),
    this.reconnectMaxAttempts = 30,
  });

  /// URL do WebSocket do server (ex.: `ws://localhost:3001/agent`).
  final String url;

  /// Nome do agente enviado no handshake (`hello`).
  final String agentName;

  /// Token opcional de identidade registrada (via `POST /api/agents`).
  final String? token;

  final PerceptionCallback? onPerception;
  final WelcomeCallback? onWelcome;
  final MessageCallback? onMessage;
  final CloseCallback? onClose;

  /// Reconexão — desligada por padrão (mesmo comportamento dos SDKs
  /// TypeScript e Python: uma queda de conexão simplesmente termina
  /// [Agent.connect]). Ligue pra sobreviver a um orquestrador que ainda não
  /// subiu, ou a uma instabilidade de rede transitória.
  final bool reconnect;

  /// Incremento do backoff linear entre tentativas (padrão 1s: 1s, 2s, 3s...).
  final Duration reconnectBackoff;

  /// Teto do backoff (padrão 5s — a partir da 5ª tentativa, sempre 5s).
  final Duration reconnectMaxBackoff;

  /// Desiste depois deste número de tentativas de reconexão.
  final int reconnectMaxAttempts;
}

/// Cliente WebSocket do protocolo ECHO//FRONT.
class Agent {
  Agent(this._opts);

  final AgentOptions _opts;
  WebSocketChannel? _channel;
  bool _matchEnded = false;
  bool _closing = false;

  /// Conecta, faz o handshake e processa mensagens até a sessão terminar.
  ///
  /// Com `reconnect: true` nas [AgentOptions], ao cair a conexão — e a
  /// partida não tiver terminado com um `match_end` — tenta de novo com
  /// backoff linear até `reconnectMaxAttempts` vezes; só então a `Future`
  /// completa. Com `reconnect: false` (padrão), roda uma sessão só.
  Future<void> connect() async {
    var attempt = 0;
    while (true) {
      attempt += 1;
      try {
        await _runOnce();
        attempt = 0; // sessão terminou de forma limpa (ex.: close() explícito)
      } catch (_) {
        // Conexão perdida (erro de rede, handshake recusado, etc.) — decide
        // abaixo se tenta de novo ou desiste, igual ao SDK Python.
      }

      if (_closing || _matchEnded || !_opts.reconnect) return;
      if (attempt >= _opts.reconnectMaxAttempts) return;

      final backoffMs = _opts.reconnectBackoff.inMilliseconds * attempt;
      final capMs = _opts.reconnectMaxBackoff.inMilliseconds;
      final delayMs = backoffMs > capMs ? capMs : backoffMs;
      await Future<void>.delayed(Duration(milliseconds: delayMs));
    }
  }

  Future<void> _runOnce() async {
    final channel = WebSocketChannel.connect(Uri.parse(_opts.url));
    _channel = channel;
    try {
      await channel.ready;
      channel.sink.add(jsonEncode({
        'v': protocolVersion,
        'type': 'hello',
        'payload': {'agentName': _opts.agentName, 'token': _opts.token},
      }));

      await for (final raw in channel.stream) {
        await _handleMessage(raw);
      }
    } finally {
      _channel = null;
      final onClose = _opts.onClose;
      if (onClose != null) await onClose();
    }
  }

  Future<void> _handleMessage(dynamic raw) async {
    if (raw is! String) return; // servidor só manda texto; ignora binário
    final Map<String, dynamic> msg;
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! Map<String, dynamic>) return;
      msg = decoded;
    } catch (_) {
      return; // mensagem malformada do servidor: ignora (paridade com os outros SDKs)
    }

    final onMessage = _opts.onMessage;
    if (onMessage != null) await onMessage(msg);

    final type = msg['type'];
    if (type == 'welcome') {
      final onWelcome = _opts.onWelcome;
      final welcome = msg['payload'];
      if (onWelcome != null && welcome is Map<String, dynamic>) {
        await onWelcome(welcome);
      }
    } else if (type == 'perception' && msg['unitId'] != null) {
      final onPerception = _opts.onPerception;
      if (onPerception != null) {
        final unitId = msg['unitId'] as String;
        final perception = (msg['payload'] as Map<String, dynamic>?) ?? const {};
        final decision = await onPerception(unitId, perception);
        if (decision != null) {
          final cycle = (msg['cycle'] as num?)?.toInt() ?? 0;
          sendDecision(unitId, cycle, decision);
        }
      }
    } else if (type == 'match_end') {
      _matchEnded = true;
    }
  }

  /// Envia uma decisão pro servidor. Lança [StateError] se chamado sem
  /// conexão ativa (chame [connect] primeiro).
  void sendDecision(String unitId, int cycle, Decision payload) {
    final channel = _channel;
    if (channel == null) {
      throw StateError('sendDecision chamado sem conexão ativa — chame connect() primeiro.');
    }
    channel.sink.add(jsonEncode({
      'v': protocolVersion,
      'type': 'decision',
      'unitId': unitId,
      'cycle': cycle,
      'payload': payload,
    }));
  }

  /// Fecha a conexão e desliga a reconexão automática, se houver.
  Future<void> close() async {
    _closing = true;
    await _channel?.sink.close();
  }
}
