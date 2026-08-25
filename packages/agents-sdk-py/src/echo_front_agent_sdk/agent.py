"""
ECHO//FRONT — SDK de agentes (Python).

Cliente WebSocket do protocolo (docs/04-protocolo-agente.md), equivalente ao
`@echo-front/agents-sdk` em TypeScript: handshake, callbacks de
percepção → decisão, e reconexão opcional com backoff linear (mesmo padrão
já usado em `apps/server/docker/sandbox-agent/agent.mjs`, sprint-13: 1s, 2s,
3s... até um teto de 5s, desistindo depois de um número máximo de
tentativas — e nunca reconecta depois de `match_end`, que não é uma falha).

Diferença deliberada em relação ao cliente TS: lá, `connect()` resolve
assim que o handshake é enviado e o resto roda em background via eventos do
`ws`; aqui, como o modelo natural do asyncio é uma coroutine que roda até
terminar, `connect()` só retorna quando a conexão (ou, com `reconnect=True`,
todas as tentativas de reconexão) se encerra. Rode como uma task
(`asyncio.create_task(agent.connect())`) se precisar continuar fazendo outra
coisa em paralelo.
"""

from __future__ import annotations

import asyncio
import inspect
import json
import logging
from dataclasses import dataclass
from typing import Any, Awaitable, Callable, Optional, Union

import websockets
from websockets.exceptions import ConnectionClosed

PROTOCOL_VERSION = "0.6.0"

# Tipos "soltos" (dict) de propósito: o SDK Python não replica os schemas
# Zod do @echo-front/protocol — o servidor já valida cada decisão enviada e
# devolve `error` (code: invalid_payload) se o payload for inválido. Ver
# docs/04-protocolo-agente.md pro formato exato de percepção/decisão.
Perception = dict[str, Any]
Decision = dict[str, Any]
ServerMessage = dict[str, Any]

MaybeAwaitable = Union[None, Awaitable[None]]
PerceptionCallback = Callable[[str, Perception], Union[Optional[Decision], Awaitable[Optional[Decision]]]]
WelcomeCallback = Callable[[dict], MaybeAwaitable]
MessageCallback = Callable[[ServerMessage], MaybeAwaitable]
CloseCallback = Callable[[], MaybeAwaitable]

logger = logging.getLogger("echo_front_agent_sdk")


@dataclass
class AgentOptions:
    url: str
    agent_name: str
    token: Optional[str] = None

    on_perception: Optional[PerceptionCallback] = None
    """Chamado a cada `perception` recebida. Pode ser síncrono ou `async def`.
    Retorne um dict de decisão pra responder, ou `None`/nada pra deixar a
    unidade em no-op neste ciclo."""

    on_welcome: Optional[WelcomeCallback] = None
    on_message: Optional[MessageCallback] = None
    on_close: Optional[CloseCallback] = None

    # Reconexão — desligada por padrão (mesmo comportamento do SDK TS: uma
    # queda de conexão simplesmente termina `connect()`). Ligue pra
    # sobreviver a um orquestrador que ainda não subiu, ou a uma
    # instabilidade de rede transitória (ver docstring do módulo).
    reconnect: bool = False
    reconnect_backoff_s: float = 1.0
    reconnect_max_backoff_s: float = 5.0
    reconnect_max_attempts: int = 30


class Agent:
    """Cliente WebSocket do protocolo ECHO//FRONT."""

    def __init__(self, opts: AgentOptions) -> None:
        self._opts = opts
        self._ws: Any = None
        self._match_ended = False
        self._closing = False

    async def connect(self) -> None:
        """Conecta, faz o handshake e processa mensagens até a sessão terminar.

        Com `reconnect=True` na criação do Agent, ao cair a conexão — e a
        partida não tiver terminado com um `match_end` — tenta de novo com
        backoff linear até `reconnect_max_attempts` vezes; só então retorna.
        Com `reconnect=False` (padrão), roda uma sessão só.
        """
        attempt = 0
        while True:
            attempt += 1
            try:
                await self._run_once()
                attempt = 0  # sessão terminou de forma limpa (ex.: close() explícito)
            except (ConnectionClosed, OSError) as err:
                logger.warning("conexão perdida: %s", err)

            if self._closing or self._match_ended or not self._opts.reconnect:
                return
            if attempt >= self._opts.reconnect_max_attempts:
                logger.error("desistindo após %d tentativas de conexão.", attempt)
                return

            delay = min(attempt * self._opts.reconnect_backoff_s, self._opts.reconnect_max_backoff_s)
            logger.info(
                "tentando reconectar em %.1fs (tentativa %d/%d)…",
                delay,
                attempt + 1,
                self._opts.reconnect_max_attempts,
            )
            await asyncio.sleep(delay)

    async def _run_once(self) -> None:
        async with websockets.connect(self._opts.url) as ws:
            self._ws = ws
            await ws.send(
                json.dumps(
                    {
                        "v": PROTOCOL_VERSION,
                        "type": "hello",
                        "payload": {"agentName": self._opts.agent_name, "token": self._opts.token},
                    }
                )
            )
            try:
                async for raw in ws:
                    await self._handle_message(raw)
            finally:
                self._ws = None
                await self._maybe_await(self._opts.on_close)

    async def _handle_message(self, raw: "str | bytes") -> None:
        try:
            msg: ServerMessage = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            return  # mensagem malformada do servidor: ignora (paridade com o SDK TS)

        await self._maybe_await(self._opts.on_message, msg)

        msg_type = msg.get("type")
        if msg_type == "welcome":
            await self._maybe_await(self._opts.on_welcome, msg.get("payload"))
        elif msg_type == "perception" and msg.get("unitId") is not None:
            decision = await self._maybe_await(self._opts.on_perception, msg["unitId"], msg.get("payload"))
            if decision:
                await self.send_decision(msg["unitId"], msg.get("cycle", 0), decision)
        elif msg_type == "match_end":
            self._match_ended = True

    async def send_decision(self, unit_id: str, cycle: int, payload: Decision) -> None:
        if self._ws is None:
            raise RuntimeError("send_decision chamado sem conexão ativa — chame connect() primeiro.")
        await self._ws.send(
            json.dumps(
                {
                    "v": PROTOCOL_VERSION,
                    "type": "decision",
                    "unitId": unit_id,
                    "cycle": cycle,
                    "payload": payload,
                }
            )
        )

    async def close(self) -> None:
        """Fecha a conexão e desliga a reconexão automática, se houver."""
        self._closing = True
        if self._ws is not None:
            await self._ws.close()

    @staticmethod
    async def _maybe_await(fn: Optional[Callable[..., Any]], *args: Any) -> Any:
        if fn is None:
            return None
        result = fn(*args)
        if inspect.isawaitable(result):
            return await result
        return result
