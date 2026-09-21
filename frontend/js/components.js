// AppBey Global UI Components & Shared Helpers
(function() {
  // --- IN-APP TOAST NOTIFICATION SYSTEM ---
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

  // Safe global override of window.alert
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

  // Official Logo & Avatar Renderer
  // Uses official AppBey Spinning Top Logo for players by default, or clean custom image if provided
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
})();
