// Rankings & Leaderboard View with Season Switching (Puntos vs Elo)
window.renderRankingsView = async (container) => {
  container.innerHTML = `<div class="text-center py-16 text-slate-500">Cargando Rankings Oficiales...</div>`;

  try {
    const seasons = await window.api.getSeasons();
    const activeSeason = seasons.find(s => s.is_active) || seasons[0];
    let selectedSeasonId = activeSeason.id;
    let selectedRankingType = "points"; // 'points' or 'elo'

    const renderRankingContent = async () => {
      const isPoints = selectedRankingType === "points";
      let rankingData = [];
      try {
        if (isPoints) {
          rankingData = await window.api.getSeasonPoints(selectedSeasonId);
        } else {
          rankingData = await window.api.getSeasonElo(selectedSeasonId);
        }
      } catch (err) {
        rankingData = [];
      }

      const currentSeasonObj = seasons.find(s => s.id === selectedSeasonId) || activeSeason;

      container.innerHTML = `
        <div class="space-y-6 max-w-5xl mx-auto pb-12">
          <!-- Header & Controls -->
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 class="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-2">
                <span class="text-amber-400">🏅</span> Rankings Oficiales AppBey
              </h1>
              <p class="text-slate-400 text-sm">Consulta las tablas históricas y actuales de Temporada por Puntos y Elo.</p>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <button onclick="location.hash='#/hall-of-fame'" class="px-3.5 py-2 rounded-xl bg-amber-600/20 hover:bg-amber-600/40 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 shadow">
                <span>🏛️</span> Salón de la Fama
              </button>
            </div>
          </div>

          <!-- Season & Type Filter Bar -->
          <div class="glass-card rounded-2xl p-4 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div class="flex items-center gap-3">
              <label class="text-xs font-bold text-slate-400 uppercase tracking-wider">Temporada:</label>
              <select id="season-selector" onchange="handleSeasonChange(this.value)" class="bg-slate-900 border border-slate-700 text-cyan-300 font-bold rounded-xl px-3 py-2 text-xs outline-none focus:border-cyan-400">
                ${seasons.map(s => `
                  <option value="${s.id}" ${s.id === selectedSeasonId ? 'selected' : ''}>
                    ${s.name} ${s.is_active ? '🔥 (Actual)' : '📜 (Histórica)'}
                  </option>
                `).join("")}
              </select>
            </div>

            <!-- Points vs Elo Switcher -->
            <div class="flex rounded-xl bg-slate-900 p-1 border border-slate-800 text-xs font-bold">
              <button onclick="handleRankingTypeChange('points')" class="px-4 py-1.5 rounded-lg transition ${isPoints ? 'bg-amber-500 text-black shadow-lg font-black' : 'text-slate-400 hover:text-white'}">
                🏆 Tabla por Puntos
              </button>
              <button onclick="handleRankingTypeChange('elo')" class="px-4 py-1.5 rounded-lg transition ${!isPoints ? 'bg-cyan-500 text-black shadow-lg font-black' : 'text-slate-400 hover:text-white'}">
                ⚡ Ranking por Elo
              </button>
            </div>
          </div>

          <!-- Season Status Banner -->
          <div class="p-3.5 rounded-xl ${currentSeasonObj.is_active ? 'bg-cyan-950/40 border border-cyan-500/30 text-cyan-300' : 'bg-slate-900 border border-slate-800 text-slate-400'} text-xs flex items-center justify-between">
            <div>
              <strong>${currentSeasonObj.name}:</strong> ${currentSeasonObj.description || ''}
            </div>
            ${currentSeasonObj.is_active && !isPoints ? `
              <span class="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400 text-[10px] font-bold uppercase">Multiplicador Nuevo Activo</span>
            ` : ''}
          </div>

          <!-- Podium of Top 3 if data available -->
          ${rankingData.length >= 3 ? `
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <!-- 2nd Place -->
              <div class="glass-card rounded-2xl p-6 text-center border border-slate-700 md:order-1 flex flex-col justify-between space-y-3">
                <div class="text-xs font-bold text-slate-400 uppercase tracking-wider">2do Lugar</div>
                <div class="relative inline-block mx-auto">
                  <img src="${rankingData[1].user?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120'}" class="w-20 h-20 rounded-full border-4 border-slate-400 mx-auto object-cover shadow-lg"/>
                  <span class="absolute -bottom-2 right-1/2 translate-x-1/2 px-2 py-0.5 rounded-full bg-slate-700 text-slate-200 text-xs font-black">#2</span>
                </div>
                <div>
                  <h3 class="font-extrabold text-lg text-white">${rankingData[1].user?.display_name || 'Blader'}</h3>
                  <div class="text-xs text-slate-400 font-mono">@${rankingData[1].user?.username || ''} • ${rankingData[1].user?.country || 'PA'}</div>
                </div>
                <div class="text-xl font-black text-slate-300 font-mono">
                  ${isPoints ? `${rankingData[1].points} pts` : `${rankingData[1].elo} elo`}
                </div>
              </div>

              <!-- 1st Place Champion -->
              <div class="glass-card rounded-2xl p-6 text-center border-2 border-amber-400 glow-gold md:order-2 flex flex-col justify-between space-y-3 bg-gradient-to-b from-amber-950/40 via-slate-900 to-slate-950">
                <div class="text-xs font-black text-amber-400 uppercase tracking-widest flex items-center justify-center gap-1">
                  <span>👑</span> Campeón de Liga
                </div>
                <div class="relative inline-block mx-auto">
                  <img src="${rankingData[0].user?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120'}" class="w-24 h-24 rounded-full border-4 border-amber-400 mx-auto object-cover shadow-xl"/>
                  <span class="absolute -bottom-2 right-1/2 translate-x-1/2 px-3 py-0.5 rounded-full bg-amber-500 text-black text-xs font-black shadow">#1</span>
                </div>
                <div>
                  <h3 class="font-black text-xl text-white">${rankingData[0].user?.display_name || 'Blader'}</h3>
                  <div class="text-xs text-amber-300 font-mono">@${rankingData[0].user?.username || ''} • ${rankingData[0].user?.country || 'PA'}</div>
                  <div class="text-xs text-slate-400 mt-1">${rankingData[0].user?.favorite_combo || ''}</div>
                </div>
                <div class="text-2xl font-black text-amber-400 font-mono">
                  ${isPoints ? `${rankingData[0].points} pts` : `${rankingData[0].elo} elo`}
                </div>
              </div>

              <!-- 3rd Place -->
              <div class="glass-card rounded-2xl p-6 text-center border border-amber-700/60 md:order-3 flex flex-col justify-between space-y-3">
                <div class="text-xs font-bold text-amber-600 uppercase tracking-wider">3er Lugar</div>
                <div class="relative inline-block mx-auto">
                  <img src="${rankingData[2].user?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120'}" class="w-20 h-20 rounded-full border-4 border-amber-700 mx-auto object-cover shadow-lg"/>
                  <span class="absolute -bottom-2 right-1/2 translate-x-1/2 px-2 py-0.5 rounded-full bg-amber-800 text-amber-200 text-xs font-black">#3</span>
                </div>
                <div>
                  <h3 class="font-extrabold text-lg text-white">${rankingData[2].user?.display_name || 'Blader'}</h3>
                  <div class="text-xs text-slate-400 font-mono">@${rankingData[2].user?.username || ''} • ${rankingData[2].user?.country || 'PA'}</div>
                </div>
                <div class="text-xl font-black text-amber-600 font-mono">
                  ${isPoints ? `${rankingData[2].points} pts` : `${rankingData[2].elo} elo`}
                </div>
              </div>
            </div>
          ` : ''}

          <!-- Ranking Table or Empty State -->
          <div class="glass-card rounded-2xl p-5 overflow-x-auto">
            ${rankingData.length ? `
              <table class="w-full text-left text-sm">
                <thead class="text-xs uppercase text-slate-400 border-b border-slate-800">
                  <tr>
                    <th class="py-3 px-3"># Pos</th>
                    <th class="py-3 px-3">Blader</th>
                    <th class="py-3 px-3 text-center">Torneos</th>
                    <th class="py-3 px-3 text-center">Títulos 🏆</th>
                    <th class="py-3 px-3 text-center">Victorias / Derrotas</th>
                    <th class="py-3 px-3 text-center">País</th>
                    <th class="py-3 px-3 text-right">${isPoints ? 'Puntos Totales' : 'Elo Rating'}</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-800">
                  ${rankingData.map((item, idx) => `
                    <tr class="hover:bg-slate-800/40">
                      <td class="py-3.5 px-3 font-bold ${idx === 0 ? 'text-amber-400 font-extrabold' : idx === 1 ? 'text-slate-300' : idx === 2 ? 'text-amber-600' : 'text-slate-500'}">
                        #${item.rank || idx + 1}
                      </td>
                      <td class="py-3.5 px-3">
                        <div class="flex items-center gap-3">
                          <img src="${item.user?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}" class="w-8 h-8 rounded-full object-cover"/>
                          <div>
                            <div class="font-bold text-white">${item.user?.display_name || 'Blader'}</div>
                            <div class="text-xs text-slate-400">@${item.user?.username || ''}</div>
                          </div>
                        </div>
                      </td>
                      <td class="py-3.5 px-3 text-center text-xs font-mono text-slate-300">${item.tournaments_played || 0}</td>
                      <td class="py-3.5 px-3 text-center text-xs font-mono font-bold text-amber-400">${item.tournaments_won || 0}</td>
                      <td class="py-3.5 px-3 text-center text-xs font-mono text-slate-300">${item.matches_won || 0}W - ${item.matches_lost || 0}L</td>
                      <td class="py-3.5 px-3 text-center text-xs font-mono font-bold text-cyan-400">${item.user?.country || 'PA'}</td>
                      <td class="py-3.5 px-3 text-right font-mono font-black ${isPoints ? 'text-amber-400' : 'text-cyan-400'}">
                        ${isPoints ? `${item.points} pts` : `${item.elo} elo`}
                      </td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            ` : `
              <div class="text-center py-12 space-y-3">
                <div class="text-4xl">⚡</div>
                <h3 class="text-base font-bold text-white">Ranking Elo en Preparación</h3>
                <p class="text-xs text-slate-400 max-w-md mx-auto">
                  El ranking Elo de esta temporada iniciará una vez disputadas las primeras rondas del nuevo circuito con el nuevo multiplicador.
                </p>
              </div>
            `}
          </div>
        </div>
      `;
    };

    window.handleSeasonChange = (seasonId) => {
      selectedSeasonId = parseInt(seasonId, 10);
      renderRankingContent();
    };

    window.handleRankingTypeChange = (type) => {
      selectedRankingType = type;
      renderRankingContent();
    };

    renderRankingContent();
  } catch(e) {
    container.innerHTML = `<div class="text-center py-16 text-rose-400">Error: ${e.message}</div>`;
  }
};
