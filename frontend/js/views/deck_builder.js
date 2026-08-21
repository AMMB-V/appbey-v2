// Beyblade X 3on3 Deck Builder View
window.renderDeckBuilderView = async (container) => {
  container.innerHTML = `<div class="text-center py-16 text-slate-500">Cargando piezas de Beyblade X...</div>`;

  let parts = [];
  let userDecks = [];

  // Deck state with 3 slots
  const currentDeck = {
    name: "Deck Competitivo 3on3",
    description: "Mi deck optimizado para torneos oficiales",
    slot1: { blade: null, ratchet: null, bit: null },
    slot2: { blade: null, ratchet: null, bit: null },
    slot3: { blade: null, ratchet: null, bit: null }
  };

  try {
    parts = await window.api.getParts();
    if (window.api.user) {
      userDecks = await window.api.getDecks(window.api.user.id);
    }
  } catch(e) {
    console.error(e);
  }

  // Prepopulate default high-tier combo if parts exist
  const blades = parts.filter(p => p.category === "blade");
  const ratchets = parts.filter(p => p.category === "ratchet");
  const bits = parts.filter(p => p.category === "bit");

  if (blades.length >= 3 && ratchets.length >= 3 && bits.length >= 3) {
    currentDeck.slot1 = { blade: blades[0], ratchet: ratchets[0], bit: bits[2] }; // Phoenix Wing 9-60 GF
    currentDeck.slot2 = { blade: blades[1], ratchet: ratchets[4], bit: bits[1] }; // Wizard Rod 5-70 DB
    currentDeck.slot3 = { blade: blades[2], ratchet: ratchets[3], bit: bits[4] }; // Dran Buster 1-60 F
  }

  const renderUI = () => {
    // Calculate total weight and stats
    const allSelectedParts = [
      currentDeck.slot1.blade, currentDeck.slot1.ratchet, currentDeck.slot1.bit,
      currentDeck.slot2.blade, currentDeck.slot2.ratchet, currentDeck.slot2.bit,
      currentDeck.slot3.blade, currentDeck.slot3.ratchet, currentDeck.slot3.bit
    ].filter(Boolean);

    const totalWeight = allSelectedParts.reduce((acc, p) => acc + (p.weight_grams || 0), 0).toFixed(1);
    const avgAttack = allSelectedParts.length ? Math.round(allSelectedParts.reduce((acc, p) => acc + p.attack_stat, 0) / allSelectedParts.length) : 0;
    const avgDefense = allSelectedParts.length ? Math.round(allSelectedParts.reduce((acc, p) => acc + p.defense_stat, 0) / allSelectedParts.length) : 0;
    const avgStamina = allSelectedParts.length ? Math.round(allSelectedParts.reduce((acc, p) => acc + p.stamina_stat, 0) / allSelectedParts.length) : 0;
    const avgDash = allSelectedParts.length ? Math.round(allSelectedParts.reduce((acc, p) => acc + p.dash_stat, 0) / allSelectedParts.length) : 0;

    // Check duplicate rule (WBO / Takara Tomy rule: No duplicate parts across 3 slots)
    const selectedIds = allSelectedParts.map(p => p.id);
    const hasDuplicates = new Set(selectedIds).size !== selectedIds.length;

    container.innerHTML = `
      <div class="space-y-6 max-w-5xl mx-auto pb-12">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 class="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-2">
              <span class="text-cyan-400">⚡</span> Constructor de Deck 3on3
            </h1>
            <p class="text-slate-400 text-sm">Arma tu alineación competitiva oficial de Beyblade X con cálculo de peso y sinergias.</p>
          </div>

          <div class="flex items-center gap-3">
            <button onclick="saveCurrentDeck()" class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-sm shadow-lg shadow-cyan-500/25 transition active:scale-95">
              💾 Guardar Deck
            </button>
          </div>
        </div>

        <!-- Duplicate Rule Warning -->
        ${hasDuplicates ? `
          <div class="p-4 rounded-xl bg-rose-950/80 border border-rose-500/60 text-rose-300 text-xs font-semibold flex items-center gap-2">
            <span>⚠️</span> <strong>Infracción de Reglas Takara Tomy:</strong> Tu deck contiene piezas repetidas en diferentes slots. En torneos 3on3 oficiales no se permite repetir Blade, Ratchet o Bit.
          </div>
        ` : `
          <div class="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2">
            <span>✅</span> Deck válido según reglas oficiales de Torneo 3on3 (Sin piezas duplicadas).
          </div>
        `}

        <!-- Deck Overall Stats Overview Card -->
        <div class="glass-card rounded-2xl p-6 border border-cyan-500/30 space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div class="flex-1">
              <input type="text" id="deck-name-input" value="${currentDeck.name}" class="text-xl font-bold bg-transparent text-white border-b border-transparent hover:border-slate-700 focus:border-cyan-400 outline-none w-full"/>
              <input type="text" id="deck-desc-input" value="${currentDeck.description}" class="text-xs text-slate-400 bg-transparent border-b border-transparent hover:border-slate-700 focus:border-cyan-400 outline-none w-full mt-1"/>
            </div>
            <div class="flex items-center gap-6 shrink-0">
              <div class="text-right">
                <span class="text-xs text-slate-400 block">Peso Total Combinado</span>
                <span class="text-2xl font-black text-amber-400 font-mono">${totalWeight} g</span>
              </div>
            </div>
          </div>

          <!-- Stats Progress Bars -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t border-slate-800">
            <div>
              <div class="flex justify-between text-xs font-bold mb-1">
                <span class="text-rose-400">Ataque</span>
                <span class="text-slate-300 font-mono">${avgAttack}%</span>
              </div>
              <div class="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div class="h-full bg-rose-500 rounded-full" style="width: ${avgAttack}%"></div>
              </div>
            </div>

            <div>
              <div class="flex justify-between text-xs font-bold mb-1">
                <span class="text-blue-400">Defensa</span>
                <span class="text-slate-300 font-mono">${avgDefense}%</span>
              </div>
              <div class="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div class="h-full bg-blue-500 rounded-full" style="width: ${avgDefense}%"></div>
              </div>
            </div>

            <div>
              <div class="flex justify-between text-xs font-bold mb-1">
                <span class="text-emerald-400">Resistencia</span>
                <span class="text-slate-300 font-mono">${avgStamina}%</span>
              </div>
              <div class="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div class="h-full bg-emerald-500 rounded-full" style="width: ${avgStamina}%"></div>
              </div>
            </div>

            <div>
              <div class="flex justify-between text-xs font-bold mb-1">
                <span class="text-cyan-400">Xtreme Dash</span>
                <span class="text-slate-300 font-mono">${avgDash}%</span>
              </div>
              <div class="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div class="h-full bg-cyan-400 rounded-full" style="width: ${avgDash}%"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- 3 Slots Combo Builder Grid -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          ${[1, 2, 3].map(slotNum => {
            const slot = currentDeck[`slot${slotNum}`];
            const beyWeight = ((slot.blade ? slot.blade.weight_grams : 0) + (slot.ratchet ? slot.ratchet.weight_grams : 0) + (slot.bit ? slot.bit.weight_grams : 0)).toFixed(1);
            const comboName = `${slot.blade ? slot.blade.name : '---'} ${slot.ratchet ? slot.ratchet.name : '---'} ${slot.bit ? slot.bit.name.split(' ')[0] : '---'}`;

            return `
              <div class="glass-card rounded-2xl p-5 border border-slate-800 flex flex-col justify-between space-y-4 relative">
                <div class="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span class="px-3 py-1 rounded-full bg-blue-600/30 text-cyan-300 font-bold text-xs">
                    Slot #${slotNum}
                  </span>
                  <span class="text-xs font-mono font-bold text-amber-400">${beyWeight} g</span>
                </div>

                <!-- Combo Title -->
                <div class="text-center space-y-1">
                  <h3 class="font-extrabold text-lg text-white truncate">${comboName}</h3>
                  <div class="text-xs text-slate-400">${slot.blade ? slot.blade.type_attr : 'Tipo'} • Tier ${slot.blade ? slot.blade.tier : '-'}</div>
                </div>

                <!-- Part Pickers -->
                <div class="space-y-3 text-xs">
                  <!-- Blade Picker -->
                  <div>
                    <label class="block text-slate-400 font-semibold mb-1">Blade (Capa de Metal)</label>
                    <select onchange="updatePart(${slotNum}, 'blade', this.value)" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200 outline-none focus:border-cyan-500 font-semibold">
                      ${blades.map(b => `<option value="${b.id}" ${slot.blade && slot.blade.id === b.id ? 'selected' : ''}>${b.name} (${b.type_attr} • ${b.weight_grams}g • Tier ${b.tier})</option>`).join("")}
                    </select>
                  </div>

                  <!-- Ratchet Picker -->
                  <div>
                    <label class="block text-slate-400 font-semibold mb-1">Ratchet (Disco Central)</label>
                    <select onchange="updatePart(${slotNum}, 'ratchet', this.value)" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200 outline-none focus:border-cyan-500 font-semibold">
                      ${ratchets.map(r => `<option value="${r.id}" ${slot.ratchet && slot.ratchet.id === r.id ? 'selected' : ''}>${r.name} (${r.weight_grams}g • Tier ${r.tier})</option>`).join("")}
                    </select>
                  </div>

                  <!-- Bit Picker -->
                  <div>
                    <label class="block text-slate-400 font-semibold mb-1">Bit (Punta de Giro)</label>
                    <select onchange="updatePart(${slotNum}, 'bit', this.value)" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200 outline-none focus:border-cyan-500 font-semibold">
                      ${bits.map(bt => `<option value="${bt.id}" ${slot.bit && slot.bit.id === bt.id ? 'selected' : ''}>${bt.name} (${bt.type_attr} • Tier ${bt.tier})</option>`).join("")}
                    </select>
                  </div>
                </div>

                <!-- Slot Individual Stats -->
                <div class="grid grid-cols-3 gap-2 text-center text-[10px] pt-3 border-t border-slate-800">
                  <div class="p-1.5 rounded bg-slate-900/80">
                    <span class="text-slate-500 block">Ataque</span>
                    <span class="font-bold text-rose-400">${slot.blade ? slot.blade.attack_stat : 0}</span>
                  </div>
                  <div class="p-1.5 rounded bg-slate-900/80">
                    <span class="text-slate-500 block">Defensa</span>
                    <span class="font-bold text-blue-400">${slot.blade ? slot.blade.defense_stat : 0}</span>
                  </div>
                  <div class="p-1.5 rounded bg-slate-900/80">
                    <span class="text-slate-500 block">Resistencia</span>
                    <span class="font-bold text-emerald-400">${slot.blade ? slot.blade.stamina_stat : 0}</span>
                  </div>
                </div>
              </div>
            `;
          }).join("")}
        </div>

        <!-- Saved Decks Section -->
        ${userDecks.length ? `
          <div class="space-y-4 pt-6">
            <h3 class="text-lg font-bold text-white">Mis Decks Guardados</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              ${userDecks.map(d => `
                <div class="glass-card p-4 rounded-xl border border-slate-800 space-y-2">
                  <div class="flex items-center justify-between">
                    <h4 class="font-bold text-white text-sm truncate">${d.name}</h4>
                    <span class="text-xs font-mono font-bold text-amber-400">${d.total_weight}g</span>
                  </div>
                  <div class="text-[11px] text-slate-400 space-y-0.5">
                    <div>1: <strong class="text-slate-200">${d.slot1_name || '---'}</strong></div>
                    <div>2: <strong class="text-slate-200">${d.slot2_name || '---'}</strong></div>
                    <div>3: <strong class="text-slate-200">${d.slot3_name || '---'}</strong></div>
                  </div>
                  <div class="pt-2 flex items-center justify-end">
                    <button onclick="handleDeleteDeck(${d.id})" class="text-xs text-rose-400 hover:underline">Eliminar</button>
                  </div>
                </div>
              `).join("")}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  };

  window.updatePart = (slotNum, category, partId) => {
    const part = parts.find(p => p.id === parseInt(partId));
    if (part) {
      currentDeck[`slot${slotNum}`][category] = part;
      renderUI();
    }
  };

  window.saveCurrentDeck = async () => {
    if (!window.api.user) {
      window.showAuthModal();
      return;
    }
    const nameInput = document.getElementById("deck-name-input");
    const descInput = document.getElementById("deck-desc-input");

    const payload = {
      name: nameInput ? nameInput.value : currentDeck.name,
      description: descInput ? descInput.value : currentDeck.description,
      is_public: true,
      slot1_name: `${currentDeck.slot1.blade?.name} ${currentDeck.slot1.ratchet?.name} ${currentDeck.slot1.bit?.name.split(' ')[0]}`,
      slot1_blade_id: currentDeck.slot1.blade?.id,
      slot1_ratchet_id: currentDeck.slot1.ratchet?.id,
      slot1_bit_id: currentDeck.slot1.bit?.id,

      slot2_name: `${currentDeck.slot2.blade?.name} ${currentDeck.slot2.ratchet?.name} ${currentDeck.slot2.bit?.name.split(' ')[0]}`,
      slot2_blade_id: currentDeck.slot2.blade?.id,
      slot2_ratchet_id: currentDeck.slot2.ratchet?.id,
      slot2_bit_id: currentDeck.slot2.bit?.id,

      slot3_name: `${currentDeck.slot3.blade?.name} ${currentDeck.slot3.ratchet?.name} ${currentDeck.slot3.bit?.name.split(' ')[0]}`,
      slot3_blade_id: currentDeck.slot3.blade?.id,
      slot3_ratchet_id: currentDeck.slot3.ratchet?.id,
      slot3_bit_id: currentDeck.slot3.bit?.id
    };

    try {
      await window.api.createDeck(payload);
      alert("¡Deck 3on3 guardado exitosamente!");
      userDecks = await window.api.getDecks(window.api.user.id);
      renderUI();
    } catch(err) {
      alert(err.message || "Error al guardar deck");
    }
  };

  window.handleDeleteDeck = async (deckId) => {
    if (!confirm("¿Eliminar este deck guardado?")) return;
    try {
      await window.api.deleteDeck(deckId);
      userDecks = await window.api.getDecks(window.api.user.id);
      renderUI();
    } catch(e) {
      alert(e.message);
    }
  };

  renderUI();
};
