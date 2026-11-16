#!/usr/bin/env bash
# Build and validate the real container sandbox. No host ports are required.
# SANDBOX_MATCHES=6 validates the complete default mirrored series (~9 minutes).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
NETWORK="echo-front-tournament"
SERVER_IMAGE="echo-front/server:local"
AGENT_IMAGE="echo-front/sandbox-agent:demo"
ORCH_NAME="echo-front-orchestrator"
EXPECTED_MATCHES="${SANDBOX_MATCHES:-1}"
if [[ ! "$EXPECTED_MATCHES" =~ ^[1-6]$ ]]; then
  echo 'error: SANDBOX_MATCHES must be an integer from 1 to 6.' >&2
  exit 1
fi
MATCH_WAIT_S=$((EXPECTED_MATCHES * 95 + 20))
command -v docker >/dev/null || { echo 'error: Docker is required.' >&2; exit 1; }
command -v node >/dev/null || { echo 'error: Node.js is required.' >&2; exit 1; }
docker info >/dev/null

# Fail closed when reusing a network. Never replace an unrelated network.
if docker network inspect "$NETWORK" >/dev/null 2>&1; then
  if [ "$(docker network inspect "$NETWORK" --format '{{.Internal}}')" != true ]; then
    echo "error: existing network $NETWORK is not internal; refusing to use it." >&2
    exit 1
  fi
else
  docker network create --internal "$NETWORK"
fi

echo '==> removing containers from the previous sandbox run'
docker rm -f "$ORCH_NAME" echo-agent-demo-a echo-agent-demo-b >/dev/null 2>&1 || true

echo '==> building server and agent images'
docker build -f apps/server/Dockerfile -t "$SERVER_IMAGE" .
docker build -t "$AGENT_IMAGE" apps/server/docker/sandbox-agent

echo '==> starting the server on the internal network (no host port published)'
docker run -d --name "$ORCH_NAME" --network "$NETWORK" "$SERVER_IMAGE"

diagnostics() {
  local result=$?
  if [ "$result" -ne 0 ]; then
    echo 'Sandbox failed; containers retained for inspection.' >&2
    for container in "$ORCH_NAME" echo-agent-demo-a echo-agent-demo-b; do
      docker logs --tail 30 "$container" >&2 || true
    done
    echo "Cleanup: docker rm -f $ORCH_NAME echo-agent-demo-a echo-agent-demo-b" >&2
  fi
}
trap diagnostics EXIT

# Internal networks do not guarantee that published ports reach the host.
# Probe the actual server process rather than an unrelated localhost service.
for ((i=0; i<30; i++)); do
  if docker exec "$ORCH_NAME" node -e \
    'fetch("http://127.0.0.1:3001/health").then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))' \
    >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec "$ORCH_NAME" node -e \
  'fetch("http://127.0.0.1:3001/health").then(async r=>{if(!r.ok)throw Error(r.status);console.log(await r.text())}).catch(e=>{console.error(e);process.exit(1)})'

for name in echo-agent-demo-a echo-agent-demo-b; do
  docker run -d --name "$name" --network "$NETWORK" \
    --cpus 1 --memory 512m --pids-limit 128 --cap-drop ALL --security-opt no-new-privileges \
    -e "AGENT_WS_URL=ws://${ORCH_NAME}:3001/agent" -e "AGENT_NAME=$name" "$AGENT_IMAGE"
done

# Verify effective limits and network attachments, not just command arguments.
docker inspect echo-agent-demo-a echo-agent-demo-b | node --input-type=module -e '
import assert from "node:assert/strict";
let input="";
for await (const part of process.stdin) input+=part;
for (const container of JSON.parse(input)) {
  const cfg=container.HostConfig;
  assert.equal(cfg.NanoCpus, 1e9);
  assert.equal(cfg.Memory, 512*1024*1024);
  assert.equal(cfg.PidsLimit, 128);
  assert.ok(cfg.CapDrop.includes("ALL"));
  assert.ok(cfg.SecurityOpt.some(value=>value.startsWith("no-new-privileges")));
  assert.deepEqual(Object.keys(container.NetworkSettings.Networks), ["echo-front-tournament"]);
  assert.equal(Object.keys(cfg.PortBindings ?? {}).length, 0);
}
console.log("Agent resource limits and network attachments verified.");'

# This is a bounded test of one literal external endpoint, not a universal
# security proof. No DNS/proxy failure can produce a false blocked result.
for name in echo-agent-demo-a echo-agent-demo-b; do
  docker exec "$name" node --input-type=module -e '
import net from "node:net";
const socket=net.connect({host:"1.1.1.1",port:443});
socket.setTimeout(3000);
socket.once("connect",()=>{console.error("Unexpected external TCP access");socket.destroy();process.exitCode=1});
socket.once("error",()=>{console.log("External TCP probe blocked");socket.destroy()});
socket.once("timeout",()=>{console.log("External TCP probe timed out (blocked)");socket.destroy()});'
done

echo "==> waiting for $EXPECTED_MATCHES completed game(s), up to $MATCH_WAIT_S polling iterations"
ok=false
for ((i=0; i<MATCH_WAIT_S; i++)); do
  if docker exec -e EXPECTED_MATCHES="$EXPECTED_MATCHES" "$ORCH_NAME" node -e \
    'fetch("http://127.0.0.1:3001/api/matches").then(r=>r.json()).then(d=>process.exit(d.matches.length>=Number(process.env.EXPECTED_MATCHES)?0:1)).catch(()=>process.exit(1))'; then
    ok=true
    break
  fi
  if [ $((i % 15)) -eq 0 ]; then echo "   ...waiting (${i}s)"; fi
  sleep 1
done
[ "$ok" = true ] || { echo 'error: game completion timed out.' >&2; exit 1; }

docker exec -i -e EXPECTED_MATCHES="$EXPECTED_MATCHES" "$ORCH_NAME" \
  node --input-type=module < scripts/verify-sandbox-replays.mjs

echo '==> sandbox passed; removing its three containers'
docker rm -f "$ORCH_NAME" echo-agent-demo-a echo-agent-demo-b >/dev/null
echo "Network $NETWORK retained; remove with: docker network rm $NETWORK"
