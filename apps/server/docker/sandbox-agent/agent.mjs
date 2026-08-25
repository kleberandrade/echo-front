#!/usr/bin/env node
/**
 * Agente de exemplo para o SANDBOX Docker (sprint-11, docs/07-campeonato.md).
 *
 * Deliberadamente AUTOCONTIDO — sem depender de @echo-front/protocol ou
 * @echo-front/agents-sdk (que não são publicados no npm; ver débito
 * registrado na sprint-10) — só assim a imagem builda com `npm install ws`
 * e nada mais. Qualquer competidor pode usar este arquivo como esqueleto:
 * é a implementação mínima do lado do cliente do protocolo (docs/04).
 *
 * Contrato do container (docs/07-campeonato.md):
 *   - conecta em `AGENT_WS_URL` (env, injetada pelo orquestrador);
 *   - decide em função da PERCEPÇÃO recebida — sem estado global entre
 *     partidas além do que o próprio processo mantiver;
 *   - sem rede externa (a rede Docker do orquestrador é `--internal`).
 */
import WebSocket from 'ws';

// Só o major precisa bater com o servidor (isCompatibleVersion em packages/protocol).
const PROTOCOL_VERSION = '0.6.0';

const WS_URL = process.env.AGENT_WS_URL;
const AGENT_NAME = process.env.AGENT_NAME || 'sandbox-agent';
const AGENT_TOKEN = process.env.AGENT_TOKEN || undefined;

if (!WS_URL) {
  console.error('AGENT_WS_URL não definida — o orquestrador deve injetá-la via `docker run -e`.');
  process.exit(1);
}

/** Wanderer simplificado: foge do que percebe, senão patrulha. Só para provar o contrato. */
function decide(unitId, perception) {
  const visual = perception.sensors.visual[0];
  const threat = visual?.direction;
  if (threat !== undefined) {
    return { movement: { direction: (threat + 180) % 360, speed: 1 }, debug: { mode: 'flee' } };
  }
  let h = 7;
  for (const c of unitId) h = (h * 31 + c.charCodeAt(0)) % 997;
  return { movement: { direction: h % 360, speed: 0.5 }, debug: { mode: 'patrol' } };
}

// Reconexão com backoff: numa disputa real, o container do agente pode subir
// (e tentar conectar) antes do orquestrador estar de pé — visto na prática
// no sandbox Docker (sprint-13): um `ECONNREFUSED` isolado, sem retry, deixa
// o agente permanentemente de fora da partida. `connect()` volta a tentar
// com backoff (1s, 2s, 3s... até um teto de 5s) em vez de desistir na
// primeira falha. Sobe até MAX_ATTEMPTS vezes; depois disso, desiste de vez
// (evita um container preso tentando pra sempre se o orquestrador nunca vier
// a existir).
const MAX_ATTEMPTS = 30;
const MAX_BACKOFF_MS = 5000;
let attempt = 0;
let matchEnded = false;

function connect() {
  attempt += 1;
  const ws = new WebSocket(WS_URL);

  ws.on('open', () => {
    attempt = 0; // conectou — reseta o contador de tentativas pra qualquer reconexão futura
    console.log(`[sandbox-agent] conectado a ${WS_URL} como "${AGENT_NAME}"`);
    ws.send(
      JSON.stringify({
        v: PROTOCOL_VERSION,
        type: 'hello',
        payload: { agentName: AGENT_NAME, token: AGENT_TOKEN },
      }),
    );
  });

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString('utf8'));
    } catch {
      return;
    }
    if (msg.type === 'error') {
      console.error(
        `[sandbox-agent] erro do servidor: ${msg.payload?.code} — ${msg.payload?.message}`,
      );
      return;
    }
    if (msg.type === 'perception' && msg.unitId !== undefined) {
      const decision = decide(msg.unitId, msg.payload);
      ws.send(
        JSON.stringify({
          v: PROTOCOL_VERSION,
          type: 'decision',
          unitId: msg.unitId,
          cycle: msg.cycle ?? 0,
          payload: decision,
        }),
      );
    }
    if (msg.type === 'match_end') {
      matchEnded = true;
      console.log(`[sandbox-agent] partida encerrada: ${JSON.stringify(msg.payload)}`);
    }
  });

  ws.on('close', () => {
    console.log('[sandbox-agent] conexão encerrada.');
    scheduleReconnect();
  });

  ws.on('error', (err) => {
    console.error('[sandbox-agent] erro de conexão:', err.message);
    // 'close' é emitido logo em seguida (mesmo quando a conexão nunca chegou
    // a abrir, como num ECONNREFUSED) — a reconexão fica centralizada lá.
  });
}

function scheduleReconnect() {
  if (matchEnded) return; // partida terminou de verdade — não é uma falha, não reconecta
  if (attempt >= MAX_ATTEMPTS) {
    console.error(`[sandbox-agent] desistindo após ${attempt} tentativas de conexão.`);
    process.exit(1);
  }
  const delayMs = Math.min(attempt * 1000, MAX_BACKOFF_MS);
  console.log(
    `[sandbox-agent] tentando reconectar em ${delayMs}ms (tentativa ${attempt + 1}/${MAX_ATTEMPTS})…`,
  );
  setTimeout(connect, delayMs);
}

connect();
