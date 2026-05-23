interface ClientData {
  id: string;
  identified: boolean;
}

interface PlayerState {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
  camera: {
    eulerX: { x: number; y: number; z: number; order: string };
    eulerY: { x: number; y: number; z: number; order: string };
    position: { x: number; y: number; z: number };
  };
}

interface OnlinePlayerState {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
}

const playerStates = new Map<string, PlayerState>();
const onlinePlayers = new Map<string, OnlinePlayerState>();

const server = Bun.serve<ClientData>({
  port: Number(Bun.env.SHOOTER_WS_PORT ?? 3001),

  fetch(req, server) {
    if (server.upgrade(req, { data: { id: crypto.randomUUID(), identified: false } })) return;
    return new Response('3D Shooter WS Server', { status: 200 });
  },

  websocket: {
    open(ws) {
      console.log(`[WS] Client connected:    ${ws.data.id} (awaiting hello)`);
    },

    message(ws, raw) {
      let msg: { type: string; id?: string; state?: PlayerState };
      try { msg = JSON.parse(String(raw)); } catch { return; }

      if (msg.type === 'hello' && msg.id) {
        ws.data.id = msg.id;
        ws.data.identified = true;
        ws.subscribe('world');
        console.log(`[WS] Client identified:   ${ws.data.id}`);
        ws.send(JSON.stringify({ type: 'init', id: ws.data.id }));

        // Send current positions of all online players to the new client
        for (const [id, state] of onlinePlayers) {
          ws.send(JSON.stringify({ type: 'player_update', id, state }));
        }

        const savedState = playerStates.get(ws.data.id);
        if (savedState) {
          ws.send(JSON.stringify({ type: 'position_init', state: savedState }));
          console.log(`[WS] Restored position for: ${ws.data.id}`);
        }
        return;
      }

      if (msg.type === 'save_position' && msg.state) {
        playerStates.set(ws.data.id, msg.state as PlayerState);
        console.log(`[WS] Saved position for:  ${ws.data.id}`);
        return;
      }

      if (msg.type === 'player_update' && msg.state && ws.data.identified) {
        onlinePlayers.set(ws.data.id, msg.state as OnlinePlayerState);
        ws.publish('world', JSON.stringify({ type: 'player_update', id: ws.data.id, state: msg.state }));
        return;
      }

      console.log(`[WS] Message from ${ws.data.id}:`, msg);
    },

    close(ws) {
      console.log(`[WS] Client disconnected: ${ws.data.id}`);
      if (ws.data.identified) {
        onlinePlayers.delete(ws.data.id);
        server.publish('world', JSON.stringify({ type: 'player_leave', id: ws.data.id }));
      }
    },
  },
});

const domain = Bun.env.DOMAIN ?? 'localhost';
console.log(`[WS] Server running on ws://${domain}:${server.port}`);
