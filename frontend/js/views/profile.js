// User Profile & Settings View
window.renderProfileView = async (container, userId = null) => {
  const currentLoggedIn = window.api.user;
  const targetId = userId || (currentLoggedIn ? currentLoggedIn.id : null);

  if (!targetId) {
    container.innerHTML = `
      <div class="glass-card max-w-md mx-auto my-12 p-8 rounded-2xl text-center space-y-4">
        <div class="text-5xl">👤</div>
        <h2 class="text-xl font-bold text-white">Inicia Sesión para ver tu Perfil</h2>
        <button onclick="window.showAuthModal()" class="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow">
          Iniciar Sesión
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = `<div class="text-center py-16 text-slate-500">Cargando perfil de Blader...</div>`;

  try {
    const userProfile = await window.api.getUser(targetId);
    const userDecks = await window.api.getDecks(targetId);
    const isOwner = currentLoggedIn && currentLoggedIn.id === userProfile.id;

    container.innerHTML = `
      <div class="space-y-6 max-w-4xl mx-auto pb-12">
        <!-- Profile Banner Card -->
        <div class="glass-card rounded-3xl p-8 border border-cyan-500/30 relative overflow-hidden bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
            <div class="flex items-center gap-5">
              <img src="${userProfile.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=160'}" class="w-24 h-24 rounded-full border-4 border-cyan-400 object-cover shadow-2xl"/>
              <div class="space-y-1">
                <div class="flex items-center gap-2">
                  <h1 class="text-2xl sm:text-3xl font-black text-white">${userProfile.display_name}</h1>
                  <span class="px-2 py-0.5 rounded text-xs font-mono font-bold bg-slate-800 text-cyan-300">${userProfile.country}</span>
                </div>
                <div class="text-xs text-cyan-400 font-mono">@${userProfile.username} • Rol: <span class="uppercase font-bold">${userProfile.role}</span></div>
                <p class="text-xs text-slate-300 max-w-md">${userProfile.bio || "Blader apasionado de Beyblade X."}</p>
                <div class="text-xs text-amber-300 pt-1 font-semibold flex items-center gap-1">
                  <span>⚡ Combo Insignia:</span> <strong>${userProfile.favorite_combo || "Phoenix Wing 9-60 GF"}</strong>
                </div>
              </div>
            </div>

            <!-- Stats Badge -->
            <div class="glass-card p-5 rounded-2xl border border-amber-500/40 text-center shrink-0 space-y-1">
              <div class="text-xs font-bold uppercase tracking-widest text-slate-400">Elo Competitivo</div>
              <div class="text-3xl font-black text-amber-400 font-mono">${userProfile.elo_rating} pts</div>
              <div class="text-[10px] text-slate-500">Temporada 2026</div>
            </div>
          </div>
        </div>

        <!-- Decks Section -->
        <div class="space-y-4">
          <h3 class="text-xl font-bold text-white flex items-center gap-2">
            <span>⚔️</span> Decks y Alineaciones (${userDecks.length})
          </h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${userDecks.map(d => `
              <div class="glass-card p-5 rounded-2xl border border-slate-800 space-y-3">
                <div class="flex items-center justify-between">
                  <h4 class="font-extrabold text-white text-base truncate">${d.name}</h4>
                  <span class="text-xs font-mono font-bold text-amber-400">${d.total_weight} g</span>
                </div>
                <div class="space-y-1.5 text-xs text-slate-300">
                  <div class="p-2 rounded-lg bg-slate-900/80 flex items-center justify-between">
                    <span>1: <strong>${d.slot1_name || '---'}</strong></span>
                  </div>
                  <div class="p-2 rounded-lg bg-slate-900/80 flex items-center justify-between">
                    <span>2: <strong>${d.slot2_name || '---'}</strong></span>
                  </div>
                  <div class="p-2 rounded-lg bg-slate-900/80 flex items-center justify-between">
                    <span>3: <strong>${d.slot3_name || '---'}</strong></span>
                  </div>
                </div>
              </div>
            `).join("")}
          </div>
        </div>

        <!-- Edit Profile Modal Trigger (if Owner) -->
        ${isOwner ? `
          <div class="glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
            <h3 class="font-bold text-white text-base">Editar Perfil</h3>
            <form onsubmit="handleUpdateProfile(event)" class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label class="block text-slate-400 font-semibold mb-1">Nombre Visible</label>
                <input type="text" name="display_name" value="${userProfile.display_name}" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-cyan-400"/>
              </div>
              <div>
                <label class="block text-slate-400 font-semibold mb-1">Combo Insignia Favorito</label>
                <input type="text" name="favorite_combo" value="${userProfile.favorite_combo || ''}" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-cyan-400"/>
              </div>
              <div class="sm:col-span-2">
                <label class="block text-slate-400 font-semibold mb-1">Biografía</label>
                <input type="text" name="bio" value="${userProfile.bio || ''}" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-cyan-400"/>
              </div>
              <div class="sm:col-span-2 flex justify-end">
                <button type="submit" class="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow">
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        ` : ''}
      </div>
    `;
  } catch(e) {
    container.innerHTML = `<div class="text-center py-16 text-rose-400">Error: ${e.message}</div>`;
  }
};

window.handleUpdateProfile = async (e) => {
  e.preventDefault();
  const form = e.target;
  try {
    await window.api.updateProfile({
      display_name: form.display_name.value,
      favorite_combo: form.favorite_combo.value,
      bio: form.bio.value
    });
    alert("¡Perfil actualizado con éxito!");
    location.reload();
  } catch(err) {
    alert(err.message || "Error al actualizar perfil");
  }
};
