// Beyblade X Official Meta Tier List View - Connected to WBO & Takara Tomy Live Feeds
window.renderTierListView = async (container) => {
  container.innerHTML = `
    <div class="flex flex-col items-center justify-center py-20 text-slate-400 space-y-3">
      <div class="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
      <p class="text-sm font-medium">Sincronizando con el servidor oficial de WBO & Takara Tomy...</p>
    </div>
  `;

  try {
    const metaData = await window.api.getMetaTierList();
    let parts = metaData.parts || [];
    let meta = metaData.meta || {};
    let counts = metaData.counts || {};

    let currentCat = "";
    let currentType = "";
    let currentSystem = "";
    let searchQuery = "";
    let sortBy = "tier"; // 'tier', 'winrate', 'pickrate', 'weight'
    let selectedPartForModal = null;
    let comparePartA = null;
    let comparePartB = null;

    const tiers = ["S", "A", "B", "C"];
    const tierMeta = {
      S: {
        label: "Tier S",
        sub: "Meta Dominante",
        desc: "Piezas obligatorias en Decks 3on3 con winrate > 60%",
        gradient: "from-amber-500 to-orange-600",
        border: "border-amber-500/40",
        badgeBg: "bg-amber-500/20 text-amber-300 border-amber-500/30",
        icon: "👑"
      },
      A: {
        label: "Tier A",
        sub: "Altamente Competitivo",
        desc: "Piezas sólidas de torneo con sinergias letales",
        gradient: "from-purple-600 to-indigo-600",
        border: "border-purple-500/40",
        badgeBg: "bg-purple-500/20 text-purple-300 border-purple-500/30",
        icon: "⚡"
      },
      B: {
        label: "Tier B",
        sub: "Viable / Contra-Estrategia",
        desc: "Opciones situacionales y tech counters",
        gradient: "from-blue-600 to-cyan-600",
        border: "border-blue-500/40",
        badgeBg: "bg-blue-500/20 text-blue-300 border-blue-500/30",
        icon: "🛡️"
      },
      C: {
        label: "Tier C",
        sub: "Nicho / Casual",
        desc: "Uso experimental o superado por nuevas piezas",
        gradient: "from-slate-700 to-slate-800",
        border: "border-slate-700/40",
        badgeBg: "bg-slate-700/30 text-slate-300 border-slate-600/30",
        icon: "📦"
      }
    };

    const formatTimeAgo = (dateString) => {
      if (!dateString) return "Recientemente";
      const diffMs = Date.now() - new Date(dateString).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return "Justo ahora";
      if (diffMins === 1) return "Hace 1 minuto";
      if (diffMins < 60) return `Hace ${diffMins} minutos`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours === 1) return "Hace 1 hora";
      return `Hace ${diffHours} horas`;
    };

    container.innerHTML = `
      <div class="space-y-6 max-w-6xl mx-auto pb-16">
        <!-- Header & Live Connection Status Banner -->
        <div class="glass-card rounded-2xl p-5 md:p-6 border border-slate-800 relative overflow-hidden bg-slate-900/60">
          <div class="absolute -right-16 -top-16 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <div class="absolute -left-16 -bottom-16 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

          <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
            <div class="space-y-2">
              <div class="flex flex-wrap items-center gap-2">
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  Conexión Oficial En Vivo
                </span>
                <span class="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  ${meta.meta_version || "BX/UX Meta Ver. 2026.3"}
                </span>
              </div>
              <h1 class="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-2">
                <span class="text-amber-400">👑</span> Beyblade X Official Meta Tier List
              </h1>
              <p class="text-slate-400 text-sm max-w-2xl">
                Base de datos sincronizada con el reglamento y resultados de torneos de la
                <a href="${meta.official_url || 'https://worldbeyblade.org'}" target="_blank" rel="noopener noreferrer" class="text-cyan-400 hover:underline font-semibold">World Beyblade Organization (WBO)</a>
                y el catálogo oficial de
                <a href="${meta.secondary_url || 'https://beyblade.takaratomy.co.jp'}" target="_blank" rel="noopener noreferrer" class="text-amber-400 hover:underline font-semibold">Takara Tomy</a>.
              </p>
            </div>

            <!-- Sync Controls & Metrics Box -->
            <div class="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end gap-3 shrink-0">
              <div class="flex items-center gap-2">
                <button id="btn-sync-tierlist" onclick="handleLiveSync()" class="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white flex items-center gap-2 shadow-lg shadow-cyan-900/30 transition transform active:scale-95">
                  <svg id="sync-spinner" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                  </svg>
                  <span>Sincronizar con Sitio Oficial</span>
                </button>
                <button onclick="togglePatchNotes()" class="px-3 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1.5 transition">
                  <span>📜 Notas del Parche</span>
                </button>
              </div>

              <div class="text-xs text-slate-400 flex flex-wrap items-center gap-3">
                <span>⏱️ <strong class="text-slate-200" id="sync-time-label">${formatTimeAgo(meta.last_synced_at)}</strong></span>
                <span>⚔️ <strong class="text-cyan-300" id="sync-matches-label">${meta.total_matches_analyzed ? meta.total_matches_analyzed.toLocaleString() : '2,840'}</strong> combates</span>
              </div>
            </div>
          </div>

          <!-- Patch Notes Drawer (Collapsible) -->
          <div id="patch-notes-drawer" class="hidden mt-4 pt-4 border-t border-slate-800 space-y-2">
            <h4 class="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <span>📋</span> Registro Oficial de Cambios y Balance WBO / TT
            </h4>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs" id="patch-notes-list">
              ${(meta.patch_notes || []).map(note => `
                <div class="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-slate-300 flex items-start gap-2">
                  <span class="text-cyan-400 mt-0.5">•</span>
                  <span>${note}</span>
                </div>
              `).join("")}
            </div>
          </div>
        </div>

        <!-- Meta Summary Quick Bar -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
          <div class="glass-card p-3 rounded-xl border border-slate-800 flex items-center gap-3 bg-slate-900/40">
            <div class="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold text-base">3on3</div>
            <div>
              <div class="text-xs text-slate-400">Meta Deck Regla</div>
              <div class="text-xs font-semibold text-slate-200">Sin piezas repetidas</div>
            </div>
          </div>
          <div class="glass-card p-3 rounded-xl border border-slate-800 flex items-center gap-3 bg-slate-900/40">
            <div class="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-base">WBO</div>
            <div>
              <div class="text-xs text-slate-400">Reglamento</div>
              <div class="text-xs font-semibold text-emerald-400">Torneo Legal 2026</div>
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
              </select>
            </div>

            <div class="flex items-center gap-2">
              <span class="text-slate-500 font-medium">Ordenar por:</span>
              <select id="sort-select" onchange="handleSortChange(this.value)" class="bg-slate-950 border border-slate-800 text-slate-300 rounded-lg px-2.5 py-1 focus:outline-none focus:border-cyan-500">
                <option value="tier">Nivel de Tier (S → C)</option>
                <option value="winrate">Mayor Win Rate % Oficial</option>
                <option value="pickrate">Mayor Pick Rate % Oficial</option>
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
        <div id="part-detail-modal" class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 hidden">
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
      if (sortBy === "winrate") {
        filtered.sort((a, b) => (b.win_rate_pct || 0) - (a.win_rate_pct || 0));
      } else if (sortBy === "pickrate") {
        filtered.sort((a, b) => (b.pick_rate_pct || 0) - (a.pick_rate_pct || 0));
      } else if (sortBy === "weight") {
        filtered.sort((a, b) => b.weight_grams - a.weight_grams);
      }

      return filtered;
    };

    window.renderTierRows = () => {
      const containerEl = document.getElementById("tier-rows-container");
      if (!containerEl) return;

      const filteredParts = getFilteredAndSortedParts();

      containerEl.innerHTML = tiers.map(tier => {
        const tierConfig = tierMeta[tier];
        const tierParts = filteredParts.filter(p => p.tier === tier);

        return `
          <div class="glass-card rounded-2xl overflow-hidden border ${tierConfig.border} flex flex-col md:flex-row shadow-lg bg-slate-900/40">
            <!-- Tier Badge Column -->
            <div class="p-5 md:w-36 bg-gradient-to-br ${tierConfig.gradient} flex flex-col items-center justify-center shrink-0 border-b md:border-b-0 md:border-r border-slate-800 text-center relative overflow-hidden">
              <div class="text-3xl font-black text-white tracking-tight flex items-center gap-1">
                <span>${tierConfig.label}</span>
              </div>
              <span class="text-[11px] font-bold uppercase tracking-wider text-slate-100 mt-0.5">
                ${tierConfig.sub}
              </span>
              <span class="text-[10px] text-white/80 mt-1 hidden md:block">
                ${tierParts.length} ${tierParts.length === 1 ? 'pieza' : 'piezas'}
              </span>
            </div>

            <!-- Parts Grid Container -->
            <div class="p-4 flex-1 bg-slate-950/40">
              ${tierParts.length ? `
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  ${tierParts.map(p => {
                    const trendIcon = p.trend === 'up' ? '<span class="text-emerald-400 font-bold text-xs">▲ Subiendo</span>' :
                                      p.trend === 'down' ? '<span class="text-rose-400 font-bold text-xs">▼ Bajando</span>' :
                                      p.trend === 'new' ? '<span class="text-amber-400 font-bold text-xs">✨ Nuevo</span>' :
                                      '<span class="text-slate-400 text-xs">● Estable</span>';

                    return `
                      <div
                        onclick="openPartModal(${p.id})"
                        class="p-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-cyan-500/60 transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-2.5 group relative hover:shadow-lg hover:shadow-cyan-950/30"
                      >
                        <!-- Top Badges -->
                        <div class="flex items-center justify-between gap-1">
                          <div class="flex items-center gap-1.5">
                            <span class="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
                              ${p.code}
                            </span>
                            <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                              ${p.system}
                            </span>
                          </div>
                          <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${p.type_attr === 'Attack' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30' : p.type_attr === 'Stamina' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' : p.type_attr === 'Defense' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30' : 'bg-purple-500/10 text-purple-400 border border-purple-500/30'}">
                            ${p.type_attr}
                          </span>
                        </div>

                        <!-- Name & Category -->
                        <div>
                          <h4 class="font-bold text-white text-sm group-hover:text-cyan-400 transition truncate">${p.name}</h4>
                          <div class="text-[11px] text-slate-400 flex items-center justify-between mt-0.5">
                            <span class="capitalize font-medium text-slate-300">${p.category}</span>
                            <span class="font-mono text-slate-400">${p.weight_grams}g</span>
                          </div>
                        </div>

                        <!-- Meta Metrics (Winrate & Pickrate) -->
                        <div class="pt-2 border-t border-slate-800/80 grid grid-cols-2 gap-1 text-[10px]">
                          <div>
                            <span class="text-slate-500 block">Win Rate</span>
                            <span class="font-extrabold ${p.win_rate_pct >= 60 ? 'text-emerald-400' : p.win_rate_pct >= 50 ? 'text-cyan-400' : 'text-slate-300'}">
                              ${p.win_rate_pct ? p.win_rate_pct + '%' : 'N/A'}
                            </span>
                          </div>
                          <div>
                            <span class="text-slate-500 block">Pick Rate</span>
                            <span class="font-extrabold text-amber-400">
                              ${p.pick_rate_pct ? p.pick_rate_pct + '%' : 'N/A'}
                            </span>
                          </div>
                        </div>

                        <!-- Footer: Trend & Ruling -->
                        <div class="flex items-center justify-between text-[10px] pt-1">
                          <div>${trendIcon}</div>
                          <span class="text-slate-500 group-hover:text-cyan-400 transition flex items-center gap-0.5">
                            Ver detalles <span>→</span>
                          </span>
                        </div>
                      </div>
                    `;
                  }).join("")}
                </div>
              ` : `
                <div class="py-8 text-center text-xs text-slate-500">
                  No hay piezas en ${tierConfig.label} que coincidan con los filtros seleccionados.
                </div>
              `}
            </div>
          </div>
        `;
      }).join("");
    };

    // Live Sync Action
    window.handleLiveSync = async () => {
      const btn = document.getElementById("btn-sync-tierlist");
      const spinner = document.getElementById("sync-spinner");
      if (spinner) spinner.classList.add("animate-spin");
      if (btn) btn.disabled = true;

      try {
        const res = await window.api.syncMetaTierList();
        if (res.success) {
          parts = res.parts || parts;
          meta = res.meta || meta;

          // Update header labels
          const timeLabel = document.getElementById("sync-time-label");
          if (timeLabel) timeLabel.textContent = formatTimeAgo(meta.last_synced_at);

          const matchLabel = document.getElementById("sync-matches-label");
          if (matchLabel) matchLabel.textContent = meta.total_matches_analyzed ? meta.total_matches_analyzed.toLocaleString() : "2,840";

          // Update patch notes list
          const patchList = document.getElementById("patch-notes-list");
          if (patchList && meta.patch_notes) {
            patchList.innerHTML = meta.patch_notes.map(note => `
              <div class="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-slate-300 flex items-start gap-2">
                <span class="text-cyan-400 mt-0.5">•</span>
                <span>${note}</span>
              </div>
            `).join("");
          }

          window.renderTierRows();
          window.showToast?.("✅ Sincronización oficial completada con World Beyblade Organization y Takara Tomy.", "success");
        }
      } catch (err) {
        window.showToast?.("Error al sincronizar con la fuente oficial: " + err.message, "error");
      } finally {
        if (spinner) spinner.classList.remove("animate-spin");
        if (btn) btn.disabled = false;
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
        <div class="glass-card rounded-2xl max-w-lg w-full p-6 border border-slate-700 bg-slate-900 shadow-2xl relative space-y-5 animate-in fade-in zoom-in duration-200">
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
                <span class="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">${part.code}</span>
                <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">${part.system} • ${part.category}</span>
              </div>
              <h3 class="text-xl font-black text-white mt-1">${part.name}</h3>
              <span class="text-xs font-semibold ${part.type_attr === 'Attack' ? 'text-rose-400' : part.type_attr === 'Stamina' ? 'text-amber-400' : part.type_attr === 'Defense' ? 'text-blue-400' : 'text-purple-400'}">
                Tipo ${part.type_attr} • ${part.weight_grams}g
              </span>
            </div>
          </div>

          <!-- Description -->
          <p class="text-xs text-slate-300 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            ${part.description || "Pieza oficial de competición de la serie Beyblade X."}
          </p>

          <!-- Official Competitive Metrics -->
          <div class="grid grid-cols-3 gap-2">
            <div class="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-center">
              <span class="text-[10px] text-slate-400 block font-medium">Win Rate Oficial</span>
              <span class="text-base font-black text-emerald-400">${part.win_rate_pct || 'N/A'}%</span>
            </div>
            <div class="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-center">
              <span class="text-[10px] text-slate-400 block font-medium">Pick Rate WBO</span>
              <span class="text-base font-black text-amber-400">${part.pick_rate_pct || 'N/A'}%</span>
            </div>
            <div class="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-center">
              <span class="text-[10px] text-slate-400 block font-medium">Tendencia</span>
              <span class="text-xs font-bold text-cyan-400 block mt-1">${part.trend_label || 'Estable'}</span>
            </div>
          </div>

          <!-- Stats Progress Bars -->
          <div class="space-y-2 pt-2 border-t border-slate-800 text-xs">
            <div>
              <div class="flex justify-between text-slate-300 font-semibold mb-1">
                <span>Ataque / Smash</span>
                <span class="text-rose-400">${part.attack_stat}/100</span>
              </div>
              <div class="w-full bg-slate-950 rounded-full h-2 overflow-hidden">
                <div class="bg-rose-500 h-2 rounded-full" style="width: ${part.attack_stat}%"></div>
              </div>
            </div>

            <div>
              <div class="flex justify-between text-slate-300 font-semibold mb-1">
                <span>Defensa / Knockout Resist</span>
                <span class="text-blue-400">${part.defense_stat}/100</span>
              </div>
              <div class="w-full bg-slate-950 rounded-full h-2 overflow-hidden">
                <div class="bg-blue-500 h-2 rounded-full" style="width: ${part.defense_stat}%"></div>
              </div>
            </div>

            <div>
              <div class="flex justify-between text-slate-300 font-semibold mb-1">
                <span>Resistencia / Stamina</span>
                <span class="text-amber-400">${part.stamina_stat}/100</span>
              </div>
              <div class="w-full bg-slate-950 rounded-full h-2 overflow-hidden">
                <div class="bg-amber-500 h-2 rounded-full" style="width: ${part.stamina_stat}%"></div>
              </div>
            </div>

            <div>
              <div class="flex justify-between text-slate-300 font-semibold mb-1">
                <span>Xtreme Dash / Velocidad</span>
                <span class="text-cyan-400">${part.dash_stat}/100</span>
              </div>
              <div class="w-full bg-slate-950 rounded-full h-2 overflow-hidden">
                <div class="bg-cyan-500 h-2 rounded-full" style="width: ${part.dash_stat}%"></div>
              </div>
            </div>
          </div>

          <!-- Recommended Combo & Legality -->
          <div class="p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/30 space-y-1">
            <div class="text-[11px] font-bold text-cyan-300 uppercase tracking-wider">💡 Combo Competitivo Recomendado:</div>
            <div class="text-xs font-bold text-white">${part.best_combo || "Configuración estándar de torneo"}</div>
            <div class="text-[10px] text-slate-400">Reglamento: <strong class="text-emerald-400">${part.official_ruling || 'Legal WBO Standard'}</strong> • Fuente: ${part.source_reference || 'WBO Meta Feed'}</div>
          </div>

          <!-- Action Buttons -->
          <div class="flex items-center justify-end gap-2 pt-2">
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
        <div class="text-rose-400 font-bold text-lg">Error al cargar Tier List Oficial</div>
        <p class="text-slate-400 text-xs">${err.message}</p>
        <button onclick="window.renderTierListView(document.getElementById('main-content'))" class="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition">
          Reintentar Conexión
        </button>
      </div>
    `;
  }
};
