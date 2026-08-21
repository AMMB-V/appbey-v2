// Meta Tier List View
window.renderTierListView = async (container) => {
  container.innerHTML = `<div class="text-center py-16 text-slate-500">Cargando Tier List oficial...</div>`;

  try {
    const parts = await window.api.getParts();

    const tiers = ["S", "A", "B", "C"];
    const tierColors = {
      S: "from-amber-500 to-orange-600 border-amber-500 text-amber-300",
      A: "from-purple-600 to-indigo-600 border-purple-500 text-purple-300",
      B: "from-blue-600 to-cyan-600 border-blue-500 text-blue-300",
      C: "from-slate-700 to-slate-800 border-slate-600 text-slate-300"
    };

    container.innerHTML = `
      <div class="space-y-6 max-w-5xl mx-auto pb-12">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 class="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-2">
              <span class="text-amber-400">👑</span> Beyblade X Meta Tier List
            </h1>
            <p class="text-slate-400 text-sm">Clasificación competitiva de piezas según win rate y pick rate en torneos oficiales.</p>
          </div>

          <div class="flex items-center gap-2">
            <button onclick="filterTierCategory('')" id="cat-btn-all" class="cat-btn px-3 py-1.5 rounded-lg text-xs font-bold bg-cyan-600/20 text-cyan-400 border border-cyan-500/30">Todas</button>
            <button onclick="filterTierCategory('blade')" id="cat-btn-blade" class="cat-btn px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white">Blades</button>
            <button onclick="filterTierCategory('ratchet')" id="cat-btn-ratchet" class="cat-btn px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white">Ratchets</button>
            <button onclick="filterTierCategory('bit')" id="cat-btn-bit" class="cat-btn px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white">Bits</button>
          </div>
        </div>

        <!-- Tier Rows -->
        <div class="space-y-4" id="tier-rows-container">
          <!-- Loaded via JS -->
        </div>
      </div>
    `;

    window.renderTierRows = (catFilter = "") => {
      const rowsEl = document.getElementById("tier-rows-container");
      const filteredParts = catFilter ? parts.filter(p => p.category === catFilter) : parts;

      rowsEl.innerHTML = tiers.map(tier => {
        const tierParts = filteredParts.filter(p => p.tier === tier);

        return `
          <div class="glass-card rounded-2xl overflow-hidden border border-slate-800 flex flex-col md:flex-row">
            <!-- Tier Badge Header -->
            <div class="p-6 md:w-32 bg-gradient-to-br ${tierColors[tier]} flex flex-col items-center justify-center shrink-0 border-b md:border-b-0 md:border-r border-slate-800">
              <span class="text-4xl font-black text-white">Tier ${tier}</span>
              <span class="text-[10px] font-bold uppercase tracking-wider text-slate-200 mt-1 opacity-90">
                ${tier === 'S' ? 'Dominante' : tier === 'A' ? 'Meta Sólido' : tier === 'B' ? 'Viable' : 'Nicho'}
              </span>
            </div>

            <!-- Parts Container -->
            <div class="p-4 flex-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 bg-slate-950/40">
              ${tierParts.length ? tierParts.map(p => `
                <div class="p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-cyan-500/50 transition flex flex-col justify-between space-y-2 group">
                  <div class="flex items-center justify-between">
                    <span class="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300">${p.code || p.system}</span>
                    <span class="text-[10px] font-bold text-slate-400 capitalize">${p.category}</span>
                  </div>
                  <div>
                    <h4 class="font-bold text-white text-xs group-hover:text-cyan-400 transition truncate">${p.name}</h4>
                    <span class="text-[10px] text-slate-400 block">${p.type_attr} • ${p.weight_grams}g</span>
                  </div>
                  <p class="text-[10px] text-slate-400 line-clamp-2">${p.description || ""}</p>
                </div>
              `).join("") : `<div class="col-span-full py-6 text-center text-xs text-slate-600">No hay piezas en este tier para la categoría seleccionada</div>`}
            </div>
          </div>
        `;
      }).join("");
    };

    window.filterTierCategory = (cat) => {
      document.querySelectorAll(".cat-btn").forEach(btn => {
        btn.className = "cat-btn px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white";
      });
      const active = document.getElementById(`cat-btn-${cat || 'all'}`);
      if (active) active.className = "cat-btn px-3 py-1.5 rounded-lg text-xs font-bold bg-cyan-600/20 text-cyan-400 border border-cyan-500/30";
      window.renderTierRows(cat);
    };

    window.renderTierRows();
  } catch(err) {
    container.innerHTML = `<div class="text-center py-16 text-rose-400">Error: ${err.message}</div>`;
  }
};
