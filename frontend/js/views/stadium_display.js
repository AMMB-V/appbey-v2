// Stadium Display / TV Projector Mode View
window.renderStadiumDisplayView = async (container, tournamentId) => {
  let tournament = null;
  let matches = [];

  const refresh = async () => {
    try {
      tournament = await window.api.getTournament(tournamentId);
      matches = await window.api.getMatches(tournamentId);
      renderDisplay();
    } catch(e) {
      console.error(e);
    }
  };

  window.wsHub.connect(tournamentId);
  window.wsHub.on("score_update", () => refresh());
  window.wsHub.on("match_call", () => refresh());

  const renderDisplay = () => {
    const activeMatches = matches.filter(m => m.status === 'in_progress' || m.status === 'calling');
    const recentMatches = matches.filter(m => m.status === 'finished').slice(-4);

    container.innerHTML = `
      <div class="fixed inset-0 z-50 bg-[#040817] text-white p-6 overflow-y-auto flex flex-col justify-between select-none">
        <!-- Top Stadium Header -->
        <div class="flex items-center justify-between border-b border-cyan-500/30 pb-4">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center font-black text-2xl text-white shadow-lg shadow-cyan-500/40">
              ⚡
            </div>
            <div>
              <div class="text-xs uppercase tracking-widest text-cyan-400 font-extrabold flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                AppBey 2.0 Live Stadium Display • ${tournament.country}
              </div>
              <h1 class="text-2xl md:text-3xl font-black text-white tracking-wide">${tournament.title}</h1>
            </div>
          </div>

          <div class="flex items-center gap-4">
            <div class="text-right">
              <div class="text-xs text-slate-400">Ronda Actual</div>
              <div class="text-xl font-extrabold text-amber-400 font-mono">Ronda ${tournament.current_round} / ${tournament.total_rounds}</div>
            </div>
            <button onclick="location.hash='#/tournaments/${tournamentId}'" class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 border border-slate-700">
              Salir de Pantalla Completa
            </button>
          </div>
        </div>

        <!-- Main Live Stations Grid -->
        <div class="my-6 grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
          ${activeMatches.length ? activeMatches.map(m => `
            <div class="glass-card rounded-3xl p-6 border-2 ${m.status === 'in_progress' ? 'border-cyan-400 glow-cyan' : 'border-amber-400 animate-pulse'} flex flex-col justify-between space-y-6">
              <!-- Station Header -->
              <div class="flex items-center justify-between">
                <span class="px-4 py-1.5 rounded-full bg-blue-600/30 border border-cyan-400 text-cyan-300 font-black text-sm uppercase tracking-wider">
                  🏟️ Stadium / Mesa #${m.station_number}
                </span>
                <span class="px-3 py-1 rounded-full text-xs font-extrabold uppercase ${m.status === 'in_progress' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}">
                  ${m.status === 'in_progress' ? '• EN COMBATE' : '⚠️ LLAMADO A MESA'}
                </span>
              </div>

              <!-- Versus Display -->
              <div class="grid grid-cols-3 gap-2 items-center text-center">
                <!-- Blue Blader -->
                <div class="space-y-2">
                  <img src="${m.player_a ? m.player_a.avatar_url : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120'}" class="w-20 h-20 sm:w-24 sm:h-24 rounded-full mx-auto border-4 border-blue-500 shadow-xl object-cover"/>
                  <div class="font-black text-lg sm:text-xl text-white truncate">${m.player_a ? m.player_a.display_name : 'TBD'}</div>
                  <div class="text-xs text-blue-400 font-bold truncate">${m.player_a ? m.player_a.favorite_combo || '' : ''}</div>
                </div>

                <!-- Live Score Counter -->
                <div class="flex flex-col items-center justify-center">
                  <div class="font-mono text-5xl sm:text-7xl font-black tracking-tight text-white flex items-center gap-2">
                    <span class="${m.score_a > m.score_b ? 'text-cyan-400' : 'text-slate-300'}">${m.score_a}</span>
                    <span class="text-slate-600 text-3xl">:</span>
                    <span class="${m.score_b > m.score_a ? 'text-rose-400' : 'text-slate-300'}">${m.score_b}</span>
                  </div>
                  <div class="text-[11px] font-bold uppercase tracking-widest text-slate-500 mt-2">Meta: 4 pts</div>
                </div>

                <!-- Red Blader -->
                <div class="space-y-2">
                  <img src="${m.player_b ? m.player_b.avatar_url : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120'}" class="w-20 h-20 sm:w-24 sm:h-24 rounded-full mx-auto border-4 border-rose-500 shadow-xl object-cover"/>
                  <div class="font-black text-lg sm:text-xl text-white truncate">${m.player_b ? m.player_b.display_name : 'TBD'}</div>
                  <div class="text-xs text-rose-400 font-bold truncate">${m.player_b ? m.player_b.favorite_combo || '' : ''}</div>
                </div>
              </div>

              <!-- Station Footer -->
              <div class="pt-2 text-center text-xs text-slate-400 border-t border-slate-800">
                ${m.games && m.games.length ? `Último asalto: <strong>${m.games[m.games.length - 1].finish_type.replace('_', ' ').toUpperCase()}</strong>` : 'Combate listo para comenzar'}
              </div>
            </div>
          `).join("") : `
            <div class="col-span-full glass-card rounded-3xl p-12 text-center text-slate-400 space-y-4">
              <div class="text-5xl">⚡</div>
              <h2 class="text-2xl font-bold text-white">No hay combates activos en este instante</h2>
              <p class="text-sm text-slate-400 max-w-md mx-auto">Los organizadores están asignando emparejamientos y mesas para la siguiente fase.</p>
            </div>
          `}
        </div>

        <!-- Bottom Finished Matches Ticker -->
        <div class="glass-card rounded-2xl p-4 border border-slate-800/80 flex items-center justify-between gap-4 text-xs overflow-x-auto">
          <span class="font-bold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
            <span>🏆</span> Resultados Recientes:
          </span>
          <div class="flex items-center gap-6 shrink-0">
            ${recentMatches.length ? recentMatches.map(m => `
              <div class="flex items-center gap-2">
                <span class="font-bold ${m.winner_id === m.player_a_id ? 'text-amber-400' : 'text-slate-400'}">${m.player_a ? m.player_a.display_name : ''}</span>
                <span class="px-2 py-0.5 rounded bg-slate-900 font-mono font-bold text-white">${m.score_a} - ${m.score_b}</span>
                <span class="font-bold ${m.winner_id === m.player_b_id ? 'text-amber-400' : 'text-slate-400'}">${m.player_b ? m.player_b.display_name : ''}</span>
              </div>
            `).join("") : '<span class="text-slate-500">Ningún match finalizado aún</span>'}
          </div>
          <div class="font-mono text-cyan-400 font-bold shrink-0">
            UC x AppBey
          </div>
        </div>
      </div>
    `;
  };

  refresh();
};
