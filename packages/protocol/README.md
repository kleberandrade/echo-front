# @echo-front/protocol

Canonical Zod schemas and TypeScript types for ECHO//FRONT agent messages, perceptions, decisions and spectator frames. The protocol constant is independent of the npm package version. Agents exchange JSON over WebSocket; schema validation checks external data at the boundary.

## Workspace setup and example

From the repository root:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @echo-front/protocol test
```

Use the local workspace rather than relying on registry publication. After building, run this module from `packages/protocol`:

```js
import { parseAgentMessage, PROTOCOL_VERSION } from './dist/index.js';
const hello = parseAgentMessage({
  v: PROTOCOL_VERSION,
  type: 'hello',
  payload: { agentName: 'example-agent' },
});
console.log(hello.type, hello.v);
```

`parseAgentMessage`, `parseServerMessage` and `parseSpectateMessage` accept an object or JSON string and throw for malformed input. Individual schemas provide `.safeParse()` for callers that want structured errors instead. `DecisionPayloadSchema` checks decision shape; range/energy/ownership rules belong to the simulator/server.

## Compatibility and limitations

`isCompatibleVersion` currently compares major-version strings. Use the current `PROTOCOL_VERSION` and schemas for pre-1.0 clients; shared major zero does not establish semantic equivalence. The mode enum reserves values beyond implemented simulation modes. The spectator schema validates the fields needed by the viewer rather than the entire internal simulator state.

See the [wire protocol](../../docs/04-protocolo-agente.md) for handshake, timing, limits, message lifecycle and trust boundaries.

## License

MIT; see [LICENSE](LICENSE).
