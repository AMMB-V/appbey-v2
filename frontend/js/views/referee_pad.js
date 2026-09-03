// Official BeyScore Compatible Referee Pad & Live Scoreboard
// Replicates official WBO BeyScore mechanics: Spin 1p, Over 2p, Burst 2p, Xtreme 3p, Draw 0p

window.renderRefereePadView = async (container, matchId) => {
  // If no matchId is provided in URL, allow selecting active tournament match OR launch standalone scoreboard
  if (!matchId) {
    try {
      const allTournaments = await window.api.getTournaments();
      const activeTournaments = allTournaments.filter(t => t.status === "in_progress");
      const tournamentsList = allTournaments.slice(0, 6);

      // Fetch active/pending matches from active tournaments to show direct scoring entry
      let activeMatchesList = [];
      try {
        const matchesArrays = await Promise.all(
          activeTournaments.slice(0, 3).map(t => window.api.getMatches(t.id).catch(() => []))
        );
        matchesArrays.forEach((mArr, idx) => {
          const t = activeTournaments[idx];
          if (mArr && mArr.length) {
            mArr.forEach(m => {
              if (m.status === "in_progress" || m.status === "calling" || m.status === "pending") {
                activeMatchesList.push({ ...m, tournament_title: t.title });
              }
            });
          }
        });
      } catch (_e) {
        activeMatchesList = [];
      }

      container.innerHTML = `
        <div class="max-w-4xl mx-auto space-y-6 py-6 select-none">
          <!-- Standalone BeyScore Quick Board Card -->
          <div class="glass-card rounded-3xl p-6 sm:p-8 border-2 border-cyan-500/50 bg-gradient-to-b from-slate-900/90 to-slate-950/95 space-y-5 shadow-2xl">
            <div class="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-5">
              <div class="flex items-center gap-3 text-center sm:text-left">
                <div class="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center font-black text-2xl text-white shadow-lg shadow-cyan-500/30">
                  ⚡
                </div>
                <div>
                  <h2 class="text-xl sm:text-2xl font-black text-white">Marcador BeyScore</h2>
                  <p class="text-xs text-slate-400">Reglamento Oficial Beyblade X (Spin 1p, Over 2p, Burst 2p, Xtreme 3p, Draw 0p)</p>
                </div>
              </div>
              <button onclick="location.hash='#/referee/standalone'" class="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600 hover:from-blue-500 hover:to-cyan-400 text-white font-extrabold text-sm shadow-lg shadow-cyan-500/30 transition transform active:scale-95">
                🎮 Iniciar Marcador Libre (Modo Práctica)
              </button>
            </div>

            <!-- Direct Active Tournament Matches -->
            ${activeMatchesList.length ? `
              <div class="space-y-3">
                <h3 class="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                  <span>⚡</span> Combates Listos para Arbitrar y Puntuar:
                </h3>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  ${activeMatchesList.map(m => `
                    <div onclick="location.hash='#/referee/${m.id}'" class="p-4 rounded-2xl bg-slate-900/90 border border-slate-700 hover:border-cyan-400 cursor-pointer transition flex items-center justify-between group shadow-md">
                      <div class="space-y-1">
                        <div class="flex items-center gap-2">
                          <span class="px-2 py-0.5 rounded bg-blue-600/30 border border-cyan-400/40 text-cyan-300 font-mono font-bold text-[11px]">
                            Mesa #${m.station_number || m.bracket_position}
                          </span>
                          <span class="text-[11px] text-slate-400 truncate max-w-[140px]">${m.tournament_title}</span>
                        </div>
                        <div class="font-bold text-white text-sm flex items-center gap-2">
                          <span class="truncate max-w-[80px]">${m.player_a ? m.player_a.display_name : 'TBD'}</span>
                          <span class="text-xs font-mono text-cyan-400 font-bold">${m.score_a}-${m.score_b}</span>
                          <span class="truncate max-w-[80px]">${m.player_b ? m.player_b.display_name : 'TBD'}</span>
                        </div>
                      </div>
                      <button class="px-3 py-1.5 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs group-hover:bg-cyan-400 transition">
                        Arbitrar &rarr;
                      </button>
                    </div>
                  `).join("")}
                </div>
              </div>
            ` : ''}

            <!-- Active Tournaments Mesas -->
            <div class="space-y-3 pt-2">
              <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <span>🏆</span> Seleccionar Torneo para Ver Todas las Mesas:
              </h3>
              ${tournamentsList.length ? `
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  ${tournamentsList.map(t => `
                    <div onclick="location.hash='#/tournaments/${t.id}'" class="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-cyan-500/50 cursor-pointer transition flex items-center justify-between">
                      <div>
                        <div class="font-bold text-white text-sm">${t.title}</div>
                        <div class="text-[11px] text-slate-400">${t.location || 'Online'} • Ronda ${t.current_round} / ${t.total_rounds || 1}</div>
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
      return;
    } catch(err) {
      container.innerHTML = `<div class="text-center py-16 text-slate-400">Error al cargar mesa: ${err.message}</div>`;
      return;
    }
  }

  const isStandalone = matchId === "standalone";
  let match = null;
  let tournamentMatches = [];
  let nextMatch = null;

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
      tournamentMatches = [];
      nextMatch = null;
      renderUI();
      return;
    }

    try {
      match = await window.api.getMatch(matchId);
      if (match && match.tournament_id) {
        if (match.tournament_matches && match.tournament_matches.length) {
          tournamentMatches = match.tournament_matches;
        } else {
          try {
            tournamentMatches = await window.api.getMatches(match.tournament_id);
          } catch (_err) {
            tournamentMatches = [];
          }
        }
        // Find next pending or in_progress match (excluding current match)
        nextMatch = tournamentMatches.find(m => m.id !== match.id && (m.status === 'in_progress' || m.status === 'calling' || m.status === 'pending')) || null;
      }
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

  const formatFinishLabel = (finishType) => {
    if (finishType === 'penalty_1p') return 'Punto por Warnings (1 pt)';
    if (finishType === 'own_finish_1p') return 'Self KO (1 pt)';
    return finishType
      .replace('_1p', ' (1 pt)')
      .replace('_2p', ' (2 pts)')
      .replace('_3p', ' (3 pts)')
      .replace('_0p', ' (0 pts)')
      .replace(/_/g, ' ')
      .toUpperCase();
  };

  const getMatchWinnerName = (m) => {
    if (m.winner) return m.winner.display_name;
    if (m.winner_id === m.player_a_id) return m.player_a?.display_name || "Corner Azul";
    if (m.winner_id === m.player_b_id) return m.player_b?.display_name || "Corner Rojo";
    if (m.score_a > m.score_b) {
      return m.player_a ? m.player_a.display_name : "Corner Azul";
    }
    if (m.score_b > m.score_a) {
      return m.player_b ? m.player_b.display_name : "Corner Rojo";
    }
    return "Ganador por Decisión";
  };

  const renderFinishBanner = (isFinished, winnerName, m, next) => {
    if (!isFinished) return '';
    return `
      <div class="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-amber-500/20 via-slate-900 to-amber-500/20 border-2 border-amber-500/60 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-3xl shadow-inner shrink-0">
            👑
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black text-[10px] uppercase tracking-wider">Combate Finalizado</span>
              <span class="font-extrabold text-amber-300 text-sm sm:text-base">Ganador Oficial: <strong>${winnerName}</strong></span>
            </div>
            <p class="text-slate-300 text-xs mt-0.5">
              Marcador definitivo: <span class="font-mono font-bold text-white">${m.score_a} - ${m.score_b}</span> (Meta: ${m.target_points || 4} pts).
            </p>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          ${next ? `
            <button onclick="location.hash='#/referee/${next.id}'" class="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-xs sm:text-sm shadow-lg shadow-emerald-500/25 flex items-center gap-1.5 active:scale-95 transition">
              <span>➡️</span> Siguiente Combate (Mesa #${next.station_number || next.bracket_position})
            </button>
          ` : ''}
          ${!isStandalone && m.tournament_id ? `
            <button onclick="location.hash='#/tournaments/${m.tournament_id}'" class="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold border border-slate-700 flex items-center gap-1 active:scale-95 transition">
              <span>📋</span> Ver Cuadro del Torneo
            </button>
          ` : ''}
          <button onclick="handleUndoLastFinish()" class="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold border border-slate-700 flex items-center gap-1 active:scale-95 transition" title="Corregir o revertir último punto">
            <span>⏪</span> Deshacer Último
          </button>
          <button onclick="handleReopenMatch()" class="px-3 py-2 rounded-xl bg-indigo-600/40 hover:bg-indigo-600 text-indigo-200 hover:text-white font-bold border border-indigo-500/30 flex items-center gap-1 active:scale-95 transition" title="Aumentar meta de puntos y continuar anotando">
            <span>🔓</span> Reabrir (+1 Meta)
          </button>
        </div>
      </div>
    `;
  };

  const renderMatchSwitcherBar = (matchesList, currentMatchId) => {
    if (!matchesList || matchesList.length <= 1) return '';
    return `
      <div class="bg-slate-900/90 rounded-2xl p-2.5 border border-slate-800 flex items-center gap-2 overflow-x-auto text-xs">
        <span class="text-[11px] uppercase font-bold text-slate-400 shrink-0 flex items-center gap-1 px-1">
          <span>🏟️</span> Mesas:
        </span>
        <div class="flex items-center gap-2 shrink-0">
          ${matchesList.map(m => {
            const isCurrent = m.id === currentMatchId;
            const isFin = m.status === 'finished';
            const nameA = m.player_a ? m.player_a.display_name.split(' ')[0] : 'TBD';
            const nameB = m.player_b ? m.player_b.display_name.split(' ')[0] : 'TBD';
            const badgeBg = isCurrent 
              ? 'bg-cyan-500 text-slate-950 font-black border-cyan-400 shadow-md shadow-cyan-500/30 ring-2 ring-cyan-400/40'
              : (isFin 
                ? 'bg-slate-800/80 text-slate-400 hover:text-slate-200 border-slate-700 hover:border-slate-600'
                : 'bg-blue-950/60 text-cyan-300 hover:bg-blue-900/60 border-blue-500/30 hover:border-cyan-500/50');
            
            return `
              <button onclick="location.hash='#/referee/${m.id}'" class="px-3 py-1.5 rounded-xl border flex items-center gap-1.5 transition active:scale-95 ${badgeBg}">
                <span>Mesa #${m.station_number || m.bracket_position}:</span>
                <span class="font-bold">${nameA} vs ${nameB}</span>
                <span class="font-mono text-[10px] px-1.5 py-0.5 rounded ${isCurrent ? 'bg-slate-950 text-cyan-300' : 'bg-slate-900 text-slate-300'}">
                  ${m.score_a}-${m.score_b}
                </span>
                ${isFin ? '<span class="text-amber-400 font-bold">✓</span>' : (isCurrent ? '<span class="w-1.5 h-1.5 rounded-full bg-slate-950 animate-ping"></span>' : '')}
              </button>
            `;
          }).join("")}
        </div>
      </div>
    `;
  };

  const renderRoundHistoryItem = (g, m, actualOrder) => {
    const isDraw = g.finish_type === "draw_0p" || g.awarded_to === "draw";
    const finishLabel = formatFinishLabel(g.finish_type);
    let recipientName = "Empate / Ambos Sin Puntos";
    let recipientClass = "text-slate-400";
    if (!isDraw) {
      if (g.awarded_to === "player_a") {
        recipientName = m.player_a?.display_name || "Corner Azul";
        recipientClass = "text-blue-400";
      } else {
        recipientName = m.player_b?.display_name || "Corner Rojo";
        recipientClass = "text-rose-400";
      }
    }
    const pointsClass = isDraw ? 'text-slate-500' : (g.points >= 3 ? 'text-amber-400' : 'text-emerald-400');

    return `
      <div class="p-2.5 sm:p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between text-xs transition">
        <div class="flex items-center gap-2.5">
          <span class="w-6 h-6 rounded-lg bg-slate-800 text-cyan-400 flex items-center justify-center font-mono font-bold text-xs border border-slate-700">
            ${actualOrder}
          </span>
          <div>
            <span class="font-bold ${recipientClass}">
              ${recipientName}
            </span>
            <span class="text-[11px] text-slate-400 font-mono ml-2 font-medium">
              ${finishLabel}
            </span>
          </div>
        </div>
        <div class="flex items-center gap-2 font-mono font-black">
          <span class="${pointsClass}">
            +${g.points} pts
          </span>
        </div>
      </div>
    `;
  };

  const renderPlayerDeckBadges = (deck, favoriteCombo, colorBg, borderCol, textCol) => {
    if (deck && deck.length) {
      return deck.map((b, i) => `
        <span class="px-2 py-0.5 rounded-md ${colorBg} border ${borderCol} text-[10px] ${textCol} font-mono">
          ${i+1}. ${b}
        </span>
      `).join("");
    }
    return `<span class="text-[11px] ${textCol} font-medium truncate">${favoriteCombo || 'Corner • Beyblade X'}</span>`;
  };

  const renderUI = () => {
    const target = match.target_points || (match.tournament ? match.tournament.match_target_points : 4) || 4;
    const isFinished = match.status === "finished" || match.score_a >= target || match.score_b >= target;
    const roundCount = (match.games ? match.games.length : 0) + 1;
    const winnerName = getMatchWinnerName(match);

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
              ${isStandalone ? 'Marcador Libre BeyScore' : `Stadium #${match.station_number || match.bracket_position} • Ronda ${match.round_number || 1}`}
            </span>
            ${nextMatch ? `
              <button onclick="location.hash='#/referee/${nextMatch.id}'" class="hidden sm:flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition font-bold">
                <span>➡️ Sig. Mesa #${nextMatch.station_number || nextMatch.bracket_position}</span>
              </button>
            ` : ''}
          </div>

          <!-- Target Points Quick Selector -->
          <div class="flex items-center gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
            <span class="text-[10px] uppercase font-bold text-slate-400 px-2">Meta:</span>
            ${[3, 4, 5, 7].map(pts => `
              <button onclick="setTargetPoints(${pts})" class="px-2.5 py-1 rounded-lg font-mono font-bold text-xs transition ${target === pts ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'}">
                ${pts}p ${pts === 4 ? '(Oficial)' : (pts === 5 ? '(Final)' : '')}
              </button>
            `).join("")}
          </div>

          <div class="flex items-center gap-2">
            ${!isStandalone ? `
              <button onclick="openDeclareWinnerModal()" title="Finalizar combate o declarar ganador oficial" class="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-bold text-xs flex items-center gap-1 active:scale-95 transition">
                <span>🏁</span> <span class="hidden sm:inline">Finalizar Combate</span>
              </button>
            ` : `
              <button onclick="openStandaloneEditModal()" title="Personalizar Nombres y Decks 3on3" class="px-2.5 py-1 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-300 border border-cyan-500/30 font-bold text-xs flex items-center gap-1">
                <span>⚙️</span> <span class="hidden sm:inline">Bladers & Decks</span>
              </button>
            `}
            <button onclick="handleLaunchChant()" title="Iniciar Cuenta Oficial 3-2-1 Go Shoot!" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs flex items-center gap-1">
              <span>📢</span> <span class="hidden sm:inline">Go Shoot!</span>
            </button>
            <button onclick="toggleFullscreen()" title="Pantalla Completa" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs">
              ⛶
            </button>
          </div>
        </div>

        <!-- Quick Match Switcher Bar (All Tournament Mesas) -->
        ${renderMatchSwitcherBar(tournamentMatches, match.id)}

        <!-- Launch Audio / Voice Chime Banner (Dynamic) -->
        <div id="chant-banner" class="hidden py-2 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black text-center text-sm uppercase tracking-widest shadow-lg animate-pulse">
          3... 2... 1... GO SHOOT! ⚡
        </div>

        <!-- Finished Notification Banner -->
        ${renderFinishBanner(isFinished, winnerName, match, nextMatch)}

        <!-- BeyScore Main Stage: Blue (Left) vs Red (Right) -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          <!-- CORNER AZUL (PLAYER A / 1) -->
          <div class="glass-card rounded-3xl p-5 border-2 ${match.score_a >= target ? 'border-amber-400 glow-gold' : 'border-blue-500/40'} bg-gradient-to-b from-blue-950/30 via-slate-900/90 to-slate-950 space-y-4 shadow-xl">
            <!-- Player Info & Score Header -->
            <div class="flex items-center justify-between border-b border-blue-900/40 pb-3">
              <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center font-black text-xl text-white shadow-md border-2 border-blue-400 shrink-0">
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
                    ${renderPlayerDeckBadges(match.player_a_deck, match.player_a?.favorite_combo, 'bg-blue-950/80', 'border-blue-500/40', 'text-cyan-300')}
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
                <button onclick="submitFinish('spin_finish_1p', 'player_a')" class="referee-btn p-3 rounded-2xl bg-gradient-to-r from-blue-700 to-cyan-700 hover:from-blue-600 hover:to-cyan-600 text-white font-bold text-xs sm:text-sm border border-cyan-400/40 shadow-md flex items-center justify-between active:scale-95 transition ${isFinished ? 'opacity-70' : ''}">
                  <div class="text-left">
                    <div class="font-extrabold">Spin Finish</div>
                    <div class="text-[10px] text-cyan-200 font-normal">Supervivencia</div>
                  </div>
                  <span class="px-2 py-1 rounded-xl bg-slate-950/70 text-cyan-300 font-mono font-black text-xs">+1</span>
                </button>

                <button onclick="submitFinish('over_finish_2p', 'player_a')" class="referee-btn p-3 rounded-2xl bg-gradient-to-r from-sky-700 to-blue-600 hover:from-sky-600 hover:to-blue-500 text-white font-bold text-xs sm:text-sm border border-sky-400/40 shadow-md flex items-center justify-between active:scale-95 transition ${isFinished ? 'opacity-70' : ''}">
                  <div class="text-left">
                    <div class="font-extrabold">Over Finish</div>
                    <div class="text-[10px] text-sky-200 font-normal">Zona de Salida</div>
                  </div>
                  <span class="px-2 py-1 rounded-xl bg-slate-950/70 text-sky-300 font-mono font-black text-xs">+2</span>
                </button>

                <button onclick="submitFinish('burst_finish_2p', 'player_a')" class="referee-btn p-3 rounded-2xl bg-gradient-to-r from-indigo-700 to-blue-600 hover:from-indigo-600 hover:to-blue-500 text-white font-bold text-xs sm:text-sm border border-indigo-400/40 shadow-md flex items-center justify-between active:scale-95 transition ${isFinished ? 'opacity-70' : ''}">
                  <div class="text-left">
                    <div class="font-extrabold">Burst Finish</div>
                    <div class="text-[10px] text-indigo-200 font-normal">Estallido</div>
                  </div>
                  <span class="px-2 py-1 rounded-xl bg-slate-950/70 text-indigo-300 font-mono font-black text-xs">+2</span>
                </button>

                <button onclick="submitFinish('xtreme_finish_3p', 'player_a')" class="referee-btn p-3 rounded-2xl bg-gradient-to-r from-amber-600 via-blue-600 to-cyan-600 hover:from-amber-500 hover:to-cyan-500 text-white font-black text-xs sm:text-sm border-2 border-amber-300 shadow-lg shadow-cyan-500/25 flex items-center justify-between active:scale-95 transition ${isFinished ? 'opacity-70' : ''}">
                  <div class="text-left">
                    <div class="font-black flex items-center gap-1">⚡ Xtreme</div>
                    <div class="text-[10px] text-amber-300 font-normal">Zona Xtreme</div>
                  </div>
                  <span class="px-2 py-1 rounded-xl bg-slate-950/90 text-amber-300 font-mono font-black text-xs">+3</span>
                </button>
              </div>

              <!-- Secondary Rules: Own Finish / Penalty -->
              <div class="grid grid-cols-2 gap-2 pt-1">
                <button onclick="submitFinish('penalty_1p', 'player_a')" class="p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 text-[11px] font-semibold border border-slate-800 hover:border-blue-500/40 flex items-center justify-between active:scale-95 transition ${isFinished ? 'opacity-70' : ''}" title="Punto por Warnings al rival (+1 para Azul)">
                  <span>⚠️ Punto por Warnings</span>
                  <span class="font-mono text-cyan-400 font-bold">+1 Azul</span>
                </button>
                <button onclick="submitFinish('own_finish_1p', 'player_a')" class="p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-cyan-300 text-[11px] font-semibold border border-slate-800 hover:border-cyan-500/40 flex items-center justify-between active:scale-95 transition ${isFinished ? 'opacity-70' : ''}" title="Self KO del rival (+1 para Azul)">
                  <span>🌀 Self KO</span>
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
                <div class="w-12 h-12 rounded-2xl bg-rose-600 flex items-center justify-center font-black text-xl text-white shadow-md border-2 border-rose-400 shrink-0">
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
                    ${renderPlayerDeckBadges(match.player_b_deck, match.player_b?.favorite_combo, 'bg-rose-950/80', 'border-rose-500/40', 'text-rose-300')}
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
                <button onclick="submitFinish('spin_finish_1p', 'player_b')" class="referee-btn p-3 rounded-2xl bg-gradient-to-r from-rose-700 to-red-600 hover:from-rose-600 hover:to-red-500 text-white font-bold text-xs sm:text-sm border border-rose-400/40 shadow-md flex items-center justify-between active:scale-95 transition ${isFinished ? 'opacity-70' : ''}">
                  <div class="text-left">
                    <div class="font-extrabold">Spin Finish</div>
                    <div class="text-[10px] text-rose-200 font-normal">Supervivencia</div>
                  </div>
                  <span class="px-2 py-1 rounded-xl bg-slate-950/70 text-rose-300 font-mono font-black text-xs">+1</span>
                </button>

                <button onclick="submitFinish('over_finish_2p', 'player_b')" class="referee-btn p-3 rounded-2xl bg-gradient-to-r from-orange-700 to-rose-600 hover:from-orange-600 hover:to-rose-500 text-white font-bold text-xs sm:text-sm border border-orange-400/40 shadow-md flex items-center justify-between active:scale-95 transition ${isFinished ? 'opacity-70' : ''}">
                  <div class="text-left">
                    <div class="font-extrabold">Over Finish</div>
                    <div class="text-[10px] text-orange-200 font-normal">Zona de Salida</div>
                  </div>
                  <span class="px-2 py-1 rounded-xl bg-slate-950/70 text-orange-300 font-mono font-black text-xs">+2</span>
                </button>

                <button onclick="submitFinish('burst_finish_2p', 'player_b')" class="referee-btn p-3 rounded-2xl bg-gradient-to-r from-pink-700 to-rose-600 hover:from-pink-600 hover:to-rose-500 text-white font-bold text-xs sm:text-sm border border-pink-400/40 shadow-md flex items-center justify-between active:scale-95 transition ${isFinished ? 'opacity-70' : ''}">
                  <div class="text-left">
                    <div class="font-extrabold">Burst Finish</div>
                    <div class="text-[10px] text-pink-200 font-normal">Estallido</div>
                  </div>
                  <span class="px-2 py-1 rounded-xl bg-slate-950/70 text-pink-300 font-mono font-black text-xs">+2</span>
                </button>

                <button onclick="submitFinish('xtreme_finish_3p', 'player_b')" class="referee-btn p-3 rounded-2xl bg-gradient-to-r from-amber-600 via-rose-600 to-red-700 hover:from-amber-500 hover:to-red-600 text-white font-black text-xs sm:text-sm border-2 border-amber-300 shadow-lg shadow-rose-500/25 flex items-center justify-between active:scale-95 transition ${isFinished ? 'opacity-70' : ''}">
                  <div class="text-left">
                    <div class="font-black flex items-center gap-1">⚡ Xtreme</div>
                    <div class="text-[10px] text-amber-200 font-normal">Zona Xtreme</div>
                  </div>
                  <span class="px-2 py-1 rounded-xl bg-slate-950/90 text-amber-300 font-mono font-black text-xs">+3</span>
                </button>
              </div>

              <!-- Secondary Rules: Own Finish / Penalty -->
              <div class="grid grid-cols-2 gap-2 pt-1">
                <button onclick="submitFinish('penalty_1p', 'player_b')" class="p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 text-[11px] font-semibold border border-slate-800 hover:border-rose-500/40 flex items-center justify-between active:scale-95 transition ${isFinished ? 'opacity-70' : ''}" title="Punto por Warnings al rival (+1 para Rojo)">
                  <span>⚠️ Punto por Warnings</span>
                  <span class="font-mono text-rose-400 font-bold">+1 Rojo</span>
                </button>
                <button onclick="submitFinish('own_finish_1p', 'player_b')" class="p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-rose-300 text-[11px] font-semibold border border-slate-800 hover:border-rose-500/40 flex items-center justify-between active:scale-95 transition ${isFinished ? 'opacity-70' : ''}" title="Self KO del rival (+1 para Rojo)">
                  <span>🌀 Self KO</span>
                  <span class="font-mono text-rose-400 font-bold">+1 Rojo</span>
                </button>
              </div>
            </div>
          </div>

        </div>

        <!-- Central Action Bar: Draw 0p, Undo, Manual Adjust, Reset -->
        <div class="glass-card rounded-2xl p-3 sm:p-4 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div class="flex items-center gap-2">
            <button onclick="submitFinish('draw_0p', 'draw')" class="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold border border-slate-700 active:scale-95 transition flex items-center gap-1.5 shadow-sm">
              <span>🤝</span> Empate / Sin Puntos (0p)
            </button>
            <span class="text-slate-500 text-[11px] hidden sm:inline">Asalto #${roundCount} en curso</span>
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

        <!-- Chronological Round History -->
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
              return renderRoundHistoryItem(g, match, actualOrder);
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

  const updateStandaloneStatus = () => {
    const target = localState.target_points;
    if (localState.score_a >= target || localState.score_b >= target) {
      localState.status = "finished";
      localState.winner = localState.score_a > localState.score_b ? "player_a" : "player_b";
    } else {
      localState.status = localState.games.length > 0 ? "in_progress" : "pending";
      localState.winner = null;
    }
  };

  const stepStandaloneScore = (player, delta) => {
    if (player === "player_a") {
      localState.score_a = Math.max(0, localState.score_a + delta);
    } else {
      localState.score_b = Math.max(0, localState.score_b + delta);
    }
    updateStandaloneStatus();
  };

  const applyStandaloneFinish = (finishType, awardedTo, pts) => {
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
    if (awardedTo === "player_b") localState.score_b += pts;
    updateStandaloneStatus();
  };

  const undoStandaloneFinish = () => {
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
    updateStandaloneStatus();
  };

  // Step score manual +/-
  window.stepScore = async (player, delta) => {
    if (isStandalone) {
      stepStandaloneScore(player, delta);
      loadMatch();
      return;
    }

    const newScoreA = player === "player_a" ? Math.max(0, match.score_a + delta) : match.score_a;
    const newScoreB = player === "player_b" ? Math.max(0, match.score_b + delta) : match.score_b;

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
      updateStandaloneStatus();
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
    const target = match.target_points || 4;
    const isFinished = match.status === "finished" || match.score_a >= target || match.score_b >= target;
    
    if (isFinished) {
      window.showToast?.("Este combate ya finalizó. Pulsa 'Reabrir (+1 Meta)' si necesitas continuar anotando asaltos.", "info");
      return;
    }

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
      applyStandaloneFinish(finishType, awardedTo, pts);
      loadMatch();
      return;
    }

    try {
      await window.api.recordFinish(matchId, {
        finish_type: finishType,
        awarded_to: awardedTo,
        notes: "Registrado vía Marcador BeyScore"
      });
      loadMatch();
    } catch(err) {
      window.showToast?.(err.message || "Error al registrar resultado", "error");
    }
  };

  // Undo last finish
  window.handleUndoLastFinish = async () => {
    if (isStandalone) {
      undoStandaloneFinish();
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
      : true;
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
    } catch(_e) {
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

  // Modal to Declare Official Winner
  window.openDeclareWinnerModal = () => {
    const existing = document.getElementById("declare-winner-modal");
    if (existing) existing.remove();

    const playerAName = match.player_a?.display_name || 'Corner Azul (Blader 1)';
    const playerBName = match.player_b?.display_name || 'Corner Rojo (Blader 2)';

    const modal = document.createElement("div");
    modal.id = "declare-winner-modal";
    modal.className = "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm";
    modal.innerHTML = `
      <div class="glass-card max-w-md w-full rounded-3xl p-6 border border-amber-500/40 space-y-4 shadow-2xl">
        <div class="flex items-center justify-between border-b border-slate-800 pb-3">
          <div class="flex items-center gap-2">
            <span class="text-xl">🏁</span>
            <div>
              <h3 class="font-bold text-white text-base">Declarar Ganador Oficial</h3>
              <p class="text-[11px] text-slate-400">Finalizar combate y avanzar llave del torneo</p>
            </div>
          </div>
          <button onclick="document.getElementById('declare-winner-modal').remove()" class="text-slate-400 hover:text-white text-lg">&times;</button>
        </div>

        <form id="declare-winner-form" class="space-y-4 text-xs">
          <div>
            <label class="block text-slate-300 font-semibold mb-2">Selecciona el Ganador:</label>
            <div class="grid grid-cols-2 gap-3">
              <label class="p-3.5 rounded-2xl bg-blue-950/40 border border-blue-500/40 hover:border-blue-400 cursor-pointer flex flex-col items-center text-center gap-1.5 transition">
                <input type="radio" name="winner_choice" value="player_a" ${match.score_a >= match.score_b ? 'checked' : ''} class="text-blue-500"/>
                <span class="font-extrabold text-blue-300 text-sm truncate w-full">${playerAName}</span>
                <span class="text-[10px] text-blue-400 font-mono">Corner Azul (${match.score_a} pts)</span>
              </label>
              <label class="p-3.5 rounded-2xl bg-rose-950/40 border border-rose-500/40 hover:border-rose-400 cursor-pointer flex flex-col items-center text-center gap-1.5 transition">
                <input type="radio" name="winner_choice" value="player_b" ${match.score_b > match.score_a ? 'checked' : ''} class="text-rose-500"/>
                <span class="font-extrabold text-rose-300 text-sm truncate w-full">${playerBName}</span>
                <span class="text-[10px] text-rose-400 font-mono">Corner Rojo (${match.score_b} pts)</span>
              </label>
            </div>
          </div>

          <div>
            <label class="block text-slate-300 font-semibold mb-1">Motivo de Conclusión:</label>
            <select name="finish_reason" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white outline-none focus:border-amber-400">
              <option value="decision_official">Victoria por Marcador Oficial (${match.score_a} - ${match.score_b})</option>
              <option value="forfeit_conceded">Abandono / Forfeit del Rival</option>
              <option value="disqualification">Descalificación Arbitral (DQ)</option>
              <option value="walkover">Walkover (No presentación)</option>
              <option value="referee_decision">Decisión Técnica del Árbitro</option>
            </select>
          </div>

          <div class="pt-2 flex justify-end gap-2 border-t border-slate-800">
            <button type="button" onclick="document.getElementById('declare-winner-modal').remove()" class="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold">
              Cancelar
            </button>
            <button type="submit" class="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black shadow">
              Confirmar y Cerrar Acta
            </button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById("declare-winner-form").onsubmit = async (e) => {
      e.preventDefault();
      const form = e.target;
      const choice = form.winner_choice.value;
      const reason = form.finish_reason.value;
      const winnerId = choice === "player_a" ? match.player_a_id : match.player_b_id;

      if (isStandalone) {
        localState.status = "finished";
        localState.winner = choice;
        document.getElementById("declare-winner-modal")?.remove();
        window.showToast?.("Combate finalizado exitosamente", "success");
        loadMatch();
        return;
      }

      try {
        await window.api.declareWinner(matchId, {
          winner_id: winnerId,
          finish_reason: reason
        });
        document.getElementById("declare-winner-modal")?.remove();
        window.showToast?.("¡Ganador oficial declarado y combate finalizado!", "success");
        loadMatch();
      } catch(err) {
        window.showToast?.(err.message || "Error al declarar ganador", "error");
      }
    };
  };

  // Manual Score Adjustment Modal
  window.openManualScoreModal = () => {
    const existing = document.getElementById("manual-score-modal");
    if (existing) existing.remove();

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

  // Real-time synchronization via WebSocket
  if (!isStandalone && matchId) {
    const parsedId = parseInt(matchId, 10);
    const wsHandler = (data) => {
      if (data && (data.match_id === parsedId || (match && data.tournament_id === match.tournament_id))) {
        loadMatch();
      }
    };
    window.wsHub.on("score_update", wsHandler);
    window.wsHub.on("tournament_updated", wsHandler);
  }

  loadMatch();
};
