// AppBey WebSocket Hub
class WebSocketHub {
  constructor() {
    this.socket = null;
    this.tournamentId = null;
    this.listeners = {};
    this.reconnectTimer = null;
  }

  connect(tournamentId = null) {
    if (this.socket) {
      try {
        this.socket.close();
      } catch (_err) {
        // Ignore socket closure errors during reconnection (SonarQube S2486)
      }
    }

    this.tournamentId = tournamentId;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const path = tournamentId ? `/ws/tournaments/${tournamentId}` : `/ws/global`;
    const url = `${protocol}//${host}${path}`;

    try {
      this.socket = new WebSocket(url);

      this.socket.onopen = () => {
        console.log("WebSocket connected:", path);
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      };

      this.socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          this.emit(payload.event, payload.data);
          this.emit("*", payload);
        } catch (err) {
          console.log("WS message parse error:", err);
        }
      };

      this.socket.onclose = () => {
        console.log("WebSocket closed, attempting reconnect in 3s...");
        this.reconnectTimer = setTimeout(() => this.connect(this.tournamentId), 3000);
      };

      this.socket.onerror = (err) => {
        console.log("WebSocket error:", err);
      };
    } catch (e) {
      console.log("Failed to initialize WebSocket:", e);
    }
  }

  on(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  off(event, callback) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => {
        try { cb(data); } catch(e) { console.error("WS Listener error:", e); }
      });
    }
  }
}

window.wsHub = new WebSocketHub();
