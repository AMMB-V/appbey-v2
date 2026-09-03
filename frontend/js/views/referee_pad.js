// Official WBO BeyScore Compatible Referee Pad & Live Scoreboard
// Replicates official WBO BeyScore mechanics: https://beyscore.worldbeyblade.org/game/

window.renderRefereePadView = async (container, matchId) => {
  // If no matchId is provided in URL, allow selecting active tournament match OR launch standalone WBO scoreboard
  if (!matchId) {
    try {
      const activeTournaments = await window.api.getTournaments("in_progress");
      const recentTournaments = await window.api.getTournaments();
      const tournamentsList = [...activeTournaments, ...recentTournaments.filter(t => !activeTournaments.some(a => a.id === t.id))].slice(0, 6);

      container.innerHTML = `
        <div class="max-w-4xl mx-auto space-y-6 py-6 select-none">
          <!-- Standalone WBO Quick Board Card -->
          <div class="glass-card rounded-3xl p-6 sm:p-8 border-2 border-cyan-500/50 bg-gradient-to-b from-slate-900/90 to-slate-950/95 space-y-5 shadow-2xl">
            <div class="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-5">
              <div class="flex items-center gap-3 text-center sm:text-left">
                <div class="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center font-black text-2xl text-white shadow-lg shadow-cyan-500/30">
                  ⚡
                </div>
                <div>
                  <h2 class="text-xl sm:text-2xl font-black text-white">Marcador WBO BeyScore</h2>
                  <p class="text-xs text-slate-400">Reglamento Oficial Beyblade X (Spin 1p, Over 2p, Burst 2p, Xtreme 3p, Draw 0p)</p>
                </div>
              </div>
              <button onclick="startStandaloneScoreboard()" class="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600 hover:from-blue-500 hover:to-cyan-400 text-white font-extrabold text-sm shadow-lg shadow-cyan-500/30 transition transform active:scale-95">
                🎮 Iniciar Marcador Libre (Modo Práctica / WBO)
              </button>
            </div>

            <!-- Active Tournaments Mesas -->
            <div class="space-y-3">
              <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <span>🏆</span> O seleccionar un combate de torneo activo:
              </h3>
              ${tournamentsList.length ? `
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  ${tournamentsList.map(t => `
                    <div onclick="location.hash='#/tournaments/${t.id}'" class="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-cyan-500/50 cursor-pointer transition flex items-center justify-between">
                      <div>
                        <div class="font-bold text-white text-sm">${t.title}</div>
                        <div class="text-[11px] text-slate-400">${t.location || 'Online'} • Ronda ${t.current_round}</div>
                      </div>
                      <span class="px-3 py-1 rounded-full text-[10px] font-bold ${t.status === 'in_progress' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'}">
                        ${t.status === 'in_progress' ? 'En Curso' : t.status}
                      </span>
                    </div>
                  `).join("")}
                </div>
              ` : `
                <p class="text-xs text-slate-500 text-center py-4">No hay torneos activos en este momento.</p>
              `}
            </div>
          </div>
        </div>
      `;

      window.startStandaloneScoreboard = () => {
        window.renderRefereePadView(container, "standalone");
      };
      return;
    } catch(err) {
      container.innerHTML = `<div class="text-center py-16 text-slate-400">Error al cargar mesa: ${err.message}</div>`;
      return;
    }
  }

  const isStandalone = matchId === "standalone";
  let match = null;

  // Standalone local state
  let localState = {
    player_a_name: "Blader 1 (Azul)",
    player_b_name: "Blader 2 (Rojo)",
    player_a_deck: ["Dran Sword 3-60F", "Hells Scythe 4-60B", "Wizard Rod 9-60B"],
    player_b_deck: ["Phoenix Wing 5-60GF", "Cobalt Drake 4-60F", "Shark Edge 3-60LF"],
    score_a: 0,
    score_b: 0,
    target_points: 4,
    status: "in_progress",
    winner: null,
    games: []
  };

  const loadMatch = async () => {
    if (isStandalone) {
      match = {
        id: "WBO-LOCAL",
        station_number: 1,
        round_number: localState.games.length + 1,
        player_a: { display_name: localState.player_a_name, favorite_combo: "Corner Azul" },
        player_b: { display_name: localState.player_b_name, favorite_combo: "Corner Rojo" },
        player_a_deck: localState.player_a_deck,
        player_b_deck: localState.player_b_deck,
        score_a: localState.score_a,
        score_b: localState.score_b,
        target_points: localState.target_points,
        status: localState.status,
        winner_id: localState.winner,
        games: localState.games
      };
      renderUI();
      return;
    }

    try {
      match = await window.api.getMatch(matchId);
      renderUI();
    } catch(err) {
      container.innerHTML = `
        <div class="max-w-md mx-auto my-12 glass-card p-6 rounded-3xl text-center space-y-4 border border-slate-800">
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
    const target = match.target_points || (match.tournament ? match.tournament.match_target_points : 4) || 4;
    const isFinished = match.status === "finished" || match.score_a >= target || match.score_b >= target;
    const roundCount = (match.games ? match.games.length : 0) + 1;

    let winnerName = "";
    if (match.score_a > match.score_b) {
      winnerName = match.player_a ? match.player_a.display_name : "Corner Azul";
    } else if (match.score_b > match.score_a) {
      winnerName = match.player_b ? match.player_b.display_name : "Corner Rojo";
    }

    container.innerHTML = `
      <div class="max-w-4xl mx-auto space-y-4 pb-16 select-none">
        
        <!-- Top Referee Bar -->
        <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 border-b border-slate-800 pb-3">
          <div class="flex items-center gap-3">
            ${!isStandalone && match.tournament_id ? `
              <button onclick="location.hash='#/tournaments/${match.tournament_id}'" class="text-cyan-400 hover:underline flex items-center gap-1 font-bold">
                &larr; Volver al Torneo
              </button>
            ` : `
              <button onclick="location.hash='#/referee'" class="text-cyan-400 hover:underline flex items-center gap-1 font-bold">
                &larr; Salir del Marcador
              </button>
            `}
            <span class="text-slate-600">|</span>
            <span class="font-bold text-amber-400 flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full ${isFinished ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}"></span>
              ${isStandalone ? 'Mesa Libre WBO BeyScore' : `Stadium #${match.station_number} • Ronda ${match.round_number}`}
            </span>
          </div>

          <!-- Target Points Quick Selector (WBO BeyScore Standard) -->
          <div class="flex items-center gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
            <span class="text-[10px] uppercase font-bold text-slate-400 px-2">Meta:</span>
            ${[3, 4, 5, 7].map(pts => `
              <button onclick="setTargetPoints(${pts})" class="px-2.5 py-1 rounded-lg font-mono font-bold text-xs transition ${target === pts ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'}">
                ${pts}p ${pts === 4 ? '(WBO)' : (pts === 5 ? '(Final)' : '')}
              </button>
            `).join("")}
          </div>

          <div class="flex items-center gap-2">
            ${isStandalone ? `
              <button onclick="openStandaloneEditModal()" title="Personalizar Nombres y Decks 3on3" class="px-2.5 py-1 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-300 border border-cyan-500/30 font-bold text-xs flex items-center gap-1">
                <span>⚙️</span> <span class="hidden sm:inline">Bladers & Decks</span>
              </button>
            ` : ''}
            <button onclick="handleLaunchChant()" title="Iniciar Cuenta Oficial 3-2-1 Go Shoot!" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs flex items-center gap-1">
              <span>📢</span> <span class="hidden sm:inline">Go Shoot!</span>
            </button>
            <button onclick="toggleFullscreen()" title="Pantalla Completa" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs">
              ⛶
            </button>
          </div>
        </div>

        <!-- Launch Audio / Voice Chime Banner (Dynamic) -->
        <div id="chant-banner" class="hidden py-2 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black text-center text-sm uppercase tracking-widest shadow-lg animate-pulse">
          3... 2... 1... GO SHOOT! ⚡
        </div>

        <!-- Finished Notification (Non-blocking: Referee can still continue or undo) -->
        ${isFinished ? `
          <div class="p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-slate-900 to-amber-500/20 border border-amber-500/50 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div class="flex items-center gap-2">
              <span class="text-2xl">👑</span>
              <div>
                <span class="font-extrabold text-amber-300 text-sm">¡Match Point Alcanzado!</span>
                <span class="text-slate-300 ml-1">Ganador sugerido: <strong>${winnerName}</strong> (${match.score_a} - ${match.score_b})</span>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button onclick="handleUndoLastFinish()" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold border border-slate-700 flex items-center gap-1">
                <span>⏪</span> Deshacer Último
              </button>
              <button onclick="handleReopenMatch()" class="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow flex items-center gap-1">
                <span>🔓</span> Seguir Anotando (+1 Meta)
              </button>
            </div>
          </div>
        ` : ''}

        <!-- WBO BeyScore Main Stage: Blue (Left) vs Red (Right) -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          <!-- CORNER AZUL (PLAYER A / 1) -->
          <div class="glass-card rounded-3xl p-5 border-2 ${match.score_a >= target ? 'border-amber-400 glow-gold' : 'border-blue-500/40'} bg-gradient-to-b from-blue-950/30 via-slate-900/90 to-slate-950 space-y-4 shadow-xl">
            <!-- Player Info & Score Header -->
            <div class="flex items-center justify-between border-b border-blue-900/40 pb-3">
              <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center font-black text-xl text-white shadow-md border-2 border-blue-400">
                  ${match.player_a?.display_name ? match.player_a.display_name.charAt(0).toUpperCase() : '1'}
                </div>
                <div>
                  <div class="flex items-center gap-1.5">
                    <span class="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                    <h3 class="font-black text-white text-base truncate max-w-[150px] sm:max-w-[190px]">
                      ${match.player_a ? match.player_a.display_name : 'Blader 1 (Azul)'}
                    </h3>
                  </div>
                  <div class="mt-1 flex flex-wrap gap-1">
                    ${match.player_a_deck && match.player_a_deck.length ? match.player_a_deck.map((b, i) => `
                      <span class="px-2 py-0.5 rounded-md bg-blue-950/80 border border-blue-500/40 text-[10px] text-cyan-300 font-mono">
                        ${i+1}. ${b}
                      </span>
                    `).join("") : `
                      <span class="text-[11px] text-blue-300/80 font-medium truncate">${match.player_a?.favorite_combo || 'Corner Azul • Beyblade X'}</span>
                    `}
                  </div>
                </div>
              </div>

              <!-- Manual Step +/- Buttons for Player A -->
              <div class="flex items-center gap-1">
                <button onclick="stepScore('player_a', -1)" title="Restar 1 punto" class="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold font-mono text-sm border border-slate-700 active:scale-95 transition flex items-center justify-center">
                  -
                </button>
                <div class="w-14 text-center font-mono text-4xl sm:text-5xl font-black text-cyan-400">
                  ${match.score_a}
                </div>
                <button onclick="stepScore('player_a', 1)" title="Sumar 1 punto" class="w-8 h-8 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold font-mono text-sm shadow-md active:scale-95 transition flex items-center justify-center">
                  +
                </button>
              </div>
            </div>

            <!-- 1-Touch BeyScore Official Finish Buttons for Player A -->
            <div class="space-y-2">
              <div class="text-[10px] font-bold text-blue-400 uppercase tracking-wider text-center">
                Puntos para Corner Azul
              </div>

              <div class="grid grid-cols-2 gap-2">
                <!-- Spin Finish (+1) -->
                <button onclick="submitFinish('spin_finish_1p', 'player_a')" class="referee-btn p-3 rounded-2xl bg-gradient-to-r from-blue-700 to-cyan-700 hover:from-blue-600 hover:to-cyan-600 text-white font-bold text-xs sm:text-sm border border-cyan-400/40 shadow-md flex items-center justify-between active:scale-95 transition">
                  <div class="text-left">
                    <div class="font-extrabold">Spin Finish</div>
                    <div class="text-[10px] text-cyan-200 font-normal">Supervivencia</div>
                  </div>
                  <span class="px-2 py-1 rounded-xl bg-slate-950/70 text-cyan-300 font-mono font-black text-xs">+1</span>
                </button>

                <!-- Over Finish (+2) -->
                <button onclick="submitFinish('over_finish_2p', 'player_a')" class="referee-btn p-3 rounded-2xl bg-gradient-to-r from-indigo-700 to-blue-600 hover:from-indigo-600 hover:to-blue-500 text-white font-bold text-xs sm:text-sm border border-indigo-400/40 shadow-md flex items-center justify-between active:scale-95 transition">
                  <div class="text-left">
                    <div class="font-extrabold">Over Finish</div>
                    <div class="text-[10px] text-indigo-200 font-normal">Zona Over</div>
                  </div>
                  <span class="px-2 py-1 rounded-xl bg-slate-950/70 text-indigo-300 font-mono font-black text-xs">+2</span>
                </button>

                <!-- Burst Finish (+2) -->
                <button onclick="submitFinish('burst_finish_2p', 'player_a')" class="referee-btn p-3 rounded-2xl bg-gradient-to-r from-purple-700 to-indigo-600 hover:from-purple-600 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm border border-purple-400/40 shadow-md flex items-center justify-between active:scale-95 transition">
                  <div class="text-left">
                    <div class="font-extrabold">Burst Finish</div>
                    <div class="text-[10px] text-purple-200 font-normal">Desarme / Piezas</div>
                  </div>
                  <span class="px-2 py-1 rounded-xl bg-slate-950/70 text-purple-300 font-mono font-black text-xs">+2</span>
                </button>

                <!-- Xtreme Finish (+3) -->
                <button onclick="submitFinish('xtreme_finish_3p', 'player_a')" class="referee-btn p-3 rounded-2xl bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-700 hover:from-cyan-500 hover:to-indigo-600 text-white font-black text-xs sm:text-sm border-2 border-cyan-300 shadow-lg shadow-cyan-500/25 flex items-center justify-between active:scale-95 transition">
                  <div class="text-left">
                    <div class="font-black flex items-center gap-1">⚡ Xtreme</div>
                    <div class="text-[10px] text-amber-300 font-normal">Zona Xtreme</div>
                  </div>
                  <span class="px-2 py-1 rounded-xl bg-slate-950/90 text-amber-300 font-mono font-black text-xs">+3</span>
                </button>
              </div>

              <!-- Secondary WBO Rules: Own Finish / Penalty -->
              <div class="grid grid-cols-2 gap-2 pt-1">
                <button onclick="submitFinish('penalty_1p', 'player_a')" class="p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 text-[11px] font-semibold border border-slate-800 hover:border-blue-500/40 flex items-center justify-between active:scale-95 transition">
                  <span>⚠️ Falta Rival</span>
                  <span class="font-mono text-cyan-400 font-bold">+1 Azul</span>
                </button>
                <button onclick="submitFinish('own_finish_1p', 'player_b')" class="p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-rose-300 text-[11px] font-semibold border border-slate-800 hover:border-rose-500/40 flex items-center justify-between active:scale-95 transition" title="Autoderrota de Rojo da 1 punto a Azul">
                  <span>🌀 Auto-out Rival</span>
                  <span class="font-mono text-cyan-400 font-bold">+1 Azul</span>
                </button>
              </div>
            </div>
          </div>

          <!-- CORNER ROJO (PLAYER B / 2) -->
          <div class="glass-card rounded-3xl p-5 border-2 ${match.score_b >= target ? 'border-amber-400 glow-gold' : 'border-rose-500/40'} bg-gradient-to-b from-rose-950/30 via-slate-900/90 to-slate-950 space-y-4 shadow-xl">
            <!-- Player Info & Score Header -->
            <div class="flex items-center justify-between border-b border-rose-900/40 pb-3">
              <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-2xl bg-rose-600 flex items-center justify-center font-black text-xl text-white shadow-md border-2 border-rose-400">
                  ${match.player_b?.display_name ? match.player_b.display_name.charAt(0).toUpperCase() : '2'}
                </div>
                <div>
                  <div class="flex items-center gap-1.5">
                    <span class="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                    <h3 class="font-black text-white text-base truncate max-w-[150px] sm:max-w-[190px]">
                      ${match.player_b ? match.player_b.display_name : 'Blader 2 (Rojo)'}
                    </h3>
                  </div>
                  <div class="mt-1 flex flex-wrap gap-1">
                    ${match.player_b_deck && match.player_b_deck.length ? match.player_b_deck.map((b, i) => `
                      <span class="px-2 py-0.5 rounded-md bg-rose-950/80 border border-rose-500/40 text-[10px] text-rose-300 font-mono">
                        ${i+1}. ${b}
                      </span>
                    `).join("") : `
                      <span class="text-[11px] text-rose-300/80 font-medium truncate">${match.player_b?.favorite_combo || 'Corner Rojo • Beyblade X'}</span>
                    `}
                  </div>
                </div>
              </div>

              <!-- Manual Step +/- Buttons for Player B -->
              <div class="flex items-center gap-1">
                <button onclick="stepScore('player_b', -1)" title="Restar 1 punto" class="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold font-mono text-sm border border-slate-700 active:scale-95 transition flex items-center justify-center">
                  -
                </button>
                <div class="w-14 text-center font-mono text-4xl sm:text-5xl font-black text-rose-400">
                  ${match.score_b}
                </div>
                <button onclick="stepScore('player_b', 1)" title="Sumar 1 punto" class="w-8 h-8 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold font-mono text-sm shadow-md active:scale-95 transition flex items-center justify-center">
                  +
                </button>
              </div>
            </div>

            <!-- 1-Touch BeyScore Official Finish Buttons for Player B -->
            <div class="space-y-2">
              <div class="text-[10px] font-bold text-rose-400 uppercase tracking-wider text-center">
                Puntos para Corner Rojo
              </div>

              <div class="grid grid-cols-2 gap-2">
                <!-- Spin Finish (+1) -->
                <button onclick="submitFinish('spin_finish_1p', 'player_b')" class="referee-btn p-3 rounded-2xl bg-gradient-to-r from-rose-700 to-red-600 hover:from-rose-600 hover:to-red-500 text-white font-bold text-xs sm:text-sm border border-rose-400/40 shadow-md flex items-center justify-between active:scale-95 transition">
                  <div class="text-left">
                    <div class="font-extrabold">Spin Finish</div>
                    <div class="text-[10px] text-rose-200 font-normal">Supervivencia</div>
                  </div>
                  <span class="px-2 py-1 rounded-xl bg-slate-950/70 text-rose-300 font-mono font-black text-xs">+1</span>
                </button>

                <!-- Over Finish (+2) -->
                <button onclick="submitFinish('over_finish_2p', 'player_b')" class="referee-btn p-3 rounded-2xl bg-gradient-to-r from-orange-700 to-rose-600 hover:from-orange-600 hover:to-rose-500 text-white font-bold text-xs sm:text-sm border border-orange-400/40 shadow-md flex items-center justify-between active:scale-95 transition">
                  <div class="text-left">
                    <div class="font-extrabold">Over Finish</div>
                    <div class="text-[10px] text-orange-200 font-normal">Zona Over</div>
                  </div>
                  <span class="px-2 py-1 rounded-xl bg-slate-950/70 text-orange-300 font-mono font-black text-xs">+2</span>
                </button>

                <!-- Burst Finish (+2) -->
                <button onclick="submitFinish('burst_finish_2p', 'player_b')" class="referee-btn p-3 rounded-2xl bg-gradient-to-r from-pink-700 to-rose-600 hover:from-pink-600 hover:to-rose-500 text-white font-bold text-xs sm:text-sm border border-pink-400/40 shadow-md flex items-center justify-between active:scale-95 transition">
                  <div class="text-left">
                    <div class="font-extrabold">Burst Finish</div>
                    <div class="text-[10px] text-pink-200 font-normal">Desarme / Piezas</div>
                  </div>
                  <span class="px-2 py-1 rounded-xl bg-slate-950/70 text-pink-300 font-mono font-black text-xs">+2</span>
                </button>

                <!-- Xtreme Finish (+3) -->
                <button onclick="submitFinish('xtreme_finish_3p', 'player_b')" class="referee-btn p-3 rounded-2xl bg-gradient-to-r from-amber-600 via-rose-600 to-red-700 hover:from-amber-500 hover:to-red-600 text-white font-black text-xs sm:text-sm border-2 border-amber-300 shadow-lg shadow-rose-500/25 flex items-center justify-between active:scale-95 transition">
                  <div class="text-left">
                    <div class="font-black flex items-center gap-1">⚡ Xtreme</div>
                    <div class="text-[10px] text-amber-200 font-normal">Zona Xtreme</div>
                  </div>
                  <span class="px-2 py-1 rounded-xl bg-slate-950/90 text-amber-300 font-mono font-black text-xs">+3</span>
                </button>
              </div>

              <!-- Secondary WBO Rules: Own Finish / Penalty -->
              <div class="grid grid-cols-2 gap-2 pt-1">
                <button onclick="submitFinish('penalty_1p', 'player_b')" class="p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 text-[11px] font-semibold border border-slate-800 hover:border-rose-500/40 flex items-center justify-between active:scale-95 transition">
                  <span>⚠️ Falta Rival</span>
                  <span class="font-mono text-rose-400 font-bold">+1 Rojo</span>
                </button>
                <button onclick="submitFinish('own_finish_1p', 'player_a')" class="p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-blue-300 text-[11px] font-semibold border border-slate-800 hover:border-blue-500/40 flex items-center justify-between active:scale-95 transition" title="Autoderrota de Azul da 1 punto a Rojo">
                  <span>🌀 Auto-out Rival</span>
                  <span class="font-mono text-rose-400 font-bold">+1 Rojo</span>
                </button>
              </div>
            </div>
          </div>

        </div>

        <!-- Central WBO Control Row: Draw Button & Undo Action -->
        <div class="glass-card rounded-2xl p-3 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs bg-slate-900/90">
          <div class="flex items-center gap-2">
            <!-- Draw / Empate (0 pts) Button (Crucial WBO BeyScore feature) -->
            <button onclick="submitFinish('draw_0p', 'draw')" class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold border border-slate-700 flex items-center gap-1.5 active:scale-95 transition shadow">
              <span>🤝</span> Empate / Draw (0 pts)
            </button>
            <span class="text-slate-500 font-mono text-[11px]">Asalto actual: #${roundCount}</span>
          </div>

          <div class="flex items-center gap-2">
            ${match.games && match.games.length ? `
              <button onclick="handleUndoLastFinish()" class="px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 flex items-center gap-1.5 active:scale-95 transition">
                <span>⏪</span> Deshacer Último Asalto
              </button>
            ` : ''}
            <button onclick="openManualScoreModal()" class="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold border border-slate-700 flex items-center gap-1 active:scale-95 transition">
              <span>✏️</span> Ajustar
            </button>
            <button onclick="handleResetMatchScore()" class="px-3.5 py-2 rounded-xl bg-rose-950/30 hover:bg-rose-900/50 text-rose-300 font-semibold border border-rose-900/40 active:scale-95 transition">
              Reiniciar (0-0)
            </button>
          </div>
        </div>

        <!-- Chronological Round History (Historial de Asaltos WBO) -->
        <div class="glass-card rounded-2xl p-4 space-y-3 border border-slate-800 bg-slate-900/70">
          <div class="flex items-center justify-between">
            <h4 class="font-bold text-xs text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <span>📋</span> Registro de Asaltos (${match.games ? match.games.length : 0})
            </h4>
            <span class="text-[10px] text-slate-500">Orden de combate Beyblade X</span>
          </div>

          <div class="space-y-2">
            ${match.games && match.games.length ? match.games.slice().reverse().map((g, idx) => {
              const actualOrder = g.game_order || (match.games.length - idx);
              const isDraw = g.finish_type === "draw_0p" || g.awarded_to === "draw";
              const finishLabel = g.finish_type
                .replace('_1p', ' (1 pt)')
                .replace('_2p', ' (2 pts)')
                .replace('_3p', ' (3 pts)')
                .replace('_0p', ' (0 pts)')
                .replace('_', ' ')
                .toUpperCase();

              const recipientName = isDraw
                ? "Empate / Ambos Sin Puntos"
                : (g.awarded_to === 'player_a' ? (match.player_a?.display_name || 'Corner Azul') : (match.player_b?.display_name || 'Corner Rojo'));

              return `
                <div class="p-2.5 sm:p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between text-xs transition">
                  <div class="flex items-center gap-2.5">
                    <span class="w-6 h-6 rounded-lg bg-slate-800 text-cyan-400 flex items-center justify-center font-mono font-bold text-xs border border-slate-700">
                      ${actualOrder}
                    </span>
                    <div>
                      <span class="font-bold ${isDraw ? 'text-slate-400' : (g.awarded_to === 'player_a' ? 'text-blue-400' : 'text-rose-400')}">
                        ${recipientName}
                      </span>
                      <span class="text-[11px] text-slate-400 font-mono ml-2 font-medium">
                        ${finishLabel}
                      </span>
                    </div>
                  </div>
                  <div class="flex items-center gap-2 font-mono font-black">
                    <span class="${isDraw ? 'text-slate-500' : (g.points >= 3 ? 'text-amber-400' : 'text-emerald-400')}">
                      +${g.points} pts
                    </span>
                  </div>
                </div>
              `;
            }).join("") : `
              <div class="text-xs text-slate-500 text-center py-6 border border-dashed border-slate-800 rounded-xl">
                Aún no se han registrado asaltos en este combate. Presiona cualquier botón de finalización arriba para comenzar.
              </div>
            `}
          </div>
        </div>

      </div>
    `;
  };

  // Step score up or down by 1 point
  window.stepScore = async (player, delta) => {
    let newScoreA = match.score_a;
    let newScoreB = match.score_b;

    if (player === "player_a") {
      newScoreA = Math.max(0, newScoreA + delta);
    } else {
      newScoreB = Math.max(0, newScoreB + delta);
    }

    if (isStandalone) {
      localState.score_a = newScoreA;
      localState.score_b = newScoreB;
      const target = localState.target_points;
      if (newScoreA >= target || newScoreB >= target) {
        localState.status = "finished";
        localState.winner = newScoreA > newScoreB ? "player_a" : "player_b";
      } else {
        localState.status = "in_progress";
        localState.winner = null;
      }
      loadMatch();
      return;
    }

    try {
      await window.api.updateManualScore(matchId, {
        score_a: newScoreA,
        score_b: newScoreB
      });
      loadMatch();
    } catch(err) {
      window.showToast?.(err.message || "Error al actualizar marcador", "error");
    }
  };

  // Set match target points (3, 4, 5, 7)
  window.setTargetPoints = async (pts) => {
    if (isStandalone) {
      localState.target_points = pts;
      const target = pts;
      if (localState.score_a >= target || localState.score_b >= target) {
        localState.status = "finished";
        localState.winner = localState.score_a > localState.score_b ? "player_a" : "player_b";
      } else {
        localState.status = "in_progress";
        localState.winner = null;
      }
      loadMatch();
      return;
    }

    try {
      await window.api.updateMatchTarget(matchId, pts);
      loadMatch();
    } catch(err) {
      window.showToast?.(err.message || "Error al cambiar meta de puntos", "error");
    }
  };

  // Submit BeyScore finish
  window.submitFinish = async (finishType, awardedTo) => {
    const pointsMap = {
      spin_finish_1p: 1,
      over_finish_2p: 2,
      burst_finish_2p: 2,
      xtreme_finish_3p: 3,
      penalty_1p: 1,
      own_finish_1p: 1,
      own_finish_2p: 2,
      draw_0p: 0
    };

    const pts = pointsMap[finishType] !== undefined ? pointsMap[finishType] : 0;

    if (isStandalone) {
      const newGame = {
        id: localState.games.length + 1,
        match_id: "standalone",
        game_order: localState.games.length + 1,
        finish_type: finishType,
        awarded_to: awardedTo,
        points: pts,
        created_at: new Date().toISOString()
      };
      localState.games.push(newGame);

      if (awardedTo === "player_a") localState.score_a += pts;
      else if (awardedTo === "player_b") localState.score_b += pts;

      const target = localState.target_points;
      if (localState.score_a >= target || localState.score_b >= target) {
        localState.status = "finished";
        localState.winner = localState.score_a > localState.score_b ? "player_a" : "player_b";
      } else {
        localState.status = "in_progress";
      }

      loadMatch();
      return;
    }

    try {
      await window.api.recordFinish(matchId, {
        finish_type: finishType,
        awarded_to: awardedTo,
        notes: "Registrado vía Mesa WBO BeyScore"
      });
      loadMatch();
    } catch(err) {
      window.showToast?.(err.message || "Error al registrar resultado", "error");
    }
  };

  // Undo last finish
  window.handleUndoLastFinish = async () => {
    if (isStandalone) {
      if (!localState.games.length) return;
      localState.games.pop();
      let sa = 0;
      let sb = 0;
      for (const g of localState.games) {
        if (g.awarded_to === "player_a") sa += g.points;
        if (g.awarded_to === "player_b") sb += g.points;
      }
      localState.score_a = sa;
      localState.score_b = sb;
      const target = localState.target_points;
      if (sa >= target || sb >= target) {
        localState.status = "finished";
        localState.winner = sa > sb ? "player_a" : "player_b";
      } else {
        localState.status = localState.games.length > 0 ? "in_progress" : "pending";
        localState.winner = null;
      }
      loadMatch();
      return;
    }

    try {
      await window.api.undoFinish(matchId);
      loadMatch();
    } catch(err) {
      window.showToast?.(err.message || "Error al deshacer asalto", "error");
    }
  };

  // Reopen match (+1 point target so it continues)
  window.handleReopenMatch = async () => {
    if (isStandalone) {
      localState.status = "in_progress";
      localState.winner = null;
      const currentTarget = localState.target_points;
      if (localState.score_a >= currentTarget || localState.score_b >= currentTarget) {
        localState.target_points = Math.max(currentTarget + 1, Math.max(localState.score_a, localState.score_b) + 1);
      }
      loadMatch();
      return;
    }

    try {
      await window.api.reopenMatch(matchId);
      loadMatch();
    } catch(err) {
      window.showToast?.(err.message || "Error al reabrir combate", "error");
    }
  };

  // Reset match score to 0-0
  window.handleResetMatchScore = async () => {
    const confirmed = window.showAppConfirm 
      ? await window.showAppConfirm("Reiniciar Marcador", "¿Deseas reiniciar el marcador a 0-0 y vaciar los asaltos de este combate?")
      : confirm("¿Deseas reiniciar el marcador a 0-0 y vaciar los asaltos?");
    if (!confirmed) return;

    if (isStandalone) {
      localState.score_a = 0;
      localState.score_b = 0;
      localState.games = [];
      localState.status = "in_progress";
      localState.winner = null;
      loadMatch();
      return;
    }

    try {
      await window.api.resetMatch(matchId);
      loadMatch();
    } catch(err) {
      window.showToast?.(err.message || "Error al reiniciar marcador", "error");
    }
  };

  // 3-2-1 GO SHOOT visual chant & audio
  window.handleLaunchChant = () => {
    const banner = document.getElementById("chant-banner");
    if (!banner) return;
    banner.classList.remove("hidden");

    // Audio cue using Web Audio API synthesis
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const playBeep = (freq, duration, delay) => {
        setTimeout(() => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
          gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start();
          osc.stop(audioCtx.currentTime + duration);
        }, delay);
      };

      playBeep(440, 0.15, 0);    // 3
      playBeep(440, 0.15, 1000); // 2
      playBeep(440, 0.15, 2000); // 1
      playBeep(880, 0.4, 3000);  // GO SHOOT!
    } catch(e) {
      // Audio synthesis fallback
    }

    setTimeout(() => {
      banner.classList.add("hidden");
    }, 4500);
  };

  // Fullscreen toggle
  window.toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  // Manual Score Adjustment Modal
  window.openManualScoreModal = () => {
    const existing = document.getElementById("manual-score-modal");
    if (existing) existing.remove();

    const target = match.target_points || 4;
    const modal = document.createElement("div");
    modal.id = "manual-score-modal";
    modal.className = "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm";
    modal.innerHTML = `
      <div class="glass-card max-w-sm w-full rounded-3xl p-6 border border-cyan-500/40 space-y-4 shadow-2xl">
        <div class="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 class="font-bold text-white text-base">Ajuste Manual de Marcador</h3>
          <button onclick="document.getElementById('manual-score-modal').remove()" class="text-slate-400 hover:text-white text-lg">&times;</button>
        </div>
        <form onsubmit="submitManualScore(event)" class="space-y-4 text-xs">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-blue-400 font-bold mb-1 truncate">${match.player_a?.display_name || 'Corner Azul'}</label>
              <input type="number" name="score_a" min="0" max="25" value="${match.score_a}" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-center text-2xl font-mono font-black text-cyan-400 outline-none focus:border-cyan-400"/>
            </div>
            <div>
              <label class="block text-rose-400 font-bold mb-1 truncate">${match.player_b?.display_name || 'Corner Rojo'}</label>
              <input type="number" name="score_b" min="0" max="25" value="${match.score_b}" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-center text-2xl font-mono font-black text-rose-400 outline-none focus:border-rose-400"/>
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
          <div class="pt-2 flex justify-end gap-2 border-t border-slate-800">
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
    const scoreA = parseInt(form.score_a.value, 10) || 0;
    const scoreB = parseInt(form.score_b.value, 10) || 0;
    const status = form.status.value;

    if (isStandalone) {
      localState.score_a = scoreA;
      localState.score_b = scoreB;
      localState.status = status;
      if (status === "finished") {
        localState.winner = scoreA > scoreB ? "player_a" : "player_b";
      } else {
        localState.winner = null;
      }
      document.getElementById("manual-score-modal")?.remove();
      loadMatch();
      return;
    }

    try {
      await window.api.updateManualScore(matchId, {
        score_a: scoreA,
        score_b: scoreB,
        status: status
      });
      document.getElementById("manual-score-modal")?.remove();
      loadMatch();
    } catch(err) {
      window.showToast?.(err.message || "Error al actualizar marcador", "error");
    }
  };

  // Standalone Bladers and Decks Editor Modal
  window.openStandaloneEditModal = () => {
    const existing = document.getElementById("standalone-edit-modal");
    if (existing) existing.remove();

    const deckA = localState.player_a_deck || [];
    const deckB = localState.player_b_deck || [];

    const modal = document.createElement("div");
    modal.id = "standalone-edit-modal";
    modal.className = "fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm overflow-y-auto";
    modal.innerHTML = `
      <div class="glass-card max-w-lg w-full rounded-3xl p-5 sm:p-6 border border-cyan-500/40 space-y-4 shadow-2xl my-auto">
        <div class="flex items-center justify-between border-b border-slate-800 pb-3">
          <div class="flex items-center gap-2">
            <span class="text-xl">⚙️</span>
            <div>
              <h3 class="font-bold text-white text-base">Configurar Bladers y Decks 3on3</h3>
              <p class="text-[11px] text-slate-400">Personaliza los nombres y los 3 Beys de cada esquina</p>
            </div>
          </div>
          <button onclick="document.getElementById('standalone-edit-modal').remove()" class="text-slate-400 hover:text-white text-xl p-1">&times;</button>
        </div>

        <form id="standalone-edit-form" class="space-y-4 text-xs">
          <!-- Corner Azul -->
          <div class="p-3.5 rounded-2xl bg-blue-950/40 border border-blue-500/30 space-y-2">
            <div class="flex items-center justify-between">
              <span class="font-extrabold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                <span class="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Corner Azul (Blader 1)
              </span>
            </div>
            <div>
              <label class="block text-[11px] text-slate-300 font-semibold mb-1">Nombre del Blader</label>
              <input type="text" name="name_a" value="${localState.player_a_name}" required class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-bold outline-none focus:border-cyan-400"/>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label class="block text-[10px] text-slate-400 mb-0.5">Bey 1</label>
                <input type="text" name="a_bey1" value="${deckA[0] || 'Dran Sword 3-60F'}" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs text-cyan-300 font-mono outline-none focus:border-cyan-400"/>
              </div>
              <div>
                <label class="block text-[10px] text-slate-400 mb-0.5">Bey 2</label>
                <input type="text" name="a_bey2" value="${deckA[1] || 'Hells Scythe 4-60B'}" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs text-cyan-300 font-mono outline-none focus:border-cyan-400"/>
              </div>
              <div>
                <label class="block text-[10px] text-slate-400 mb-0.5">Bey 3</label>
                <input type="text" name="a_bey3" value="${deckA[2] || 'Wizard Rod 9-60B'}" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs text-cyan-300 font-mono outline-none focus:border-cyan-400"/>
              </div>
            </div>
          </div>

          <!-- Corner Rojo -->
          <div class="p-3.5 rounded-2xl bg-rose-950/40 border border-rose-500/30 space-y-2">
            <div class="flex items-center justify-between">
              <span class="font-extrabold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                <span class="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Corner Rojo (Blader 2)
              </span>
            </div>
            <div>
              <label class="block text-[11px] text-slate-300 font-semibold mb-1">Nombre del Blader</label>
              <input type="text" name="name_b" value="${localState.player_b_name}" required class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-bold outline-none focus:border-rose-400"/>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label class="block text-[10px] text-slate-400 mb-0.5">Bey 1</label>
                <input type="text" name="b_bey1" value="${deckB[0] || 'Phoenix Wing 5-60GF'}" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs text-rose-300 font-mono outline-none focus:border-rose-400"/>
              </div>
              <div>
                <label class="block text-[10px] text-slate-400 mb-0.5">Bey 2</label>
                <input type="text" name="b_bey2" value="${deckB[1] || 'Cobalt Drake 4-60F'}" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs text-rose-300 font-mono outline-none focus:border-rose-400"/>
              </div>
              <div>
                <label class="block text-[10px] text-slate-400 mb-0.5">Bey 3</label>
                <input type="text" name="b_bey3" value="${deckB[2] || 'Shark Edge 3-60LF'}" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-xs text-rose-300 font-mono outline-none focus:border-rose-400"/>
              </div>
            </div>
          </div>

          <div class="pt-2 flex justify-end gap-2 border-t border-slate-800">
            <button type="button" onclick="document.getElementById('standalone-edit-modal').remove()" class="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold">
              Cancelar
            </button>
            <button type="submit" class="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600 text-white font-bold shadow">
              Guardar Configuración
            </button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById("standalone-edit-form").onsubmit = (e) => {
      e.preventDefault();
      const form = e.target;
      localState.player_a_name = form.name_a.value.trim() || "Blader 1 (Azul)";
      localState.player_b_name = form.name_b.value.trim() || "Blader 2 (Rojo)";
      localState.player_a_deck = [form.a_bey1.value.trim(), form.a_bey2.value.trim(), form.a_bey3.value.trim()].filter(Boolean);
      localState.player_b_deck = [form.b_bey1.value.trim(), form.b_bey2.value.trim(), form.b_bey3.value.trim()].filter(Boolean);
      document.getElementById("standalone-edit-modal")?.remove();
      window.showToast?.("Bladers y Decks actualizados con éxito", "success");
      loadMatch();
    };
  };

  // Real-time updates via broadcast socket if available
  if (window.api.onTournamentUpdate && matchId && !isStandalone) {
    window.api.onTournamentUpdate((data) => {
      if (data.event === "score_update" && data.payload.match_id === parseInt(matchId, 10)) {
        loadMatch();
      }
    });
  }

  loadMatch();
};
