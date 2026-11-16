import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { connectLive, type LiveSocket } from './live-connection';

class FakeSocket implements LiveSocket {
  readyState = 0;
  onopen: LiveSocket['onopen'] = null;
  onclose: LiveSocket['onclose'] = null;
  onerror: LiveSocket['onerror'] = null;
  onmessage: LiveSocket['onmessage'] = null;
  send = vi.fn();
  close = vi.fn(() => {
    this.readyState = 3;
  });

  open() {
    this.readyState = 1;
    this.onopen?.(new Event('open'));
  }
  disconnect() {
    this.readyState = 3;
    this.onclose?.(new CloseEvent('close'));
  }
  message(data: unknown) {
    this.onmessage?.(new MessageEvent('message', { data }));
  }
}

function setup() {
  const sockets: FakeSocket[] = [];
  const onStatus = vi.fn();
  const onMessage = vi.fn();
  const createSocket = vi.fn(() => {
    const socket = new FakeSocket();
    sockets.push(socket);
    return socket;
  });
  const stop = connectLive({
    url: 'wss://arena.example/spectate',
    createSocket,
    onStatus,
    onMessage,
  });
  return { sockets, createSocket, onStatus, onMessage, stop };
}

describe('live spectator connection', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('forwards connection status and server frames without later replacing their status', () => {
    const { sockets, onStatus, onMessage, stop } = setup();
    expect(onStatus).toHaveBeenLastCalledWith('connecting');
    sockets[0]!.open();
    expect(onStatus).toHaveBeenLastCalledWith('connected');
    sockets[0]!.message('server-confirmed match state');
    expect(onMessage).toHaveBeenLastCalledWith('server-confirmed match state');
    onStatus.mockClear();
    vi.advanceTimersByTime(75_000);
    expect(onStatus).not.toHaveBeenCalled();
    stop();
  });

  it('retries cold-start failures with exponential delay capped at ten seconds', () => {
    const { sockets, createSocket, onStatus, stop } = setup();
    for (const delay of [1000, 2000, 4000, 8000, 10_000, 10_000]) {
      sockets.at(-1)!.disconnect();
      expect(onStatus).toHaveBeenLastCalledWith('reconnecting');
      const count = sockets.length;
      vi.advanceTimersByTime(delay - 1);
      expect(createSocket).toHaveBeenCalledTimes(count);
      vi.advanceTimersByTime(1);
      expect(createSocket).toHaveBeenCalledTimes(count + 1);
    }
    stop();
  });

  it('resets the retry delay when the socket successfully opens', () => {
    const { sockets, stop } = setup();
    sockets[0]!.disconnect();
    vi.advanceTimersByTime(1000);
    sockets[1]!.disconnect();
    vi.advanceTimersByTime(2000);
    sockets[2]!.open();
    sockets[2]!.disconnect();
    vi.advanceTimersByTime(1000);
    expect(sockets).toHaveLength(4);
    stop();
  });

  it('sends keepalive every 25 seconds only while OPEN', () => {
    const { sockets, stop } = setup();
    const socket = sockets[0]!;
    vi.advanceTimersByTime(25_000);
    expect(socket.send).not.toHaveBeenCalled();
    socket.open();
    vi.advanceTimersByTime(24_999);
    expect(socket.send).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(socket.send).toHaveBeenCalledWith('{"type":"ping"}');
    socket.readyState = 2;
    vi.advanceTimersByTime(25_000);
    expect(socket.send).toHaveBeenCalledTimes(1);
    stop();
  });

  it('reconnects once after errors even if close fires too', () => {
    const { sockets, createSocket, stop } = setup();
    const socket = sockets[0]!;
    const closed = socket.onclose;
    socket.onerror?.(new Event('error'));
    closed?.(new CloseEvent('close'));
    vi.advanceTimersByTime(1000);
    expect(createSocket).toHaveBeenCalledTimes(2);
    stop();
  });

  it('stops pending retries and ignores queued callbacks from the old socket', () => {
    const { sockets, createSocket, onStatus, onMessage, stop } = setup();
    const socket = sockets[0]!;
    const opened = socket.onopen;
    const message = socket.onmessage;
    socket.disconnect();
    stop();
    onStatus.mockClear();
    opened?.(new Event('open'));
    message?.(new MessageEvent('message', { data: 'late frame' }));
    vi.advanceTimersByTime(60_000);
    expect(createSocket).toHaveBeenCalledTimes(1);
    expect(onStatus).not.toHaveBeenCalled();
    expect(onMessage).not.toHaveBeenCalled();
  });

  it('closes an active connection and clears keepalive on repeated stop', () => {
    const { sockets, createSocket, stop } = setup();
    const socket = sockets[0]!;
    socket.open();
    stop();
    stop();
    vi.advanceTimersByTime(60_000);
    expect(socket.close).toHaveBeenCalledTimes(1);
    expect(socket.send).not.toHaveBeenCalled();
    expect(createSocket).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('retries after a keepalive send fails and ignores a superseded socket', () => {
    const { sockets, createSocket, onMessage, stop } = setup();
    const first = sockets[0]!;
    const lateMessage = first.onmessage;
    first.open();
    first.send.mockImplementationOnce(() => {
      throw new Error('transport closed');
    });
    vi.advanceTimersByTime(25_000);
    expect(first.close).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    expect(createSocket).toHaveBeenCalledTimes(2);
    lateMessage?.(new MessageEvent('message', { data: 'old match' }));
    expect(onMessage).not.toHaveBeenCalled();
    sockets[1]!.open();
    vi.advanceTimersByTime(25_000);
    expect(sockets[1]!.send).toHaveBeenCalledTimes(1);
    stop();
  });

  it('closes a connecting socket without reopening it after unmount', () => {
    const { sockets, createSocket, stop } = setup();
    const socket = sockets[0]!;
    const opened = socket.onopen;
    const closed = socket.onclose;
    stop();
    opened?.(new Event('open'));
    closed?.(new CloseEvent('close'));
    vi.advanceTimersByTime(60_000);
    expect(socket.close).toHaveBeenCalledTimes(1);
    expect(socket.send).not.toHaveBeenCalled();
    expect(createSocket).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('allocates no keepalive after a connected-status callback unmounts the viewer', () => {
    const { sockets, createSocket, onStatus, stop } = setup();
    onStatus.mockImplementation((status) => {
      if (status === 'connected') stop();
    });
    sockets[0]!.open();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(60_000);
    expect(sockets[0]!.send).not.toHaveBeenCalled();
    expect(createSocket).toHaveBeenCalledTimes(1);
  });

  it('allocates no retry after a reconnecting-status callback unmounts the viewer', () => {
    const { sockets, createSocket, onStatus, stop } = setup();
    onStatus.mockImplementation((status) => {
      if (status === 'reconnecting') stop();
    });
    sockets[0]!.disconnect();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(60_000);
    expect(createSocket).toHaveBeenCalledTimes(1);
  });

  it('retries if constructing a connection fails', () => {
    const createSocket = vi
      .fn<() => LiveSocket>()
      .mockImplementationOnce(() => {
        throw new Error('temporarily unavailable');
      })
      .mockImplementation(() => new FakeSocket());
    const stop = connectLive({
      url: 'wss://arena.example',
      createSocket,
      onStatus: vi.fn(),
      onMessage: vi.fn(),
    });
    vi.advanceTimersByTime(1000);
    expect(createSocket).toHaveBeenCalledTimes(2);
    stop();
  });
});
