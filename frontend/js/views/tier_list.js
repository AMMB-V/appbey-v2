// AppBey's local Beyblade X part catalog and reference tier list.
window.renderTierListView = async (container) => {
  container.innerHTML = `
    <div class="flex flex-col items-center justify-center py-20 text-slate-400 space-y-3">
      <div class="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
      <p class="text-sm font-medium">Cargando las piezas registradas en AppBey...</p>
    </div>
  `;

  try {
    const metaData = await window.api.getMetaTierList();
    let parts = metaData.parts || [];
    let meta = metaData.meta || {};
    let counts = metaData.counts || {};
    const canSyncCatalog = ["admin", "organizer"].includes(window.api.user?.role);

    let currentCat = "";
    let currentType = "";
    let currentSystem = "";
    let searchQuery = "";
    let sortBy = "tier";
    let selectedPartForModal = null;
    let comparePartA = null;
    let comparePartB = null;

    const tiers = ["S", "A", "B", "C", "N"];
    const tierMeta = {
      S: {
        label: "Tier S",
        sub: "Referencia destacada",
        desc: "Clasificación de referencia local de AppBey",
        gradient: "from-amber-500 to-orange-600",
        border: "border-amber-500/40",
        badgeBg: "bg-amber-500/20 text-amber-300 border-amber-500/30",
        icon: "👑"
      },
      A: {
        label: "Tier A",
        sub: "Referencia competitiva",
        desc: "Clasificación de referencia local de AppBey",
        gradient: "from-purple-600 to-indigo-600",
        border: "border-purple-500/40",
        badgeBg: "bg-purple-500/20 text-purple-300 border-purple-500/30",
        icon: "⚡"
      },
      B: {
        label: "Tier B",
        sub: "Referencia situacional",
        desc: "Opciones situacionales según la referencia local",
        gradient: "from-blue-600 to-cyan-600",
        border: "border-blue-500/40",
        badgeBg: "bg-blue-500/20 text-blue-300 border-blue-500/30",
        icon: "🛡️"
      },
      C: {
        label: "Tier C",
        sub: "Referencia casual",
        desc: "Clasificación de referencia local de AppBey",
        gradient: "from-slate-700 to-slate-800",
        border: "border-slate-700/40",
        badgeBg: "bg-slate-700/30 text-slate-300 border-slate-600/30",
        icon: "📦"
      },
      N: {
        label: "Sin clasificar",
        sub: "Piezas nuevas",
        desc: "Piezas importadas sin una clasificación de tier",
        gradient: "from-slate-800 to-slate-900",
        border: "border-slate-600/40",
        badgeBg: "bg-slate-700/30 text-slate-300 border-slate-600/30",
        icon: "✨"
      }
    };

    const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);
    const formatStat = (value) => Number(value) > 0 ? escapeHtml(value) : "—";

    container.innerHTML = `
      <div class="space-y-6 max-w-6xl mx-auto pb-16">
        <div class="glass-card rounded-2xl p-5 md:p-6 border border-slate-800 relative overflow-hidden bg-slate-900/60">
          <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
            <div class="space-y-2">
              <div class="flex flex-wrap items-center gap-2">
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  Catálogo de AppBey
                </span>
                <span class="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  Blades · Ratchets · Bits
                </span>
              </div>
              <h1 class="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-2">
                <span class="text-amber-400">🛡️</span> Piezas Beyblade X
              </h1>
            </div>

            <div class="flex flex-wrap items-center gap-3 shrink-0">
              <a href="https://beyblade-x-api.onrender.com/swagger-ui.html" target="_blank" rel="noopener noreferrer" class="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 flex items-center gap-2 transition">
                <span>🔗 Fuente del catálogo</span>
              </a>
              ${canSyncCatalog ? `<button id="btn-sync-tierlist" onclick="handleLiveSync()" ${meta.status === "syncing" ? "disabled" : ""} class="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white flex items-center gap-2 shadow-lg shadow-cyan-900/30 transition transform active:scale-95">
                <svg id="sync-spinner" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                </svg>
                <span>${meta.status === "syncing" ? "Actualizando..." : "Actualizar lista"}</span>
              </button>` : ""}
            </div>
          </div>
        </div>

        <!-- Meta Summary Quick Bar -->
        <div class="grid grid-cols-2 gap-3">
          <div class="glass-card p-3 rounded-xl border border-slate-800 flex items-center gap-3 bg-slate-900/40">
            <div class="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-black text-lg">S</div>
            <div>
              <div class="text-xs text-slate-400">Piezas Tier S</div>
              <div class="text-lg font-extrabold text-white" id="count-tier-s">${counts.s_tier || 0}</div>
            </div>
          </div>
          <div class="glass-card p-3 rounded-xl border border-slate-800 flex items-center gap-3 bg-slate-900/40">
            <div class="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 font-black text-lg">A</div>
            <div>
              <div class="text-xs text-slate-400">Piezas Tier A</div>
              <div class="text-lg font-extrabold text-white" id="count-tier-a">${counts.a_tier || 0}</div>
            </div>
          </div>
        </div>

        <!-- Filter & Search Tool Bar -->
        <div class="glass-card p-4 rounded-2xl border border-slate-800 space-y-3 bg-slate-900/50">
          <div class="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <!-- Search Bar -->
            <div class="relative flex-1">
              <input
                type="text"
                id="search-tier-input"
                placeholder="Buscar pieza (ej: Phoenix Wing, 9-60, Disc Ball, Left Spin)..."
                class="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                oninput="handleSearchChange(this.value)"
              />
              <svg class="w-4 h-4 text-slate-500 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
            </div>

            <!-- Category Filter Tabs -->
            <div class="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
              <button onclick="setCategoryFilter('')" id="cat-btn-all" class="cat-pill px-3 py-1.5 rounded-xl text-xs font-bold bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 whitespace-nowrap transition">Todas (${parts.length})</button>
              <button onclick="setCategoryFilter('blade')" id="cat-btn-blade" class="cat-pill px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white whitespace-nowrap transition">Blades (${counts.blades || 0})</button>
              <button onclick="setCategoryFilter('ratchet')" id="cat-btn-ratchet" class="cat-pill px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white whitespace-nowrap transition">Ratchets (${counts.ratchets || 0})</button>
              <button onclick="setCategoryFilter('bit')" id="cat-btn-bit" class="cat-pill px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white whitespace-nowrap transition">Bits (${counts.bits || 0})</button>
            </div>
          </div>

          <!-- Secondary Filters: System, Type, Sort -->
          <div class="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80 text-xs">
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-slate-500 font-medium">Filtrar por:</span>
              <select id="type-filter-select" onchange="handleTypeFilter(this.value)" class="bg-slate-950 border border-slate-800 text-slate-300 rounded-lg px-2.5 py-1 focus:outline-none focus:border-cyan-500">
                <option value="">Todos los Tipos</option>
                <option value="Attack">Ataque</option>
                <option value="Stamina">Resistencia</option>
                <option value="Defense">Defensa</option>
                <option value="Balance">Equilibrio</option>
              </select>

              <select id="system-filter-select" onchange="handleSystemFilter(this.value)" class="bg-slate-950 border border-slate-800 text-slate-300 rounded-lg px-2.5 py-1 focus:outline-none focus:border-cyan-500">
                <option value="">Todos los Sistemas</option>
                <option value="BX">BX (Basic Line)</option>
                <option value="UX">UX (Unique Line)</option>
                <option value="Custom">Custom</option>
              </select>
            </div>

            <div class="flex items-center gap-2">
              <span class="text-slate-500 font-medium">Ordenar por:</span>
              <select id="sort-select" onchange="handleSortChange(this.value)" class="bg-slate-950 border border-slate-800 text-slate-300 rounded-lg px-2.5 py-1 focus:outline-none focus:border-cyan-500">
                <option value="tier">Nivel de Tier</option>
                <option value="weight">Mayor Peso (Gramos)</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Tier Rows Container -->
        <div class="space-y-4" id="tier-rows-container">
          <!-- Populated by renderTierRows -->
        </div>

        <!-- Part Detail Modal Container -->
        <div id="part-detail-modal" class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 hidden overflow-y-auto">
          <!-- Populated dynamically -->
        </div>
      </div>
    `;

    // Filter & Sort Logic
    const getFilteredAndSortedParts = () => {
      let filtered = [...parts];

      if (currentCat) {
        filtered = filtered.filter(p => p.category === currentCat);
      }
      if (currentType) {
        filtered = filtered.filter(p => p.type_attr?.toLowerCase() === currentType.toLowerCase());
      }
      if (currentSystem) {
        filtered = filtered.filter(p => p.system?.toLowerCase() === currentSystem.toLowerCase());
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(p =>
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q)) ||
          (p.best_combo && p.best_combo.toLowerCase().includes(q))
        );
      }

      // Sort
      if (sortBy === "weight") {
        filtered.sort((a, b) => b.weight_grams - a.weight_grams);
      }

      return filtered;
    };

    const getTrendBadgeHtml = (trend) => {
      switch (trend) {
        case 'up':
          return '<span class="text-emerald-400 font-bold text-xs">▲ Subiendo</span>';
        case 'down':
          return '<span class="text-rose-400 font-bold text-xs">▼ Bajando</span>';
        case 'new':
          return '<span class="text-amber-400 font-bold text-xs">✨ Nuevo</span>';
        default:
          return '<span class="text-slate-400 text-xs">● Estable</span>';
      }
    };

    const getTypeBadgeClass = (typeAttr) => {
      switch (typeAttr) {
        case 'Attack':
          return 'bg-rose-500/10 text-rose-400 border border-rose-500/30';
        case 'Stamina':
          return 'bg-amber-500/10 text-amber-400 border border-amber-500/30';
        case 'Defense':
          return 'bg-blue-500/10 text-blue-400 border border-blue-500/30';
        default:
          return 'bg-purple-500/10 text-purple-400 border border-purple-500/30';
      }
    };

    const renderPartCardHtml = (p) => {
      const trendIcon = getTrendBadgeHtml(p.trend);
      const typeClass = getTypeBadgeClass(p.type_attr);

      return `
        <div
          onclick="openPartModal(${p.id})"
          class="p-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-cyan-500/60 transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-2.5 group relative hover:shadow-lg hover:shadow-cyan-950/30"
        >
          <div class="flex items-center justify-between gap-1">
            <div class="flex items-center gap-1.5">
              <span class="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
                ${escapeHtml(p.code)}
              </span>
              <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                ${escapeHtml(p.system)}
              </span>
            </div>
            <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${typeClass}">
              ${escapeHtml(p.type_attr)}
            </span>
          </div>

          <div>
            <h4 class="font-bold text-white text-sm group-hover:text-cyan-400 transition truncate">${escapeHtml(p.name)}</h4>
            <div class="text-[11px] text-slate-400 flex items-center justify-between mt-0.5">
              <span class="capitalize font-medium text-slate-300">${escapeHtml(p.category)}</span>
              <span class="font-mono text-slate-400">${p.weight_grams ? `${p.weight_grams}g` : "—"}</span>
            </div>
          </div>

          <div class="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
            <div class="flex items-center gap-2">
              <span class="text-rose-400 font-bold font-mono">ATK ${formatStat(p.attack_stat)}</span>
              <span class="text-blue-400 font-bold font-mono">DEF ${formatStat(p.defense_stat)}</span>
              <span class="text-amber-400 font-bold font-mono">STA ${formatStat(p.stamina_stat)}</span>
            </div>
            <span class="text-slate-400 group-hover:text-cyan-400 transition text-[11px] font-semibold flex items-center gap-0.5">
              Ver ficha <span>→</span>
            </span>
          </div>
        </div>
      `;
    };

    const renderTierRowHtml = (tier, filteredParts, metaTiers) => {
      const tierConfig = metaTiers[tier];
      const tierParts = filteredParts.filter(p => p.tier === tier);
      const countLabel = `${tierParts.length} ${tierParts.length === 1 ? 'pieza' : 'piezas'}`;

      return `
        <div class="glass-card rounded-2xl overflow-hidden border ${tierConfig.border} flex flex-col md:flex-row shadow-lg bg-slate-900/40">
          <div class="p-5 md:w-36 bg-gradient-to-br ${tierConfig.gradient} flex flex-col items-center justify-center shrink-0 border-b md:border-b-0 md:border-r border-slate-800 text-center relative overflow-hidden">
            <div class="text-3xl font-black text-white tracking-tight flex items-center gap-1">
              <span>${tierConfig.label}</span>
            </div>
            <span class="text-[11px] font-bold uppercase tracking-wider text-slate-100 mt-0.5">
              ${tierConfig.sub}
            </span>
            <span class="text-[10px] text-white/80 mt-1 hidden md:block">
              ${countLabel}
            </span>
          </div>

          <div class="p-4 flex-1 bg-slate-950/40">
            ${tierParts.length ? `
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                ${tierParts.map(renderPartCardHtml).join("")}
              </div>
            ` : `
              <div class="py-8 text-center text-xs text-slate-500">
                No hay piezas en ${tierConfig.label} que coincidan con los filtros seleccionados.
              </div>
            `}
          </div>
        </div>
      `;
    };

    window.renderTierRows = () => {
      const containerEl = document.getElementById("tier-rows-container");
      if (!containerEl) return;

      const filteredParts = getFilteredAndSortedParts();
      containerEl.innerHTML = tiers.map(tier => renderTierRowHtml(tier, filteredParts, tierMeta)).join("");
    };

    // The source can cold-start, so start the import and poll its server-side status.
    window.handleLiveSync = async () => {
      const btn = document.getElementById("btn-sync-tierlist");
      const spinner = document.getElementById("sync-spinner");
      const label = btn?.querySelector("span");
      if (spinner) spinner.classList.add("animate-spin");
      if (btn) btn.disabled = true;
      if (label) label.textContent = "Actualizando...";

      try {
        const started = await window.api.syncMetaTierList();
        let latest = started;
        const deadline = Date.now() + 90_000;
        while (latest.meta?.status === "syncing" && Date.now() < deadline) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          latest = await window.api.getMetaTierList({ noCache: true });
        }
        if (latest.meta?.status !== "synced") {
          throw new Error(latest.meta?.last_error || "La fuente no terminó de actualizar el catálogo a tiempo.");
        }
        await window.renderTierListView(container);
        window.showToast?.("Lista de piezas actualizada.", "success");
      } catch (err) {
        window.showToast?.("No se pudieron actualizar los datos: " + err.message, "error");
      } finally {
        if (spinner) spinner.classList.remove("animate-spin");
        if (btn) btn.disabled = false;
        if (label) label.textContent = "Actualizar lista";
      }
    };

    window.togglePatchNotes = () => {
      const drawer = document.getElementById("patch-notes-drawer");
      if (drawer) drawer.classList.toggle("hidden");
    };

    window.setCategoryFilter = (cat) => {
      currentCat = cat;
      document.querySelectorAll(".cat-pill").forEach(btn => {
        btn.className = "cat-pill px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white whitespace-nowrap transition";
      });
      const active = document.getElementById(`cat-btn-${cat || 'all'}`);
      if (active) active.className = "cat-pill px-3 py-1.5 rounded-xl text-xs font-bold bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 whitespace-nowrap transition";
      window.renderTierRows();
    };

    window.handleTypeFilter = (type) => {
      currentType = type;
      window.renderTierRows();
    };

    window.handleSystemFilter = (sys) => {
      currentSystem = sys;
      window.renderTierRows();
    };

    window.handleSortChange = (s) => {
      sortBy = s;
      window.renderTierRows();
    };

    window.handleSearchChange = (q) => {
      searchQuery = q;
      window.renderTierRows();
    };

    // Modal Details Logic
    window.openPartModal = (partId) => {
      const part = parts.find(p => p.id === partId);
      if (!part) return;

      const modalEl = document.getElementById("part-detail-modal");
      if (!modalEl) return;

      const tierConfig = tierMeta[part.tier] || tierMeta.C;

      modalEl.innerHTML = `
        <div class="glass-card rounded-2xl max-w-lg w-full p-6 border border-slate-700 bg-slate-900 shadow-2xl relative space-y-5 animate-in fade-in zoom-in duration-200 my-8 max-h-[calc(100vh-4rem)] overflow-y-auto">
          <!-- Close Button -->
          <button onclick="closePartModal()" class="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>

          <!-- Modal Header -->
          <div class="flex items-start gap-3">
            <div class="w-14 h-14 rounded-2xl bg-gradient-to-br ${tierConfig.gradient} flex items-center justify-center text-white font-black text-2xl shrink-0 shadow-lg">
              ${part.tier}
            </div>
            <div>
              <div class="flex items-center gap-2">
                <span class="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">${escapeHtml(part.code)}</span>
                <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">${escapeHtml(part.system)} • ${escapeHtml(part.category)}</span>
              </div>
              <h3 class="text-xl font-black text-white mt-1">${escapeHtml(part.name)}</h3>
              <span class="text-xs font-semibold ${part.type_attr === 'Attack' ? 'text-rose-400' : part.type_attr === 'Stamina' ? 'text-amber-400' : part.type_attr === 'Defense' ? 'text-blue-400' : 'text-purple-400'}">
                Tipo ${escapeHtml(part.type_attr)} • ${part.weight_grams ? `${part.weight_grams}g` : "—"}
              </span>
            </div>
          </div>

          <!-- Description -->
          <p class="text-xs text-slate-300 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            ${escapeHtml(part.description || "Pieza registrada en el catálogo de AppBey.")}
          </p>

          <div class="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-xs">
            <div class="rounded-lg bg-slate-950 p-2 text-slate-300">Ataque <strong class="text-rose-400">${formatStat(part.attack_stat)}</strong></div>
            <div class="rounded-lg bg-slate-950 p-2 text-slate-300">Defensa <strong class="text-blue-400">${formatStat(part.defense_stat)}</strong></div>
            <div class="rounded-lg bg-slate-950 p-2 text-slate-300">Resistencia <strong class="text-amber-400">${formatStat(part.stamina_stat)}</strong></div>
            <div class="rounded-lg bg-slate-950 p-2 text-slate-300">Dash <strong class="text-cyan-400">${formatStat(part.dash_stat)}</strong></div>
          </div>

          <!-- Recommended Combo & Legality -->
          <div class="p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/30 space-y-1">
            <div class="text-[11px] font-bold text-cyan-300 uppercase tracking-wider">💡 Combo Competitivo Recomendado:</div>
            <div class="text-xs font-bold text-white">${escapeHtml(part.best_combo || "Configuración estándar de torneo")}</div>
            <div class="text-[10px] text-slate-400">Estado de reglamento y procedencia: <strong class="text-amber-300">no verificados por AppBey</strong></div>
          </div>

          <!-- Action Buttons -->
          <div class="flex items-center justify-between gap-2 pt-2">
            <a href="https://beyblade-x-api.onrender.com/swagger-ui.html" target="_blank" rel="noopener noreferrer" class="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-600/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-600/30 flex items-center gap-1.5 transition">
              <span>🌐 Ver fuente del catálogo</span>
            </a>
            <button onclick="closePartModal()" class="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition">
              Cerrar
            </button>
          </div>
        </div>
      `;

      modalEl.classList.remove("hidden");
    };

    window.closePartModal = () => {
      const modalEl = document.getElementById("part-detail-modal");
      if (modalEl) modalEl.classList.add("hidden");
    };

    // Initial render of tier rows
    window.renderTierRows();
  } catch (err) {
    container.innerHTML = `
      <div class="glass-card rounded-2xl p-8 text-center max-w-md mx-auto space-y-4 border border-rose-500/30 bg-rose-950/10">
        <div class="text-rose-400 font-bold text-lg">Error al cargar las piezas</div>
        <p class="text-slate-400 text-xs">${err.message}</p>
        <button onclick="window.renderTierListView(document.getElementById('main-content'))" class="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition">
          Reintentar Conexión
        </button>
      </div>
    `;
  }
};
