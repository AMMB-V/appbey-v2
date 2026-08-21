// Tournament Detail View
window.renderTournamentDetailView = async (container, tournamentId) => {
  const user = window.api.user;
  let tournament = null;
  let matches = [];
  let participants = [];

  container.innerHTML = `<div class="text-center py-16 text-slate-500">Cargando datos del torneo #${tournamentId}...</div>`;

  const refreshData = async () => {
    try {
      tournament = await window.api.getTournament(tournamentId);
      matches = await window.api.getMatches(tournamentId);
      participants = await window.api.getParticipants(tournamentId);
      renderUI();
    } catch(err) {
      container.innerHTML = `<div class="text-center py-16 text-rose-400">Error al cargar torneo: ${err.message}</div>`;
    }
  };

  // Connect WebSocket for live tournament sync
  window.wsHub.connect(tournamentId);
  window.wsHub.on("score_update", () => refreshData());
  window.wsHub.on("match_call", () => refreshData());

  const renderUI = () => {
    const isOrganizer = user && (user.role === "organizer" || user.role === "admin" || user.id === tournament.organizer_id);
    const isParticipant = user && participants.some(p => p.user_id === user.id);
    const userParticipation = user && participants.find(p => p.user_id === user.id);

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
                  ${tournament.status === 'in_progress' ? `• EN VIVO — Ronda ${tournament.current_round} de ${tournament.total_rounds}` : tournament.status.toUpperCase()}
                </span>
                <span class="px-2.5 py-1 rounded bg-slate-800 text-xs font-semibold text-cyan-300">${tournament.format === 'swiss' ? 'Sistema Suizo WBO' : 'Eliminación Directa'}</span>
                <span class="px-2.5 py-1 rounded bg-slate-800 text-xs font-semibold text-amber-300">${tournament.battle_type === '3on3_deck' ? '3on3 Deck' : '1on1'} (Meta: ${tournament.match_target_points} pts)</span>
              </div>
              <h1 class="text-2xl md:text-3xl font-extrabold text-white">${tournament.title}</h1>
              <p class="text-slate-300 text-sm max-w-2xl">${tournament.description || ""}</p>
              <div class="text-xs text-slate-400 flex flex-wrap gap-4 pt-1">
                <span>📍 ${tournament.venue_name} (${tournament.country})</span>
                <span>🏆 Pozo: <strong class="text-amber-400">${tournament.prize_pool_ap} AP Coins</strong></span>
                <span>👥 Participantes: <strong class="text-cyan-400">${participants.length}</strong> / ${tournament.max_participants}</span>
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="flex flex-wrap md:flex-col gap-2">
              ${!isParticipant && tournament.status === 'registration_open' ? `
                <button onclick="handleRegisterTournament(${tournament.id})" class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold shadow-lg shadow-emerald-500/25 transition active:scale-95">
                  Inscribirse (${tournament.entry_fee_ap} AP)
                </button>
              ` : ''}

              ${isParticipant && !userParticipation.checked_in ? `
                <button onclick="handleSelfCheckin(${tournament.id})" class="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold shadow-lg shadow-cyan-500/25 transition active:scale-95">
                  Confirmar Check-In
                </button>
              ` : ''}

              <button onclick="location.hash='#/stadium-display/${tournament.id}'" class="px-4 py-2 rounded-xl bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center justify-center gap-1.5">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                Pantalla Proyector TV
              </button>
            </div>
          </div>

          <!-- Organizer Management Bar -->
          ${isOrganizer ? `
            <div class="mt-6 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
              <div class="text-xs text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/></svg>
                Panel de Control del Organizador
              </div>
              <div class="flex flex-wrap gap-2">
                ${tournament.status === 'registration_open' ? `
                  <button onclick="handleStartTournament(${tournament.id})" class="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow">
                    ▶ Iniciar Torneo & Generar Ronda 1
                  </button>
                ` : ''}
                ${tournament.status === 'in_progress' && tournament.format === 'swiss' ? `
                  <button onclick="handleNextRound(${tournament.id})" class="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow">
                    + Generar Siguiente Ronda
                  </button>
                ` : ''}
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Detail Sub-Navigation Tabs -->
        <div class="flex items-center gap-2 border-b border-slate-800 pb-2">
          <button onclick="switchTTab('matches')" id="ttab-btn-matches" class="ttab-btn px-4 py-2 rounded-lg font-bold text-sm bg-cyan-600/20 text-cyan-400 border border-cyan-500/30">
            Partidas en Vivo (${matches.length})
          </button>
          <button onclick="switchTTab('standings')" id="ttab-btn-standings" class="ttab-btn px-4 py-2 rounded-lg font-semibold text-sm text-slate-400 hover:text-white">
            Tabla de Posiciones (${participants.length})
          </button>
        </div>

        <!-- Matches Tab View -->
        <div id="ttab-matches" class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${matches.map(m => `
              <div class="glass-card rounded-xl p-5 border ${m.status === 'in_progress' ? 'border-cyan-500 glow-cyan' : m.status === 'calling' ? 'border-amber-500 animate-pulse' : 'border-slate-800'} space-y-4">
                <div class="flex items-center justify-between text-xs pb-2 border-b border-slate-800">
                  <span class="font-bold text-slate-300">Ronda ${m.round_number} • Mesa / Stadium #${m.station_number}</span>
                  <span class="px-2 py-0.5 rounded font-bold uppercase ${
                    m.status === 'in_progress' ? 'bg-emerald-500/20 text-emerald-400' :
                    m.status === 'calling' ? 'bg-amber-500/20 text-amber-400' :
                    m.status === 'finished' ? 'bg-slate-800 text-slate-400' : 'bg-blue-500/20 text-blue-400'
                  }">
                    ${m.status === 'in_progress' ? 'En Combate' : m.status === 'calling' ? 'Llamado a Mesa' : m.status === 'finished' ? 'Finalizado' : 'Pendiente'}
                  </span>
                </div>

                <!-- Competitors Versus -->
                <div class="flex items-center justify-between">
                  <!-- Player A -->
                  <div class="flex items-center gap-3 flex-1">
                    <img src="${m.player_a ? m.player_a.avatar_url : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}" class="w-10 h-10 rounded-full border-2 border-blue-500 object-cover"/>
                    <div class="truncate">
                      <div class="font-bold text-sm text-white truncate ${m.winner_id === m.player_a_id ? 'text-amber-400' : ''}">
                        ${m.player_a ? m.player_a.display_name : 'TBD'}
                      </div>
                      <div class="text-[10px] text-slate-400">${m.player_a ? m.player_a.favorite_combo || '' : ''}</div>
                    </div>
                  </div>

                  <!-- Score Display -->
                  <div class="px-4 py-1.5 rounded-xl bg-slate-950 border border-slate-800 font-mono font-extrabold text-xl flex items-center gap-2">
                    <span class="${m.score_a > m.score_b ? 'text-cyan-400' : 'text-slate-300'}">${m.score_a}</span>
                    <span class="text-slate-600">:</span>
                    <span class="${m.score_b > m.score_a ? 'text-rose-400' : 'text-slate-300'}">${m.score_b}</span>
                  </div>

                  <!-- Player B -->
                  <div class="flex items-center justify-end gap-3 flex-1 text-right">
                    <div class="truncate">
                      <div class="font-bold text-sm text-white truncate ${m.winner_id === m.player_b_id ? 'text-amber-400' : ''}">
                        ${m.player_b ? m.player_b.display_name : (m.is_bye ? 'BYE (Pase Libre)' : 'TBD')}
                      </div>
                      <div class="text-[10px] text-slate-400">${m.player_b ? m.player_b.favorite_combo || '' : ''}</div>
                    </div>
                    <img src="${m.player_b ? m.player_b.avatar_url : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}" class="w-10 h-10 rounded-full border-2 border-rose-500 object-cover"/>
                  </div>
                </div>

                <!-- Match Actions / Referee trigger -->
                <div class="pt-2 flex items-center justify-between text-xs">
                  <div class="text-slate-500">
                    ${m.games && m.games.length ? `${m.games.length} asalto(s) jugados` : 'Esperando inicio'}
                  </div>
                  <div class="flex items-center gap-2">
                    ${!m.is_bye && m.status !== 'finished' ? `
                      <button onclick="handleCallMatch(${m.id}, ${m.station_number})" class="px-2.5 py-1 rounded bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 font-semibold">
                        Llamar a Mesa
                      </button>
                      <button onclick="location.hash='#/referee/${m.id}'" class="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold shadow">
                        Mesa de Arbitraje ⚡
                      </button>
                    ` : ''}
                  </div>
                </div>
              </div>
            `).join("")}
          </div>
        </div>

        <!-- Standings Tab View -->
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
              ${participants.map((p, idx) => `
                <tr class="hover:bg-slate-800/40">
                  <td class="py-3 px-3 font-bold ${idx === 0 ? 'text-amber-400 font-extrabold' : 'text-slate-300'}">
                    ${idx + 1}
                  </td>
                  <td class="py-3 px-3">
                    <div class="flex items-center gap-2">
                      <img src="${p.user.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}" class="w-7 h-7 rounded-full object-cover"/>
                      <span class="font-bold text-white">${p.user.display_name}</span>
                      <span class="text-xs text-slate-400">@${p.user.username}</span>
                    </div>
                  </td>
                  <td class="py-3 px-3 text-center font-extrabold text-cyan-400">${p.swiss_points}</td>
                  <td class="py-3 px-3 text-center text-slate-300">${p.matches_won} / ${p.matches_drawn} / ${p.matches_lost}</td>
                  <td class="py-3 px-3 text-center text-xs font-mono text-slate-400">${p.points_scored} : ${p.points_conceded}</td>
                  <td class="py-3 px-3 text-center text-xs font-mono text-slate-300">${p.buchholz.toFixed(1)}</td>
                  <td class="py-3 px-3 text-center">
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold ${p.checked_in ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}">
                      ${p.checked_in ? 'Check-in OK' : 'Pendiente'}
                    </span>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  };

  window.switchTTab = (tab) => {
    document.getElementById("ttab-matches").classList.toggle("hidden", tab !== "matches");
    document.getElementById("ttab-standings").classList.toggle("hidden", tab !== "standings");

    document.getElementById("ttab-btn-matches").className = tab === "matches"
      ? "ttab-btn px-4 py-2 rounded-lg font-bold text-sm bg-cyan-600/20 text-cyan-400 border border-cyan-500/30"
      : "ttab-btn px-4 py-2 rounded-lg font-semibold text-sm text-slate-400 hover:text-white";

    document.getElementById("ttab-btn-standings").className = tab === "standings"
      ? "ttab-btn px-4 py-2 rounded-lg font-bold text-sm bg-cyan-600/20 text-cyan-400 border border-cyan-500/30"
      : "ttab-btn px-4 py-2 rounded-lg font-semibold text-sm text-slate-400 hover:text-white";
  };

  window.handleRegisterTournament = async (tId) => {
    if (!window.api.user) {
      window.showAuthModal();
      return;
    }
    try {
      await window.api.registerTournament(tId);
      alert("¡Inscripción confirmada!");
      refreshData();
    } catch(err) {
      alert(err.message || "Error al inscribirse");
    }
  };

  window.handleSelfCheckin = async (tId) => {
    try {
      await window.api.checkinParticipant(tId, window.api.user.id);
      alert("¡Check-in confirmado!");
      refreshData();
    } catch(err) {
      alert(err.message || "Error al realizar check-in");
    }
  };

  window.handleStartTournament = async (tId) => {
    if (!confirm("¿Deseas iniciar el torneo y generar los emparejamientos de la Ronda 1?")) return;
    try {
      await window.api.startTournament(tId);
      refreshData();
    } catch(err) {
      alert(err.message || "Error al iniciar torneo");
    }
  };

  window.handleNextRound = async (tId) => {
    if (!confirm("¿Generar la siguiente ronda de emparejamientos Suizos?")) return;
    try {
      await window.api.nextRoundTournament(tId);
      refreshData();
    } catch(err) {
      alert(err.message || "Error al generar siguiente ronda");
    }
  };

  window.handleCallMatch = async (mId, station) => {
    try {
      await window.api.callMatch(mId, station, "calling");
      alert(`¡Combate llamado a Mesa / Stadium ${station}!`);
    } catch(err) {
      alert(err.message || "Error al llamar match");
    }
  };

  refreshData();
};
