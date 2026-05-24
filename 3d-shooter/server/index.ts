interface ClientData {
  id: string;       // server-generated socket UUID — unique per WS connection
  clientId: string; // client's persistent localStorage ID — used only for save/restore
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
const playerLastSeen = new Map<string, number>();
const objectStates = new Map<number, ObjectState>();

function encodeObjectUpdate(id: number, s: ObjectState): string {
  const { position: p, quaternion: q, velocity: v, angularVelocity: a, ownerId } = s;
  const f = (n: number) => n.toPrecision(7);
  return `ou,${id},${ownerId},${f(p.x)},${f(p.y)},${f(p.z)},${f(q.x)},${f(q.y)},${f(q.z)},${f(q.w)},${f(v.x)},${f(v.y)},${f(v.z)},${f(a.x)},${f(a.y)},${f(a.z)}`;
}

let serverId: string | null = null;
const connectedClients: string[] = [];

const server = Bun.serve<ClientData>({
  port: Number(Bun.env.SHOOTER_WS_PORT ?? 3001),

  fetch(req, server) {
    if (server.upgrade(req, { data: { id: crypto.randomUUID(), clientId: '', identified: false } })) return;
    return new Response('3D Shooter WS Server', { status: 200 });
  },

  websocket: {
    open(ws) {
      console.log(`[WS] Client connected: ${ws.data.id} (awaiting hello)`);
    },

    message(ws, raw) {
      const str = String(raw);

      // --- CSV fast path for high-frequency messages ---
      if (str.charCodeAt(0) !== 123 /* '{' */) {
        if (!ws.data.identified) return;
        const p = str.split(',');
        const prefix = p[0];

        if (prefix === 'ou') {
          // object_update client→server: ou,id,px,py,pz,qx,qy,qz,qw,vx,vy,vz,avx,avy,avz
          const objId = Number(p[1]);
          objectStates.set(objId, {
            position:        { x: Number(p[2]),  y: Number(p[3]),  z: Number(p[4])  },
            quaternion:      { x: Number(p[5]),  y: Number(p[6]),  z: Number(p[7]),  w: Number(p[8])  },
            velocity:        { x: Number(p[9]),  y: Number(p[10]), z: Number(p[11]) },
            angularVelocity: { x: Number(p[12]), y: Number(p[13]), z: Number(p[14]) },
            ownerId: ws.data.id,
          });
          // server→clients: inject ownerId between id and position
          ws.publish('world', `ou,${objId},${ws.data.id},${p.slice(2).join(',')}`);
          return;
        }

        if (prefix === 'or') {
          // object_release: or,id
          const objId = Number(p[1]);
          const state = objectStates.get(objId);
          if (state) state.ownerId = serverId ?? '';
          server.publish('world', `or,${objId}`);
          return;
        }

        if (prefix === 'pu') {
          // player_update client→server: pu,px,py,pz,rx,ry,rz,rw,crouching,cameraPitch
          onlinePlayers.set(ws.data.id, {
            position: { x: Number(p[1]), y: Number(p[2]), z: Number(p[3]) },
            rotation: { x: Number(p[4]), y: Number(p[5]), z: Number(p[6]), w: Number(p[7]) },
          });
          playerLastSeen.set(ws.data.id, Date.now());
          // server→clients: prepend socketId
          ws.publish('world', `pu,${ws.data.id},${p.slice(1).join(',')}`);
          return;
        }

        return; // unknown CSV prefix
      }

      // --- JSON path for low-frequency control messages ---
      let msg: { type: string; id?: string; state?: PlayerState; [key: string]: any };
      try { msg = JSON.parse(str); } catch { return; }

      if (msg.type === 'hello' && msg.id) {
        // ws.data.id stays as the server-generated socket UUID (unique per connection).
        // ws.data.clientId is the client's persistent localStorage ID used only for
        // position save/restore — multiple tabs on the same machine share this.
        ws.data.clientId = msg.id;
        ws.data.identified = true;
        ws.subscribe('world');
        connectedClients.push(ws.data.id);
        console.log(`[WS] Client identified:   ${ws.data.id} (clientId: ${ws.data.clientId})`);

        // Elect server if none yet; notify others via ws.publish (excludes sender)
        if (!serverId) {
          serverId = ws.data.id;
          console.log(`[WS] Server role assigned: ${serverId}`);
          ws.publish('world', JSON.stringify({ type: 'server_role', serverId }));
        }

        // Send our server-generated socket id so the client can filter its own updates
        ws.send(JSON.stringify({ type: 'init', id: ws.data.id }));
        ws.send(JSON.stringify({ type: 'server_role', serverId }));

        // Send current positions of all online players to the new client
        for (const [id, state] of onlinePlayers) {
          ws.send(JSON.stringify({ type: 'player_update', id, state }));
        }

        // Send latest object states to the new client
        for (const [id, state] of objectStates) {
          ws.send(encodeObjectUpdate(id, state));
        }

        const savedState = playerStates.get(ws.data.clientId);
        if (savedState) {
          ws.send(JSON.stringify({ type: 'position_init', state: savedState }));
          console.log(`[WS] Restored position for: ${ws.data.clientId}`);
        }
        return;
      }

      if (msg.type === 'leave_server' && msg.state && ws.data.identified) {
        playerStates.set(ws.data.clientId, msg.state as PlayerState);
        console.log(`[WS] Saved position for:  ${ws.data.clientId}`);

        onlinePlayers.delete(ws.data.id);
        playerLastSeen.delete(ws.data.id);

        const idx = connectedClients.indexOf(ws.data.id);
        if (idx !== -1) connectedClients.splice(idx, 1);

        if (serverId === ws.data.id) {
          serverId = connectedClients[0] ?? null;
          console.log(`[WS] Server role transferred: ${serverId ?? 'none'}`);
          server.publish('world', JSON.stringify({ type: 'server_role', serverId }));
        }

        if (serverId) {
          for (const [objId, state] of objectStates) {
            if (state.ownerId === ws.data.id) {
              state.ownerId = serverId;
              server.publish('world', encodeObjectUpdate(objId, state));
            }
          }
        }

        server.publish('world', JSON.stringify({ type: 'player_update', id: ws.data.id, state: { deleted: true } }));
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
      if (ws.data.identified && onlinePlayers.has(ws.data.id)) {
        onlinePlayers.delete(ws.data.id);
        playerLastSeen.delete(ws.data.id);

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
              server.publish('world', encodeObjectUpdate(objId, state));
            }
          }
        }

        server.publish('world', JSON.stringify({ type: 'player_update', id: ws.data.id, state: { deleted: true } }));
      }
    },
  },
});

const domain = Bun.env.DOMAIN ?? 'localhost';
console.log(`[WS] Server running on ws://${server.hostname}:${server.port}`);

setInterval(() => {
  const now = Date.now();
  for (const [id, lastSeen] of playerLastSeen) {
    if (now - lastSeen > 3000) {
      console.log(`[WS] Removed stale player: ${id}`);
      onlinePlayers.delete(id);
      playerLastSeen.delete(id);
      server.publish('world', JSON.stringify({ type: 'player_update', id, state: { deleted: true } }));
    }
  }
}, 1000);
