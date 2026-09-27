// AppBey WebSocket Hub
class WebSocketHub {
  constructor() {
    this.socket = null;
    this.tournamentId = null;
    this.listeners = {};
    this.reconnectTimer = null;
    this.connectionId = 0;
    this.reconnectAttempts = 0;
    this.hasConnected = false;
    window.addEventListener("online", () => this.reconnectWhenOnline());
    window.addEventListener("offline", () => {
      this.emitNetworkStatus("offline");
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
    });
  }

  connect(tournamentId = null) {
    const connectionId = ++this.connectionId;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      try {
        this.socket.onclose = null;
        this.socket.close();
      } catch (_err) {
        // Ignore socket closure errors during reconnection (SonarQube S2486)
      }
    }

    this.tournamentId = tournamentId;
    if (!navigator.onLine) {
      this.emitNetworkStatus("offline");
      return;
    }
    const configuredBase = String(window.APPBEY_CONFIG?.wsBaseUrl || "").replace(/\/+$/, "");
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const path = tournamentId ? `/ws/tournaments/${tournamentId}` : `/ws/global`;
    const url = configuredBase ? `${configuredBase}${path}` : `${protocol}//${host}${path}`;

    try {
      this.socket = new WebSocket(url);

      this.socket.onopen = () => {
        console.log("WebSocket connected:", path);
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
        this.reconnectAttempts = 0;
        this.emitNetworkStatus("online");
        if (this.hasConnected) this.emit("reconnected");
        this.hasConnected = true;
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
        if (connectionId !== this.connectionId) return;
        this.scheduleReconnect(connectionId);
      };

      this.socket.onerror = (err) => {
        console.log("WebSocket error:", err);
      };
    } catch (e) {
      console.log("Failed to initialize WebSocket:", e);
      this.scheduleReconnect(connectionId);
    }
  }

  scheduleReconnect(connectionId) {
    if (connectionId !== this.connectionId || !navigator.onLine || this.reconnectTimer) return;
    const delay = Math.min(1000 * (2 ** this.reconnectAttempts), 30000);
    const jitter = Math.random() * delay * 0.25;
    this.reconnectAttempts += 1;
    this.emitNetworkStatus("reconnecting");
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (connectionId === this.connectionId) this.connect(this.tournamentId);
    }, delay + jitter);
  }

  reconnectWhenOnline() {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.emitNetworkStatus("online");
      return;
    }
    this.emitNetworkStatus("reconnecting");
    if (!this.tournamentId) return;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.connect(this.tournamentId);
  }

  emitNetworkStatus(status) {
    window.dispatchEvent(new CustomEvent("appbey-network-status", { detail: { status } }));
  }

  on(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  off(event, callback) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  clear(event = null) {
    if (event) {
      delete this.listeners[event];
    } else {
      this.listeners = {};
      this.disconnect();
    }
  }

  disconnect() {
    this.connectionId += 1;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.onclose = null;
      this.socket.close();
      this.socket = null;
    }
    this.tournamentId = null;
    this.reconnectAttempts = 0;
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
