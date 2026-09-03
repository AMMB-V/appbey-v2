// Tournaments List & Creation View
window.renderTournamentsView = async (container) => {
  const user = window.api.user;
  const isOrganizer = user && (user.role === "organizer" || user.role === "admin");

  container.innerHTML = `
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl md:text-3xl font-extrabold text-white">Torneos y Competencias</h1>
          <p class="text-slate-400 text-sm">Gestiona y participa en torneos oficiales y comunitarios de Beyblade X.</p>
        </div>
        ${isOrganizer ? `
          <button onclick="window.openCreateTournamentModal()" class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold shadow-lg shadow-cyan-500/25 flex items-center gap-2">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
            Crear Nuevo Torneo
          </button>
        ` : ''}
      </div>

      <!-- Filters Tab Bar -->
      <div class="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto">
        <button onclick="filterTournaments('')" id="tab-all" class="t-tab px-4 py-2 rounded-lg text-sm font-bold bg-cyan-600/20 text-cyan-400 border border-cyan-500/30">Todos</button>
        <button onclick="filterTournaments('in_progress')" id="tab-in_progress" class="t-tab px-4 py-2 rounded-lg text-sm font-semibold text-slate-400 hover:text-white">En Curso</button>
        <button onclick="filterTournaments('registration_open')" id="tab-registration_open" class="t-tab px-4 py-2 rounded-lg text-sm font-semibold text-slate-400 hover:text-white">Inscripciones Abiertas</button>
        <button onclick="filterTournaments('completed')" id="tab-completed" class="t-tab px-4 py-2 rounded-lg text-sm font-semibold text-slate-400 hover:text-white">Finalizados</button>
      </div>

      <!-- Tournaments Grid -->
      <div id="tournaments-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div class="col-span-full text-center py-12 text-slate-500">Cargando torneos...</div>
      </div>
    </div>
  `;

  window.loadTournamentsList = async (statusFilter = "") => {
    try {
      const tournaments = await window.api.getTournaments(statusFilter ? { status: statusFilter } : {});
      const grid = document.getElementById("tournaments-grid");
      if (!tournaments.length) {
        grid.innerHTML = `<div class="col-span-full text-center py-12 text-slate-500">No se encontraron torneos en esta categoría.</div>`;
        return;
      }

      grid.innerHTML = tournaments.map(t => `
        <div class="glass-card rounded-2xl overflow-hidden flex flex-col justify-between hover:border-cyan-500/60 transition group">
          <div class="p-6 space-y-4">
            <div class="flex items-start justify-between gap-2">
              <span class="px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${
                t.status === 'in_progress' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' :
                t.status === 'registration_open' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40' :
                'bg-slate-800 text-slate-400'
              }">
                ${t.status === 'in_progress' ? '• EN VIVO' : t.status === 'registration_open' ? 'INSCRIPCIONES' : 'FINALIZADO'}
              </span>
              <span class="text-xs font-mono px-2 py-1 rounded bg-slate-800 text-cyan-300 font-bold">${t.country}</span>
            </div>

            <div>
              <h3 class="font-extrabold text-xl text-white group-hover:text-cyan-400 transition">${t.title}</h3>
              <p class="text-xs text-slate-400 line-clamp-2 mt-1">${t.description || "Torneo competitivo oficial AppBey."}</p>
            </div>

            <div class="grid grid-cols-2 gap-2 text-xs py-2 border-y border-slate-800">
              <div>
                <span class="text-slate-500 block">Formato:</span>
                <span class="font-semibold text-slate-200">${t.format === 'swiss' ? 'Sistema Suizo' : 'Eliminación Directa'}</span>
              </div>
              <div>
                <span class="text-slate-500 block">Regla:</span>
                <span class="font-semibold text-slate-200">${t.battle_type === '3on3_deck' ? '3on3 Deck (4 pts)' : '1on1 (3 pts)'}</span>
              </div>
              <div>
                <span class="text-slate-500 block">Lugar:</span>
                <span class="font-semibold text-slate-200 truncate block">${t.venue_name}</span>
              </div>
              <div>
                <span class="text-slate-500 block">Premio:</span>
                <span class="font-bold text-amber-400">${t.prize_pool_ap} AP Coins</span>
              </div>
            </div>
          </div>

          <div class="p-4 bg-slate-900/60 border-t border-slate-800 flex items-center justify-between">
            <span class="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <span>👥</span>
              <strong class="text-cyan-400 font-bold">${t.participants_count}</strong>
              <span>${t.participants_count === 1 ? 'Blader inscrito' : 'Bladers inscritos'}</span>
            </span>
            <button onclick="location.hash='#/tournaments/${t.id}'" class="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow transition active:scale-95">
              Ver Bracket & Detalles &rarr;
            </button>
          </div>
        </div>
      `).join("");
    } catch(err) {
      console.error(err);
    }
  };

  window.filterTournaments = (status) => {
    document.querySelectorAll(".t-tab").forEach(btn => {
      btn.className = "t-tab px-4 py-2 rounded-lg text-sm font-semibold text-slate-400 hover:text-white";
    });
    const active = document.getElementById(`tab-${status || 'all'}`);
    if (active) active.className = "t-tab px-4 py-2 rounded-lg text-sm font-bold bg-cyan-600/20 text-cyan-400 border border-cyan-500/30";
    window.loadTournamentsList(status);
  };

  window.loadTournamentsList();
};

window.openCreateTournamentModal = () => {
  const modal = document.createElement("div");
  modal.id = "create-t-modal";
  modal.className = "fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto";
  modal.innerHTML = `
    <div class="glass-card max-w-lg w-full max-h-[92vh] overflow-y-auto rounded-3xl p-5 sm:p-6 border border-cyan-500/40 space-y-4 shadow-2xl my-auto">
      <div class="flex items-center justify-between border-b border-slate-800 pb-3">
        <div class="flex items-center gap-2">
          <span class="text-xl">🏆</span>
          <h2 class="text-lg sm:text-xl font-bold text-white">Crear Nuevo Torneo Oficial</h2>
        </div>
        <button onclick="document.getElementById('create-t-modal').remove()" class="text-slate-400 hover:text-white text-2xl px-2">&times;</button>
      </div>
      <form id="create-t-form" onsubmit="submitNewTournament(event)" class="space-y-3.5 text-xs">
        <div>
          <label class="block text-slate-300 mb-1 font-semibold">Título del Torneo *</label>
          <input type="text" name="title" required placeholder="Ej: Torneo Regional Beyblade X — WBO Cup" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:border-cyan-500 outline-none text-sm"/>
        </div>
        <div>
          <label class="block text-slate-300 mb-1 font-semibold">Descripción / Reglas Especiales</label>
          <textarea name="description" rows="2" placeholder="Detalles de la competencia, reglamento Takara Tomy / WBO..." class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white focus:border-cyan-500 outline-none"></textarea>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block text-slate-300 mb-1 font-semibold">Formato</label>
            <select name="format" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white focus:border-cyan-500 outline-none">
              <option value="swiss">Sistema Suizo (WBO Oficial)</option>
              <option value="single_elim">Eliminación Directa (Playoffs)</option>
            </select>
          </div>
          <div>
            <label class="block text-slate-300 mb-1 font-semibold">Tipo de Combate</label>
            <select name="battle_type" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white focus:border-cyan-500 outline-none">
              <option value="3on3_deck">3on3 Deck Battle (3 Beys)</option>
              <option value="1on1">1on1 Individual Battle</option>
            </select>
          </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block text-slate-300 mb-1 font-semibold">Meta de Puntos para Ganar</label>
            <select name="match_target_points" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white focus:border-cyan-500 outline-none">
              <option value="4" selected>4 Puntos (Oficial Beyblade X)</option>
              <option value="5">5 Puntos (Semifinales / Match Largo)</option>
              <option value="7">7 Puntos (Gran Final WBO)</option>
              <option value="3">3 Puntos (Match Rápido)</option>
            </select>
          </div>
          <div>
            <label class="block text-slate-300 mb-1 font-semibold">Pozo Premio (AP Coins)</label>
            <input type="number" name="prize_pool_ap" value="1000" min="0" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white focus:border-cyan-500 outline-none"/>
          </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block text-slate-300 mb-1 font-semibold">Lugar / Sede / Venue</label>
            <input type="text" name="venue_name" value="Arena Central Beyblade" required class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white focus:border-cyan-500 outline-none"/>
          </div>
          <div>
            <label class="block text-slate-300 mb-1 font-semibold">País / Región</label>
            <select name="country" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white focus:border-cyan-500 outline-none">
              <option value="ES">España (ES)</option>
              <option value="PA" selected>Panamá (PA)</option>
              <option value="MX">México (MX)</option>
              <option value="CL">Chile (CL)</option>
              <option value="AR">Argentina (AR)</option>
              <option value="PE">Perú (PE)</option>
              <option value="CO">Colombia (CO)</option>
              <option value="US">Estados Unidos (US)</option>
              <option value="JP">Japón (JP)</option>
              <option value="WBO">WBO Internacional</option>
            </select>
          </div>
        </div>
        <div class="pt-2">
          <button type="submit" class="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-sm shadow-lg shadow-cyan-500/25 transition active:scale-95">
            ⚡ Publicar Torneo Oficial
          </button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
};

window.submitNewTournament = async (e) => {
  e.preventDefault();
  const form = e.target;
  const targetPts = parseInt(form.match_target_points?.value || "4", 10);
  const data = {
    title: form.title.value,
    description: form.description.value,
    format: form.format.value,
    battle_type: form.battle_type.value,
    match_target_points: targetPts,
    max_participants: 128,
    prize_pool_ap: parseInt(form.prize_pool_ap?.value || "1000", 10),
    entry_fee_ap: 0,
    venue_name: form.venue_name.value,
    country: form.country.value.toUpperCase(),
    total_rounds: form.format.value === "swiss" ? 4 : 3
  };

  try {
    const created = await window.api.createTournament(data);
    document.getElementById("create-t-modal")?.remove();
    if (window.showToast) {
      window.showToast("¡Torneo creado exitosamente!", "success");
    } else {
      alert("¡Torneo creado exitosamente!");
    }
    location.hash = `#/tournaments/${created.id}`;
  } catch(err) {
    if (window.showToast) {
      window.showToast(err.message || "Error al crear torneo", "error");
    } else {
      alert(err.message || "Error al crear torneo");
    }
  }
};
