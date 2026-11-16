# Sandbox agent example

This minimal WebSocket client is an executable reference for the tournament container contract. It depends only on `ws`, so it does not require published ECHO//FRONT packages. `agent.mjs` connects using `AGENT_WS_URL`, identifies itself with `AGENT_NAME` and accepts optional `AGENT_TOKEN`.

## Build and run

From the repository root, with Docker running and registry access:

```bash
docker build -t echo-front/sandbox-agent:demo apps/server/docker/sandbox-agent
./scripts/run-tournament-sandbox.sh
```

The script builds the authoritative server too, creates an internal network and starts two agents. Both agents and the server must be on that same network. The URL is `ws://echo-front-orchestrator:3001/agent`; do not substitute `host.docker.internal`, which is not guaranteed reachable from an internal Docker network.

The orchestrator applies a 1 CPU/512 MB budget, PID limits, dropped capabilities and `no-new-privileges`. The agent opens an outbound WebSocket and publishes no port. The script uses fixed container names, removes previous containers with those names and requires host port 3001. See [competition documentation](../../../../docs/07-campeonato.md) for the full lifecycle and cleanup behavior.

## Validation scope

Command-construction tests verify the flags passed by `ContainerOrchestrator` using a fake command runner. Real Node/WebSocket tests verify protocol behavior. Neither establishes that Docker image pulls, builds, networking or a complete sandbox tournament worked on the current machine. Run the script and retain its actual result when reporting container validation.
