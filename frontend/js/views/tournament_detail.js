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
                <span>👥 Participantes: <strong class="text-cyan-400 font-bold">${participants.length}</strong> Bladers inscritos</span>
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

              <button onclick="location.hash='#/stadium-display/${tournament.id}'" class="px-4 py-2 rounded-xl bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition">
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
                  <button onclick="openAddParticipantModal(${tournament.id})" class="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow flex items-center gap-1 active:scale-95 transition">
                    <span>+</span> Registrar Participante & Deck
                  </button>
                  <button onclick="handleStartTournament(${tournament.id})" class="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow active:scale-95 transition">
                    ▶ Iniciar Torneo & Generar Ronda 1
                  </button>
                ` : ''}
                ${tournament.status === 'in_progress' && tournament.format === 'swiss' ? `
                  <button onclick="handleNextRound(${tournament.id})" class="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow active:scale-95 transition">
                    + Generar Siguiente Ronda
                  </button>
                ` : ''}
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Detail Sub-Navigation Tabs -->
        <div class="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto text-xs sm:text-sm">
          <button onclick="switchTTab('matches')" id="ttab-btn-matches" class="ttab-btn px-4 py-2 rounded-xl font-bold whitespace-nowrap bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 transition">
            Partidas en Vivo (${matches.length})
          </button>
          <button onclick="switchTTab('standings')" id="ttab-btn-standings" class="ttab-btn px-4 py-2 rounded-xl font-semibold whitespace-nowrap text-slate-400 hover:text-white transition">
            Tabla de Posiciones (${participants.length})
          </button>
          <button onclick="switchTTab('decks')" id="ttab-btn-decks" class="ttab-btn px-4 py-2 rounded-xl font-semibold whitespace-nowrap text-slate-400 hover:text-white transition">
            🛡️ Bladers & Decks (${participants.length})
          </button>
        </div>

        <!-- Matches Tab View -->
        <div id="ttab-matches" class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${matches.map(m => `
              <div class="glass-card rounded-2xl p-4 sm:p-5 border ${m.status === 'in_progress' ? 'border-cyan-500 glow-cyan' : m.status === 'calling' ? 'border-amber-500 animate-pulse' : 'border-slate-800'} space-y-4">
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
                <div class="flex items-center justify-between gap-2">
                  <!-- Player A -->
                  <div class="flex items-center gap-2.5 flex-1 min-w-0">
                    <img src="${m.player_a ? m.player_a.avatar_url : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}" class="w-10 h-10 rounded-xl border-2 border-blue-500 object-cover flex-shrink-0"/>
                    <div class="min-w-0 truncate">
                      <div class="font-bold text-sm text-white truncate ${m.winner_id === m.player_a_id ? 'text-amber-400' : ''}">
                        ${m.player_a ? m.player_a.display_name : 'TBD'}
                      </div>
                      ${m.player_a_deck && m.player_a_deck.length ? `
                        <div class="text-[10px] text-blue-300/80 truncate font-mono">
                          ${m.player_a_deck.join(" • ")}
                        </div>
                      ` : `
                        <div class="text-[10px] text-slate-400 truncate">${m.player_a ? m.player_a.favorite_combo || '' : ''}</div>
                      `}
                    </div>
                  </div>

                  <!-- Score Display -->
                  <div class="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 font-mono font-extrabold text-lg sm:text-xl flex items-center gap-1.5 flex-shrink-0 shadow-inner">
                    <span class="${m.score_a > m.score_b ? 'text-cyan-400' : 'text-slate-300'}">${m.score_a}</span>
                    <span class="text-slate-600">:</span>
                    <span class="${m.score_b > m.score_a ? 'text-rose-400' : 'text-slate-300'}">${m.score_b}</span>
                  </div>

                  <!-- Player B -->
                  <div class="flex items-center justify-end gap-2.5 flex-1 min-w-0 text-right">
                    <div class="min-w-0 truncate">
                      <div class="font-bold text-sm text-white truncate ${m.winner_id === m.player_b_id ? 'text-amber-400' : ''}">
                        ${m.player_b ? m.player_b.display_name : (m.is_bye ? 'BYE (Pase Libre)' : 'TBD')}
                      </div>
                      ${m.player_b_deck && m.player_b_deck.length ? `
                        <div class="text-[10px] text-rose-300/80 truncate font-mono">
                          ${m.player_b_deck.join(" • ")}
                        </div>
                      ` : `
                        <div class="text-[10px] text-slate-400 truncate">${m.player_b ? m.player_b.favorite_combo || '' : ''}</div>
                      `}
                    </div>
                    <img src="${m.player_b ? m.player_b.avatar_url : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}" class="w-10 h-10 rounded-xl border-2 border-rose-500 object-cover flex-shrink-0"/>
                  </div>
                </div>

                <!-- Match Actions / Referee trigger -->
                <div class="pt-2 flex flex-wrap items-center justify-between gap-2 text-xs border-t border-slate-800/60">
                  <div class="text-slate-400 flex items-center gap-1.5">
                    ${m.referee ? `<span class="px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/30 text-cyan-300 text-[11px] font-semibold">⚖️ ${m.referee.display_name}</span>` : `<span class="text-slate-500 italic text-[11px]">Sin árbitro</span>`}
                  </div>
                  <div class="flex items-center gap-2">
                    ${isOrganizer && !m.is_bye ? `
                      <button onclick="openAssignRefereeModal(${m.id})" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold active:scale-95 transition">
                        Árbitro
                      </button>
                    ` : ''}
                    ${!m.is_bye && m.status !== 'finished' ? `
                      <button onclick="handleCallMatch(${m.id}, ${m.station_number})" class="px-2.5 py-1 rounded-lg bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 font-semibold active:scale-95 transition">
                        Llamar
                      </button>
                      <button onclick="location.hash='#/referee/${m.id}'" class="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold shadow flex items-center gap-1 active:scale-95 transition">
                        <span>⚡</span> Mesa WBO
                      </button>
                    ` : ''}
                    ${!m.is_bye && m.status === 'finished' ? `
                      <button onclick="location.hash='#/referee/${m.id}'" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1 active:scale-95 transition">
                        <span>📊</span> Ver Acta
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

        <!-- Bladers & Decks Tab View -->
        <div id="ttab-decks" class="hidden space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            ${participants.map(p => {
              const deck = Array.isArray(p.deck) ? p.deck : [];
              const canEditDeck = isOrganizer || (user && user.id === p.user_id);
              return `
                <div class="glass-card rounded-2xl p-4 border border-slate-800 hover:border-cyan-500/40 transition space-y-3">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                      <img src="${p.user.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}" class="w-10 h-10 rounded-xl object-cover border border-slate-700"/>
                      <div>
                        <div class="font-bold text-white text-sm">${p.user.display_name}</div>
                        <div class="text-xs text-slate-400">@${p.user.username} • ${p.user.country || 'WBO'}</div>
                      </div>
                    </div>
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold ${p.checked_in ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}">
                      ${p.checked_in ? 'Check-in' : 'Pendiente'}
                    </span>
                  </div>

                  <!-- 3 Beys Deck Box -->
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

                  ${canEditDeck ? `
                    <div class="pt-1 flex justify-end">
                      <button onclick='openEditDeckModal(${tournament.id}, ${p.user_id}, "${p.user.display_name.replace(/"/g, '&quot;')}", ${JSON.stringify(deck)})' class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-cyan-600/30 text-cyan-300 hover:text-cyan-200 border border-slate-700 hover:border-cyan-500 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                        Editar Deck
                      </button>
                    </div>
                  ` : ''}
                </div>
              `;
            }).join("")}
          </div>
        </div>
      </div>
    `;
  };

  window.switchTTab = (tab) => {
    document.getElementById("ttab-matches").classList.toggle("hidden", tab !== "matches");
    document.getElementById("ttab-standings").classList.toggle("hidden", tab !== "standings");
    document.getElementById("ttab-decks").classList.toggle("hidden", tab !== "decks");

    const tabs = ["matches", "standings", "decks"];
    tabs.forEach(t => {
      const btn = document.getElementById(`ttab-btn-${t}`);
      if (btn) {
        btn.className = tab === t
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
    const ok = await window.showAppConfirm("Iniciar Torneo", "¿Deseas iniciar el torneo y generar los emparejamientos de la Ronda 1?");
    if (!ok) return;
    try {
      await window.api.startTournament(tId);
      window.showToast("¡Torneo iniciado! Ronda 1 generada.", "success");
      refreshData();
    } catch(err) {
      window.showToast(err.message || "Error al iniciar torneo", "error");
    }
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

  window.openEditDeckModal = (tId, userId, bladerName, currentDeck = []) => {
    const existing = document.getElementById("edit-deck-modal");
    if (existing) existing.remove();

    const beys = Array.isArray(currentDeck) ? currentDeck : [];
    const metaCombos = [
      "Phoenix Wing 9-60 GF",
      "Wizard Rod 5-70 B",
      "Dran Buster 1-60 LF",
      "Cobalt Dragoon 1-60 E",
      "Shark Edge 3-60 LF",
      "Unicorn Sting 5-60 GP"
    ];

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
              <button type="button" onclick="fillDeckInput('${combo}')" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 hover:text-white border border-slate-700 transition">
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
                <select name="user_id" required class="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none focus:border-cyan-400 text-sm">
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
