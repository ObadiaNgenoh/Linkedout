import type { Server } from "http";
import { WebSocketServer, type WebSocket } from "ws";

type RealtimeEvent = {
  type: "feed:new" | "feed:reaction" | "feed:comment" | "message:new" | "presence";
  payload: Record<string, unknown>;
};

const clients = new Set<WebSocket>();

export function attachRealtime(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (socket) => {
    clients.add(socket);
    socket.send(JSON.stringify({ type: "presence", payload: { online: clients.size, mode: "database-backed" } } satisfies RealtimeEvent));

    socket.on("message", (raw) => {
      try {
        const incoming = JSON.parse(String(raw)) as RealtimeEvent;
        if (!incoming?.type || !incoming.payload) return;
        broadcast({ type: incoming.type, payload: { ...incoming.payload, receivedAt: Date.now() } });
      } catch {
        // Ignore malformed prototype events; production validation belongs at the API boundary.
      }
    });

    socket.on("close", () => {
      clients.delete(socket);
      broadcast({ type: "presence", payload: { online: clients.size, mode: "prototype" } });
    });
  });

  return wss;
}

export function broadcast(event: RealtimeEvent) {
  const serialized = JSON.stringify(event);
  for (const client of clients) {
    if (client.readyState === 1) client.send(serialized);
  }
}
