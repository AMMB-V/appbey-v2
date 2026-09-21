// Tournament Detail View
if (typeof window.renderAvatar !== "function") {
  window.renderAvatar = (user, sizeClass = "w-8 h-8", textClass = "text-xs", borderClass = "border border-slate-700") => {
    const src = (user?.avatar_url && !user.avatar_url.includes("placeholder")) ? user.avatar_url : "/assets/images/appbey_logo_transparent.png?v=3.4";
    return `<div class="${sizeClass} rounded-full overflow-hidden ${borderClass} flex-shrink-0 flex items-center justify-center bg-slate-950 shadow-md"><img src="${src}" class="w-full h-full object-contain" onerror="this.src='/assets/images/appbey_logo_transparent.png?v=3.4'" alt="Blader"/></div>`;
  };
}

window.renderTournamentDetailView = async (container, tournamentId) => {
  const user = window.api.user;
  let tournament = null;
  let matches = [];
  let participants = [];

  container.innerHTML = `<div class="text-center py-16 text-slate-500">Cargando datos del torneo #${tournamentId}...</div>`;

  const isCurrentView = () => window.location.hash.startsWith(`#/tournaments/${tournamentId}`);

  const refreshData = async () => {
    if (!isCurrentView()) return;
    try {
      tournament = await window.api.getTournament(tournamentId);
      if (!isCurrentView()) return;
      matches = await window.api.getMatches(tournamentId);
      if (!isCurrentView()) return;
      participants = await window.api.getParticipants(tournamentId);
      if (!isCurrentView()) return;
      renderUI();
    } catch(err) {
      if (!isCurrentView()) return;
      container.innerHTML = `<div class="text-center py-16 text-rose-400">Error al cargar torneo: ${err.message}</div>`;
    }
  };

  // Connect WebSocket for live tournament sync
  window.wsHub.clear();
  window.wsHub.connect(tournamentId);
  window.wsHub.on("score_update", () => { if (isCurrentView()) refreshData(); });
  window.wsHub.on("match_call", () => { if (isCurrentView()) refreshData(); });
  window.wsHub.on("tournament_updated", () => { if (isCurrentView()) refreshData(); });
  window.wsHub.on("match_referee_assigned", () => { if (isCurrentView()) refreshData(); });

  const getMatchStatusBadge = (status) => {
    switch (status) {
      case 'in_progress':
        return '<span class="px-2 py-0.5 rounded font-bold uppercase bg-emerald-500/20 text-emerald-400">En Combate</span>';
      case 'calling':
        return '<span class="px-2 py-0.5 rounded font-bold uppercase bg-amber-500/20 text-amber-400">Llamado a Mesa</span>';
      case 'finished':
        return '<span class="px-2 py-0.5 rounded font-bold uppercase bg-slate-800 text-slate-400">Finalizado</span>';
      default:
        return '<span class="px-2 py-0.5 rounded font-bold uppercase bg-blue-500/20 text-blue-400">Pendiente</span>';
    }
  };

  const renderMatchCard = (m, isOrganizer) => {
    const borderClass = m.status === 'in_progress' ? 'border-cyan-500 glow-cyan' : m.status === 'calling' ? 'border-amber-500 animate-pulse' : 'border-slate-800';
    const playerAName = m.player_a ? m.player_a.display_name : 'TBD';
    const playerBName = m.player_b ? m.player_b.display_name : (m.is_bye ? 'BYE (Pase Libre)' : 'TBD');
    const scoreAClass = m.score_a > m.score_b ? 'text-cyan-400' : 'text-slate-300';
    const scoreBClass = m.score_b > m.score_a ? 'text-rose-400' : 'text-slate-300';

    const playerADeck = m.player_a_deck && m.player_a_deck.length 
      ? `<div class="text-[10px] text-blue-300/80 truncate font-mono">${m.player_a_deck.join(" • ")}</div>`
      : `<div class="text-[10px] text-slate-400 truncate">${m.player_a ? m.player_a.favorite_combo || '' : ''}</div>`;

    const playerBDeck = m.player_b_deck && m.player_b_deck.length
      ? `<div class="text-[10px] text-rose-300/80 truncate font-mono">${m.player_b_deck.join(" • ")}</div>`
      : `<div class="text-[10px] text-slate-400 truncate">${m.player_b ? m.player_b.favorite_combo || '' : ''}</div>`;

    const refereeBadge = m.referee 
      ? `<span class="px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/30 text-cyan-300 text-[11px] font-semibold">⚖️ ${m.referee.display_name}</span>`
      : `<span class="text-slate-500 italic text-[11px]">Sin árbitro</span>`;

    let actionsHtml = '';
    if (isOrganizer && !m.is_bye) {
      actionsHtml += `<button onclick="openAssignRefereeModal(${m.id})" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold active:scale-95 transition">Árbitro</button>`;
    }
    if (!m.is_bye && m.status !== 'finished') {
      actionsHtml += `
        <button onclick="handleCallMatch(${m.id}, ${m.station_number})" class="px-2.5 py-1 rounded-lg bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 font-semibold active:scale-95 transition">Llamar</button>
        <button onclick="location.hash='#/referee/${m.id}'" class="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold shadow flex items-center gap-1 active:scale-95 transition"><span>⚡</span> Marcador</button>
      `;
    } else if (!m.is_bye && m.status === 'finished') {
      actionsHtml += `
        <button onclick="location.hash='#/referee/${m.id}'" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1 active:scale-95 transition"><span>📊</span> Ver Acta</button>
        ${isOrganizer ? `<button onclick="handleReopenMatchFromDetail(${m.id})" class="px-2 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 text-xs font-semibold active:scale-95 transition" title="Reabrir combate para continuar anotando">Reabrir</button>` : ''}
      `;
    }

    return `
      <div class="glass-card rounded-2xl p-4 sm:p-5 border ${borderClass} space-y-4">
        <div class="flex items-center justify-between text-xs pb-2 border-b border-slate-800">
          <span class="font-bold text-slate-300">Ronda ${m.round_number} • Mesa / Stadium #${m.station_number}</span>
          ${getMatchStatusBadge(m.status)}
        </div>

        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2.5 flex-1 min-w-0">
            ${window.renderAvatar(m.player_a, "w-10 h-10", "text-sm", "border-2 border-blue-500")}
            <div class="min-w-0 truncate">
              <div class="font-bold text-sm text-white truncate ${m.winner_id === m.player_a_id ? 'text-amber-400' : ''}">
                ${playerAName}
              </div>
              ${playerADeck}
            </div>
          </div>

          <div class="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 font-mono font-extrabold text-lg sm:text-xl flex items-center gap-1.5 flex-shrink-0 shadow-inner">
            <span class="${scoreAClass}">${m.score_a}</span>
            <span class="text-slate-600">:</span>
            <span class="${scoreBClass}">${m.score_b}</span>
          </div>

          <div class="flex items-center justify-end gap-2.5 flex-1 min-w-0 text-right">
            <div class="min-w-0 truncate">
              <div class="font-bold text-sm text-white truncate ${m.winner_id === m.player_b_id ? 'text-amber-400' : ''}">
                ${playerBName}
              </div>
              ${playerBDeck}
            </div>
            ${window.renderAvatar(m.player_b, "w-10 h-10", "text-sm", "border-2 border-rose-500")}
          </div>
        </div>

        <div class="pt-2 flex flex-wrap items-center justify-between gap-2 text-xs border-t border-slate-800/60">
          <div class="text-slate-400 flex items-center gap-1.5">
            ${refereeBadge}
          </div>
          <div class="flex items-center gap-2">
            ${actionsHtml}
          </div>
        </div>
      </div>
    `;
  };

  const renderStandingsRow = (p, idx) => {
    const rankClass = idx === 0 ? 'text-amber-400 font-extrabold' : 'text-slate-300';
    const checkinBadge = p.checked_in
      ? '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">Check-in OK</span>'
      : '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400">Pendiente</span>';

    return `
      <tr class="hover:bg-slate-800/40">
        <td class="py-3 px-3 font-bold ${rankClass}">${idx + 1}</td>
        <td class="py-3 px-3">
          <div class="flex items-center gap-2">
            ${window.renderAvatar(p.user, "w-7 h-7", "text-xs", "border border-slate-700")}
            <div>
              <span class="font-bold text-white">${p.user?.display_name || ''}</span>
              <span class="text-xs text-slate-400">@${p.user?.username || ''}</span>
            </div>
          </div>
        </td>
        <td class="py-3 px-3 text-center font-extrabold text-cyan-400">${p.swiss_points}</td>
        <td class="py-3 px-3 text-center text-slate-300">${p.matches_won} / ${p.matches_drawn} / ${p.matches_lost}</td>
        <td class="py-3 px-3 text-center text-xs font-mono text-slate-400">${p.points_scored} : ${p.points_conceded}</td>
        <td class="py-3 px-3 text-center text-xs font-mono text-slate-300">${p.buchholz.toFixed(1)}</td>
        <td class="py-3 px-3 text-center">${checkinBadge}</td>
      </tr>
    `;
  };

  // Render Challonge Group Stage Cards (Group A, B, C, D...)
  const renderChallongeGroupCards = (parts, tour, isOrganizer) => {
    const advancers = tour.advancers_per_group || 2;
    // Collect group IDs
    let groupMap = {};
    const hasAssignedGroups = parts.some(p => p.group_id);

    if (hasAssignedGroups) {
      parts.forEach(p => {
        const gid = p.group_id || "A";
        if (!groupMap[gid]) groupMap[gid] = [];
        groupMap[gid].push(p);
      });
    } else {
      // Preview serpentine groups before tournament starts
      const count = tour.group_count || (parts.length >= 64 ? 16 : parts.length >= 32 ? 8 : parts.length >= 16 ? 4 : 2);
      for (let i = 0; i < count; i++) {
        groupMap[String.fromCharCode(65 + i)] = [];
      }
      parts.forEach((p, idx) => {
        const cycle = Math.floor(idx / count);
        const rem = idx % count;
        const gIndex = cycle % 2 === 0 ? rem : count - 1 - rem;
        const gName = String.fromCharCode(65 + gIndex);
        if (groupMap[gName]) {
          groupMap[gName].push({ ...p, group_id: gName, seed: p.seed || idx + 1 });
        }
      });
    }

    const groupKeys = Object.keys(groupMap).sort();
    if (!groupKeys.length) {
      return `<div class="p-8 text-center text-slate-500 glass-card rounded-2xl">No hay grupos configurados aún.</div>`;
    }

    return `
      <div class="space-y-6">
        <!-- Quick Participant Registration & Group Assignment Bar (Organizer) -->
        ${isOrganizer && tour.status !== 'completed' ? `
          <div class="p-4 rounded-2xl glass-card border border-cyan-500/40 bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-cyan-950/40 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 shadow-xl">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-xl bg-cyan-600/30 border border-cyan-500/50 flex items-center justify-center text-cyan-300 font-bold shrink-0">
                ⚡
              </div>
              <div>
                <div class="text-xs font-black text-white uppercase tracking-wider">Inscripción Rápida en Mesa de Torneo</div>
                <div class="text-[11px] text-slate-400">Registra bladers al instante y asígnalos directamente a un grupo</div>
              </div>
            </div>
            <form onsubmit="handleQuickAddParticipant(event, ${tour.id})" class="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <input type="text" id="quick-add-name-${tour.id}" placeholder="Nombre o Apodo del Blader..." required class="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs outline-none focus:border-cyan-400 flex-1 min-w-[170px] shadow-inner"/>
              <select id="quick-add-group-${tour.id}" class="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-cyan-300 text-xs font-bold outline-none focus:border-cyan-400">
                <option value="">Grupo: Automático</option>
                ${groupKeys.map(k => `<option value="${k}">Grupo ${k}</option>`).join("")}
              </select>
              <button type="submit" class="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/30 active:scale-95 transition whitespace-nowrap">
                + Añadir
              </button>
              <button type="button" onclick="openBulkParticipantModal(${tour.id})" class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-xs transition whitespace-nowrap">
                + Carga masiva
              </button>
            </form>
          </div>
        ` : ''}

        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-cyan-950/30 border border-cyan-500/20">
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <span class="text-sm font-bold text-cyan-300">📊 Fase de Grupos Estilo Challonge</span>
              <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">Siembra en Serpentina</span>
            </div>
            <p class="text-xs text-slate-400">
              Sistema Round Robin por grupo (3 pts victoria, 1 pto empate). Desempates: Puntos &rarr; Diferencia de Puntos &rarr; Puntos a favor &rarr; Seed inicial.
            </p>
          </div>
          <div class="flex items-center gap-2">
            <span class="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold whitespace-nowrap">
              Top ${advancers} por grupo clasifican a Eliminatorias
            </span>
            <button onclick="openSerpentineModal()" class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1 transition">
              ℹ️ Ver Siembra
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          ${groupKeys.map(gid => {
            const list = groupMap[gid];
            // Sort group members by group_rank if available, or tiebreakers
            list.sort((a, b) => {
              if (a.group_rank && b.group_rank) return a.group_rank - b.group_rank;
              const priority = tour.tie_break_priority || ["victories_losses", "point_difference", "head_to_head", "points_for_seed"];
              for (const criterion of priority) {
                if (criterion === "victories_losses") {
                  if ((b.group_matches_won || 0) !== (a.group_matches_won || 0)) return (b.group_matches_won || 0) - (a.group_matches_won || 0);
                  if ((a.group_matches_lost || 0) !== (b.group_matches_lost || 0)) return (a.group_matches_lost || 0) - (b.group_matches_lost || 0);
                } else if (criterion === "point_difference" && (b.group_diff || 0) !== (a.group_diff || 0)) return (b.group_diff || 0) - (a.group_diff || 0);
                else if (criterion === "points_for_seed" && (b.group_points_scored || 0) !== (a.group_points_scored || 0)) return (b.group_points_scored || 0) - (a.group_points_scored || 0);
              }
              return (a.seed || 99) - (b.seed || 99);
            });

            return `
              <div class="glass-card rounded-2xl overflow-hidden border border-cyan-500/30 flex flex-col shadow-xl">
                <!-- Group Header -->
                <div class="p-4 bg-slate-900/90 border-b border-cyan-500/20 flex items-center justify-between">
                  <div class="flex items-center gap-2.5">
                    <span class="w-8 h-8 rounded-xl bg-cyan-600/30 border border-cyan-500/50 text-cyan-300 font-black text-base flex items-center justify-center shadow">
                      ${gid}
                    </span>
                    <div>
                      <h3 class="font-extrabold text-white text-base">Grupo ${gid}</h3>
                      <span class="text-[11px] text-slate-400">${list.length} Bladers en contienda</span>
                    </div>
                  </div>
                  <span class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    Top ${advancers} a Playoffs
                  </span>
                </div>

                <!-- Group Table -->
                <div class="overflow-x-auto flex-1">
                  <table class="w-full text-left text-xs">
                    <thead class="text-[10px] uppercase text-slate-400 bg-slate-950/60 border-b border-slate-800/80">
                      <tr>
                        <th class="py-2.5 px-3 text-center w-8">#</th>
                        <th class="py-2.5 px-3">Blader</th>
                        <th class="py-2.5 px-2 text-center font-bold text-cyan-300">PTS</th>
                        <th class="py-2.5 px-2 text-center">V-E-D</th>
                        <th class="py-2.5 px-2 text-center">DIF</th>
                        <th class="py-2.5 px-2 text-center">PF</th>
                        <th class="py-2.5 px-3 text-center">Estado</th>
                        ${isOrganizer ? '<th class="py-2.5 px-2 text-center">Reasignar Grupo</th>' : ''}
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-800/60">
                      ${list.map((p, pIdx) => {
                        const rank = p.group_rank || (pIdx + 1);
                        const isQual = rank <= advancers;
                        const diffVal = p.group_diff || 0;
                        const diffStr = diffVal > 0 ? `+${diffVal}` : `${diffVal}`;
                        const diffColor = diffVal > 0 ? 'text-emerald-400' : diffVal < 0 ? 'text-rose-400' : 'text-slate-400';

                        return `
                          <tr class="${isQual ? 'bg-emerald-950/15 hover:bg-emerald-950/25' : 'hover:bg-slate-800/40'} transition">
                            <td class="py-2.5 px-3 text-center font-extrabold ${isQual ? 'text-emerald-400' : 'text-slate-400'}">
                              ${rank}
                            </td>
                            <td class="py-2.5 px-3">
                              <div class="flex items-center gap-2">
                                ${window.renderAvatar(p.user, "w-6 h-6", "text-[10px]", "border border-slate-700")}
                                <div class="min-w-0">
                                  <div class="font-bold text-white text-xs truncate flex items-center gap-1.5">
                                    <span>${p.user?.display_name || ''}</span>
                                    <span class="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-cyan-300 font-mono font-normal">S#${p.seed || pIdx + 1}</span>
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td class="py-2.5 px-2 text-center font-black text-cyan-300 text-sm">
                              ${p.group_points || 0}
                            </td>
                            <td class="py-2.5 px-2 text-center text-slate-300 font-mono text-[11px]">
                              ${p.matches_won || 0}-${p.matches_drawn || 0}-${p.matches_lost || 0}
                            </td>
                            <td class="py-2.5 px-2 text-center font-mono font-bold text-[11px] ${diffColor}">
                              ${diffStr}
                            </td>
                            <td class="py-2.5 px-2 text-center text-slate-400 font-mono text-[11px]">
                              ${p.group_points_scored || p.points_scored || 0}
                            </td>
                            <td class="py-2.5 px-3 text-center">
                              ${isQual ? `
                                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm">
                                  ✓ Clasificado
                                </span>
                              ` : `
                                <span class="px-2 py-0.5 rounded-md text-[10px] font-semibold text-slate-500 bg-slate-900 border border-slate-800">
                                  Eliminado
                                </span>
                              `}
                            </td>
                            ${isOrganizer ? `
                              <td class="py-2.5 px-2 text-center">
                                <div class="flex items-center justify-center gap-1">
                                  <select onchange="handleMoveParticipantGroup(${tour.id}, ${p.user_id}, this.value)" title="Mover Blader a otro grupo" class="bg-slate-900 border border-slate-700 text-[10px] font-bold text-cyan-300 rounded-lg px-2 py-1 outline-none focus:border-cyan-400">
                                    ${groupKeys.map(k => `<option value="${k}" ${k === gid ? 'selected' : ''}>Grupo ${k}</option>`).join("")}
                                  </select>
                                  <button onclick="handleRemoveParticipant(${tour.id}, ${p.user_id}, '${(p.user?.display_name || '').replace(/'/g, "\\'")}')" class="p-1 rounded bg-rose-950/40 border border-rose-800/40 hover:bg-rose-900/60 text-rose-300 text-xs transition" title="Remover del torneo">
                                    ✕
                                  </button>
                                </div>
                              </td>
                            ` : ''}
                          </tr>
                        `;
                      }).join("")}
                    </tbody>
                  </table>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
  };

  // Render Challonge Interactive Knockout Bracket Tree
  const renderChallongeKnockoutBracket = (matchesList, tour, isOrganizer) => {
    // Filter matches that are part of the knockout stage
    const playoffMatches = matchesList.filter(m => !m.group_id && m.stage !== "group_stage");
    const isKnockoutActive = tour.stage_type === 'knockout' || playoffMatches.length > 0;

    if (!isKnockoutActive) {
      // Group stage in progress or not started yet: Show Bracket Preview & Ready trigger
      const advancersCount = (tour.group_count || 4) * (tour.advancers_per_group || 2);
      const startingStageName = advancersCount >= 32 ? "16vos de Final (32 Bladers)" :
                                advancersCount >= 16 ? "8vos de Final (16 Bladers)" :
                                advancersCount >= 8 ? "Cuartos de Final (8 Bladers)" : "Semifinales (4 Bladers)";

      return `
        <div class="glass-card rounded-2xl p-6 sm:p-8 border border-cyan-500/30 text-center space-y-6">
          <div class="max-w-xl mx-auto space-y-3">
            <div class="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-3xl shadow-xl shadow-cyan-500/30">
              🏆
            </div>
            <h2 class="text-xl sm:text-2xl font-black text-white">Cuadro de Eliminación Directa (Playoffs)</h2>
            <p class="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Al finalizar los combates de la Fase de Grupos, los <strong class="text-cyan-300 font-bold">${advancersCount} mejores bladers</strong> clasificados avanzarán a las llaves eliminatorias de <strong class="text-amber-300 font-bold">${startingStageName}</strong>.
            </p>
          </div>

          <!-- Preview of Challonge Crossover Pairings -->
          <div class="max-w-2xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-3 text-left text-xs">
            <div class="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
              <div class="font-bold text-cyan-400">Llave Superior (Cruce de Grupos)</div>
              <div class="text-slate-300">⚔️ 1º Lugar Grupo A vs 2º Lugar Grupo B</div>
              <div class="text-slate-300">⚔️ 1º Lugar Grupo C vs 2º Lugar Grupo D</div>
            </div>
            <div class="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
              <div class="font-bold text-cyan-400">Llave Inferior (Cruce de Grupos)</div>
              <div class="text-slate-300">⚔️ 1º Lugar Grupo B vs 2º Lugar Grupo A</div>
              <div class="text-slate-300">⚔️ 1º Lugar Grupo D vs 2º Lugar Grupo C</div>
            </div>
          </div>

          ${isOrganizer ? `
            <div class="pt-2">
              <button onclick="handleGeneratePlayoffs(${tour.id})" class="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/25 transition active:scale-95 flex items-center gap-2 mx-auto">
                <span>⚡</span> Finalizar Grupos & Generar Fase de Eliminación
              </button>
            </div>
          ` : `
            <div class="text-xs text-slate-500 italic">
              El organizador del torneo activará las llaves en cuanto concluyan las partidas de grupos.
            </div>
          `}
        </div>
      `;
    }

    // Group playoff matches by round or stage
    const stageOrder = ["16vos de Final", "8vos de Final", "Cuartos de Final", "Semifinales", "Gran Final"];
    let roundsMap = {};

    playoffMatches.forEach(m => {
      let rName = m.stage_name || m.stage;
      if (!rName || rName === "knockout") {
        rName = `Ronda Playoff ${m.round_number}`;
      }
      if (rName === "quarterfinal") rName = "Cuartos de Final";
      if (rName === "semifinal") rName = "Semifinales";
      if (rName === "final") rName = "Gran Final";
      if (!roundsMap[rName]) roundsMap[rName] = [];
      roundsMap[rName].push(m);
    });

    const orderedRoundNames = Object.keys(roundsMap).sort((a, b) => {
      const idxA = stageOrder.indexOf(a);
      const idxB = stageOrder.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });

    // Check for champion
    const finalRoundName = orderedRoundNames[orderedRoundNames.length - 1];
    const finalMatches = roundsMap[finalRoundName] || [];
    const grandFinalMatch = finalMatches.find(m => m.stage === "Gran Final" || finalRoundName === "Gran Final");
    let championUser = null;
    if (grandFinalMatch && grandFinalMatch.status === "finished" && grandFinalMatch.winner_id) {
      championUser = grandFinalMatch.winner_id === grandFinalMatch.player_a_id ? grandFinalMatch.player_a : grandFinalMatch.player_b;
    } else if (tour.winner_user_id) {
      const p = participants.find(part => part.user_id === tour.winner_user_id);
      championUser = p ? p.user : null;
    }

    return `
      <div class="space-y-4">
        <!-- Interactive Bracket Header Toolbar -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900/90 border border-cyan-500/30">
          <div class="flex items-center gap-2.5">
            <span class="text-xl">🏆</span>
            <div>
              <h3 class="font-extrabold text-white text-sm">Cuadro de Eliminación Directa Interactivo</h3>
              <p class="text-[11px] text-slate-400">Pasa el cursor sobre cualquier Blader para seguir su recorrido por las llaves</p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button onclick="scrollBracketContainer(-300)" class="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 transition active:scale-95" title="Desplazar a la izquierda">
              ◀
            </button>
            <button onclick="scrollBracketContainer(300)" class="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 transition active:scale-95" title="Desplazar a la derecha">
              ▶
            </button>
            <button onclick="toggleBracketViewMode()" id="btn-toggle-bracket-mode" class="px-3 py-2 rounded-xl bg-cyan-600/20 text-cyan-300 border border-cyan-500/40 text-xs font-bold flex items-center gap-1.5 transition hover:bg-cyan-600/30">
              <span id="bracket-mode-icon">🌲</span> <span id="bracket-mode-text">Vista en Árbol</span>
            </button>
          </div>
        </div>

        <!-- Interactive Visual Tree Bracket Container -->
        <div id="bracket-tree-view" class="overflow-x-auto pb-6 pt-2 scroll-smooth">
          <div class="flex items-stretch gap-8 min-w-[850px] py-4 px-2">
            ${orderedRoundNames.map((rName, rIdx) => {
              const rMatches = roundsMap[rName];

              return `
                <div class="flex-1 min-w-[270px] max-w-[320px] flex flex-col justify-between space-y-4 relative">
                  <!-- Round Column Header -->
                  <div class="p-2.5 rounded-xl bg-gradient-to-r from-slate-900 to-slate-950 border border-cyan-500/30 text-center shadow-lg sticky top-0 z-20">
                    <h4 class="font-black text-xs uppercase tracking-wider text-cyan-300">${rName}</h4>
                    <span class="text-[10px] text-slate-400 font-mono">${rMatches.length} ${rMatches.length === 1 ? 'Combate' : 'Combates'}</span>
                  </div>

                  <!-- Column Matches -->
                  <div class="flex-1 flex flex-col justify-around gap-6 py-2">
                    ${rMatches.map((m) => {
                      const pAName = m.player_a?.display_name || "TBD (Clasificado)";
                      const pBName = m.player_b?.display_name || (m.is_bye ? "BYE (Pase Libre)" : "TBD (Clasificado)");
                      const isFinished = m.status === "finished";
                      const winnerA = m.winner_id === m.player_a_id;
                      const winnerB = m.winner_id === m.player_b_id;

                      return `
                        <div 
                          class="bracket-node glass-card rounded-2xl p-3 border ${
                            m.status === 'in_progress' ? 'border-emerald-500/80 shadow-lg shadow-emerald-500/20 glow-cyan' :
                            isFinished ? 'border-slate-800 bg-slate-950/80' : 'border-cyan-500/25'
                          } space-y-2 relative transition duration-200 hover:border-cyan-400 hover:shadow-cyan-950/40 cursor-pointer"
                          onclick="location.hash='#/referee/${m.id}'"
                          title="Haz clic para ver el marcador oficial de este match"
                        >
                          <div class="flex items-center justify-between text-[10px] text-slate-400 border-b border-slate-800/80 pb-1.5">
                            <span class="font-mono font-bold text-slate-300">Mesa #${m.station_number || 1}</span>
                            ${getMatchStatusBadge(m.status)}
                          </div>

                          <!-- Player A Node -->
                          <div 
                            class="bracket-player-row flex items-center justify-between gap-2 p-1.5 rounded-xl transition ${
                              winnerA ? 'bg-amber-500/20 border border-amber-500/50 text-amber-300 font-bold' : 'bg-slate-900/60 text-slate-200'
                            }"
                            data-blader-id="${m.player_a_id || ''}"
                            onmouseenter="highlightBracketBlader(${m.player_a_id || 0})"
                            onmouseleave="unhighlightBracketBlader()"
                          >
                            <div class="flex items-center gap-2 min-w-0">
                              ${window.renderAvatar(m.player_a, "w-6 h-6", "text-[10px]", winnerA ? "border border-amber-400" : "border border-slate-700")}
                              <div class="truncate text-xs font-semibold ${winnerA ? 'text-amber-300 font-bold' : 'text-white'}">
                                ${pAName}
                              </div>
                            </div>
                            <div class="flex items-center gap-1.5 flex-shrink-0">
                              ${winnerA ? '<span class="text-xs">👑</span>' : ''}
                              <span class="px-2 py-0.5 rounded-lg bg-slate-950 font-mono font-extrabold text-xs ${winnerA ? 'text-amber-400' : 'text-slate-300'}">
                                ${m.score_a}
                              </span>
                            </div>
                          </div>

                          <!-- Player B Node -->
                          <div 
                            class="bracket-player-row flex items-center justify-between gap-2 p-1.5 rounded-xl transition ${
                              winnerB ? 'bg-amber-500/20 border border-amber-500/50 text-amber-300 font-bold' : 'bg-slate-900/60 text-slate-200'
                            }"
                            data-blader-id="${m.player_b_id || ''}"
                            onmouseenter="highlightBracketBlader(${m.player_b_id || 0})"
                            onmouseleave="unhighlightBracketBlader()"
                          >
                            <div class="flex items-center gap-2 min-w-0">
                              ${window.renderAvatar(m.player_b, "w-6 h-6", "text-[10px]", winnerB ? "border border-amber-400" : "border border-slate-700")}
                              <div class="truncate text-xs font-semibold ${winnerB ? 'text-amber-300 font-bold' : 'text-white'}">
                                ${pBName}
                              </div>
                            </div>
                            <div class="flex items-center gap-1.5 flex-shrink-0">
                              ${winnerB ? '<span class="text-xs">👑</span>' : ''}
                              <span class="px-2 py-0.5 rounded-lg bg-slate-950 font-mono font-extrabold text-xs ${winnerB ? 'text-amber-400' : 'text-slate-300'}">
                                ${m.score_b}
                              </span>
                            </div>
                          </div>
                        </div>
                      `;
                    }).join("")}
                  </div>
                </div>
              `;
            }).join("")}

            <!-- Champion Podium Showcase Box -->
            <div class="flex-1 min-w-[240px] max-w-[280px] flex flex-col justify-center items-center py-4">
              <div class="p-2.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-amber-600/20 border border-amber-500/40 text-center shadow-lg w-full mb-4">
                <h4 class="font-black text-xs uppercase tracking-wider text-amber-300">Gran Campeón</h4>
                <span class="text-[10px] text-slate-400">Título Oficial</span>
              </div>

              <div class="w-full glass-card rounded-3xl p-6 border-2 ${championUser ? 'border-amber-400 glow-gold bg-gradient-to-b from-amber-950/40 via-slate-900 to-slate-950' : 'border-slate-800 bg-slate-950/50'} text-center space-y-4">
                <div class="text-4xl">
                  👑
                </div>
                ${championUser ? `
                  <div class="relative inline-block mx-auto">
                    ${window.renderAvatar(championUser, "w-20 h-20", "text-xl", "border-4 border-amber-400 shadow-2xl")}
                  </div>
                  <div>
                    <h3 class="font-black text-xl text-white">${championUser.display_name}</h3>
                    <div class="text-xs text-amber-300 font-mono mt-0.5">@${championUser.username} • Campeón de Torneo</div>
                  </div>
                  <div class="p-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-[11px] font-extrabold text-amber-300">
                    🏆 1er Lugar Nacional
                  </div>
                ` : `
                  <div class="w-16 h-16 rounded-full border-2 border-dashed border-slate-700 flex items-center justify-center text-slate-500 mx-auto font-mono text-xs">
                    ?
                  </div>
                  <div class="text-xs text-slate-400">
                    Por definirse en la Gran Final
                  </div>
                `}
              </div>
            </div>
          </div>
        </div>

        <!-- Detailed Match List View (Alternative Toggle) -->
        <div id="bracket-list-view" class="hidden space-y-6">
          ${orderedRoundNames.map(rName => {
            const rMatches = roundsMap[rName];
            return `
              <div class="space-y-3">
                <div class="flex items-center gap-2 pb-1 border-b border-slate-800">
                  <span class="font-extrabold text-sm text-cyan-300 uppercase">${rName}</span>
                  <span class="text-xs text-slate-400 font-mono">(${rMatches.length} matches)</span>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  ${rMatches.map(m => renderMatchCard(m, isOrganizer)).join("")}
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
  };

  const renderBladerDeckCard = (p, isOrganizer, u, tour) => {
    const deck = Array.isArray(p.deck) ? p.deck : [];
    const canEditDeck = isOrganizer || (u && u.id === p.user_id);
    const checkinBadge = p.checked_in
      ? '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">Check-in</span>'
      : '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400">Pendiente</span>';

    const editDeckBtn = canEditDeck ? `
      <div class="pt-1 flex items-center justify-between gap-2">
        ${isOrganizer && tour.status !== 'completed' ? `
          <button onclick="handleRemoveParticipant(${tour.id}, ${p.user_id}, '${(p.user?.display_name || '').replace(/'/g, "\\'")}')" class="px-2.5 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 text-xs font-semibold flex items-center gap-1 transition active:scale-95">
            <span>🗑️</span> Remover
          </button>
        ` : '<div></div>'}
        <button onclick='openEditDeckModal(${tour.id}, ${p.user_id}, "${(p.user?.display_name || '').replace(/"/g, '&quot;')}", ${JSON.stringify(deck)})' class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-cyan-600/30 text-cyan-300 hover:text-cyan-200 border border-slate-700 hover:border-cyan-500 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
          Editar Deck
        </button>
      </div>
    ` : '';

    return `
      <div class="glass-card rounded-2xl p-4 border border-slate-800 hover:border-cyan-500/40 transition space-y-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            ${window.renderAvatar(p.user, "w-10 h-10", "text-sm", "border border-slate-700")}
            <div>
              <div class="font-bold text-white text-sm">${p.user?.display_name || ''}</div>
              <div class="text-xs text-slate-400">@${p.user?.username || ''} • ${p.user?.country || 'PA'}</div>
            </div>
          </div>
          ${checkinBadge}
        </div>

        <div class="bg-slate-950/80 rounded-xl p-3 border border-slate-800 space-y-2">
          <div class="flex items-center justify-between text-[11px] text-slate-400 font-semibold border-b border-slate-800 pb-1">
            <span>🛡️ Deck Oficial (3on3)</span>
            <span class="text-cyan-400 font-mono">${deck.length}/3 Beys</span>
          </div>
          <div class="space-y-1.5 text-xs">
            <div class="flex items-center gap-2">
              <span class="w-4 h-4 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold flex items-center justify-center flex-shrink-0">1</span>
              <span class="font-semibold text-slate-200 truncate ${deck[0] ? '' : 'text-slate-500 italic'}">
                ${deck[0] || 'Sin registrar (Lead Bey)'}
              </span>
            </div>
            <div class="flex items-center gap-2">
              <span class="w-4 h-4 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-bold flex items-center justify-center flex-shrink-0">2</span>
              <span class="font-semibold text-slate-200 truncate ${deck[1] ? '' : 'text-slate-500 italic'}">
                ${deck[1] || 'Sin registrar'}
              </span>
            </div>
            <div class="flex items-center gap-2">
              <span class="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-bold flex items-center justify-center flex-shrink-0">3</span>
              <span class="font-semibold text-slate-200 truncate ${deck[2] ? '' : 'text-slate-500 italic'}">
                ${deck[2] || 'Sin registrar'}
              </span>
            </div>
          </div>
        </div>

        ${editDeckBtn}
      </div>
    `;
  };

  let currentGroupFilter = "";

  const renderUI = () => {
    const isOrganizer = user && (user.role === "organizer" || user.role === "admin" || user.id === tournament.organizer_id);
    const isParticipant = user && participants.some(p => p.user_id === user.id);
    const userParticipation = user && participants.find(p => p.user_id === user.id);
    const isGroupsFormat = tournament.format === "groups_elim" || tournament.format === "round_robin";
    const isKnockout = tournament.stage_type === "knockout";

    // Format labels
    const formatTitle = isGroupsFormat ? "Fase de Grupos + Playoffs (Challonge)" :
                        tournament.format === "swiss" ? "Sistema Suizo WBO" : "Eliminación Directa";

    // Stage status badge
    let statusText = tournament.status.toUpperCase();
    if (tournament.status === "in_progress") {
      if (isGroupsFormat) {
        statusText = isKnockout ? `• EN VIVO — ${tournament.knockout_round_name || 'Playoffs Eliminatorios'}` :
                                  `• EN VIVO — Fase de Grupos (${tournament.group_count || 4} Grupos)`;
      } else {
        statusText = `• EN VIVO — Ronda ${tournament.current_round} de ${tournament.total_rounds}`;
      }
    }

    // Extract unique groups from participants or matches
    const allGroupIds = Array.from(new Set(participants.map(p => p.group_id).filter(Boolean))).sort();

    // Filter matches for the matches tab
    const groupStageMatches = matches.filter(m => m.group_id || m.stage === "group_stage");
    const displayedMatches = currentGroupFilter
      ? groupStageMatches.filter(m => m.group_id === currentGroupFilter)
      : (isGroupsFormat ? groupStageMatches : matches);

    container.innerHTML = `
      <div class="space-y-6">
        <!-- Header Info Card -->
        <div class="glass-card rounded-2xl p-6 border border-cyan-500/30 relative overflow-hidden">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div class="space-y-2">
              <div class="flex flex-wrap items-center gap-2">
                <span class="px-3 py-1 rounded-full text-xs font-bold ${
                  tournament.status === 'in_progress' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                  tournament.status === 'registration_open' ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-800 text-slate-300'
                }">
                  ${statusText}
                </span>
                <span class="px-2.5 py-1 rounded bg-slate-800 text-xs font-semibold text-cyan-300 border border-cyan-500/30">${formatTitle}</span>
              </div>
              <h1 class="text-2xl md:text-3xl font-extrabold text-white">${tournament.title}</h1>
              <p class="text-slate-300 text-sm max-w-2xl">${tournament.description || ""}</p>
              <div class="text-xs text-slate-400 flex flex-wrap gap-4 pt-1">
                <span>📍 ${tournament.venue_name} (${tournament.country})</span>
                <span>⚔️ <strong class="text-amber-400">${tournament.battle_type === '3on3_deck' ? '3on3 Deck' : '1on1'}</strong></span>
                <span>👥 <strong class="text-cyan-400 font-bold">${participants.length}</strong> inscritos</span>
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="flex flex-wrap md:flex-col gap-2">
              ${!isParticipant && tournament.status === 'registration_open' ? `
                <button onclick="handleRegisterTournament(${tournament.id})" class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold shadow-lg shadow-emerald-500/25 transition active:scale-95">
                  Inscribirse al Torneo
                </button>
              ` : ''}

              ${isParticipant && !userParticipation.checked_in ? `
                <button onclick="handleSelfCheckin(${tournament.id})" class="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold shadow-lg shadow-cyan-500/25 transition active:scale-95">
                  Confirmar Check-In
                </button>
              ` : ''}

              <button onclick="location.hash='#/stadium-display/${tournament.id}'" class="px-4 py-2 rounded-xl bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                Pantalla
              </button>
            </div>
          </div>

          <!-- Organizer Management Bar -->
          ${isOrganizer ? `
            <details class="mt-5 pt-3 border-t border-slate-800/80 group">
              <summary class="cursor-pointer list-none min-h-11 flex items-center text-sm text-amber-300 font-bold">
                Opciones del organizador
                <span class="ml-2 text-xs text-slate-500 group-open:hidden">Mostrar</span>
                <span class="ml-2 text-xs text-slate-500 hidden group-open:inline">Ocultar</span>
              </summary>
            <div class="pt-2 flex flex-wrap items-center justify-between gap-3">
              <div class="text-xs text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/></svg>
                Panel de Control del Organizador
              </div>
              <div class="flex flex-wrap gap-2">
                ${tournament.status === 'registration_open' ? `
                  <button onclick="openAddParticipantModal(${tournament.id})" class="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow flex items-center gap-1 active:scale-95 transition">
                    <span>+</span> Inscribir participante
                  </button>
                  <button onclick="handleShuffleSeeds(${tournament.id})" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs shadow flex items-center gap-1 active:scale-95 transition">
                    <span>🎲</span> Barajar siembras
                  </button>
                  <button onclick="handleStartTournament(${tournament.id})" class="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow active:scale-95 transition flex items-center gap-1.5">
                    <span>▶</span> ${isGroupsFormat ? 'Iniciar y generar grupos' : 'Iniciar y generar ronda 1'}
                  </button>
                ` : ''}
                <button onclick="handleDeleteTournament(${tournament.id})" class="px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/60 font-bold text-xs shadow flex items-center gap-1 active:scale-95 transition ml-auto">
                  <span>🗑️</span> Eliminar Torneo
                </button>

                ${tournament.status === 'in_progress' && isGroupsFormat && !isKnockout ? `
                  <button onclick="handleGeneratePlayoffs(${tournament.id})" class="px-4 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs shadow active:scale-95 transition flex items-center gap-1.5">
                    <span>🏆</span> Generar playoffs
                  </button>
                  <button onclick="openSerpentineModal()" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition">
                    ℹ️ Siembra
                  </button>
                ` : ''}

                ${tournament.status === 'in_progress' && tournament.format === 'swiss' ? `
                  <button onclick="handleNextRound(${tournament.id})" class="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow active:scale-95 transition">
                    + Generar Siguiente Ronda
                  </button>
                ` : ''}
              </div>
            </div>
            </details>
          ` : ''}
        </div>

        <!-- Detail Sub-Navigation Tabs -->
        <div class="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto text-xs sm:text-sm">
          ${isGroupsFormat ? `
            <button onclick="switchTTab('groups')" id="ttab-btn-groups" class="ttab-btn px-4 py-2 rounded-xl font-bold whitespace-nowrap bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 transition">
              Grupos (${allGroupIds.length || tournament.group_count || 4})
            </button>
            <button onclick="switchTTab('matches')" id="ttab-btn-matches" class="ttab-btn px-4 py-2 rounded-xl font-semibold whitespace-nowrap text-slate-400 hover:text-white transition">
              Partidas (${groupStageMatches.length})
            </button>
            <button onclick="switchTTab('bracket')" id="ttab-btn-bracket" class="ttab-btn px-4 py-2 rounded-xl font-semibold whitespace-nowrap text-slate-400 hover:text-white transition">
              Playoffs
            </button>
          ` : `
            <button onclick="switchTTab('matches')" id="ttab-btn-matches" class="ttab-btn px-4 py-2 rounded-xl font-bold whitespace-nowrap bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 transition">
              Partidas en Vivo (${matches.length})
            </button>
            <button onclick="switchTTab('standings')" id="ttab-btn-standings" class="ttab-btn px-4 py-2 rounded-xl font-semibold whitespace-nowrap text-slate-400 hover:text-white transition">
              Tabla de Posiciones (${participants.length})
            </button>
          `}
          <button onclick="switchTTab('decks')" id="ttab-btn-decks" class="ttab-btn px-4 py-2 rounded-xl font-semibold whitespace-nowrap text-slate-400 hover:text-white transition">
            🛡️ Bladers & Decks (${participants.length})
          </button>
        </div>

        <!-- Groups Tab View (for groups_elim) -->
        ${isGroupsFormat ? `
          <div id="ttab-groups" class="space-y-4">
            ${renderChallongeGroupCards(participants, tournament, isOrganizer)}
          </div>
        ` : ''}

        <!-- Matches Tab View -->
        <div id="ttab-matches" class="${isGroupsFormat ? 'hidden' : ''} space-y-4">
          ${isGroupsFormat && allGroupIds.length > 0 ? `
            <!-- Group Filter Bar -->
            <div class="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
              <span class="text-slate-400 font-bold mr-1">Filtrar:</span>
              <button onclick="filterGroupMatches('')" class="px-3 py-1.5 rounded-lg font-bold ${!currentGroupFilter ? 'bg-cyan-600 text-white shadow' : 'bg-slate-800 text-slate-400 hover:text-white'} transition">
                Todos los Grupos (${groupStageMatches.length})
              </button>
              ${allGroupIds.map(gid => {
                const count = groupStageMatches.filter(m => m.group_id === gid).length;
                const isActive = currentGroupFilter === gid;
                return `
                  <button onclick="filterGroupMatches('${gid}')" class="px-3 py-1.5 rounded-lg font-bold ${isActive ? 'bg-cyan-600 text-white shadow' : 'bg-slate-800 text-slate-400 hover:text-white'} transition">
                    Grupo ${gid} (${count})
                  </button>
                `;
              }).join("")}
            </div>
          ` : ''}

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${displayedMatches.length ? displayedMatches.map(m => renderMatchCard(m, isOrganizer)).join("") : `
              <div class="col-span-full text-center py-12 glass-card rounded-2xl text-slate-500">
                No hay combates programados en esta sección.
              </div>
            `}
          </div>
        </div>

        <!-- Bracket Tab View -->
        <div id="ttab-bracket" class="hidden space-y-4">
          ${renderChallongeKnockoutBracket(matches, tournament, isOrganizer)}
        </div>

        <!-- Swiss Standings Tab View (for swiss format) -->
        <div id="ttab-standings" class="hidden glass-card rounded-2xl p-4 overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="text-xs uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th class="py-3 px-3"># Pos</th>
                <th class="py-3 px-3">Blader</th>
                <th class="py-3 px-3 text-center">Puntos Suizos</th>
                <th class="py-3 px-3 text-center">W / D / L</th>
                <th class="py-3 px-3 text-center">Pts +/-</th>
                <th class="py-3 px-3 text-center">Buchholz</th>
                <th class="py-3 px-3 text-center">Estado</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800">
              ${participants.map((p, idx) => renderStandingsRow(p, idx)).join("")}
            </tbody>
          </table>
        </div>

        <!-- Bladers & Decks Tab View -->
        <div id="ttab-decks" class="hidden space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            ${participants.map(p => renderBladerDeckCard(p, isOrganizer, user, tournament)).join("")}
          </div>
        </div>
      </div>
    `;
  };

  window.filterGroupMatches = (gid) => {
    currentGroupFilter = gid;
    renderUI();
    // Keep matches tab active
    window.switchTTab("matches");
  };

  window.switchTTab = (tab) => {
    const allTabIds = ["groups", "matches", "bracket", "standings", "decks"];
    allTabIds.forEach(t => {
      const el = document.getElementById(`ttab-${t}`);
      if (el) el.classList.toggle("hidden", t !== tab);

      const btn = document.getElementById(`ttab-btn-${t}`);
      if (btn) {
        btn.className = t === tab
          ? "ttab-btn px-4 py-2 rounded-xl font-bold whitespace-nowrap bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 transition"
          : "ttab-btn px-4 py-2 rounded-xl font-semibold whitespace-nowrap text-slate-400 hover:text-white transition";
      }
    });
  };

  window.handleRegisterTournament = async (tId) => {
    if (!window.api.user) {
      window.showAuthModal();
      return;
    }
    try {
      await window.api.registerTournament(tId);
      window.showToast("¡Inscripción confirmada!", "success");
      refreshData();
    } catch(err) {
      window.showToast(err.message || "Error al inscribirse", "error");
    }
  };

  window.handleSelfCheckin = async (tId) => {
    try {
      await window.api.checkinParticipant(tId, window.api.user.id);
      window.showToast("¡Check-in confirmado!", "success");
      refreshData();
    } catch(err) {
      window.showToast(err.message || "Error al realizar check-in", "error");
    }
  };

  window.handleStartTournament = async (tId) => {
    const isGroups = tournament && tournament.format === "groups_elim";
    const title = isGroups ? "Iniciar Fase de Grupos" : "Iniciar Torneo";
    const msg = isGroups
      ? "¿Deseas iniciar el torneo y segmentar a los participantes en grupos mediante Siembra en Serpentina (Challonge)?"
      : "¿Deseas iniciar el torneo y generar los emparejamientos de la Ronda 1?";
    const ok = await window.showAppConfirm(title, msg);
    if (!ok) return;
    try {
      await window.api.startTournament(tId);
      window.showToast("¡Torneo iniciado! Grupos y partidas generadas.", "success");
      refreshData();
    } catch(err) {
      window.showToast(err.message || "Error al iniciar torneo", "error");
    }
  };

  // Quick Inline Participant Registration
  window.handleQuickAddParticipant = async (e, tId) => {
    e.preventDefault();
    const input = document.getElementById(`quick-add-name-${tId}`);
    const groupSelect = document.getElementById(`quick-add-group-${tId}`);
    const name = input?.value?.trim();
    if (!name) return;
    const targetGroup = groupSelect?.value || undefined;

    try {
      input.disabled = true;
      const res = await window.api.addTournamentParticipant(tId, {
        new_blader_name: name,
        checked_in: true
      });
      if (targetGroup && res?.participant?.user_id) {
        await window.api.updateTournamentParticipantGroup(tId, res.participant.user_id, targetGroup);
      }
      window.showToast(`¡Blader "${name}" añadido e inscrito con éxito!`, "success");
      input.value = "";
      input.disabled = false;
      refreshData();
    } catch(err) {
      if (input) input.disabled = false;
      window.showToast(err.message || "Error al añadir participante", "error");
    }
  };

  window.openBulkParticipantModal = (tId) => {
    const existing = document.getElementById("bulk-part-modal");
    if (existing) existing.remove();
    const modal = document.createElement("div");
    modal.id = "bulk-part-modal";
    modal.className = "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md";
    modal.innerHTML = `
      <div class="glass-card max-w-xl w-full rounded-3xl p-6 border border-cyan-500/40 space-y-4 shadow-2xl">
        <div class="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 class="font-extrabold text-white">Carga masiva de participantes</h3>
          <button onclick="document.getElementById('bulk-part-modal').remove()" class="text-slate-400 hover:text-white text-2xl">&times;</button>
        </div>
        <p class="text-xs text-slate-400">Una persona por línea. Usa username, email o nombre visible; opcionalmente añade <code class="text-cyan-300">| Bey 1, Bey 2, Bey 3</code>.</p>
        <textarea id="bulk-participants-input" rows="10" placeholder="usuario@correo.com | Phoenix Wing 9-60 GF&#10;nombre presencial | Wizard Rod 5-70 B" class="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white text-sm outline-none focus:border-cyan-400"></textarea>
        <div class="flex justify-end gap-2">
          <button type="button" onclick="document.getElementById('bulk-part-modal').remove()" class="px-4 py-2 rounded-xl bg-slate-800 text-slate-300">Cancelar</button>
          <button type="button" onclick="handleBulkParticipantSubmit(${tId})" class="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold">Inscribir lista</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  };

  window.handleBulkParticipantSubmit = async (tId) => {
    const input = document.getElementById("bulk-participants-input");
    const lines = (input?.value || "").split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const participantsToAdd = lines.map(line => {
      const [identifier, deckText] = line.split("|", 2);
      return { identifier: identifier.trim(), deck: (deckText || "").split(",").map(item => item.trim()).filter(Boolean), checked_in: true };
    });
    if (!participantsToAdd.length) {
      window.showToast("Añade al menos un participante", "error");
      return;
    }
    try {
      await window.api.addTournamentParticipantsBulk(tId, participantsToAdd);
      window.showToast(`${participantsToAdd.length} participantes inscritos`, "success");
      document.getElementById("bulk-part-modal")?.remove();
      refreshData();
    } catch (err) {
      window.showToast(err.message || "Error en la carga masiva", "error");
    }
  };

  // Reassign Participant Group
  window.handleMoveParticipantGroup = async (tId, userId, newGroupId) => {
    if (!newGroupId) return;
    try {
      await window.api.updateTournamentParticipantGroup(tId, userId, newGroupId);
      window.showToast(`Blader reasignado a Grupo ${newGroupId}`, "success");
      refreshData();
    } catch(err) {
      window.showToast(err.message || "Error al mover de grupo", "error");
    }
  };

  // Interactive Bracket Controls
  window.scrollBracketContainer = (offset) => {
    const container = document.getElementById("bracket-tree-view");
    if (container) {
      container.scrollBy({ left: offset, behavior: "smooth" });
    }
  };

  window.toggleBracketViewMode = () => {
    const treeView = document.getElementById("bracket-tree-view");
    const listView = document.getElementById("bracket-list-view");
    const icon = document.getElementById("bracket-mode-icon");
    const text = document.getElementById("bracket-mode-text");
    if (!treeView || !listView) return;

    if (treeView.classList.contains("hidden")) {
      treeView.classList.remove("hidden");
      listView.classList.add("hidden");
      if (icon) icon.textContent = "🌲";
      if (text) text.textContent = "Vista en Árbol";
    } else {
      treeView.classList.add("hidden");
      listView.classList.remove("hidden");
      if (icon) icon.textContent = "📋";
      if (text) text.textContent = "Vista en Lista";
    }
  };

  window.highlightBracketBlader = (bladerId) => {
    if (!bladerId) return;
    document.querySelectorAll(`[data-blader-id="${bladerId}"]`).forEach(el => {
      el.classList.add("ring-2", "ring-cyan-400", "bg-cyan-900/40");
    });
  };

  window.unhighlightBracketBlader = () => {
    document.querySelectorAll(".bracket-player-row").forEach(el => {
      el.classList.remove("ring-2", "ring-cyan-400", "bg-cyan-900/40");
    });
  };

  window.handleShuffleSeeds = async (tId) => {
    const ok = await window.showAppConfirm("Barajar Siembras (Challonge)", "¿Deseas reordenar y barajar aleatoriamente los números de siembra de todos los participantes inscritos antes de iniciar?");
    if (!ok) return;
    try {
      await window.api.shuffleTournamentSeeds(tId);
      window.showToast("¡Siembras barajadas aleatoriamente con éxito!", "success");
      refreshData();
    } catch(err) {
      window.showToast(err.message || "Error al barajar siembras", "error");
    }
  };

  window.handleRemoveParticipant = async (tId, userId, bladerName) => {
    const ok = await window.showAppConfirm("Remover Participante", `¿Estás seguro de que deseas retirar a ${bladerName || 'este blader'} del torneo?`);
    if (!ok) return;
    try {
      await window.api.removeTournamentParticipant(tId, userId);
      window.showToast("Participante retirado exitosamente", "success");
      refreshData();
    } catch(err) {
      window.showToast(err.message || "Error al remover participante", "error");
    }
  };

  window.handleDeleteTournament = async (tId) => {
    const ok = await window.showAppConfirm("Eliminar Torneo", "¿Estás seguro de que deseas eliminar este torneo por completo? Esta acción es definitiva.");
    if (!ok) return;
    try {
      await window.api.deleteTournament(tId);
      window.showToast("Torneo eliminado exitosamente", "success");
      location.hash = "#/tournaments";
    } catch(err) {
      window.showToast(err.message || "Error al eliminar torneo", "error");
    }
  };

  window.handleGeneratePlayoffs = async (tId) => {
    const ok = await window.showAppConfirm(
      "Generar Cuadro de Eliminación (Playoffs)",
      "¿Deseas finalizar la fase de grupos y generar las llaves eliminatorias? Los mejores clasificados de cada grupo avanzarán según el cruce de Challonge (16vos, 8vos, Cuartos o Semifinales)."
    );
    if (!ok) return;
    try {
      const res = await window.api.generatePlayoffs(tId);
      window.showToast(res.message || "¡Fase eliminatoria generada con éxito!", "success");
      refreshData();
      setTimeout(() => {
        window.switchTTab("bracket");
      }, 300);
    } catch(err) {
      window.showToast(err.message || "Error al generar playoffs", "error");
    }
  };

  window.openSerpentineModal = () => {
    const existing = document.getElementById("serpentine-modal");
    if (existing) existing.remove();

    const gCount = tournament.group_count || 4;
    const modal = document.createElement("div");
    modal.id = "serpentine-modal";
    modal.className = "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto";
    modal.innerHTML = `
      <div class="glass-card max-w-lg w-full max-h-[90vh] overflow-y-auto rounded-3xl p-6 border border-cyan-500/40 space-y-4 shadow-2xl my-auto">
        <div class="flex items-center justify-between border-b border-slate-800 pb-3">
          <div class="flex items-center gap-2">
            <span class="text-xl">🐍</span>
            <h3 class="font-extrabold text-white text-base">Algoritmo de Siembra en Serpentina (Challonge)</h3>
          </div>
          <button onclick="document.getElementById('serpentine-modal').remove()" class="text-slate-400 hover:text-white text-2xl">&times;</button>
        </div>

        <div class="space-y-3 text-xs text-slate-300 leading-relaxed">
          <p>
            Al igual que en <strong class="text-cyan-300">challonge.com</strong>, los participantes se ordenan por su <strong>Seed inicial o Ranking</strong> y se siembran en zigzag a lo largo de los grupos para garantizar que ningún grupo quede desbalanceado con todos los jugadores fuertes.
          </p>

          <div class="p-3 rounded-xl bg-slate-900 border border-slate-800 font-mono text-[11px] space-y-1">
            <div class="text-cyan-400 font-bold">Patrón de Distribución (Serpentine Seeding):</div>
            <div>• Vuelta 1 (Izq a Der): Semilla 1 &rarr; Grupo A, Semilla 2 &rarr; Grupo B, Semilla 3 &rarr; Grupo C...</div>
            <div>• Vuelta 2 (Der a Izq): Semilla N &rarr; Grupo C, Semilla N+1 &rarr; Grupo B, Semilla N+2 &rarr; Grupo A...</div>
          </div>

          <div class="border-t border-slate-800 pt-3">
            <h4 class="font-bold text-white text-xs mb-2">Bladers Sembrados en este Torneo:</h4>
            <div class="max-h-52 overflow-y-auto space-y-1.5 pr-1">
              ${participants.map((p, idx) => `
                <div class="p-2 rounded-lg bg-slate-900/70 border border-slate-800 flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <span class="w-5 text-center font-bold text-cyan-400">#${p.seed || idx + 1}</span>
                    <span class="font-semibold text-white">${p.user?.display_name || ''}</span>
                  </div>
                  <span class="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold">
                    ${p.group_id ? `Grupo ${p.group_id}` : 'Pendiente'}
                  </span>
                </div>
              `).join("")}
            </div>
          </div>
        </div>

        <div class="flex justify-end pt-2">
          <button onclick="document.getElementById('serpentine-modal').remove()" class="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow">
            Entendido
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  };

  window.handleNextRound = async (tId) => {
    const ok = await window.showAppConfirm("Siguiente Ronda", "¿Generar la siguiente ronda de emparejamientos Suizos?");
    if (!ok) return;
    try {
      await window.api.nextRoundTournament(tId);
      window.showToast("¡Siguiente ronda generada!", "success");
      refreshData();
    } catch(err) {
      window.showToast(err.message || "Error al generar siguiente ronda", "error");
    }
  };

  window.handleCallMatch = async (mId, station) => {
    try {
      await window.api.callMatch(mId, station, "calling");
      window.showToast(`¡Combate llamado a Mesa / Stadium ${station}!`, "info");
    } catch(err) {
      window.showToast(err.message || "Error al llamar match", "error");
    }
  };

  window.handleReopenMatchFromDetail = async (mId) => {
    try {
      await window.api.reopenMatch(mId);
      window.showToast("Combate reabierto para anotación", "info");
      refreshData();
    } catch(err) {
      window.showToast(err.message || "Error al reabrir combate", "error");
    }
  };

  window.openEditDeckModal = (tId, userId, bladerName, currentDeck = []) => {
    const existing = document.getElementById("edit-deck-modal");
    if (existing) existing.remove();

    const beys = Array.isArray(currentDeck) ? currentDeck : [];
    const metaCombos = window.APPBEY_META_COMBOS || [];

    const modal = document.createElement("div");
    modal.id = "edit-deck-modal";
    modal.className = "fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto";
    modal.innerHTML = `
      <div class="glass-card max-w-md w-full rounded-3xl p-5 sm:p-6 border border-cyan-500/40 space-y-4 shadow-2xl my-auto max-h-[92vh] overflow-y-auto">
        <div class="flex items-center justify-between border-b border-slate-800 pb-3">
          <div class="flex items-center gap-2">
            <span class="text-xl">🛡️</span>
            <div>
              <h3 class="font-extrabold text-white text-base">Deck Oficial 3on3</h3>
              <p class="text-xs text-cyan-400 font-semibold">${bladerName}</p>
            </div>
          </div>
          <button onclick="document.getElementById('edit-deck-modal').remove()" class="text-slate-400 hover:text-white text-2xl px-2">&times;</button>
        </div>

        <!-- Quick insert pills -->
        <div class="space-y-1.5">
          <label class="block text-[11px] text-slate-400 font-semibold">Toca un combo popular para rellenar rápido:</label>
          <div class="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
            ${metaCombos.map(combo => `
              <button type="button" onclick="fillDeckInput('${combo.replace(/'/g, "\\'")}')" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 hover:text-white border border-slate-700 transition">
                + ${combo}
              </button>
            `).join("")}
          </div>
        </div>

        <form onsubmit="handleSubmitEditDeck(event, ${tId}, ${userId})" class="space-y-3 text-xs">
          <div>
            <label class="block text-slate-300 font-semibold mb-1">Bey #1 (Lead / As del Deck) *</label>
            <input type="text" id="deck-input-1" name="deck_1" value="${beys[0] || ''}" placeholder="Ej: Phoenix Wing 9-60 GF" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none focus:border-cyan-400 text-sm"/>
          </div>
          <div>
            <label class="block text-slate-300 font-semibold mb-1">Bey #2 (Segundo Bey)</label>
            <input type="text" id="deck-input-2" name="deck_2" value="${beys[1] || ''}" placeholder="Ej: Wizard Rod 5-70 B" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none focus:border-cyan-400 text-sm"/>
          </div>
          <div>
            <label class="block text-slate-300 font-semibold mb-1">Bey #3 (Tercer Bey)</label>
            <input type="text" id="deck-input-3" name="deck_3" value="${beys[2] || ''}" placeholder="Ej: Cobalt Dragoon 1-60 E" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none focus:border-cyan-400 text-sm"/>
          </div>
          <div class="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <button type="button" onclick="document.getElementById('edit-deck-modal').remove()" class="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700">Cancelar</button>
            <button type="submit" class="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold shadow-lg shadow-cyan-500/25 transition active:scale-95">
              Guardar Deck
            </button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);

    window.fillDeckInput = (combo) => {
      const i1 = document.getElementById("deck-input-1");
      const i2 = document.getElementById("deck-input-2");
      const i3 = document.getElementById("deck-input-3");
      if (!i1.value) i1.value = combo;
      else if (!i2.value) i2.value = combo;
      else if (!i3.value) i3.value = combo;
      else i1.value = combo;
    };
  };

  window.handleSubmitEditDeck = async (e, tId, userId) => {
    e.preventDefault();
    const form = e.target;
    const deck = [form.deck_1.value, form.deck_2.value, form.deck_3.value].map(s => s.trim()).filter(Boolean);
    try {
      await window.api.updateParticipantDeck(tId, userId, deck);
      window.showToast("¡Deck actualizado con éxito!", "success");
      document.getElementById("edit-deck-modal")?.remove();
      refreshData();
    } catch(err) {
      window.showToast(err.message || "Error al actualizar deck", "error");
    }
  };

  window.openAddParticipantModal = async (tId) => {
    const existing = document.getElementById("add-part-modal");
    if (existing) existing.remove();

    try {
      const allUsers = await window.api.getUsers({ limit: 100 });
      const currentPartIds = participants.map(p => p.user_id);
      const availableUsers = allUsers.filter(u => !currentPartIds.includes(u.id));

      const modal = document.createElement("div");
      modal.id = "add-part-modal";
      modal.className = "fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto";
      modal.innerHTML = `
        <div class="glass-card max-w-lg w-full rounded-3xl p-5 sm:p-6 border border-cyan-500/40 space-y-4 shadow-2xl my-auto max-h-[92vh] overflow-y-auto">
          <div class="flex items-center justify-between border-b border-slate-800 pb-3">
            <div class="flex items-center gap-2">
              <span class="text-xl">✍️</span>
              <h3 class="font-extrabold text-white text-base">Inscripción en Mesa & Registro de Deck</h3>
            </div>
            <button onclick="document.getElementById('add-part-modal').remove()" class="text-slate-400 hover:text-white text-2xl px-2">&times;</button>
          </div>

          <!-- Tabs: Nuevo Blader vs Usuario Registrado -->
          <div class="grid grid-cols-2 gap-2 p-1 bg-slate-900/90 rounded-xl border border-slate-800 text-xs">
            <button type="button" id="tab-new-blader" onclick="switchAddTab('new')" class="py-2 px-3 rounded-lg font-bold bg-cyan-600 text-white transition">
              ➕ Blader Nuevo / Presencial
            </button>
            <button type="button" id="tab-registered-blader" onclick="switchAddTab('registered')" class="py-2 px-3 rounded-lg font-bold text-slate-400 hover:text-white transition">
              👥 Usuario de la Web
            </button>
          </div>

          <!-- Form 1: Nuevo Blader -->
          <form id="form-new-blader" onsubmit="handleSubmitAddParticipant(event, ${tId}, 'new')" class="space-y-3 text-xs">
            <div>
              <label class="block text-slate-300 font-semibold mb-1">Nombre o Alias del Blader *</label>
              <input type="text" name="new_blader_name" required placeholder="Ej: Jan Kraft, Carlos Bey, Alex..." class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 sm:p-3 text-white placeholder-slate-500 outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 text-sm"/>
            </div>

            <div class="grid grid-cols-2 gap-2.5">
              <div>
                <label class="block text-slate-300 font-semibold mb-1">País / Región</label>
                <select name="country" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white outline-none focus:border-cyan-400">
                  <option value="PA" selected>Panamá (PA)</option>
                  <option value="ES">España (ES)</option>
                  <option value="MX">México (MX)</option>
                  <option value="US">Estados Unidos (US)</option>
                  <option value="CL">Chile (CL)</option>
                  <option value="AR">Argentina (AR)</option>
                  <option value="PE">Perú (PE)</option>
                  <option value="CO">Colombia (CO)</option>
                  <option value="FR">Francia (FR)</option>
                  <option value="JP">Japón (JP)</option>
                  <option value="WBO">WBO / Internacional</option>
                </select>
              </div>
              <div>
                <label class="block text-slate-300 font-semibold mb-1">Combo Favorito (Opcional)</label>
                <input type="text" name="favorite_combo" placeholder="Ej: Phoenix Wing 9-60 GF" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white placeholder-slate-500 outline-none focus:border-cyan-400"/>
              </div>
            </div>

            <!-- Deck 3on3 Inputs -->
            <div class="bg-slate-950/70 rounded-2xl p-3 border border-slate-800/80 space-y-2">
              <label class="block text-cyan-400 font-bold text-xs">🛡️ Deck Oficial 3on3 del Blader (Opcional)</label>
              <div class="flex flex-wrap gap-1.5">
                ${metaCombos.map(combo => `<button type="button" onclick="fillParticipantDeckInput('new','${combo.replace(/'/g, "\\'")}')" class="px-2 py-1 rounded-lg bg-slate-800 text-[10px] text-slate-300 border border-slate-700">+ ${combo}</button>`).join("")}
              </div>
              <div class="space-y-2">
                <input type="text" name="deck_1" placeholder="Bey #1 (Lead): Ej: Phoenix Wing 9-60 GF" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white placeholder-slate-500 outline-none focus:border-cyan-400 text-xs"/>
                <input type="text" name="deck_2" placeholder="Bey #2: Ej: Wizard Rod 5-70 B" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white placeholder-slate-500 outline-none focus:border-cyan-400 text-xs"/>
                <input type="text" name="deck_3" placeholder="Bey #3: Ej: Cobalt Dragoon 1-60 E" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white placeholder-slate-500 outline-none focus:border-cyan-400 text-xs"/>
              </div>
            </div>

            <div class="flex items-center gap-2 pt-1">
              <input type="checkbox" name="checked_in" id="checkin-now-new" checked class="rounded bg-slate-900 border-slate-700 text-cyan-500 w-4 h-4"/>
              <label for="checkin-now-new" class="text-slate-300 font-semibold cursor-pointer">Marcar Check-in presencial confirmado (Listo para emparejar)</label>
            </div>

            <div class="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button type="button" onclick="document.getElementById('add-part-modal').remove()" class="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700">Cancelar</button>
              <button type="submit" class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold shadow-lg shadow-cyan-500/25 transition active:scale-95">
                ⚡ Inscribir Blader & Deck
              </button>
            </div>
          </form>

          <!-- Form 2: Usuario Registrado -->
          <form id="form-registered-blader" onsubmit="handleSubmitAddParticipant(event, ${tId}, 'registered')" class="space-y-3 text-xs hidden">
            <div>
              <label class="block text-slate-300 font-semibold mb-1">Seleccionar Usuario de la Plataforma</label>
              ${availableUsers.length ? `
                <div class="mb-2">
                  <input type="text" id="reg-user-search-input" oninput="window.filterRegUserSelect(this.value)" placeholder="🔍 Buscar por nombre o @usuario..." class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white outline-none focus:border-cyan-400 text-xs"/>
                </div>
                <select id="reg-user-select" name="user_id" required class="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none focus:border-cyan-400 text-sm">
                  ${availableUsers.map(u => `<option value="${u.id}">${u.display_name} (@${u.username}) - ${u.country} [${u.role}]</option>`).join("")}
                </select>
              ` : `
                <div class="text-slate-400 p-3 bg-slate-900/80 rounded-xl border border-slate-800 text-center">
                  Todos los usuarios registrados de la web ya están en el torneo.
                </div>
              `}
            </div>

            <!-- Deck 3on3 Inputs for registered user -->
            <div class="bg-slate-950/70 rounded-2xl p-3 border border-slate-800/80 space-y-2">
              <label class="block text-cyan-400 font-bold text-xs">🛡️ Deck Oficial 3on3 del Blader (Opcional)</label>
              <div class="flex flex-wrap gap-1.5">
                ${metaCombos.map(combo => `<button type="button" onclick="fillParticipantDeckInput('registered','${combo.replace(/'/g, "\\'")}')" class="px-2 py-1 rounded-lg bg-slate-800 text-[10px] text-slate-300 border border-slate-700">+ ${combo}</button>`).join("")}
              </div>
              <div class="space-y-2">
                <input type="text" name="reg_deck_1" placeholder="Bey #1 (Lead): Ej: Phoenix Wing 9-60 GF" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white placeholder-slate-500 outline-none focus:border-cyan-400 text-xs"/>
                <input type="text" name="reg_deck_2" placeholder="Bey #2: Ej: Wizard Rod 5-70 B" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white placeholder-slate-500 outline-none focus:border-cyan-400 text-xs"/>
                <input type="text" name="reg_deck_3" placeholder="Bey #3: Ej: Cobalt Dragoon 1-60 E" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white placeholder-slate-500 outline-none focus:border-cyan-400 text-xs"/>
              </div>
            </div>

            <div class="flex items-center gap-2 pt-1">
              <input type="checkbox" name="checked_in" id="checkin-now-reg" checked class="rounded bg-slate-900 border-slate-700 text-cyan-500 w-4 h-4"/>
              <label for="checkin-now-reg" class="text-slate-300 font-semibold cursor-pointer">Marcar Check-in de presencia confirmado</label>
            </div>

            <div class="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button type="button" onclick="document.getElementById('add-part-modal').remove()" class="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700">Cancelar</button>
              <button type="submit" ${!availableUsers.length ? 'disabled' : ''} class="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow transition active:scale-95">
                Inscribir Usuario
              </button>
            </div>
          </form>
        </div>
      `;
      document.body.appendChild(modal);

      window.switchAddTab = (tab) => {
        const btnNew = document.getElementById("tab-new-blader");
        const btnReg = document.getElementById("tab-registered-blader");
        const formNew = document.getElementById("form-new-blader");
        const formReg = document.getElementById("form-registered-blader");
        if (tab === "new") {
          btnNew.className = "py-2 px-3 rounded-lg font-bold bg-cyan-600 text-white transition";
          btnReg.className = "py-2 px-3 rounded-lg font-bold text-slate-400 hover:text-white transition";
          formNew.classList.remove("hidden");
          formReg.classList.add("hidden");
        } else {
          btnReg.className = "py-2 px-3 rounded-lg font-bold bg-cyan-600 text-white transition";
          btnNew.className = "py-2 px-3 rounded-lg font-bold text-slate-400 hover:text-white transition";
          formReg.classList.remove("hidden");
          formNew.classList.add("hidden");
        }
      };

      window.filterRegUserSelect = (query) => {
        const sel = document.getElementById("reg-user-select");
        if (!sel) return;
        const q = query.toLowerCase().trim();
        Array.from(sel.options).forEach(opt => {
          const text = opt.text.toLowerCase();
          opt.style.display = text.includes(q) ? "" : "none";
        });
        const firstVisible = Array.from(sel.options).find(opt => opt.style.display !== "none");
        if (firstVisible) sel.value = firstVisible.value;
      };
      window.fillParticipantDeckInput = (mode, combo) => {
        const names = mode === "new" ? ["deck_1", "deck_2", "deck_3"] : ["reg_deck_1", "reg_deck_2", "reg_deck_3"];
        const firstEmpty = names.map(name => document.querySelector(`#${mode === "new" ? "form-new-blader" : "form-registered-blader"} [name="${name}"]`)).find(input => input && !input.value.trim());
        if (firstEmpty) firstEmpty.value = combo;
      };
    } catch(err) {
      window.showToast("Error al cargar participantes: " + err.message, "error");
    }
  };

  window.handleSubmitAddParticipant = async (e, tId, mode) => {
    e.preventDefault();
    const form = e.target;
    try {
      if (mode === "new") {
        const deck = [form.deck_1?.value, form.deck_2?.value, form.deck_3?.value].map(s => s?.trim()).filter(Boolean);
        await window.api.addTournamentParticipant(tId, {
          new_blader_name: form.new_blader_name.value,
          country: form.country.value,
          favorite_combo: form.favorite_combo.value,
          checked_in: form.checked_in.checked,
          deck
        });
      } else {
        const deck = [form.reg_deck_1?.value, form.reg_deck_2?.value, form.reg_deck_3?.value].map(s => s?.trim()).filter(Boolean);
        await window.api.addTournamentParticipant(tId, {
          user_id: form.user_id.value,
          checked_in: form.checked_in.checked,
          deck
        });
      }
      window.showToast("¡Blader y Deck inscritos exitosamente en el torneo!", "success");
      document.getElementById("add-part-modal")?.remove();
      refreshData();
    } catch(err) {
      window.showToast(err.message || "Error al inscribir blader", "error");
    }
  };

  window.openAssignRefereeModal = async (matchId) => {
    const existing = document.getElementById("assign-ref-modal");
    if (existing) existing.remove();

    try {
      const allUsers = await window.api.getUsers({ limit: 100 });
      const referees = allUsers.filter(u => ["referee", "admin", "organizer"].includes(u.role));

      const modal = document.createElement("div");
      modal.id = "assign-ref-modal";
      modal.className = "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md";
      modal.innerHTML = `
        <div class="glass-card max-w-md w-full rounded-2xl p-6 border border-cyan-500/40 space-y-4 shadow-2xl">
          <div class="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 class="font-bold text-white text-base">Asignar Árbitro / Juez de Mesa</h3>
            <button onclick="document.getElementById('assign-ref-modal').remove()" class="text-slate-400 hover:text-white text-lg">&times;</button>
          </div>
          <form onsubmit="handleSubmitAssignReferee(event, ${matchId})" class="space-y-4 text-xs">
            <div>
              <label class="block text-slate-300 font-semibold mb-1">Seleccionar Árbitro Oficial</label>
              <select name="referee_id" required class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-cyan-400">
                ${referees.map(r => `<option value="${r.id}">${r.display_name} (@${r.username}) [${r.role.toUpperCase()}]</option>`).join("")}
              </select>
            </div>
            <div class="flex justify-end gap-2 pt-2">
              <button type="button" onclick="document.getElementById('assign-ref-modal').remove()" class="px-4 py-2 rounded-lg bg-slate-800 text-slate-300">Cancelar</button>
              <button type="submit" class="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold shadow">
                Confirmar Asignación
              </button>
            </div>
          </form>
        </div>
      `;
      document.body.appendChild(modal);
    } catch(err) {
      window.showToast("Error al cargar árbitros: " + err.message, "error");
    }
  };

  window.handleSubmitAssignReferee = async (e, matchId) => {
    e.preventDefault();
    const form = e.target;
    try {
      await window.api.assignMatchReferee(matchId, form.referee_id.value);
      window.showToast("¡Árbitro asignado al match correctamente!", "success");
      document.getElementById("assign-ref-modal")?.remove();
      refreshData();
    } catch(err) {
      window.showToast(err.message || "Error al asignar árbitro", "error");
    }
  };

  refreshData();
};
