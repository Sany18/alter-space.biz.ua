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

interface Vec3 { x: number; y: number; z: number; }
interface Quat { x: number; y: number; z: number; w: number; }

interface ObjectState {
  position: Vec3;
  quaternion: Quat;
  velocity: Vec3;
  angularVelocity: Vec3;
  ownerId: string;
}

const playerStates = new Map<string, PlayerState>();
const onlinePlayers = new Map<string, OnlinePlayerState>();
const objectStates = new Map<number, ObjectState>();

let serverId: string | null = null;
const connectedClients: string[] = [];

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
      let msg: { type: string; id?: string; state?: PlayerState; [key: string]: any };
      try { msg = JSON.parse(String(raw)); } catch { return; }

      if (msg.type === 'hello' && msg.id) {
        ws.data.id = msg.id;
        ws.data.identified = true;
        ws.subscribe('world');
        connectedClients.push(ws.data.id);
        console.log(`[WS] Client identified:   ${ws.data.id}`);

        // Elect server if none yet; notify others via ws.publish (excludes sender)
        if (!serverId) {
          serverId = ws.data.id;
          console.log(`[WS] Server role assigned: ${serverId}`);
          ws.publish('world', JSON.stringify({ type: 'server_role', serverId }));
        }

        ws.send(JSON.stringify({ type: 'init', id: ws.data.id }));
        ws.send(JSON.stringify({ type: 'server_role', serverId }));

        // Send current positions of all online players to the new client
        for (const [id, state] of onlinePlayers) {
          ws.send(JSON.stringify({ type: 'player_update', id, state }));
        }

        // Send latest object states to the new client
        for (const [id, state] of objectStates) {
          ws.send(JSON.stringify({ type: 'object_update', id, ...state }));
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

      if (msg.type === 'object_update' && ws.data.identified) {
        const objId = msg.id as number;
        const os: ObjectState = {
          position: msg.position as Vec3,
          quaternion: msg.quaternion as Quat,
          velocity: msg.velocity as Vec3,
          angularVelocity: msg.angularVelocity as Vec3,
          ownerId: ws.data.id,
        };
        objectStates.set(objId, os);
        ws.publish('world', JSON.stringify({ type: 'object_update', id: objId, ...os }));
        return;
      }

      if (msg.type === 'object_release' && ws.data.identified) {
        const objId = msg.id as number;
        const state = objectStates.get(objId);
        if (state) state.ownerId = serverId ?? '';
        server.publish('world', JSON.stringify({ type: 'object_release', id: objId }));
        return;
      }

      if (msg.type === 'claim_server' && ws.data.identified) {
        serverId = ws.data.id;
        console.log(`[WS] Server role claimed:  ${serverId}`);
        ws.send(JSON.stringify({ type: 'server_role', serverId }));
        ws.publish('world', JSON.stringify({ type: 'server_role', serverId }));
        return;
      }

      console.log(`[WS] Message from ${ws.data.id}:`, msg);
    },

    close(ws) {
      console.log(`[WS] Client disconnected: ${ws.data.id}`);
      if (ws.data.identified) {
        onlinePlayers.delete(ws.data.id);

        const idx = connectedClients.indexOf(ws.data.id);
        if (idx !== -1) connectedClients.splice(idx, 1);

        // Transfer server role if needed
        if (serverId === ws.data.id) {
          serverId = connectedClients[0] ?? null;
          console.log(`[WS] Server role transferred: ${serverId ?? 'none'}`);
          server.publish('world', JSON.stringify({ type: 'server_role', serverId }));
        }

        // Release objects owned by the disconnected client — new server takes over
        if (serverId) {
          for (const [objId, state] of objectStates) {
            if (state.ownerId === ws.data.id) {
              state.ownerId = serverId;
              server.publish('world', JSON.stringify({ type: 'object_update', id: objId, ...state }));
            }
          }
        }

        server.publish('world', JSON.stringify({ type: 'player_leave', id: ws.data.id }));
      }
    },
  },
});

const domain = Bun.env.DOMAIN ?? 'localhost';
console.log(`[WS] Server running on ws://${domain}:${server.port}`);
