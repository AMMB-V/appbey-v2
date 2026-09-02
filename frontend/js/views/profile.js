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

        <!-- Edit Profile (if Owner) -->
        ${isOwner ? `
          <div class="glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
            <h3 class="font-bold text-white text-base flex items-center gap-2">
              <span>⚙️</span> Editar Perfil y Foto
            </h3>
            <form onsubmit="handleUpdateProfile(event)" class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <!-- Avatar Upload / URL / Presets -->
              <div class="sm:col-span-2 bg-slate-900/80 p-4 rounded-2xl border border-slate-800 space-y-3">
                <label class="block text-slate-300 font-bold flex items-center justify-between">
                  <span>Actualizar Foto de Perfil</span>
                  <span class="text-[10px] text-cyan-400">Subir imagen o cambiar URL</span>
                </label>
                <div class="flex items-center gap-4">
                  <div class="relative shrink-0">
                    <img id="profile-avatar-preview" src="${userProfile.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=160'}" class="w-16 h-16 rounded-full border-2 border-cyan-400 object-cover shadow-lg" alt="Avatar Preview"/>
                    <label for="profile-avatar-file" class="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-cyan-600 hover:bg-cyan-500 text-white cursor-pointer shadow">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                    </label>
                    <input type="file" id="profile-avatar-file" accept="image/*" class="hidden" onchange="window.handleProfileAvatarUpload(event)"/>
                  </div>
                  <div class="flex-1 space-y-1.5">
                    <input type="text" id="profile-avatar-url" name="avatar_url" value="${userProfile.avatar_url || ''}" placeholder="URL de imagen directa (https://...)" oninput="window.updateProfileAvatarPreview(this.value)" class="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white outline-none focus:border-cyan-400 text-xs"/>
                    <div class="flex items-center gap-2 overflow-x-auto py-0.5">
                      <span class="text-[10px] text-slate-500 shrink-0">Presets:</span>
                      <button type="button" onclick="window.selectProfilePreset('https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=160')" class="w-6 h-6 rounded-full border border-slate-700 overflow-hidden hover:border-cyan-400 shrink-0">
                        <img src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=160" class="w-full h-full object-cover"/>
                      </button>
                      <button type="button" onclick="window.selectProfilePreset('https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=160')" class="w-6 h-6 rounded-full border border-slate-700 overflow-hidden hover:border-cyan-400 shrink-0">
                        <img src="https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=160" class="w-full h-full object-cover"/>
                      </button>
                      <button type="button" onclick="window.selectProfilePreset('https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=160')" class="w-6 h-6 rounded-full border border-slate-700 overflow-hidden hover:border-cyan-400 shrink-0">
                        <img src="https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=160" class="w-full h-full object-cover"/>
                      </button>
                      <button type="button" onclick="window.selectProfilePreset('https://images.unsplash.com/photo-1580489944761-15a19d654956?w=160')" class="w-6 h-6 rounded-full border border-slate-700 overflow-hidden hover:border-cyan-400 shrink-0">
                        <img src="https://images.unsplash.com/photo-1580489944761-15a19d654956?w=160" class="w-full h-full object-cover"/>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label class="block text-slate-400 font-semibold mb-1">Nombre Visible</label>
                <input type="text" name="display_name" value="${userProfile.display_name}" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white outline-none focus:border-cyan-400"/>
              </div>
              <div>
                <label class="block text-slate-400 font-semibold mb-1">Combo Insignia Favorito</label>
                <input type="text" name="favorite_combo" value="${userProfile.favorite_combo || ''}" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white outline-none focus:border-cyan-400"/>
              </div>
              <div class="sm:col-span-2">
                <label class="block text-slate-400 font-semibold mb-1">Biografía</label>
                <input type="text" name="bio" value="${userProfile.bio || ''}" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white outline-none focus:border-cyan-400"/>
              </div>
              <div class="sm:col-span-2 flex justify-end">
                <button type="submit" class="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/20 active:scale-95 transition">
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

window.updateProfileAvatarPreview = (url) => {
  const preview = document.getElementById("profile-avatar-preview");
  if (preview && url) preview.src = url;
};

window.selectProfilePreset = (url) => {
  const input = document.getElementById("profile-avatar-url");
  if (input) input.value = url;
  window.updateProfileAvatarPreview(url);
};

window.handleProfileAvatarUpload = (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    alert("Por favor selecciona un archivo de imagen válido");
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target?.result;
    if (dataUrl) window.selectProfilePreset(dataUrl);
  };
  reader.readAsDataURL(file);
};

window.handleUpdateProfile = async (e) => {
  e.preventDefault();
  const form = e.target;
  try {
    const avatarVal = form.avatar_url?.value?.trim() || document.getElementById("profile-avatar-preview")?.src || null;
    await window.api.updateProfile({
      display_name: form.display_name.value,
      favorite_combo: form.favorite_combo.value,
      bio: form.bio.value,
      avatar_url: avatarVal
    });
    alert("¡Perfil actualizado con éxito!");
    location.reload();
  } catch(err) {
    alert(err.message || "Error al actualizar perfil");
  }
};
