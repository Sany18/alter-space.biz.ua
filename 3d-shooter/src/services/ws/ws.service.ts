import { LocalStorageService } from '../localstorage/localstorage.service';

/**
 * CSV wire format for high-frequency messages (≈50% smaller than JSON):
 *   object_update  server→client  ou,{id},{ownerId},{px},{py},{pz},{qx},{qy},{qz},{qw},{vx},{vy},{vz},{avx},{avy},{avz}
 *   object_release                or,{id}
 *   player_update  server→client  pu,{socketId},{px},{py},{pz},{rx},{ry},{rz},{rw},{crouching01},{cameraPitch}
 */
function parseCsvMessage(raw: string): WsIncomingMessage | null {
  const p = raw.split(',');
  switch (p[0]) {
    case 'ou': return {
      type: 'object_update',
      id: Number(p[1]),
      ownerId: p[2],
      position:        { x: Number(p[3]),  y: Number(p[4]),  z: Number(p[5])  },
      quaternion:      { x: Number(p[6]),  y: Number(p[7]),  z: Number(p[8]),  w: Number(p[9])  },
      velocity:        { x: Number(p[10]), y: Number(p[11]), z: Number(p[12]) },
      angularVelocity: { x: Number(p[13]), y: Number(p[14]), z: Number(p[15]) },
    };
    case 'or': return { type: 'object_release', id: Number(p[1]) };
    case 'pu': return {
      type: 'player_update',
      id: p[1],
      state: {
        position: { x: Number(p[2]), y: Number(p[3]), z: Number(p[4]) },
        rotation: { x: Number(p[5]), y: Number(p[6]), z: Number(p[7]), w: Number(p[8]) },
        crouching: p[9] === '1',
        cameraPitch: Number(p[10]),
      },
    };
    default: return null;
  }
}

export interface PlayerPositionState {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
  camera: {
    eulerX: { x: number; y: number; z: number; order: string };
    eulerY: { x: number; y: number; z: number; order: string };
    position: { x: number; y: number; z: number };
  };
}

export interface PlayerUpdateState {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
  crouching?: boolean;
  cameraPitch?: number;
}

export interface Vec3 { x: number; y: number; z: number; }
export interface Quat { x: number; y: number; z: number; w: number; }

export type WsIncomingMessage =
  | { type: 'init'; id: string }
  | { type: 'position_init'; state: PlayerPositionState }
  | { type: 'player_update'; id: string; state: PlayerUpdateState }
  | { type: 'player_leave'; id: string }
  | { type: 'server_role'; serverId: string | null }
  | { type: 'object_update'; id: number; ownerId: string; position: Vec3; quaternion: Quat; velocity: Vec3; angularVelocity: Vec3 }
  | { type: 'object_release'; id: number }
  | { type: 'chat_message'; socketId: string; playerName: string; text: string; timestamp: number }
  | { type: 'chat_history'; messages: Array<{ socketId: string; playerName: string; text: string; timestamp: number }> };

type MessageHandler<T extends WsIncomingMessage = WsIncomingMessage> = (msg: T) => void;

class WsServiceClass {
  private socket: WebSocket | null = null;
  private handlers = new Map<string, MessageHandler<any>>();
  /** Messages received before a handler was registered — replayed on .on() */
  private replayBuffer = new Map<string, WsIncomingMessage>();
  /** Message types that should be buffered for late subscribers */
  private static readonly REPLAY_TYPES = new Set(['chat_history', 'position_init', 'server_role']);
  private url: string | null = null;

  /** Persistent across page reloads — used only for save_position / position_init. */
  clientId: string = (() => {
    const stored = LocalStorageService.get('client-id');
    if (stored) return stored;
    const id = crypto.randomUUID();
    LocalStorageService.set('client-id', id);
    return id;
  })();

  /**
   * Server-assigned socket UUID — unique per WS connection, never shared between
   * tabs even on the same machine. Used to filter out our own player_update messages.
   * Populated when the server sends `init`.
   */
  socketId: string = '';

  connect(url: string = __APP_WS_URL__) {
    if (this.socket?.readyState === WebSocket.OPEN) return;

    this.url = url;
    this.socket = new WebSocket(url);

    this.socket.addEventListener('open', () => {
      console.log('[WsService] Connected to', url);
      // Claim the persistent client ID so the server associates it with this socket
      this.socket!.send(JSON.stringify({
        type: 'hello',
        id: this.clientId,
        playerName: (LocalStorageService.get('player-settings') ?? {}).playerName ?? 'Player',
      }));
    });

    this.socket.addEventListener('message', (event: MessageEvent<string>) => {
      const raw = event.data;
      let msg: WsIncomingMessage;
      if (raw.charCodeAt(0) === 123 /* '{' */) {
        try { msg = JSON.parse(raw); } catch { return; }
      } else {
        const parsed = parseCsvMessage(raw);
        if (!parsed) return;
        msg = parsed;
      }

      if (msg.type === 'init') {
        this.socketId = msg.id;
        console.log('[WsService] Socket ID assigned by server:', this.socketId);
      }

      const handler = this.handlers.get(msg.type);
      if (handler) {
        handler(msg);
      } else if (WsServiceClass.REPLAY_TYPES.has(msg.type)) {
        // No handler yet — buffer so it can be replayed when one registers
        this.replayBuffer.set(msg.type, msg);
      }
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
    // Replay a buffered message of this type if it arrived before registration
    const buffered = this.replayBuffer.get(type);
    if (buffered) {
      this.replayBuffer.delete(type);
      (handler as MessageHandler<any>)(buffered);
    }
  }

  off(type: string) {
    this.handlers.delete(type);
  }

  send(data: object) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
    }
  }

  sendChat(text: string) {
    const trimmed = text.trim().slice(0, 300);
    if (trimmed) this.send({ type: 'chat_message', text: trimmed });
  }

  sendRaw(str: string) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(str);
    }
  }
}

export const WsService = new WsServiceClass();
