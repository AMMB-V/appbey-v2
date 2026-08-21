// Mobile-Optimized Referee Scoring Pad View
window.renderRefereePadView = async (container, matchId) => {
  container.innerHTML = `<div class="text-center py-16 text-slate-500">Cargando mesa de arbitraje #${matchId}...</div>`;

  let match = null;

  const loadMatch = async () => {
    try {
      match = await window.api.getMatch(matchId);
      renderUI();
    } catch(err) {
      container.innerHTML = `<div class="text-center py-16 text-rose-400">Error: ${err.message}</div>`;
    }
  };

  const renderUI = () => {
    const isFinished = match.status === "finished";
    const target = 4; // Standard Beyblade X target points

    container.innerHTML = `
      <div class="max-w-2xl mx-auto space-y-5 pb-12 select-none">
        <!-- Top Referee Header -->
        <div class="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800 pb-2">
          <button onclick="location.hash='#/tournaments/${match.tournament_id}'" class="text-cyan-400 hover:underline flex items-center gap-1 font-bold">
            &larr; Volver al Torneo
          </button>
          <span class="font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            Stadium #${match.station_number} • Ronda ${match.round_number}
          </span>
          <span class="font-mono text-slate-500">Match #${match.id}</span>
        </div>

        <!-- Live Scoreboard Hero -->
        <div class="glass-card rounded-3xl p-6 border-2 ${isFinished ? 'border-amber-500 glow-gold' : 'border-cyan-500/40 glow-cyan'} text-center space-y-4">
          <div class="text-xs uppercase font-bold tracking-widest text-slate-400">
            ${isFinished ? '🏆 MATCH FINALIZADO' : 'COMBATE EN VIVO • META: 4 PUNTOS'}
          </div>

          <div class="grid grid-cols-2 gap-4 items-center">
            <!-- Player A (Blue Corner) -->
            <div class="space-y-2 text-center">
              <div class="relative inline-block">
                <img src="${match.player_a ? match.player_a.avatar_url : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}" class="w-16 h-16 sm:w-20 sm:h-20 rounded-full mx-auto border-4 border-blue-500 shadow-lg object-cover"/>
                ${match.winner_id === match.player_a_id ? '<span class="absolute -top-2 -right-2 text-2xl">👑</span>' : ''}
              </div>
              <div class="font-black text-base sm:text-lg text-white truncate">${match.player_a ? match.player_a.display_name : 'Player A'}</div>
              <div class="text-xs text-blue-400 font-semibold truncate">${match.player_a ? match.player_a.favorite_combo || 'Corner Azul' : ''}</div>
              <div class="font-mono text-5xl sm:text-6xl font-black text-cyan-400 py-1">${match.score_a}</div>
            </div>

            <!-- Player B (Red Corner) -->
            <div class="space-y-2 text-center">
              <div class="relative inline-block">
                <img src="${match.player_b ? match.player_b.avatar_url : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}" class="w-16 h-16 sm:w-20 sm:h-20 rounded-full mx-auto border-4 border-rose-500 shadow-lg object-cover"/>
                ${match.winner_id === match.player_b_id ? '<span class="absolute -top-2 -right-2 text-2xl">👑</span>' : ''}
              </div>
              <div class="font-black text-base sm:text-lg text-white truncate">${match.player_b ? match.player_b.display_name : 'Player B'}</div>
              <div class="text-xs text-rose-400 font-semibold truncate">${match.player_b ? match.player_b.favorite_combo || 'Corner Rojo' : ''}</div>
              <div class="font-mono text-5xl sm:text-6xl font-black text-rose-400 py-1">${match.score_b}</div>
            </div>
          </div>
        </div>

        ${!isFinished ? `
          <!-- 1-Touch Touch Referee Buttons for Beyblade X -->
          <div class="space-y-4">
            <div class="text-xs font-bold uppercase tracking-wider text-slate-400 text-center">
              Puntos del Combate (1-Toque)
            </div>

            <div class="grid grid-cols-2 gap-4">
              <!-- Player A (Blue) Scoring Column -->
              <div class="space-y-2.5">
                <div class="text-xs font-bold text-blue-400 uppercase text-center">Para Corner Azul</div>
                
                <button onclick="submitFinish('spin_finish_1p', 'player_a')" class="referee-btn w-full py-3.5 px-3 rounded-2xl bg-gradient-to-r from-blue-700 to-blue-600 hover:from-blue-600 hover:to-blue-500 text-white font-bold text-sm shadow-md border border-blue-400/40 flex items-center justify-between">
                  <span>Spin Finish</span>
                  <span class="px-2 py-0.5 rounded-full bg-blue-900 text-cyan-300 font-mono text-xs">+1 pt</span>
                </button>

                <button onclick="submitFinish('over_finish_2p', 'player_a')" class="referee-btn w-full py-3.5 px-3 rounded-2xl bg-gradient-to-r from-indigo-700 to-blue-600 hover:from-indigo-600 hover:to-blue-500 text-white font-bold text-sm shadow-md border border-indigo-400/40 flex items-center justify-between">
                  <span>Over Finish</span>
                  <span class="px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 font-mono text-xs">+2 pts</span>
                </button>

                <button onclick="submitFinish('burst_finish_2p', 'player_a')" class="referee-btn w-full py-3.5 px-3 rounded-2xl bg-gradient-to-r from-purple-700 to-indigo-600 hover:from-purple-600 hover:to-indigo-500 text-white font-bold text-sm shadow-md border border-purple-400/40 flex items-center justify-between">
                  <span>Burst Finish</span>
                  <span class="px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 font-mono text-xs">+2 pts</span>
                </button>

                <button onclick="submitFinish('xtreme_finish_3p', 'player_a')" class="referee-btn w-full py-4 px-3 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-extrabold text-sm shadow-lg shadow-cyan-500/30 border border-cyan-300 flex items-center justify-between animate-pulse">
                  <span>⚡ Xtreme Finish</span>
                  <span class="px-2.5 py-1 rounded-full bg-black/40 text-amber-300 font-mono text-xs">+3 pts</span>
                </button>
              </div>

              <!-- Player B (Red) Scoring Column -->
              <div class="space-y-2.5">
                <div class="text-xs font-bold text-rose-400 uppercase text-center">Para Corner Rojo</div>

                <button onclick="submitFinish('spin_finish_1p', 'player_b')" class="referee-btn w-full py-3.5 px-3 rounded-2xl bg-gradient-to-r from-rose-700 to-red-600 hover:from-rose-600 hover:to-red-500 text-white font-bold text-sm shadow-md border border-rose-400/40 flex items-center justify-between">
                  <span>Spin Finish</span>
                  <span class="px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 font-mono text-xs">+1 pt</span>
                </button>

                <button onclick="submitFinish('over_finish_2p', 'player_b')" class="referee-btn w-full py-3.5 px-3 rounded-2xl bg-gradient-to-r from-orange-700 to-rose-600 hover:from-orange-600 hover:to-rose-500 text-white font-bold text-sm shadow-md border border-orange-400/40 flex items-center justify-between">
                  <span>Over Finish</span>
                  <span class="px-2 py-0.5 rounded-full bg-orange-950 text-orange-300 font-mono text-xs">+2 pts</span>
                </button>

                <button onclick="submitFinish('burst_finish_2p', 'player_b')" class="referee-btn w-full py-3.5 px-3 rounded-2xl bg-gradient-to-r from-pink-700 to-rose-600 hover:from-pink-600 hover:to-rose-500 text-white font-bold text-sm shadow-md border border-pink-400/40 flex items-center justify-between">
                  <span>Burst Finish</span>
                  <span class="px-2 py-0.5 rounded-full bg-pink-950 text-pink-300 font-mono text-xs">+2 pts</span>
                </button>

                <button onclick="submitFinish('xtreme_finish_3p', 'player_b')" class="referee-btn w-full py-4 px-3 rounded-2xl bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white font-extrabold text-sm shadow-lg shadow-rose-500/30 border border-amber-300 flex items-center justify-between animate-pulse">
                  <span>⚡ Xtreme Finish</span>
                  <span class="px-2.5 py-1 rounded-full bg-black/40 text-amber-300 font-mono text-xs">+3 pts</span>
                </button>
              </div>
            </div>

            <!-- Penalties & Null Launches -->
            <div class="grid grid-cols-2 gap-3 pt-2">
              <button onclick="submitFinish('penalty_1p', 'player_b')" class="referee-btn py-2 px-3 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 border border-slate-700">
                ⚠️ Falta / Penalty (+1 Azul)
              </button>
              <button onclick="submitFinish('penalty_1p', 'player_a')" class="referee-btn py-2 px-3 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 border border-slate-700">
                ⚠️ Falta / Penalty (+1 Rojo)
              </button>
            </div>
          </div>
        ` : `
          <div class="p-6 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-3">
            <h3 class="font-bold text-lg text-white">Combate Concluido</h3>
            <p class="text-xs text-slate-400">El resultado ha sido registrado y sincronizado con el bracket oficial del torneo.</p>
            <button onclick="location.hash='#/tournaments/${match.tournament_id}'" class="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow">
              Regresar al Torneo
            </button>
          </div>
        `}

        <!-- Asaltos / Games Timeline -->
        <div class="glass-card rounded-2xl p-4 space-y-3">
          <h4 class="font-bold text-sm text-slate-300">Historial de Asaltos</h4>
          <div class="space-y-2">
            ${match.games && match.games.length ? match.games.map(g => `
              <div class="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs">
                <div class="flex items-center gap-2">
                  <span class="w-5 h-5 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center font-mono font-bold">${g.game_order}</span>
                  <span class="font-bold ${g.awarded_to === 'player_a' ? 'text-blue-400' : 'text-rose-400'}">
                    ${g.awarded_to === 'player_a' ? match.player_a.display_name : match.player_b.display_name}
                  </span>
                  <span class="text-slate-400">(${g.finish_type.replace('_', ' ').toUpperCase()})</span>
                </div>
                <span class="font-mono font-bold text-amber-400">+${g.points} pts</span>
              </div>
            `).join("") : '<div class="text-xs text-slate-500 text-center py-4">No hay asaltos registrados aún</div>'}
          </div>
        </div>
      </div>
    `;
  };

  window.submitFinish = async (finishType, awardedTo) => {
    try {
      await window.api.recordFinish(matchId, {
        finish_type: finishType,
        awarded_to: awardedTo,
        notes: `Marcado desde mesa de arbitraje`
      });
      loadMatch();
    } catch(err) {
      alert(err.message || "Error al registrar resultado");
    }
  };

  loadMatch();
};
