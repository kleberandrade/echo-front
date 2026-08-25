# echo-front-agent-sdk

SDK Python para escrever agentes do [ECHO//FRONT](https://github.com/kleberandrade/echo-front) —
conecta via WebSocket, faz o handshake do protocolo e chama sua função de
decisão a cada percepção recebida. Equivalente ao
[`@echo-front/agents-sdk`](https://www.npmjs.com/package/@echo-front/agents-sdk)
em TypeScript, pra quem prefere Python.

## Instalação

```bash
pip install echo-front-agent-sdk
```

## Uso

```python
import asyncio
from echo_front_agent_sdk import Agent, AgentOptions


def decide(unit_id: str, perception: dict) -> dict | None:
    # perception["sensors"]["visual" | "thermal" | "sound" | "radar" | "memory"]
    # — ver docs/04-protocolo-agente.md
    som = sorted(perception["sensors"]["sound"], key=lambda s: -s["intensity"])
    if som and som[0]["intensity"] > 0.2:
        return {"movement": {"direction": som[0]["direction"], "speed": 0.8}}
    return {"movement": {"direction": 0, "speed": 0.5}}


async def main() -> None:
    agent = Agent(AgentOptions(url="ws://localhost:3001/agent", agent_name="meu-bot", on_perception=decide))
    await agent.connect()  # roda até a partida terminar (ou a conexão cair)


asyncio.run(main())
```

`on_perception` pode ser uma função síncrona (como acima) ou `async def` — o
SDK aguarda automaticamente se for uma coroutine. Retorne `None` (ou nada)
pra deixar a unidade em no-op naquele ciclo.

### Reconexão

Por padrão uma queda de conexão simplesmente termina `connect()` — igual ao
SDK TypeScript. Pra sobreviver a instabilidade de rede ou a um orquestrador
que ainda não subiu (o cenário real que motivou isso no sandbox Docker, ver
`apps/server/docker/sandbox-agent/agent.mjs`), ligue `reconnect=True`:

```python
agent = Agent(AgentOptions(
    url="ws://localhost:3001/agent",
    agent_name="meu-bot",
    on_perception=decide,
    reconnect=True,          # backoff linear: 1s, 2s, 3s... até um teto de 5s
    reconnect_max_attempts=30,
))
```

`connect()` nunca reconecta depois de um `match_end` recebido — isso não é
uma falha, é o fim normal da partida.

## Diferença em relação ao SDK TypeScript

No cliente TS, `connect()` resolve assim que o handshake é enviado e o resto
roda em background via eventos do `ws`. Em Python, o jeito natural do
`asyncio` é uma coroutine que roda até terminar — então aqui `connect()` só
retorna quando a sessão (ou, com `reconnect=True`, todas as tentativas de
reconexão) se encerra. Se precisar continuar fazendo outra coisa em
paralelo, rode como uma task: `asyncio.create_task(agent.connect())`.

## Documentação

Guia completo pra escrever um agente (protocolo, sensores, exemplos
comentados): [`docs/04-protocolo-agente.md`](https://github.com/kleberandrade/echo-front/blob/main/docs/04-protocolo-agente.md).
Guia do competidor (como validar e conectar, séries ranqueadas, pontuação):
a página [`/compete`](https://echo-front.vercel.app/compete) do site.

Este SDK não replica os schemas de validação do protocolo (isso fica a
cargo do `@echo-front/protocol`, em TypeScript) — percepções e decisões
trafegam como `dict` puro; o servidor valida cada decisão enviada e responde
com um `error` (`code: invalid_payload`) se o payload não bater com o
schema.

## Desenvolvimento

```bash
pip install -e ".[dev]"
pytest
```

## Licença

MIT — ver [LICENSE](./LICENSE).
