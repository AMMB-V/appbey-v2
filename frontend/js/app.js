// AppBey Core Application Router & Shell
(function() {
  const router = () => {
    const hash = window.location.hash || "#/";
    const main = document.getElementById("main-content");
    if (!main) return;

    // Update active nav links
    document.querySelectorAll(".nav-link").forEach(el => {
      const target = el.getAttribute("href");
      if (target === hash || (hash.startsWith(target) && target !== "#/")) {
        el.classList.add("text-cyan-400", "font-bold");
        el.classList.remove("text-slate-400");
      } else {
        el.classList.remove("text-cyan-400", "font-bold");
        el.classList.add("text-slate-400");
      }
    });

    // Match Routes
    if (hash === "#/" || hash === "#") {
      window.renderHomeView(main);
    } else if (hash === "#/tournaments") {
      window.renderTournamentsView(main);
    } else if (hash.startsWith("#/tournaments/")) {
      const id = parseInt(hash.replace("#/tournaments/", ""));
      window.renderTournamentDetailView(main, id);
    } else if (hash === "#/referee" || hash.startsWith("#/referee/")) {
      const id = hash.startsWith("#/referee/") ? parseInt(hash.replace("#/referee/", "")) : null;
      window.renderRefereePadView(main, id);
    } else if (hash === "#/stadium-display" || hash.startsWith("#/stadium-display/")) {
      const id = hash.startsWith("#/stadium-display/") ? parseInt(hash.replace("#/stadium-display/", "")) : null;
      window.renderStadiumDisplayView(main, id);
    } else if (hash === "#/deck-builder") {
      window.renderDeckBuilderView(main);
    } else if (hash === "#/tier-list") {
      window.renderTierListView(main);
    } else if (hash === "#/rankings") {
      window.renderRankingsView(main);
    } else if (hash === "#/hall-of-fame") {
      window.renderHallOfFameView(main);
    } else if (hash === "#/wallet") {
      window.renderWalletView(main);
    } else if (hash === "#/social") {
      window.renderSocialView(main);
    } else if (hash === "#/profile" || hash.startsWith("#/profile/")) {
      const id = hash.startsWith("#/profile/") ? parseInt(hash.replace("#/profile/", "")) : null;
      window.renderProfileView(main, id);
    } else {
      main.innerHTML = `<div class="text-center py-24 text-slate-500">Página no encontrada (404)</div>`;
    }

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

          <div onclick="location.hash='#/wallet'" class="cursor-pointer px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold font-mono flex items-center gap-1.5 hover:bg-amber-500/20 transition">
            <span>🪙</span>
            <span id="nav-wallet-balance">... AP</span>
          </div>

          <div onclick="location.hash='#/profile'" class="cursor-pointer flex items-center gap-2">
            <img src="${user.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}" class="w-8 h-8 rounded-full border-2 border-cyan-400 object-cover"/>
            <span class="text-xs font-bold text-white hidden sm:inline">${user.display_name}</span>
          </div>

          <button onclick="handleLogout()" title="Cerrar Sesión" class="p-1.5 rounded-lg text-slate-400 hover:text-rose-400">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
          </button>
        </div>
      `;

      window.api.getMyWallet().then(w => {
        const el = document.getElementById("nav-wallet-balance");
        if (el) el.innerText = `${w.balance} AP`;
      }).catch(() => {});
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
