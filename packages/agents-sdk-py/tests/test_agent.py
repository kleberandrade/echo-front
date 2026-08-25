"""
Testes do Agent contra um servidor WebSocket local fake — sem depender do
apps/server real. Cobre: handshake (hello → welcome), percepção → decisão
(síncrona e async), no-op quando on_perception devolve None, mensagem
malformada é ignorada, e reconexão com backoff quando reconnect=True.
"""

from __future__ import annotations

import asyncio
import json

import pytest
import websockets

from echo_front_agent_sdk import Agent, AgentOptions, PROTOCOL_VERSION


async def _serve(handler):
    server = await websockets.serve(handler, "localhost", 0)
    port = server.sockets[0].getsockname()[1]
    return server, f"ws://localhost:{port}/agent"


@pytest.mark.asyncio
async def test_handshake_and_decision_roundtrip():
    received_hello = {}

    async def handler(ws):
        hello = json.loads(await ws.recv())
        received_hello.update(hello)
        assert hello["type"] == "hello"
        assert hello["v"] == PROTOCOL_VERSION
        assert hello["payload"]["agentName"] == "test-agent"

        await ws.send(json.dumps({"v": PROTOCOL_VERSION, "type": "welcome", "payload": {"matchId": "m1"}}))
        await ws.send(
            json.dumps(
                {
                    "v": PROTOCOL_VERSION,
                    "type": "perception",
                    "cycle": 3,
                    "unitId": "cian_runner_1",
                    "payload": {"sensors": {"sound": []}},
                }
            )
        )

        decision_raw = await ws.recv()
        decision = json.loads(decision_raw)
        assert decision["type"] == "decision"
        assert decision["unitId"] == "cian_runner_1"
        assert decision["cycle"] == 3
        assert decision["payload"]["movement"]["direction"] == 42

        await ws.send(json.dumps({"v": PROTOCOL_VERSION, "type": "match_end", "payload": {}}))

    server, url = await _serve(handler)
    try:
        welcomes = []

        def on_perception(unit_id, perception):
            assert unit_id == "cian_runner_1"
            return {"movement": {"direction": 42, "speed": 1}}

        agent = Agent(
            AgentOptions(
                url=url,
                agent_name="test-agent",
                on_perception=on_perception,
                on_welcome=lambda w: welcomes.append(w),
            )
        )
        await asyncio.wait_for(agent.connect(), timeout=5)
        assert welcomes == [{"matchId": "m1"}]
        assert received_hello["payload"]["agentName"] == "test-agent"
    finally:
        server.close()
        await server.wait_closed()


@pytest.mark.asyncio
async def test_async_on_perception_is_awaited():
    async def handler(ws):
        await ws.recv()  # hello
        await ws.send(
            json.dumps(
                {"v": PROTOCOL_VERSION, "type": "perception", "cycle": 0, "unitId": "u1", "payload": {}}
            )
        )
        decision = json.loads(await ws.recv())
        assert decision["payload"]["debug"] == {"mode": "async"}
        await ws.send(json.dumps({"v": PROTOCOL_VERSION, "type": "match_end", "payload": {}}))

    server, url = await _serve(handler)
    try:

        async def on_perception(unit_id, perception):
            await asyncio.sleep(0)
            return {"debug": {"mode": "async"}}

        agent = Agent(AgentOptions(url=url, agent_name="a", on_perception=on_perception))
        await asyncio.wait_for(agent.connect(), timeout=5)
    finally:
        server.close()
        await server.wait_closed()


@pytest.mark.asyncio
async def test_no_decision_sent_when_on_perception_returns_none():
    async def handler(ws):
        await ws.recv()  # hello
        await ws.send(
            json.dumps(
                {"v": PROTOCOL_VERSION, "type": "perception", "cycle": 0, "unitId": "u1", "payload": {}}
            )
        )
        # nenhuma decisão deve chegar — em vez disso, fecha a partida.
        with pytest.raises(asyncio.TimeoutError):
            await asyncio.wait_for(ws.recv(), timeout=0.3)
        await ws.send(json.dumps({"v": PROTOCOL_VERSION, "type": "match_end", "payload": {}}))

    server, url = await _serve(handler)
    try:
        agent = Agent(AgentOptions(url=url, agent_name="a", on_perception=lambda u, p: None))
        await asyncio.wait_for(agent.connect(), timeout=5)
    finally:
        server.close()
        await server.wait_closed()


@pytest.mark.asyncio
async def test_malformed_message_is_ignored():
    async def handler(ws):
        await ws.recv()  # hello
        await ws.send("isso não é json válido {{{")
        await ws.send(json.dumps({"v": PROTOCOL_VERSION, "type": "match_end", "payload": {}}))

    server, url = await _serve(handler)
    try:
        agent = Agent(AgentOptions(url=url, agent_name="a"))
        await asyncio.wait_for(agent.connect(), timeout=5)  # não deve levantar
    finally:
        server.close()
        await server.wait_closed()


@pytest.mark.asyncio
async def test_reconnect_backoff_gives_up_after_max_attempts():
    # Nenhum servidor escutando nesta porta — toda tentativa de conexão falha.
    agent = Agent(
        AgentOptions(
            url="ws://localhost:1/agent",
            agent_name="a",
            reconnect=True,
            reconnect_backoff_s=0.01,
            reconnect_max_backoff_s=0.02,
            reconnect_max_attempts=3,
        )
    )
    await asyncio.wait_for(agent.connect(), timeout=5)  # desiste sozinho, não trava


@pytest.mark.asyncio
async def test_close_stops_reconnect_loop():
    agent = Agent(
        AgentOptions(
            url="ws://localhost:1/agent",
            agent_name="a",
            reconnect=True,
            reconnect_backoff_s=0.05,
            reconnect_max_attempts=1000,
        )
    )
    task = asyncio.create_task(agent.connect())
    await asyncio.sleep(0.05)
    await agent.close()
    await asyncio.wait_for(task, timeout=5)
