import type http from "http";
import { WebSocket, WebSocketServer } from "ws";

export class RealtimeHub {
  private readonly server: WebSocketServer;
  private readonly globalSockets = new Set<WebSocket>();
  private readonly tournamentSockets = new Map<number, Set<WebSocket>>();
  private readonly liveClients = new WeakSet<WebSocket>();
  private readonly heartbeat: NodeJS.Timeout;

  constructor(server: http.Server) {
    this.server = new WebSocketServer({ noServer: true });

    server.on("upgrade", (request, socket, head) => {
      const url = request.url || "/";
      let pathname: string;
      try {
        pathname = new URL(url, `http://${request.headers.host || "localhost"}`).pathname;
      } catch {
        socket.destroy();
        return;
      }

      if (pathname === "/ws/global" || /^\/ws\/tournaments\/\d+$/.test(pathname)) {
        this.server.handleUpgrade(request, socket, head, (ws) => {
          this.server.emit("connection", ws, request);
        });
      } else {
        socket.destroy();
      }
    });

    this.server.on("connection", (ws: WebSocket, req: http.IncomingMessage) => {
      this.liveClients.add(ws);
      const url = req.url || "/";
      let currentTournamentId: number | null = null;

      if (url.split("?")[0] === "/ws/global") {
        this.globalSockets.add(ws);
      } else if (url.split("?")[0].startsWith("/ws/tournaments/")) {
        const id = Number.parseInt(url.split("?")[0].split("/")[3], 10);
        if (!Number.isNaN(id)) {
          currentTournamentId = id;
          if (!this.tournamentSockets.has(id)) this.tournamentSockets.set(id, new Set());
          this.tournamentSockets.get(id)!.add(ws);
        }
      }

      ws.on("close", () => {
        this.globalSockets.delete(ws);
        if (currentTournamentId && this.tournamentSockets.has(currentTournamentId)) {
          this.tournamentSockets.get(currentTournamentId)!.delete(ws);
        }
      });
      ws.on("message", () => {});
      ws.on("pong", () => this.liveClients.add(ws));
      ws.on("error", (error) => console.error("WebSocket error:", error));
    });

    this.heartbeat = setInterval(() => {
      for (const client of this.server.clients) {
        if (client.readyState !== WebSocket.OPEN) continue;
        if (!this.liveClients.has(client)) {
          client.terminate();
          continue;
        }
        this.liveClients.delete(client);
        client.ping();
      }
    }, 30000);
    this.heartbeat.unref();
  }

  broadcastTournament(tournamentId: number, event: string, data: unknown): void {
    const payload = JSON.stringify({ event, data });
    const sockets = this.tournamentSockets.get(tournamentId);
    if (sockets) {
      for (const ws of sockets) {
        if (ws.readyState === WebSocket.OPEN) ws.send(payload);
      }
    }
    for (const ws of this.globalSockets) {
      if (ws.readyState === WebSocket.OPEN) ws.send(payload);
    }
  }

  closeAll(code: number, reason: string): void {
    for (const client of this.server.clients) client.close(code, reason);
  }

  stopHeartbeat(): void {
    clearInterval(this.heartbeat);
  }
}
