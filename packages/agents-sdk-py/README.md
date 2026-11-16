# ECHO//FRONT Python agent SDK

An asyncio WebSocket client for the ECHO//FRONT tactical arena. It sends the
protocol handshake, delivers perceptions to your decision callback, and sends
returned decisions. It shares protocol `0.6.0` with the TypeScript and Dart SDKs.

## Requirements and installation

Python 3.11+ and a running ECHO//FRONT server are required. From the repository root:

```sh
cd packages/agents-sdk-py
python3.13 -m venv .venv
source .venv/bin/activate
python -m pip install -e '.[dev]'
```

Use any supported Python 3.11+ executable when creating the virtual environment.
The SDK uses `websockets >=16,<18`; development uses pytest 9 and pytest-asyncio 1.

## Quick start

Start the server using the [root quick start](../../README.md), then run two
agents in separate terminals (each with the virtual environment activated):

```sh
python examples/runner.py --name python-cyan
python examples/runner.py --name python-magenta
```

The [executable example](examples/runner.py) moves every controlled unit at half
speed. It demonstrates the connection lifecycle rather than a competitive strategy.
Use `--url ws://host:3001/agent` to select another server and `--help` for options.
Public matchmaking requires two agents; one connection waits in the queue.

## Callback API

```python
from echo_front_agent_sdk import Agent, AgentOptions


def decide(unit_id, perception):
    return {"movement": {"direction": 0, "speed": 0.5}}


agent = Agent(AgentOptions(
    url="ws://localhost:3001/agent",
    agent_name="my-agent",
    on_perception=decide,
))
# Inside an async function:
# await agent.connect()
```

`on_perception(unit_id, perception)` may be synchronous or asynchronous. Return a
decision dictionary (including `{}` for an empty decision), or `None` to send
nothing for that cycle. `on_welcome(payload)`, `on_message(message)`, and
`on_close()` also accept synchronous or asynchronous callbacks. `token` in
`AgentOptions` supplies an optional registered agent identity.

`connect()` runs until the WebSocket session ends. Use
`asyncio.create_task(agent.connect())` to run it concurrently. `close()` closes the
socket and prevents further reconnection. A `match_end` suppresses reconnection;
the session returns when the server closes its socket. Callbacks should finish
promptly to avoid delaying later perceptions.

## Reconnection and errors

Reconnection is disabled by default. Enable it with `reconnect=True`. The options
`reconnect_backoff_s=1`, `reconnect_max_backoff_s=5`, and
`reconnect_max_attempts=30` control linear backoff and the total connection attempt
budget, including the initial attempt. Normal disconnects also consume that
budget. A received `match_end` or explicit `close()` stops retries.

Malformed JSON and invalid message envelopes are ignored before callbacks.
Perception envelopes require a nonempty string unit ID, nonnegative integer
cycle, and object payload. This is basic boundary validation: the SDK does not
replicate all Zod schemas. Perceptions and decisions remain plain dictionaries;
the authoritative server validates decision fields. Callback exceptions propagate
to the caller. Sending a decision without a live connection raises `RuntimeError`.

## Development and validation

```sh
python -m pytest -q
python examples/runner.py --help
```

Tests use real loopback WebSocket connections against an in-process server; they
cover handshake, synchronous/asynchronous decisions, no-op, malformed envelopes,
bounded reconnection, and explicit shutdown. They require permission to bind local
ports and do not require the NestJS server. The SDK is not a container sandbox and
does not impose a callback execution timeout.

See the [protocol reference](../../docs/04-protocolo-agente.md) for sensors,
decisions, and message formats. Licensed under [MIT](LICENSE), with existing
authorship preserved.
