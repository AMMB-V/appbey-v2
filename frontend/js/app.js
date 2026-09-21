// AppBey Core Application Router & Shell
(function() {
  // --- IN-APP TOAST NOTIFICATION SYSTEM ---
  // Eradicates browser native alerts and the "Suppress dialogs" button permanently
  window.showToast = (message, type = "info", duration = 3500) => {
    let container = document.getElementById("toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "toast-container";
      container.className = "fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-2 max-w-[92vw] w-[420px] pointer-events-none";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `pointer-events-auto transition-all duration-300 transform -translate-y-2 opacity-0 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl backdrop-blur-xl border text-xs sm:text-sm font-semibold w-full ${
      type === "error" ? "bg-rose-950/95 border-rose-500/60 text-rose-200 shadow-rose-950/50" :
      type === "success" ? "bg-emerald-950/95 border-emerald-500/60 text-emerald-200 shadow-emerald-950/50" :
      "bg-slate-900/95 border-cyan-500/50 text-cyan-200 shadow-cyan-950/50"
    }`;

    const icon = type === "error" ? "⚠️" : type === "success" ? "✅" : "⚡";
    toast.innerHTML = `
      <span class="text-base flex-shrink-0">${icon}</span>
      <div class="flex-1 leading-snug break-words">${message}</div>
      <button class="text-slate-400 hover:text-white px-1 text-sm font-bold">&times;</button>
    `;

    toast.querySelector("button").onclick = () => {
      toast.classList.add("opacity-0", "-translate-y-2");
      setTimeout(() => toast.remove(), 250);
    };

    container.appendChild(toast);
    requestAnimationFrame(() => {
      toast.classList.remove("-translate-y-2", "opacity-0");
    });

    setTimeout(() => {
      if (toast.isConnected) {
        toast.classList.add("opacity-0", "-translate-y-2");
        setTimeout(() => toast.remove(), 300);
      }
    }, duration);
  };

  // Official Logo & Avatar Renderer
  window.renderAvatar = (user, sizeClass = "w-8 h-8", textClass = "text-xs", borderClass = "border border-slate-700") => {
    const name = (user?.display_name || user?.username || "Blader").trim();
    const customUrl = (user?.avatar_url || "").trim();
    const isCleanCustomUrl = customUrl && !customUrl.includes("unsplash.com") && !customUrl.includes("placeholder") && !customUrl.includes("via.placeholder");
    const logoSrc = "/assets/images/appbey_logo.png";
    const src = isCleanCustomUrl ? customUrl : logoSrc;

    return `
      <div class="${sizeClass} rounded-full overflow-hidden ${borderClass} flex-shrink-0 flex items-center justify-center bg-slate-950 shadow-md">
        <img src="${src}" class="w-full h-full object-cover" onerror="this.onerror=null;this.src='${logoSrc}'" alt="${name}"/>
      </div>
    `;
  };

  // Safe global override of window.alert to completely prevent browser native alert dialogs
  window.alert = function(msg) {
    const text = (msg === null || msg === undefined) ? "" : String(msg);
    const lower = text.toLowerCase();
    const isError = lower.includes("error") || lower.includes("falló") || lower.includes("no encontrado") || lower.includes("denegad");
    window.showToast(text, isError ? "error" : "success");
  };

  // In-app confirm modal replacement
  window.showAppConfirm = (title, message) => {
    return new Promise((resolve) => {
      const modal = document.createElement("div");
      modal.className = "fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md";
      modal.innerHTML = `
        <div class="glass-card max-w-sm w-full rounded-3xl p-6 border border-cyan-500/40 space-y-4 shadow-2xl text-center">
          <div class="text-3xl">⚖️</div>
          <h3 class="font-extrabold text-white text-base">${title || 'Confirmación'}</h3>
          <p class="text-xs text-slate-300 leading-relaxed">${message}</p>
          <div class="grid grid-cols-2 gap-2 pt-2">
            <button id="modal-cancel-btn" class="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition active:scale-95">
              Cancelar
            </button>
            <button id="modal-confirm-btn" class="py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold text-xs shadow-md transition active:scale-95">
              Confirmar
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      modal.querySelector("#modal-cancel-btn").onclick = () => {
        modal.remove();
        resolve(false);
      };
      modal.querySelector("#modal-confirm-btn").onclick = () => {
        modal.remove();
        resolve(true);
      };
    });
  };

  const updateActiveNav = (hash) => {
    document.querySelectorAll(".nav-link").forEach((el) => {
      const target = el.getAttribute("href");
      const isActive = target === hash || (target !== "#/" && hash.startsWith(target));
      el.classList.toggle("text-cyan-400", isActive);
      el.classList.toggle("font-bold", isActive);
      el.classList.toggle("text-slate-400", !isActive);
    });
  };

  const parseIdFromHash = (hash, prefix) => {
    if (!hash.startsWith(prefix)) return null;
    const rest = hash.slice(prefix.length);
    if (rest === "standalone") return "standalone";
    const parsed = parseInt(rest, 10);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const dispatchRoute = (hash, main) => {
    if (hash === "#/" || hash === "#") {
      window.renderHomeView(main);
      return;
    }
    if (hash === "#/tournaments") {
      window.renderTournamentsView(main);
      return;
    }
    if (hash.startsWith("#/tournaments/")) {
      window.renderTournamentDetailView(main, parseIdFromHash(hash, "#/tournaments/"));
      return;
    }
    if (hash.startsWith("#/referee")) {
      window.renderRefereePadView(main, parseIdFromHash(hash, "#/referee/"));
      return;
    }
    if (hash.startsWith("#/stadium-display")) {
      window.renderStadiumDisplayView(main, parseIdFromHash(hash, "#/stadium-display/"));
      return;
    }
    if (hash.startsWith("#/profile")) {
      window.renderProfileView(main, parseIdFromHash(hash, "#/profile/"));
      return;
    }

    const staticRoutes = {
      "#/deck-builder": window.renderDeckBuilderView,
      "#/tier-list": window.renderTierListView,
      "#/rankings": window.renderRankingsView,
      "#/hall-of-fame": window.renderHallOfFameView,
      "#/social": window.renderSocialView,
    };

    const handler = staticRoutes[hash];
    if (handler) {
      handler(main);
      return;
    }

    main.innerHTML = `<div class="text-center py-24 text-slate-500">Página no encontrada (404)</div>`;
  };

  const router = () => {
    const hash = window.location.hash || "#/";
    const main = document.getElementById("main-content");
    if (!main) return;

    // Clear stale websocket listeners from previous view so they never overwrite DOM
    if (window.wsHub) {
      window.wsHub.clear();
    }

    updateActiveNav(hash);
    dispatchRoute(hash, main);
    window.scrollTo(0, 0);
  };

  // Service Worker Registration for PWA Mobile
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").then(reg => {
        console.log("AppBey PWA Service Worker Registered:", reg.scope);
      }).catch(err => {
        console.log("SW Registration failed:", err);
      });
    });
  }

  // Auth Header Updater
  const updateAuthUI = () => {
    const user = window.api.user;
    const authContainer = document.getElementById("nav-auth-container");
    if (!authContainer) return;

    if (user) {
      const isAdmin = user.role === "admin";
      authContainer.innerHTML = `
        <div class="flex items-center gap-2 sm:gap-3">
          ${isAdmin ? `
            <button onclick="window.openAdminUserManagementModal()" title="Panel de Administración" class="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-bold flex items-center gap-1">
              <span>🛡️</span> <span class="hidden sm:inline">Admin</span>
            </button>
          ` : ''}

          <div onclick="location.hash='#/profile'" class="cursor-pointer flex items-center gap-2 hover:opacity-90 transition">
            ${window.renderAvatar(user, "w-8 h-8", "text-xs", "border-2 border-cyan-400")}
            <span class="text-xs font-bold text-white hidden sm:inline">${user.display_name}</span>
          </div>

          <button onclick="handleLogout()" title="Cerrar Sesión" class="p-1.5 rounded-lg text-slate-400 hover:text-rose-400">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
          </button>
        </div>
      `;
    } else {
      authContainer.innerHTML = `
        <button onclick="window.showAuthModal('login')" class="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs shadow-md transition active:scale-95">
          Iniciar Sesión
        </button>
      `;
    }
  };

  window.handleLogout = () => {
    window.api.setAuth(null, null);
    location.hash = "#/";
    location.reload();
  };

  window.addEventListener("hashchange", router);
  window.addEventListener("auth-change", updateAuthUI);
  window.addEventListener("DOMContentLoaded", () => {
    updateAuthUI();
    router();
  });
})();
