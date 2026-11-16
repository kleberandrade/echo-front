## Unreleased

- Bound retries after clean disconnects, as well as failed connections.
- Ignore malformed perception envelopes before invoking callbacks.
- Add an executable runner example and reproducible development documentation.
- Update compatible dependencies and require Dart 3.11 or newer.
- Close test WebSockets after each handler to make lifecycle tests terminate.

## 0.1.0

- Initial `Agent` and `AgentOptions`, handshake, perception/welcome/message/close
  callbacks, and optional linear-backoff reconnection, matching the TypeScript
  and Python SDKs.
