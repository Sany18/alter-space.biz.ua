interface ClientData {
  id: string;
}

const server = Bun.serve<ClientData>({
  port: Number(Bun.env.SHOOTER_WS_PORT ?? 3001),

  fetch(req, server) {
    if (server.upgrade(req, { data: { id: crypto.randomUUID() } })) return;
    return new Response('3D Shooter WS Server', { status: 200 });
  },

  websocket: {
    open(ws) {
      console.log(`[WS] Client connected:    ${ws.data.id} (awaiting hello)`);
    },

    message(ws, raw) {
      let msg: { type: string; id?: string };
      try { msg = JSON.parse(String(raw)); } catch { return; }

      if (msg.type === 'hello' && msg.id) {
        ws.data.id = msg.id;
        console.log(`[WS] Client identified:   ${ws.data.id}`);
        ws.send(JSON.stringify({ type: 'init', id: ws.data.id }));
        return;
      }

      console.log(`[WS] Message from ${ws.data.id}:`, msg);
    },

    close(ws) {
      console.log(`[WS] Client disconnected: ${ws.data.id}`);
    },
  },
});

const domain = Bun.env.DOMAIN ?? 'localhost';
console.log(`[WS] Server running on ws://${domain}:${server.port}`);
