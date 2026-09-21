// AppBey Core Application Router & Shell
(function() {
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
    try {
      dispatchRoute(hash, main);
    } catch (error) {
      console.error("AppBey route error:", error);
      main.innerHTML = `
        <section class="glass-card rounded-2xl p-8 text-center space-y-4 border border-rose-500/30" role="alert">
          <div class="text-3xl" aria-hidden="true">⚠️</div>
          <h1 class="text-lg font-bold text-white">No se pudo cargar esta sección</h1>
          <p class="text-sm text-slate-400">Recarga la página o vuelve al inicio para continuar.</p>
          <button type="button" onclick="location.hash='#/'" class="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm transition focus:outline-none focus:ring-2 focus:ring-cyan-300">
            Volver al inicio
          </button>
        </section>
      `;
    }
    window.scrollTo(0, 0);
  };

  // Service Worker Registration for PWA Mobile
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js?v=3.3.0", { updateViaCache: "none" }).then(reg => {
        console.log("AppBey PWA Service Worker Registered:", reg.scope);
        if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
        return reg.update();
      }).catch(err => {
        console.warn("SW Registration failed:", err);
      });

      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
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

          <button onclick="window.handleLogout()" title="Cerrar Sesión" class="p-1.5 rounded-lg text-slate-400 hover:text-rose-400">
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
  window.addEventListener("DOMContentLoaded", async () => {
    if (window.api.token) {
      try {
        const currentUser = await window.api.getMe();
        window.api.setAuth(window.api.token, currentUser);
      } catch (error) {
        if (error.status === 401) {
          window.api.setAuth(null, null);
        }
      }
    }
    updateAuthUI();
    router();
  });
})();
