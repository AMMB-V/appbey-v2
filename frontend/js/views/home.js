// Home / Dashboard View
window.renderHomeView = async (container) => {
  container.innerHTML = `
    <div class="space-y-6">
      <!-- Hero Banner / Live Tournament Ticker -->
      <div class="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-950 p-6 border border-cyan-500/30 glass-card">
        <div class="absolute -right-10 -bottom-10 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-3">
              <span class="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
              En Vivo • Beyblade X Championship
            </div>
            <h1 class="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-2">
              AppBey
            </h1>
            <p class="text-slate-300 max-w-xl text-sm md:text-base">
              Plataforma competitiva oficial: Brackets en tiempo real, arbitraje táctil 3on3 Xtreme Stadium, constructor de Decks y sistema de AP Coins.
            </p>
          </div>
          <div class="flex flex-wrap gap-3">
            <button onclick="location.hash='#/tournaments'" class="px-5 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold shadow-lg shadow-cyan-500/25 transition transform active:scale-95 flex items-center gap-2">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
              Explorar Torneos
            </button>
            <button onclick="location.hash='#/deck-builder'" class="px-5 py-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 font-bold transition transform active:scale-95 flex items-center gap-2">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
              Armar Deck 3on3
            </button>
          </div>
        </div>
      </div>

      <!-- User Stats Bar (if logged in) or Quick Auth Banner -->
      <div id="home-user-card" class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <!-- Loaded via JS -->
      </div>

      <!-- Quick Action Cards Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div onclick="location.hash='#/referee/1'" class="glass-card p-5 rounded-xl cursor-pointer hover:border-cyan-400 transition transform hover:-translate-y-1 group">
          <div class="w-12 h-12 rounded-lg bg-blue-600/20 text-cyan-400 flex items-center justify-center mb-4 group-hover:scale-110 transition">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
          <h3 class="font-bold text-lg text-white mb-1">Mesa de Arbitraje</h3>
          <p class="text-xs text-slate-400">Marcador táctil de 1-toque para registrar Spin, Over, Burst y Xtreme Finishes.</p>
        </div>

        <div onclick="location.hash='#/stadium-display/1'" class="glass-card p-5 rounded-xl cursor-pointer hover:border-amber-400 transition transform hover:-translate-y-1 group">
          <div class="w-12 h-12 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center mb-4 group-hover:scale-110 transition">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
          </div>
          <h3 class="font-bold text-lg text-white mb-1">Modo Proyector TV</h3>
          <p class="text-xs text-slate-400">Pantalla gigante para proyectar llamados a mesas y marcadores en vivo en la arena.</p>
        </div>

        <div onclick="location.hash='#/tier-list'" class="glass-card p-5 rounded-xl cursor-pointer hover:border-purple-400 transition transform hover:-translate-y-1 group">
          <div class="w-12 h-12 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center mb-4 group-hover:scale-110 transition">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
          </div>
          <h3 class="font-bold text-lg text-white mb-1">Meta Tier List</h3>
          <p class="text-xs text-slate-400">Ranking oficial y comunitario de Blades, Ratchets y Bits Beyblade X.</p>
        </div>

        <div onclick="location.hash='#/wallet'" class="glass-card p-5 rounded-xl cursor-pointer hover:border-emerald-400 transition transform hover:-translate-y-1 group">
          <div class="w-12 h-12 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4 group-hover:scale-110 transition">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
          <h3 class="font-bold text-lg text-white mb-1">Billetera AP Coins</h3>
          <p class="text-xs text-slate-400">Reclama recompensas diarias, transfiere monedas y participa en torneos.</p>
        </div>
      </div>

      <!-- Active Tournaments & Recent Activity Section -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Tournaments Spotlight -->
        <div class="lg:col-span-2 space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-xl font-bold text-white flex items-center gap-2">
              <span class="w-3 h-3 rounded-full bg-cyan-400"></span>
              Torneos Destacados
            </h2>
            <a href="#/tournaments" class="text-sm font-semibold text-cyan-400 hover:text-cyan-300">Ver todos &rarr;</a>
          </div>
          <div id="home-tournaments-list" class="space-y-3">
            <div class="text-center py-8 text-slate-500">Cargando torneos...</div>
          </div>
        </div>

        <!-- Leaderboard Preview -->
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-xl font-bold text-white flex items-center gap-2">
              <span class="w-3 h-3 rounded-full bg-amber-400"></span>
              Top Bladers
            </h2>
            <a href="#/rankings" class="text-sm font-semibold text-amber-400 hover:text-amber-300">Ver Ranking &rarr;</a>
          </div>
          <div id="home-top-bladers" class="glass-card rounded-xl p-4 divide-y divide-slate-800">
            <div class="text-center py-6 text-slate-500">Cargando ranking...</div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Render User Card
  const user = window.api.user;
  const userCardEl = document.getElementById("home-user-card");
  if (user) {
    userCardEl.innerHTML = `
      <div class="glass-card p-4 rounded-xl border-l-4 border-blue-500">
        <div class="text-xs text-slate-400 font-medium">Blader Autenticado</div>
        <div class="text-lg font-bold text-white truncate">${user.display_name}</div>
        <div class="text-xs text-cyan-400 font-mono">@${user.username} • ${user.country}</div>
      </div>
      <div class="glass-card p-4 rounded-xl border-l-4 border-amber-500">
        <div class="text-xs text-slate-400 font-medium">Elo Competitivo</div>
        <div class="text-lg font-bold text-amber-400">${user.elo_rating || 1200} pts</div>
        <div class="text-xs text-slate-500">Temporada 2026</div>
      </div>
      <div class="glass-card p-4 rounded-xl border-l-4 border-emerald-500">
        <div class="text-xs text-slate-400 font-medium">Saldo AP Coins</div>
        <div class="text-lg font-bold text-emerald-400" id="home-ap-balance">... AP</div>
        <button onclick="claimDailyRewardHome()" class="text-xs text-emerald-300 hover:underline">+ Reclamar Bono</button>
      </div>
      <div class="glass-card p-4 rounded-xl border-l-4 border-cyan-500">
        <div class="text-xs text-slate-400 font-medium">Rol en Plataforma</div>
        <div class="text-lg font-bold text-cyan-300 uppercase text-sm">${user.role}</div>
        <div class="text-xs text-slate-400">${user.favorite_combo || "Phoenix Wing"}</div>
      </div>
    `;

    // Fetch actual wallet
    window.api.getMyWallet().then(w => {
      const el = document.getElementById("home-ap-balance");
      if (el) el.innerText = `${w.balance} AP`;
    }).catch(() => {});
  } else {
    userCardEl.innerHTML = `
      <div class="col-span-full glass-card p-4 rounded-xl flex items-center justify-between bg-blue-950/40 border border-cyan-500/30">
        <div class="flex items-center gap-3">
          <div class="p-3 rounded-xl bg-cyan-500/20 text-cyan-400">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
          </div>
          <div>
            <div class="font-bold text-white">¿Eres organizador o Blader competidor?</div>
            <div class="text-xs text-slate-400">Inicia sesión con tu cuenta para guardar decks, ganar AP Coins y registrarte en torneos.</div>
          </div>
        </div>
        <button onclick="window.showAuthModal()" class="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm shadow">
          Iniciar Sesión
        </button>
      </div>
    `;
  }

  // Load Tournaments Spotlight
  try {
    const tournaments = await window.api.getTournaments();
    const tListEl = document.getElementById("home-tournaments-list");
    if (!tournaments.length) {
      tListEl.innerHTML = `<div class="text-center py-6 text-slate-500">No hay torneos activos en este momento.</div>`;
    } else {
      tListEl.innerHTML = tournaments.slice(0, 3).map(t => `
        <div onclick="location.hash='#/tournaments/${t.id}'" class="glass-card p-5 rounded-xl cursor-pointer hover:border-cyan-500 transition flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold ${t.status === 'in_progress' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'}">
                ${t.status === 'in_progress' ? '• EN CURSO (Ronda ' + t.current_round + ')' : 'Inscripciones Abiertas'}
              </span>
              <span class="text-xs text-slate-400">${t.battle_type === '3on3_deck' ? 'Formato 3on3 Deck' : '1on1'} • ${t.match_target_points} pts</span>
            </div>
            <h3 class="font-bold text-white text-lg">${t.title}</h3>
            <p class="text-xs text-slate-400 flex items-center gap-1">
              <svg class="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/></svg>
              ${t.venue_name} (${t.country})
            </p>
          </div>
          <div class="flex items-center gap-4">
            <div class="text-right">
              <div class="text-xs text-slate-400">Premio Total</div>
              <div class="text-sm font-bold text-amber-400">${t.prize_pool_ap} AP</div>
            </div>
            <div class="text-right">
              <div class="text-xs text-slate-400">Inscritos</div>
              <div class="text-sm font-bold text-cyan-400">${t.participants_count} / ${t.max_participants}</div>
            </div>
            <span class="p-2 rounded-lg bg-slate-800 text-slate-300">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
            </span>
          </div>
        </div>
      `).join("");
    }
  } catch(e) {
    console.error("Error loading home tournaments:", e);
  }

  // Load Leaderboard preview
  try {
    const leaderboard = await window.api.getLeaderboard();
    const bladersEl = document.getElementById("home-top-bladers");
    bladersEl.innerHTML = leaderboard.slice(0, 5).map((b, idx) => `
      <div class="py-2.5 flex items-center justify-between first:pt-0 last:pb-0">
        <div class="flex items-center gap-3">
          <span class="w-6 text-center font-bold ${idx === 0 ? 'text-amber-400 text-base' : idx === 1 ? 'text-slate-300' : idx === 2 ? 'text-amber-600' : 'text-slate-500 text-xs'}">#${b.rank}</span>
          <img src="${b.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}" class="w-8 h-8 rounded-full border border-slate-700 object-cover"/>
          <div>
            <div class="font-bold text-sm text-white">${b.display_name}</div>
            <div class="text-xs text-slate-400">${b.favorite_combo || 'Phoenix Wing'}</div>
          </div>
        </div>
        <div class="text-right">
          <div class="font-bold text-cyan-400 text-sm">${b.elo_rating}</div>
          <div class="text-[10px] text-slate-500 uppercase">${b.country}</div>
        </div>
      </div>
    `).join("");
  } catch(e) {
    console.error("Error loading home leaderboard:", e);
  }
};

window.claimDailyRewardHome = async () => {
  try {
    const res = await window.api.claimDailyReward();
    alert("¡Felicidades! Has reclamado +50 AP Coins.");
    location.reload();
  } catch(err) {
    alert(err.message || "Error al reclamar recompensa");
  }
};
