// Rankings & Leaderboard View with Season Switching (Puntos vs Elo), Live Search & Full Blader Cards
window.renderRankingsView = async (container) => {
  container.innerHTML = `
    <div class="text-center py-16 text-slate-500 flex flex-col items-center gap-3">
      <div class="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
      <span class="text-xs sm:text-sm font-medium">Cargando Rankings Oficiales de la Asociación Panameña de Beyblade...</span>
    </div>
  `;

  try {
    const seasons = await window.api.getSeasons();
    const activeSeason = seasons.find(s => s.id === 1) || seasons[0];
    let selectedSeasonId = activeSeason.id;
    let selectedRankingType = "points"; // 'points' or 'elo'
    let searchQuery = "";
    let rawRankingData = [];

    // Global store for modal lookups
    window._rankingsDataFiltered = [];

    const fetchRankingsData = async () => {
      try {
        if (selectedRankingType === "points") {
          rawRankingData = await window.api.getSeasonPoints(selectedSeasonId);
        } else {
          rawRankingData = await window.api.getSeasonElo(selectedSeasonId);
        }
      } catch (err) {
        console.error("Error cargando rankings:", err);
        rawRankingData = [];
      }
    };

    const getFilteredData = () => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return rawRankingData;
      return rawRankingData.filter(item => {
        const name = (item.display_name || item.user?.display_name || "").toLowerCase();
        const username = (item.username || item.user?.username || "").toLowerCase();
        return name.includes(q) || username.includes(q);
      });
    };

    const renderTableBodyHtml = (filtered) => {
      const isPoints = selectedRankingType === "points";
      if (!filtered.length) {
        return `
          <tr>
            <td colspan="8" class="text-center py-12">
              <div class="text-3xl mb-2">🔍</div>
              <div class="text-sm font-bold text-white">No se encontraron bladers con "${searchQuery}"</div>
              <div class="text-xs text-slate-400 mt-1">Prueba con otro nombre o borra el término de búsqueda.</div>
              <button onclick="window.clearRankingSearch()" class="mt-3 px-3 py-1.5 rounded-lg bg-slate-800 text-cyan-300 text-xs font-bold hover:bg-slate-700 transition">
                Limpiar Búsqueda
              </button>
            </td>
          </tr>
        `;
      }

      return filtered.map((item, idx) => {
        const bladerName = item.display_name || item.user?.display_name || `Blader #${item.rank || idx + 1}`;
        const username = item.username || item.user?.username || `blader_${item.user_id || idx + 1}`;
        const avatar = item.avatar_url || item.user?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100';
        const pos = item.rank || idx + 1;
        const diff = (item.points_for || 0) - (item.points_against || 0);
        const winRate = item.win_rate || "0%";
        const winRateVal = parseInt(winRate, 10) || 0;

        return `
          <tr onclick="window.openRankingsBladerModal(${idx})" class="hover:bg-slate-800/60 cursor-pointer transition">
            <!-- Pos -->
            <td class="py-3 px-2 sm:px-3 text-center font-bold ${pos === 1 ? 'text-amber-400 font-black text-sm' : pos === 2 ? 'text-slate-200 font-bold' : pos === 3 ? 'text-amber-600 font-bold' : pos <= 10 ? 'text-cyan-400' : 'text-slate-500'}">
              ${pos === 1 ? '🥇 #1' : pos === 2 ? '🥈 #2' : pos === 3 ? '🥉 #3' : `#${pos}`}
            </td>

            <!-- Blader Info -->
            <td class="py-3 px-2 sm:px-3 font-sans">
              <div class="flex items-center gap-2.5">
                <img src="${avatar}" class="w-8 h-8 rounded-full object-cover border ${pos <= 3 ? 'border-amber-400' : 'border-slate-700'} shrink-0" alt="${bladerName}"/>
                <div>
                  <div class="font-bold text-white hover:text-cyan-300 transition text-xs sm:text-sm">${bladerName}</div>
                  <div class="text-[10px] text-slate-400 font-mono">@${username} • PA 🇵🇦</div>
                </div>
              </div>
            </td>

            <!-- Torneos Jugados -->
            <td class="py-3 px-2 text-center text-slate-300 font-semibold">${item.tournaments_played || 0}</td>

            <!-- Partidas G - P -->
            <td class="py-3 px-2 text-center text-slate-300">
              <span class="text-emerald-400 font-bold">${item.matches_won || 0}G</span> - <span class="text-rose-400">${item.matches_lost || 0}P</span>
              <span class="text-[10px] text-slate-500 block font-sans">(${item.matches_played || ((item.matches_won || 0) + (item.matches_lost || 0))} combates)</span>
            </td>

            <!-- Puntos (+ / -) -->
            <td class="py-3 px-2 text-center text-slate-300">
              <span class="text-cyan-300 font-bold">${item.points_for || 0}</span> / <span class="text-slate-400">${item.points_against || 0}</span>
              <span class="text-[10px] ${diff >= 0 ? 'text-emerald-400' : 'text-rose-400'} block">(${diff >= 0 ? '+' : ''}${diff})</span>
            </td>

            <!-- Bonus -->
            <td class="py-3 px-2 text-center text-amber-300/90">${item.bonus_points || 0}</td>

            <!-- Win Rate -->
            <td class="py-3 px-2 text-center">
              <span class="px-2 py-0.5 rounded-full text-[11px] font-bold ${winRateVal >= 60 ? 'bg-emerald-500/20 text-emerald-400' : winRateVal >= 50 ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-800 text-slate-400'}">
                ${winRate}
              </span>
            </td>

            <!-- Total Points / Elo -->
            <td class="py-3 px-2 sm:px-3 text-right font-black ${isPoints ? 'text-amber-400 text-sm sm:text-base' : 'text-cyan-400 text-sm'}">
              ${isPoints ? `${item.points || 0} pts` : `${item.elo || item.elo_rating || 1500} elo`}
            </td>
          </tr>
        `;
      }).join("");
    };

    const renderFullView = () => {
      const isPoints = selectedRankingType === "points";
      const currentSeasonObj = seasons.find(s => s.id === selectedSeasonId) || activeSeason;
      const filtered = getFilteredData();
      window._rankingsDataFiltered = filtered;
      const top3 = rawRankingData.slice(0, 3);

      container.innerHTML = `
        <div class="space-y-6 max-w-6xl mx-auto pb-16">
          <!-- Header & Controls -->
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold uppercase tracking-wider mb-2">
                <span>🇵🇦</span> Asociación Panameña de Beyblade • APB
              </div>
              <h1 class="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-2">
                <span class="text-amber-400">🏆</span> Ranking Oficial de Bladers
              </h1>
              <p class="text-slate-400 text-xs md:text-sm">Registro histórico oficial con 96 bladers clasificados, estadísticas completas de partidas, victorias, puntos y win rate.</p>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <button onclick="location.hash='#/hall-of-fame'" class="px-4 py-2 rounded-xl bg-amber-600/20 hover:bg-amber-600/40 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-2 shadow transition transform active:scale-95">
                <span>🏛️</span> Salón de la Fama
              </button>
            </div>
          </div>

          <!-- Season & Type Filter Bar -->
          <div class="glass-card rounded-2xl p-4 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div class="flex flex-wrap items-center gap-3">
              <label class="text-xs font-bold text-slate-400 uppercase tracking-wider">Temporada:</label>
              <select id="season-selector" onchange="window.handleSeasonChange(this.value)" class="bg-slate-900 border border-slate-700 text-cyan-300 font-bold rounded-xl px-3 py-2 text-xs outline-none focus:border-cyan-400">
                ${seasons.map(s => `
                  <option value="${s.id}" ${s.id === selectedSeasonId ? 'selected' : ''}>
                    ${s.name} ${s.id === 1 ? '📜 (Oficial 96 Bladers)' : '⚡ (Activa)'}
                  </option>
                `).join("")}
              </select>
            </div>

            <!-- Points vs Elo Switcher -->
            <div class="flex rounded-xl bg-slate-900 p-1 border border-slate-800 text-xs font-bold">
              <button onclick="window.handleRankingTypeChange('points')" class="px-4 py-1.5 rounded-lg transition ${isPoints ? 'bg-amber-500 text-black shadow-lg font-black' : 'text-slate-400 hover:text-white'}">
                🏆 Tabla por Puntos (${rawRankingData.length})
              </button>
              <button onclick="window.handleRankingTypeChange('elo')" class="px-4 py-1.5 rounded-lg transition ${!isPoints ? 'bg-cyan-500 text-black shadow-lg font-black' : 'text-slate-400 hover:text-white'}">
                ⚡ Ranking Elo
              </button>
            </div>
          </div>

          <!-- Podium of Top 3 (shown when not searching and top 3 exists) -->
          ${top3.length >= 3 && !searchQuery ? `
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <!-- 2nd Place -->
              <div class="glass-card rounded-2xl p-6 text-center border border-slate-600 md:order-1 flex flex-col justify-between space-y-3 bg-gradient-to-b from-slate-800/40 to-slate-950/80">
                <div class="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center justify-center gap-1">
                  <span>🥈</span> 2do Lugar Nacional
                </div>
                <div class="relative inline-block mx-auto">
                  <img src="${top3[1].avatar_url || top3[1].user?.avatar_url || 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150'}" class="w-20 h-20 rounded-full border-4 border-slate-400 mx-auto object-cover shadow-lg" alt="2do Lugar"/>
                  <span class="absolute -bottom-2 right-1/2 translate-x-1/2 px-2.5 py-0.5 rounded-full bg-slate-700 text-slate-200 text-xs font-black shadow">#2</span>
                </div>
                <div>
                  <h3 class="font-extrabold text-xl text-white">${top3[1].display_name || top3[1].user?.display_name || 'Woonka'}</h3>
                  <div class="text-xs text-slate-400 font-mono">@${top3[1].username || top3[1].user?.username || 'woonka'} • ${top3[1].country || 'PA'}</div>
                  <div class="text-[11px] text-slate-400 mt-1 font-mono">${top3[1].matches_won || 94} Victorias • ${top3[1].win_rate || '63%'} WR</div>
                </div>
                <div class="text-2xl font-black text-slate-200 font-mono">
                  ${isPoints ? `${top3[1].points || 0} pts` : `${top3[1].elo || top3[1].elo_rating || 1500} elo`}
                </div>
              </div>

              <!-- 1st Place Champion -->
              <div class="glass-card rounded-2xl p-6 text-center border-2 border-amber-400 glow-gold md:order-2 flex flex-col justify-between space-y-3 bg-gradient-to-b from-amber-950/50 via-slate-900 to-slate-950">
                <div class="text-xs font-black text-amber-400 uppercase tracking-widest flex items-center justify-center gap-1.5">
                  <span>👑</span> Campeón de Temporada 1
                </div>
                <div class="relative inline-block mx-auto">
                  <img src="${top3[0].avatar_url || top3[0].user?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}" class="w-24 h-24 rounded-full border-4 border-amber-400 mx-auto object-cover shadow-2xl" alt="Campeón"/>
                  <span class="absolute -bottom-2.5 right-1/2 translate-x-1/2 px-3 py-0.5 rounded-full bg-amber-500 text-black text-xs font-black shadow-lg">#1</span>
                </div>
                <div>
                  <h3 class="font-black text-2xl text-white">${top3[0].display_name || top3[0].user?.display_name || 'Yorch'}</h3>
                  <div class="text-xs text-amber-300 font-mono">@${top3[0].username || top3[0].user?.username || 'yorch'} • ${top3[0].country || 'PA'}</div>
                  <div class="text-xs text-amber-200/80 mt-1 font-mono">${top3[0].matches_won || 96} Victorias • ${top3[0].points_for || 519} Puntos a Favor</div>
                </div>
                <div class="text-3xl font-black text-amber-400 font-mono">
                  ${isPoints ? `${top3[0].points || 0} pts` : `${top3[0].elo || top3[0].elo_rating || 1500} elo`}
                </div>
              </div>

              <!-- 3rd Place -->
              <div class="glass-card rounded-2xl p-6 text-center border border-amber-700/60 md:order-3 flex flex-col justify-between space-y-3 bg-gradient-to-b from-amber-950/30 to-slate-950/80">
                <div class="text-xs font-black text-amber-500 uppercase tracking-wider flex items-center justify-center gap-1">
                  <span>🥉</span> 3er Lugar Nacional
                </div>
                <div class="relative inline-block mx-auto">
                  <img src="${top3[2].avatar_url || top3[2].user?.avatar_url || 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=150'}" class="w-20 h-20 rounded-full border-4 border-amber-700 mx-auto object-cover shadow-lg" alt="3er Lugar"/>
                  <span class="absolute -bottom-2 right-1/2 translate-x-1/2 px-2.5 py-0.5 rounded-full bg-amber-800 text-amber-200 text-xs font-black shadow">#3</span>
                </div>
                <div>
                  <h3 class="font-extrabold text-xl text-white">${top3[2].display_name || top3[2].user?.display_name || 'Kanghy'}</h3>
                  <div class="text-xs text-slate-400 font-mono">@${top3[2].username || top3[2].user?.username || 'kanghy'} • ${top3[2].country || 'PA'}</div>
                  <div class="text-[11px] text-slate-400 mt-1 font-mono">${top3[2].matches_played || 157} Partidas • ${top3[2].points_for || 505} PF</div>
                </div>
                <div class="text-2xl font-black text-amber-500 font-mono">
                  ${isPoints ? `${top3[2].points || 0} pts` : `${top3[2].elo || top3[2].elo_rating || 1500} elo`}
                </div>
              </div>
            </div>
          ` : ''}

          <!-- Search Box & Stats Summary -->
          <div class="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div class="relative w-full sm:w-80">
              <span class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 text-sm">
                🔍
              </span>
              <input
                type="text"
                id="blader-search-input"
                placeholder="Buscar Blader por nombre o @usuario..."
                value="${searchQuery}"
                oninput="window.handleRankingSearch(this.value)"
                class="w-full bg-slate-900/90 border border-slate-700 focus:border-cyan-400 text-white rounded-xl pl-9 pr-4 py-2.5 text-xs outline-none shadow transition"
              />
            </div>
            <div id="ranking-count-summary" class="text-xs text-slate-400 font-mono">
              Mostrando <strong class="text-white">${filtered.length}</strong> de <strong class="text-cyan-400">${rawRankingData.length}</strong> Bladers Oficiales
            </div>
          </div>

          <!-- Official Rankings Table -->
          <div class="glass-card rounded-2xl p-2 sm:p-4 overflow-x-auto border border-slate-800">
            <table class="w-full text-left text-xs sm:text-sm">
              <thead class="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800 bg-slate-900/50">
                <tr>
                  <th class="py-3 px-2 sm:px-3 text-center"># Pos</th>
                  <th class="py-3 px-2 sm:px-3">Blader</th>
                  <th class="py-3 px-2 text-center" title="Torneos Jugados">Torneos</th>
                  <th class="py-3 px-2 text-center" title="Partidas Ganadas y Perdidas">Partidas (G - P)</th>
                  <th class="py-3 px-2 text-center" title="Puntos a Favor / En Contra">Puntos (+ / -)</th>
                  <th class="py-3 px-2 text-center" title="Puntos Bonus Acumulados">Bonus</th>
                  <th class="py-3 px-2 text-center" title="Porcentaje de Victorias">Win Rate</th>
                  <th class="py-3 px-2 sm:px-3 text-right">${isPoints ? 'Puntos Totales' : 'Elo Rating'}</th>
                </tr>
              </thead>
              <tbody id="rankings-table-tbody" class="divide-y divide-slate-800/60 font-mono text-xs">
                ${renderTableBodyHtml(filtered)}
              </tbody>
            </table>
          </div>
        </div>
      `;
    };

    // Fast search without rebuilding the entire DOM tree
    window.handleRankingSearch = (query) => {
      searchQuery = query;
      const filtered = getFilteredData();
      window._rankingsDataFiltered = filtered;

      const tbody = document.getElementById("rankings-table-tbody");
      if (tbody) {
        tbody.innerHTML = renderTableBodyHtml(filtered);
      }

      const countEl = document.getElementById("ranking-count-summary");
      if (countEl) {
        countEl.innerHTML = `Mostrando <strong class="text-white">${filtered.length}</strong> de <strong class="text-cyan-400">${rawRankingData.length}</strong> Bladers Oficiales`;
      }
    };

    window.clearRankingSearch = () => {
      searchQuery = "";
      const input = document.getElementById("blader-search-input");
      if (input) input.value = "";
      window.handleRankingSearch("");
    };

    window.handleSeasonChange = async (seasonId) => {
      selectedSeasonId = parseInt(seasonId, 10);
      await fetchRankingsData();
      renderFullView();
    };

    window.handleRankingTypeChange = async (type) => {
      selectedRankingType = type;
      await fetchRankingsData();
      renderFullView();
    };

    // Modal to view full details of any blader
    window.openRankingsBladerModal = (index) => {
      const b = window._rankingsDataFiltered[index];
      if (!b) return;

      // Remove any existing modal
      const existing = document.getElementById("blader-detail-modal");
      if (existing) existing.remove();

      const name = b.display_name || b.user?.display_name || 'Blader';
      const username = b.username || b.user?.username || 'blader';
      const avatar = b.avatar_url || b.user?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';
      const played = b.matches_played || ((b.matches_won || 0) + (b.matches_lost || 0));
      const diff = (b.points_for || 0) - (b.points_against || 0);

      const modalEl = document.createElement("div");
      modalEl.id = "blader-detail-modal";
      modalEl.className = "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in";
      modalEl.onclick = (e) => {
        if (e.target === modalEl) modalEl.remove();
      };

      modalEl.innerHTML = `
        <div class="glass-card w-full max-w-lg rounded-2xl border border-slate-700 p-6 space-y-5 bg-slate-900 shadow-2xl relative" onclick="event.stopPropagation()">
          <button onclick="document.getElementById('blader-detail-modal').remove()" class="absolute top-4 right-4 p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition">
            ✕
          </button>

          <div class="flex items-center gap-4">
            <div class="relative">
              <img src="${avatar}" class="w-16 h-16 rounded-full border-2 border-amber-400 object-cover" alt="${name}"/>
              <span class="absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full bg-amber-500 text-black text-[10px] font-black shadow">#${b.rank || index + 1}</span>
            </div>
            <div>
              <h2 class="text-xl font-black text-white">${name}</h2>
              <div class="text-xs text-amber-300 font-mono">@${username} • Panamá 🇵🇦</div>
              <div class="text-xs text-slate-400 mt-0.5">Asociación Panameña de Beyblade</div>
            </div>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center font-mono">
            <div class="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
              <div class="text-[10px] text-slate-400 uppercase font-sans">Puntos Totales</div>
              <div class="text-lg font-black text-amber-400">${b.points || 0}</div>
            </div>
            <div class="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
              <div class="text-[10px] text-slate-400 uppercase font-sans">Win Rate</div>
              <div class="text-lg font-black text-emerald-400">${b.win_rate || '0%'}</div>
            </div>
            <div class="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
              <div class="text-[10px] text-slate-400 uppercase font-sans">Torneos</div>
              <div class="text-lg font-black text-white">${b.tournaments_played || 0}</div>
            </div>
            <div class="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
              <div class="text-[10px] text-slate-400 uppercase font-sans">Partidas</div>
              <div class="text-lg font-black text-cyan-400">${played}</div>
            </div>
          </div>

          <div class="space-y-2 text-xs text-slate-300 bg-slate-950/40 p-4 rounded-xl border border-slate-800">
            <div class="flex justify-between py-1 border-b border-slate-800">
              <span class="text-slate-400">Victorias / Derrotas:</span>
              <span class="font-mono font-bold text-emerald-400">${b.matches_won || 0} Ganadas <span class="text-slate-500">/</span> <span class="text-rose-400">${b.matches_lost || 0} Perdidas</span></span>
            </div>
            <div class="flex justify-between py-1 border-b border-slate-800">
              <span class="text-slate-400">Puntos a Favor / En Contra:</span>
              <span class="font-mono font-bold">${b.points_for || 0} Favor / ${b.points_against || 0} Contra (${diff >= 0 ? '+' : ''}${diff})</span>
            </div>
            <div class="flex justify-between py-1 border-b border-slate-800">
              <span class="text-slate-400">Puntos Bonus Acumulados:</span>
              <span class="font-mono font-bold text-amber-300">+${b.bonus_points || 0} pts</span>
            </div>
            <div class="flex justify-between py-1">
              <span class="text-slate-400">Advertencias (Warnings):</span>
              <span class="font-mono font-bold text-slate-400">${b.warnings || 0}</span>
            </div>
          </div>

          <button onclick="document.getElementById('blader-detail-modal').remove()" class="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow transition">
            Cerrar Ficha del Blader
          </button>
        </div>
      `;

      document.body.appendChild(modalEl);
    };

    // Close on Escape key
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        const modal = document.getElementById("blader-detail-modal");
        if (modal) modal.remove();
      }
    });

    await fetchRankingsData();
    renderFullView();
  } catch (e) {
    console.error("Error en renderRankingsView:", e);
    container.innerHTML = `
      <div class="text-center py-16 text-rose-400 space-y-3">
        <div class="text-3xl">⚠️</div>
        <div class="font-bold">Error al cargar los rankings</div>
        <div class="text-xs text-slate-400">${e.message}</div>
        <button onclick="window.renderRankingsView(document.getElementById('main-content'))" class="px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold hover:bg-slate-700">
          Reintentar
        </button>
      </div>
    `;
  }
};
