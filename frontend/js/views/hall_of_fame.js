// Hall of Fame View
window.renderHallOfFameView = async (container) => {
  container.innerHTML = `<div class="text-center py-16 text-slate-500">Cargando Salón de la Fama...</div>`;

  try {
    const hof = await window.api.getHallOfFame();

    container.innerHTML = `
      <div class="space-y-6 max-w-5xl mx-auto pb-12">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 class="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-2">
              <span class="text-amber-400">🏛️</span> Salón de la Fama Beyblade
            </h1>
            <p class="text-slate-400 text-sm">Homenaje a los campeones legendarios, torneos históricos y sus combos ganadores.</p>
          </div>

          <button onclick="location.hash='#/rankings'" class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 text-xs font-bold">
            &larr; Volver a Rankings
          </button>
        </div>

        <!-- Hall of Fame Grid Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          ${hof.map(h => `
            <div class="glass-card rounded-2xl p-6 border-2 border-amber-500/40 glow-gold space-y-4 relative overflow-hidden bg-gradient-to-br from-amber-950/20 via-slate-900 to-slate-950">
              <div class="flex items-start justify-between">
                <span class="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-black tracking-wider uppercase">
                  Año ${h.year}
                </span>
                <span class="text-3xl">🏆</span>
              </div>

              <div class="flex items-center gap-4">
                <img src="${h.blader_avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120'}" class="w-16 h-16 rounded-full border-2 border-amber-400 object-cover shadow-lg"/>
                <div>
                  <h3 class="text-lg font-black text-white">${h.blader_name}</h3>
                  <div class="text-xs text-amber-400 font-mono font-semibold">@${h.blader_username} • ${h.country}</div>
                  <div class="text-xs text-slate-400 mt-0.5">${h.tournament_name}</div>
                </div>
              </div>

              <div class="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                <span class="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Deck Insignia Campeón:</span>
                <p class="text-xs text-cyan-300 font-bold font-mono">${h.signature_deck}</p>
              </div>

              <p class="text-xs text-slate-400 leading-relaxed">${h.notes || ""}</p>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  } catch(e) {
    container.innerHTML = `<div class="text-center py-16 text-rose-400">Error: ${e.message}</div>`;
  }
};
