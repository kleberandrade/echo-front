export interface LiveSocket {
  readonly readyState: number;
  onopen: ((event: Event) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  send(data: string): void;
  close(): void;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting';

interface LiveConnectionOptions {
  url: string;
  createSocket?: (url: string) => LiveSocket;
  onStatus: (status: ConnectionStatus) => void;
  onMessage: (data: unknown) => void;
}

function browserSocket(url: string): LiveSocket {
  return new WebSocket(url);
}

/** Each instance owns its socket and timers; closing removes every source of future work. */
class LiveConnection {
  private socket: LiveSocket | undefined;
  private retry: ReturnType<typeof setTimeout> | undefined;
  private keepalive: ReturnType<typeof setInterval> | undefined;
  private retryDelay = 1000;
  private readonly createSocket: (url: string) => LiveSocket;

  constructor(private readonly options: LiveConnectionOptions) {
    const { createSocket = browserSocket } = options;
    this.createSocket = createSocket;
  }

  start(): () => void {
    this.options.onStatus('connecting');
    this.open();
    return () => this.stop();
  }

  private stop(): void {
    clearTimeout(this.retry);
    this.retry = undefined;
    this.releaseSocket();
  }

  private releaseSocket(): void {
    clearInterval(this.keepalive);
    this.keepalive = undefined;
    const previous = this.socket;
    this.socket = undefined;
    if (!previous) return;
    previous.onopen = previous.onclose = previous.onerror = previous.onmessage = null;
    previous.close();
  }

  private reconnect(): void {
    this.releaseSocket();
    this.retry = setTimeout(() => {
      this.retry = undefined;
      this.open();
    }, this.retryDelay);
    this.retryDelay = Math.min(this.retryDelay * 2, 10_000);
    // Allocate first: the status callback can synchronously unmount and stop this lifecycle.
    this.options.onStatus('reconnecting');
  }

  private opened(current: LiveSocket): void {
    if (this.socket !== current) return;
    this.retryDelay = 1000;
    this.keepalive = setInterval(() => this.ping(current), 25_000);
    this.options.onStatus('connected');
  }

  private ping(current: LiveSocket): void {
    if (this.socket !== current || current.readyState !== 1) return;
    try {
      current.send('{"type":"ping"}');
    } catch {
      this.reconnect();
    }
  }

  private failed(current: LiveSocket): void {
    if (this.socket === current) this.reconnect();
  }

  private received(current: LiveSocket, data: unknown): void {
    if (this.socket === current) this.options.onMessage(data);
  }

  private attach(current: LiveSocket): void {
    current.onopen = () => this.opened(current);
    current.onmessage = (event) => this.received(current, event.data);
    current.onclose = current.onerror = () => this.failed(current);
  }

  private open(): void {
    try {
      this.socket = this.createSocket(this.options.url);
      this.attach(this.socket);
    } catch {
      this.reconnect();
    }
  }
}

/** Own one socket at a time; callers stop this lifecycle when their view unmounts. */
export function connectLive(options: LiveConnectionOptions): () => void {
  return new LiveConnection(options).start();
}
