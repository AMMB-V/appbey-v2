// Admin User Management & Role Assignment Modal / Panel
window.openAdminUserManagementModal = async () => {
  const existing = document.getElementById("admin-user-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "admin-user-modal";
  modal.className = "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md";

  modal.innerHTML = `
    <div class="glass-card max-w-3xl w-full rounded-3xl p-6 border border-cyan-500/40 space-y-5 shadow-2xl max-h-[90vh] flex flex-col">
      <div class="flex items-center justify-between border-b border-slate-800 pb-3">
        <div class="flex items-center gap-2">
          <span class="text-xl">🛡️</span>
          <div>
            <h2 class="text-lg font-extrabold text-white">Administración de Usuarios y Roles</h2>
            <p class="text-xs text-slate-400">Asigna cargos (Blader, Árbitro, Organizador, Admin) o registra nuevos usuarios directamente.</p>
          </div>
        </div>
        <button onclick="document.getElementById('admin-user-modal').remove()" class="text-slate-400 hover:text-white text-xl font-bold">&times;</button>
      </div>

      <!-- Action Tabs -->
      <div class="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button onclick="switchAdminUserTab('list')" id="autab-list" class="autab-btn px-4 py-1.5 rounded-lg text-xs font-bold bg-cyan-600/20 text-cyan-400 border border-cyan-500/30">
          Directorio de Usuarios
        </button>
        <button onclick="switchAdminUserTab('create')" id="autab-create" class="autab-btn px-4 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white">
          + Registrar Nuevo Usuario
        </button>
      </div>

      <!-- Tab: Users Directory & Role Changer -->
      <div id="admin-users-list-panel" class="flex-1 overflow-y-auto space-y-3 pr-1">
        <div class="text-center py-8 text-slate-500 text-xs">Cargando directorio de usuarios...</div>
      </div>

      <!-- Tab: Admin Create User Form -->
      <div id="admin-users-create-panel" class="hidden flex-1 overflow-y-auto space-y-4 pr-1">
        <form id="admin-create-user-form" onsubmit="handleAdminCreateUser(event)" class="space-y-3 text-xs">
          <!-- Avatar Selector -->
          <div class="bg-slate-900/90 p-3 rounded-2xl border border-slate-800 space-y-2">
            <label class="block text-slate-300 font-bold flex items-center justify-between">
              <span>Foto de Perfil del Blader</span>
              <span class="text-[10px] text-cyan-400 font-normal">Subir archivo o URL</span>
            </label>
            <div class="flex items-center gap-3">
              <div class="relative shrink-0">
                <img id="admin-create-avatar-preview" src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150" class="w-12 h-12 rounded-full border-2 border-cyan-400 object-cover shadow" alt="Avatar"/>
                <label for="admin-create-avatar-file" class="absolute -bottom-1 -right-1 p-1 rounded-full bg-cyan-600 hover:bg-cyan-500 text-white cursor-pointer shadow">
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                </label>
                <input type="file" id="admin-create-avatar-file" accept="image/*" class="hidden" onchange="window.handleAdminCreateAvatarUpload(event)"/>
              </div>
              <div class="flex-1 space-y-1">
                <input type="text" id="admin-create-avatar-url" name="avatar_url" placeholder="URL de foto o usa el botón de subida" oninput="window.updateAdminCreateAvatarPreview(this.value)" class="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-white outline-none focus:border-cyan-400 text-[11px]"/>
                <div class="flex items-center gap-1.5 overflow-x-auto py-0.5">
                  <span class="text-[10px] text-slate-500 shrink-0">Presets:</span>
                  <button type="button" onclick="window.selectAdminCreatePreset('https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150')" class="w-5 h-5 rounded-full border border-slate-700 overflow-hidden hover:border-cyan-400 shrink-0">
                    <img src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150" class="w-full h-full object-cover"/>
                  </button>
                  <button type="button" onclick="window.selectAdminCreatePreset('https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150')" class="w-5 h-5 rounded-full border border-slate-700 overflow-hidden hover:border-cyan-400 shrink-0">
                    <img src="https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150" class="w-full h-full object-cover"/>
                  </button>
                  <button type="button" onclick="window.selectAdminCreatePreset('https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=150')" class="w-5 h-5 rounded-full border border-slate-700 overflow-hidden hover:border-cyan-400 shrink-0">
                    <img src="https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=150" class="w-full h-full object-cover"/>
                  </button>
                  <button type="button" onclick="window.selectAdminCreatePreset('https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150')" class="w-5 h-5 rounded-full border border-slate-700 overflow-hidden hover:border-cyan-400 shrink-0">
                    <img src="https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150" class="w-full h-full object-cover"/>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-slate-300 font-semibold mb-1">Nombre de Usuario (@username)</label>
              <input type="text" name="username" required placeholder="ej: blader_rookie" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white outline-none focus:border-cyan-400"/>
            </div>
            <div>
              <label class="block text-slate-300 font-semibold mb-1">Nombre Visible / Alias</label>
              <input type="text" name="display_name" required placeholder="ej: Luis Martinez" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white outline-none focus:border-cyan-400"/>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-slate-300 font-semibold mb-1">Correo Electrónico</label>
              <input type="email" name="email" required placeholder="correo@ejemplo.com" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white outline-none focus:border-cyan-400"/>
            </div>
            <div>
              <label class="block text-slate-300 font-semibold mb-1">Contraseña Inicial</label>
              <input type="password" name="password" required value="123456" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white outline-none focus:border-cyan-400"/>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-slate-300 font-semibold mb-1">Rol / Cargo Asignado</label>
              <select name="role" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white outline-none focus:border-cyan-400 font-semibold">
                <option value="blader">Blader (Participante)</option>
                <option value="referee">Árbitro Oficial</option>
                <option value="organizer">Organizador de Torneos</option>
                <option value="admin">Administrador del Sistema</option>
              </select>
            </div>
            <div>
              <label class="block text-slate-300 font-semibold mb-1">País</label>
              <input type="text" name="country" value="PA" maxlength="5" required class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white outline-none focus:border-cyan-400 uppercase font-mono"/>
            </div>
          </div>

          <div class="pt-2 flex justify-end">
            <button type="submit" class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg">
              Guardar y Registrar Usuario
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  window.loadAdminUsersList = async () => {
    try {
      const users = await window.api.getUsers({ limit: 100 });
      const container = document.getElementById("admin-users-list-panel");
      if (!container) return;

      container.innerHTML = `
        <table class="w-full text-left text-xs">
          <thead class="text-[10px] uppercase text-slate-400 border-b border-slate-800">
            <tr>
              <th class="py-2.5 px-2">Usuario</th>
              <th class="py-2.5 px-2 text-center">País</th>
              <th class="py-2.5 px-2 text-center">Elo</th>
              <th class="py-2.5 px-2">Rol Actual</th>
              <th class="py-2.5 px-2 text-right">Asignar Cargo</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800">
            ${users.map(u => `
              <tr class="hover:bg-slate-800/40">
                <td class="py-2.5 px-2">
                  <div class="flex items-center gap-2">
                    <img src="${u.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}" class="w-7 h-7 rounded-full object-cover"/>
                    <div>
                      <div class="font-bold text-white">${u.display_name}</div>
                      <div class="text-[10px] text-slate-400 font-mono">@${u.username}</div>
                    </div>
                  </div>
                </td>
                <td class="py-2.5 px-2 text-center font-mono font-bold text-cyan-400">${u.country}</td>
                <td class="py-2.5 px-2 text-center font-mono font-bold text-amber-400">${u.elo_rating}</td>
                <td class="py-2.5 px-2">
                  <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    u.role === 'admin' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                    u.role === 'organizer' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                    u.role === 'referee' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' :
                    'bg-slate-800 text-slate-300'
                  }">
                    ${u.role}
                  </span>
                </td>
                <td class="py-2.5 px-2 text-right">
                  <select onchange="handleAdminChangeRole(${u.id}, this.value)" class="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg p-1 text-[11px] outline-none focus:border-cyan-400">
                    <option value="blader" ${u.role === 'blader' ? 'selected' : ''}>Blader</option>
                    <option value="referee" ${u.role === 'referee' ? 'selected' : ''}>Árbitro</option>
                    <option value="organizer" ${u.role === 'organizer' ? 'selected' : ''}>Organizador</option>
                    <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
                  </select>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `;
    } catch(err) {
      const container = document.getElementById("admin-users-list-panel");
      if (container) container.innerHTML = `<div class="text-center py-6 text-rose-400">Error al cargar usuarios: ${err.message}</div>`;
    }
  };

  window.switchAdminUserTab = (tab) => {
    const isList = tab === "list";
    document.getElementById("admin-users-list-panel")?.classList.toggle("hidden", !isList);
    document.getElementById("admin-users-create-panel")?.classList.toggle("hidden", isList);

    document.getElementById("autab-list").className = isList
      ? "autab-btn px-4 py-1.5 rounded-lg text-xs font-bold bg-cyan-600/20 text-cyan-400 border border-cyan-500/30"
      : "autab-btn px-4 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white";

    document.getElementById("autab-create").className = !isList
      ? "autab-btn px-4 py-1.5 rounded-lg text-xs font-bold bg-cyan-600/20 text-cyan-400 border border-cyan-500/30"
      : "autab-btn px-4 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white";
  };

  window.handleAdminChangeRole = async (userId, newRole) => {
    try {
      await window.api.updateUserRole(userId, newRole);
      alert(`Cargo actualizado exitosamente a: ${newRole}`);
      window.loadAdminUsersList();
    } catch(err) {
      alert(err.message || "Error al actualizar rol");
      window.loadAdminUsersList();
    }
  };

  window.updateAdminCreateAvatarPreview = (url) => {
    const preview = document.getElementById("admin-create-avatar-preview");
    if (preview && url) preview.src = url;
  };

  window.selectAdminCreatePreset = (url) => {
    const input = document.getElementById("admin-create-avatar-url");
    if (input) input.value = url;
    window.updateAdminCreateAvatarPreview(url);
  };

  window.handleAdminCreateAvatarUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Por favor selecciona un archivo de imagen válido");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result;
      if (dataUrl) window.selectAdminCreatePreset(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  window.handleAdminCreateUser = async (e) => {
    e.preventDefault();
    const form = e.target;
    try {
      const avatarVal = form.avatar_url?.value?.trim() || document.getElementById("admin-create-avatar-preview")?.src || null;
      await window.api.adminCreateUser({
        username: form.username.value,
        display_name: form.display_name.value,
        email: form.email.value,
        password: form.password.value,
        role: form.role.value,
        avatar_url: avatarVal,
        country: form.country.value.toUpperCase()
      });
      alert("¡Usuario registrado y cargo asignado exitosamente!");
      form.reset();
      switchAdminUserTab("list");
      window.loadAdminUsersList();
    } catch(err) {
      alert(err.message || "Error al crear usuario");
    }
  };

  window.loadAdminUsersList();
};
