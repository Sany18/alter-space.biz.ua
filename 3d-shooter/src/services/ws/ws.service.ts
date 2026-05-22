import { LocalStorageService } from '../localstorage/localstorage.service';

export type WsIncomingMessage =
  | { type: 'init'; id: string };

type MessageHandler<T extends WsIncomingMessage = WsIncomingMessage> = (msg: T) => void;

class WsServiceClass {
  private socket: WebSocket | null = null;
  private handlers = new Map<string, MessageHandler<any>>();
  private url: string | null = null;

  /** Persistent across page reloads — generated once and stored in localStorage. */
  clientId: string = (() => {
    const stored = LocalStorageService.get('client-id');
    if (stored) return stored;
    const id = crypto.randomUUID();
    LocalStorageService.set('client-id', id);
    return id;
  })();

  connect(url: string = __APP_WS_URL__) {
    if (this.socket?.readyState === WebSocket.OPEN) return;

    this.url = url;
    this.socket = new WebSocket(url);

    this.socket.addEventListener('open', () => {
      console.log('[WsService] Connected to', url);
      // Claim the persistent client ID so the server associates it with this socket
      this.socket!.send(JSON.stringify({ type: 'hello', id: this.clientId }));
    });

    this.socket.addEventListener('message', (event: MessageEvent<string>) => {
      let msg: WsIncomingMessage;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      if (msg.type === 'init') {
        console.log('[WsService] ID confirmed by server:', msg.id);
      }

      this.handlers.get(msg.type)?.(msg);
    });

    this.socket.addEventListener('close', () => {
      this.socket = null;
      console.log('[WsService] Disconnected');
      if (this.url) {
        console.log('[WsService] Reconnecting in 3s...');
        setTimeout(() => this.connect(this.url!), 3000);
      }
    });

    this.socket.addEventListener('error', () => {
      console.error('[WsService] Connection error');
    });
  }

  disconnect() {
    this.url = null; // prevent auto-reconnect
    this.socket?.close();
    this.socket = null;
    // clientId is intentionally kept — it is persistent
  }

  on<T extends WsIncomingMessage>(type: T['type'], handler: MessageHandler<T>) {
    this.handlers.set(type, handler as MessageHandler<any>);
  }

  off(type: string) {
    this.handlers.delete(type);
  }

  send(data: object) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
    }
  }
}

export const WsService = new WsServiceClass();
