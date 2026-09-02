// Mobile-Optimized Referee Scoring Pad View
window.renderRefereePadView = async (container, matchId) => {
  if (!matchId) {
    container.innerHTML = `
      <div class="max-w-2xl mx-auto space-y-6 py-8">
        <div class="glass-card rounded-3xl p-8 border border-cyan-500/40 text-center space-y-4">
          <div class="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center font-black text-3xl text-white mx-auto shadow-lg shadow-cyan-500/30">
            ⚖️
          </div>
          <h2 class="text-2xl font-black text-white">Mesa de Arbitraje Oficial</h2>
          <p class="text-xs text-slate-300 max-w-md mx-auto">
            El marcador táctil de 1-toque se activa dentro del panel de cada torneo en curso. Selecciona un torneo activo para abrir la mesa correspondiente.
          </p>
          <div class="pt-2 flex justify-center gap-3">
            <button onclick="location.hash='#/tournaments'" class="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/25 transition">
              Ver Torneos Disponibles
            </button>
          </div>
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = `<div class="text-center py-16 text-slate-500">Cargando mesa de arbitraje #${matchId}...</div>`;

  let match = null;

  const loadMatch = async () => {
    try {
      match = await window.api.getMatch(matchId);
      renderUI();
    } catch(err) {
      container.innerHTML = `
        <div class="max-w-md mx-auto my-12 glass-card p-6 rounded-2xl text-center space-y-4 border border-slate-800">
          <div class="text-4xl">⚠️</div>
          <h3 class="font-bold text-white text-base">Combate no encontrado</h3>
          <p class="text-xs text-slate-400">El combate #${matchId} no existe o el torneo aún no ha generado las mesas de esta ronda.</p>
          <button onclick="location.hash='#/tournaments'" class="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow">
            Ir a Torneos
          </button>
        </div>
      `;
    }
  };

  const renderUI = () => {
    const isFinished = match.status === "finished";
    const target = match.tournament ? (match.tournament.match_target_points || 4) : 4;

    container.innerHTML = `
      <div class="max-w-2xl mx-auto space-y-5 pb-12 select-none">
        <!-- Top Referee Header -->
        <div class="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800 pb-2">
          <button onclick="location.hash='#/tournaments/${match.tournament_id}'" class="text-cyan-400 hover:underline flex items-center gap-1 font-bold">
            &larr; Volver al Torneo
          </button>
          <span class="font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
            <span class="w-2 h-2 rounded-full ${isFinished ? 'bg-slate-500' : 'bg-emerald-400 animate-ping'}"></span>
            Stadium #${match.station_number} • Ronda ${match.round_number}
          </span>
          <span class="font-mono text-slate-500">Match #${match.id}</span>
        </div>

        <!-- Live Scoreboard Hero -->
        <div class="glass-card rounded-3xl p-6 border-2 ${isFinished ? 'border-amber-500 glow-gold' : 'border-cyan-500/40 glow-cyan'} text-center space-y-4">
          <div class="flex items-center justify-between">
            <span class="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${isFinished ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}">
              ${isFinished ? '🏆 MATCH FINALIZADO' : '⚡ COMBATE EN CURSO'}
            </span>
            <span class="text-[11px] text-slate-300 font-semibold bg-slate-900 px-3 py-1 rounded-full border border-slate-800">
              Meta: Primero a <strong class="text-cyan-400">${target} pts</strong> (Máx posible: 5 o 6 pts)
            </span>
          </div>

          <div class="grid grid-cols-2 gap-4 items-center pt-1">
            <!-- Player A (Blue Corner) -->
            <div class="space-y-2 text-center p-3 rounded-2xl bg-blue-950/20 border border-blue-900/30">
              <div class="relative inline-block">
                <img src="${match.player_a ? match.player_a.avatar_url : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}" class="w-16 h-16 sm:w-20 sm:h-20 rounded-full mx-auto border-4 border-blue-500 shadow-lg object-cover"/>
                ${match.winner_id === match.player_a_id ? '<span class="absolute -top-2 -right-2 text-2xl">👑</span>' : ''}
              </div>
              <div class="font-black text-base sm:text-lg text-white truncate">${match.player_a ? match.player_a.display_name : 'Player A'}</div>
              <div class="text-xs text-blue-400 font-semibold truncate">${match.player_a ? match.player_a.favorite_combo || 'Corner Azul' : ''}</div>
              <div class="font-mono text-5xl sm:text-6xl font-black text-cyan-400 py-1">${match.score_a}</div>
            </div>

            <!-- Player B (Red Corner) -->
            <div class="space-y-2 text-center p-3 rounded-2xl bg-rose-950/20 border border-rose-900/30">
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

        <!-- Touch Referee Buttons for Beyblade X -->
        ${!isFinished ? `
          <div class="space-y-4">
            <div class="text-xs font-bold uppercase tracking-wider text-slate-400 text-center flex items-center justify-between">
              <span>Registrar Puntos del Asalto (1-Toque)</span>
              <span class="text-[10px] text-cyan-400 font-normal">Sincronización instantánea</span>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <!-- Player A (Blue) Scoring Column -->
              <div class="space-y-2.5">
                <div class="text-xs font-bold text-blue-400 uppercase text-center pb-1">Para Corner Azul</div>
                
                <button onclick="submitFinish('spin_finish_1p', 'player_a')" class="referee-btn w-full py-3.5 px-3 rounded-2xl bg-gradient-to-r from-blue-700 to-blue-600 hover:from-blue-600 hover:to-blue-500 text-white font-bold text-sm shadow-md border border-blue-400/40 flex items-center justify-between active:scale-95 transition">
                  <span>Spin Finish</span>
                  <span class="px-2 py-0.5 rounded-full bg-blue-900 text-cyan-300 font-mono text-xs">+1 pt</span>
                </button>

                <button onclick="submitFinish('over_finish_2p', 'player_a')" class="referee-btn w-full py-3.5 px-3 rounded-2xl bg-gradient-to-r from-indigo-700 to-blue-600 hover:from-indigo-600 hover:to-blue-500 text-white font-bold text-sm shadow-md border border-indigo-400/40 flex items-center justify-between active:scale-95 transition">
                  <span>Over Finish</span>
                  <span class="px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 font-mono text-xs">+2 pts</span>
                </button>

                <button onclick="submitFinish('burst_finish_2p', 'player_a')" class="referee-btn w-full py-3.5 px-3 rounded-2xl bg-gradient-to-r from-purple-700 to-indigo-600 hover:from-purple-600 hover:to-indigo-500 text-white font-bold text-sm shadow-md border border-purple-400/40 flex items-center justify-between active:scale-95 transition">
                  <span>Burst Finish</span>
                  <span class="px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 font-mono text-xs">+2 pts</span>
                </button>

                <button onclick="submitFinish('xtreme_finish_3p', 'player_a')" class="referee-btn w-full py-4 px-3 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-extrabold text-sm shadow-lg shadow-cyan-500/30 border border-cyan-300 flex items-center justify-between active:scale-95 transition">
                  <span>⚡ Xtreme Finish</span>
                  <span class="px-2.5 py-1 rounded-full bg-black/40 text-amber-300 font-mono text-xs">+3 pts</span>
                </button>
              </div>

              <!-- Player B (Red) Scoring Column -->
              <div class="space-y-2.5">
                <div class="text-xs font-bold text-rose-400 uppercase text-center pb-1">Para Corner Rojo</div>

                <button onclick="submitFinish('spin_finish_1p', 'player_b')" class="referee-btn w-full py-3.5 px-3 rounded-2xl bg-gradient-to-r from-rose-700 to-red-600 hover:from-rose-600 hover:to-red-500 text-white font-bold text-sm shadow-md border border-rose-400/40 flex items-center justify-between active:scale-95 transition">
                  <span>Spin Finish</span>
                  <span class="px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 font-mono text-xs">+1 pt</span>
                </button>

                <button onclick="submitFinish('over_finish_2p', 'player_b')" class="referee-btn w-full py-3.5 px-3 rounded-2xl bg-gradient-to-r from-orange-700 to-rose-600 hover:from-orange-600 hover:to-rose-500 text-white font-bold text-sm shadow-md border border-orange-400/40 flex items-center justify-between active:scale-95 transition">
                  <span>Over Finish</span>
                  <span class="px-2 py-0.5 rounded-full bg-orange-950 text-orange-300 font-mono text-xs">+2 pts</span>
                </button>

                <button onclick="submitFinish('burst_finish_2p', 'player_b')" class="referee-btn w-full py-3.5 px-3 rounded-2xl bg-gradient-to-r from-pink-700 to-rose-600 hover:from-pink-600 hover:to-rose-500 text-white font-bold text-sm shadow-md border border-pink-400/40 flex items-center justify-between active:scale-95 transition">
                  <span>Burst Finish</span>
                  <span class="px-2 py-0.5 rounded-full bg-pink-950 text-pink-300 font-mono text-xs">+2 pts</span>
                </button>

                <button onclick="submitFinish('xtreme_finish_3p', 'player_b')" class="referee-btn w-full py-4 px-3 rounded-2xl bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white font-extrabold text-sm shadow-lg shadow-rose-500/30 border border-amber-300 flex items-center justify-between active:scale-95 transition">
                  <span>⚡ Xtreme Finish</span>
                  <span class="px-2.5 py-1 rounded-full bg-black/40 text-amber-300 font-mono text-xs">+3 pts</span>
                </button>
              </div>
            </div>

            <!-- Penalties & Null Launches -->
            <div class="grid grid-cols-2 gap-3 pt-1">
              <button onclick="submitFinish('penalty_1p', 'player_a')" class="referee-btn py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-blue-300 text-xs font-semibold border border-blue-900/50 flex items-center justify-between">
                <span>⚠️ Penalty / Falta</span>
                <span class="text-cyan-400 font-mono">+1 Azul</span>
              </button>
              <button onclick="submitFinish('penalty_1p', 'player_b')" class="referee-btn py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-rose-300 text-xs font-semibold border border-rose-900/50 flex items-center justify-between">
                <span>⚠️ Penalty / Falta</span>
                <span class="text-rose-400 font-mono">+1 Rojo</span>
              </button>
            </div>
          </div>
        ` : `
          <!-- Finished Match Banner & Controls -->
          <div class="p-6 rounded-3xl bg-slate-900/90 border border-amber-500/40 text-center space-y-4 glow-gold">
            <div class="text-4xl">👑</div>
            <h3 class="font-extrabold text-xl text-white">
              ¡Ganador: <span class="text-amber-400">${match.winner_id === match.player_a_id ? match.player_a?.display_name : match.player_b?.display_name}</span>!
            </h3>
            <p class="text-xs text-slate-300 max-w-md mx-auto">
              El combate ha alcanzado la meta requerida (${target}+ puntos) con un resultado final de <strong class="text-white">${match.score_a} - ${match.score_b}</strong>.
            </p>
            <div class="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button onclick="handleUndoLastFinish()" class="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs border border-slate-700 flex items-center gap-1.5 transition">
                <span>⏪</span> Deshacer Último Asalto
              </button>
              <button onclick="handleReopenMatch()" class="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow flex items-center gap-1.5 transition">
                <span>🔓</span> Reabrir Combate
              </button>
              <button onclick="location.hash='#/tournaments/${match.tournament_id}'" class="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs shadow transition">
                Volver al Torneo &rarr;
              </button>
            </div>
          </div>
        `}

        <!-- Quick Referee Control Tools Bar -->
        <div class="glass-card rounded-2xl p-4 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div class="text-slate-400 font-semibold flex items-center gap-2">
            <span>⚙️ Herramientas de Mesa:</span>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            ${match.games && match.games.length ? `
              <button onclick="handleUndoLastFinish()" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold border border-slate-700 flex items-center gap-1">
                <span>⏪</span> Deshacer Asalto
              </button>
            ` : ''}
            <button onclick="openManualScoreModal()" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold border border-slate-700 flex items-center gap-1">
              <span>✏️</span> Ajuste Manual
            </button>
            <button onclick="handleResetMatchScore()" class="px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 font-semibold border border-rose-900/40">
              Reiniciar (0-0)
            </button>
          </div>
        </div>

        <!-- Asaltos / Games Timeline -->
        <div class="glass-card rounded-2xl p-4 space-y-3 border border-slate-800">
          <div class="flex items-center justify-between">
            <h4 class="font-bold text-sm text-slate-300 flex items-center gap-2">
              <span>📋</span> Historial de Asaltos (${match.games ? match.games.length : 0})
            </h4>
            <span class="text-[10px] text-slate-500">Orden cronológico</span>
          </div>

          <div class="space-y-2">
            ${match.games && match.games.length ? match.games.map(g => {
              const finishName = g.finish_type.replace('_1p', '').replace('_2p', '').replace('_3p', '').replace('_0p', '').replace('_', ' ').toUpperCase();
              return `
                <div class="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between text-xs">
                  <div class="flex items-center gap-2.5">
                    <span class="w-6 h-6 rounded-full bg-slate-800 text-cyan-400 flex items-center justify-center font-mono font-bold text-xs">${g.game_order}</span>
                    <div>
                      <span class="font-bold ${g.awarded_to === 'player_a' ? 'text-blue-400' : 'text-rose-400'}">
                        ${g.awarded_to === 'player_a' ? (match.player_a?.display_name || 'Corner Azul') : (match.player_b?.display_name || 'Corner Rojo')}
                      </span>
                      <span class="text-[11px] text-slate-400 font-mono ml-1.5">(${finishName})</span>
                    </div>
                  </div>
                  <span class="font-mono font-black ${g.points >= 3 ? 'text-amber-400' : 'text-emerald-400'}">+${g.points} pts</span>
                </div>
              `;
            }).join("") : '<div class="text-xs text-slate-500 text-center py-4">No hay asaltos registrados aún en este combate</div>'}
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

  window.handleUndoLastFinish = async () => {
    try {
      await window.api.undoFinish(matchId);
      loadMatch();
    } catch(err) {
      alert(err.message || "Error al deshacer asalto");
    }
  };

  window.handleReopenMatch = async () => {
    try {
      await window.api.reopenMatch(matchId);
      loadMatch();
    } catch(err) {
      alert(err.message || "Error al reabrir combate");
    }
  };

  window.handleResetMatchScore = async () => {
    if (!confirm("¿Estás seguro de reiniciar el marcador a 0-0 y borrar los asaltos de esta mesa?")) return;
    try {
      await window.api.resetMatch(matchId);
      loadMatch();
    } catch(err) {
      alert(err.message || "Error al reiniciar marcador");
    }
  };

  window.openManualScoreModal = () => {
    const modal = document.createElement("div");
    modal.id = "manual-score-modal";
    modal.className = "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm";
    modal.innerHTML = `
      <div class="glass-card max-w-sm w-full rounded-2xl p-6 border border-cyan-500/40 space-y-4">
        <div class="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 class="font-bold text-white text-base">Ajuste Manual de Marcador</h3>
          <button onclick="document.getElementById('manual-score-modal').remove()" class="text-slate-400 hover:text-white text-lg">&times;</button>
        </div>
        <form onsubmit="submitManualScore(event)" class="space-y-4 text-xs">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-blue-400 font-bold mb-1">${match.player_a?.display_name || 'Corner Azul'}</label>
              <input type="number" name="score_a" min="0" max="15" value="${match.score_a}" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-center text-xl font-mono font-black text-cyan-400 outline-none focus:border-cyan-400"/>
            </div>
            <div>
              <label class="block text-rose-400 font-bold mb-1">${match.player_b?.display_name || 'Corner Rojo'}</label>
              <input type="number" name="score_b" min="0" max="15" value="${match.score_b}" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-center text-xl font-mono font-black text-rose-400 outline-none focus:border-rose-400"/>
            </div>
          </div>
          <div>
            <label class="block text-slate-300 font-semibold mb-1">Estado del Combate</label>
            <select name="status" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white outline-none focus:border-cyan-400">
              <option value="in_progress" ${match.status === 'in_progress' ? 'selected' : ''}>En Curso (Permitir seguir marcando)</option>
              <option value="finished" ${match.status === 'finished' ? 'selected' : ''}>Finalizado (Declarar Ganador)</option>
              <option value="pending" ${match.status === 'pending' ? 'selected' : ''}>Pendiente</option>
            </select>
          </div>
          <div class="pt-2 flex justify-end gap-2">
            <button type="button" onclick="document.getElementById('manual-score-modal').remove()" class="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold">
              Cancelar
            </button>
            <button type="submit" class="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold shadow">
              Guardar Marcador
            </button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
  };

  window.submitManualScore = async (e) => {
    e.preventDefault();
    const form = e.target;
    try {
      await window.api.updateManualScore(matchId, {
        score_a: form.score_a.value,
        score_b: form.score_b.value,
        status: form.status.value
      });
      document.getElementById("manual-score-modal")?.remove();
      loadMatch();
    } catch(err) {
      alert(err.message || "Error al actualizar marcador");
    }
  };

  loadMatch();
};
