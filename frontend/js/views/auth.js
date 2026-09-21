// Auth Modal & Quick Switcher
window.showAuthModal = (initialMode = "login") => {
  const existing = document.getElementById("auth-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "auth-modal";
  modal.className = "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md";

  modal.innerHTML = `
    <div class="glass-card max-w-md w-full rounded-3xl p-6 border border-cyan-500/40 space-y-5 shadow-2xl">
      <div class="flex items-center justify-between border-b border-slate-800 pb-3">
        <div class="flex items-center gap-2.5">
          <img src="/assets/images/appbey_logo_transparent.png?v=3.4" class="w-8 h-8 rounded-xl object-contain shadow" alt="AppBey Logo"/>
          <h2 class="text-xl font-extrabold text-white">AppBey</h2>
        </div>
        <button onclick="document.getElementById('auth-modal').remove()" class="text-slate-400 hover:text-white text-xl font-bold">&times;</button>
      </div>

      <!-- Mode Switcher -->
      <div class="flex rounded-xl bg-slate-900 p-1 border border-slate-800 text-xs font-bold">
        <button onclick="switchAuthTab('login')" id="auth-tab-login" class="flex-1 py-2 rounded-lg bg-blue-600 text-white shadow">Iniciar Sesión</button>
        <button onclick="switchAuthTab('register')" id="auth-tab-register" class="flex-1 py-2 rounded-lg text-slate-400 hover:text-white">Registrarse</button>
      </div>
      <div id="google-signin-section" class="hidden space-y-2">
        <div class="text-center text-[11px] text-slate-500">o continúa con</div>
        <div id="google-signin-button" class="flex justify-center min-h-10"></div>
      </div>

      <!-- Login Form -->
      <form id="login-form" onsubmit="submitLogin(event)" class="space-y-3 text-xs">
        <div>
          <label class="block text-slate-300 font-semibold mb-1">Email o Nombre de Usuario</label>
          <input type="text" name="email" autocomplete="username" required class="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none focus:border-cyan-400 text-sm"/>
        </div>
        <div>
          <label class="block text-slate-300 font-semibold mb-1">Contraseña</label>
          <input type="password" name="password" autocomplete="current-password" required class="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none focus:border-cyan-400 text-sm"/>
        </div>
        <button type="submit" class="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-black text-sm shadow-lg shadow-cyan-500/25 transition active:scale-95">
          Entrar a AppBey
        </button>
      </form>

      <!-- Register Form (Hidden by default) -->
      <form id="register-form" onsubmit="submitRegister(event)" class="space-y-3 text-xs hidden">
        <!-- Blader Avatar Selector with Preview -->
        <div class="bg-slate-900/90 p-3 rounded-2xl border border-slate-800 space-y-2.5">
          <label class="block text-slate-300 font-bold flex items-center justify-between">
            <span>Foto de Perfil del Blader</span>
            <span class="text-[10px] text-cyan-400 font-normal">Subir archivo o usar iniciales</span>
          </label>

          <div class="flex items-center gap-3">
            <div class="relative shrink-0">
              <div id="register-avatar-preview-box">
                ${window.renderAvatar({ display_name: "Nuevo Blader" }, "w-14 h-14", "text-xl", "border-2 border-cyan-400 shadow-lg")}
              </div>
              <label for="register-avatar-file" class="absolute -bottom-1 -right-1 p-1 rounded-full bg-cyan-600 hover:bg-cyan-500 text-white cursor-pointer shadow">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              </label>
              <input type="file" id="register-avatar-file" accept="image/*" class="hidden" onchange="window.handleRegisterAvatarUpload(event)"/>
            </div>

            <div class="flex-1 space-y-1.5">
              <input type="text" id="register-avatar-url" name="avatar_url" placeholder="URL directa de imagen (opcional)" oninput="window.updateRegisterAvatarPreview(this.value)" class="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-white outline-none focus:border-cyan-400 text-[11px]"/>
              <div class="text-[10px] text-slate-500">Si lo dejas vacío, se generará tu avatar con tus iniciales oficiales.</div>
            </div>
          </div>
        </div>

        <div>
          <label class="block text-slate-300 font-semibold mb-1">Nombre de Usuario (único)</label>
          <input type="text" name="username" placeholder="ej: blader_pro" required class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white outline-none focus:border-cyan-400"/>
        </div>
        <div>
          <label class="block text-slate-300 font-semibold mb-1">Nombre / Alias Visible</label>
          <input type="text" name="display_name" placeholder="ej: Ryu Kusanagi" required class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white outline-none focus:border-cyan-400"/>
        </div>
        <div>
          <label class="block text-slate-300 font-semibold mb-1">Correo Electrónico</label>
          <input type="email" name="email" placeholder="blader@ejemplo.com" required class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white outline-none focus:border-cyan-400"/>
        </div>
        <div>
          <label class="block text-slate-300 font-semibold mb-1">Contraseña</label>
          <input type="password" name="password" required class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white outline-none focus:border-cyan-400"/>
        </div>
        <div>
          <label class="block text-slate-300 font-semibold mb-1">País (Código ISO)</label>
          <input type="text" name="country" value="PA" maxlength="5" required class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white outline-none focus:border-cyan-400 uppercase"/>
          <p class="text-[10px] text-slate-400 mt-1">El registro otorga rol inicial de <strong>Blader</strong>. Los roles de Árbitro y Organizador son asignados por un Administrador.</p>
        </div>
        <button type="submit" class="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm shadow-lg shadow-emerald-500/25 transition active:scale-95">
          Crear Cuenta Oficial de Blader
        </button>
      </form>
    </div>
  `;

  document.body.appendChild(modal);
  setupGoogleSignIn();
  if (initialMode === "register") switchAuthTab("register");
};

window.setupGoogleSignIn = () => {
  const clientId = window.__APP_CONFIG__?.googleClientId;
  const section = document.getElementById("google-signin-section");
  const button = document.getElementById("google-signin-button");
  if (!clientId || !section || !button) return;
  const render = () => {
    if (!window.google?.accounts?.id) return false;
    window.google.accounts.id.initialize({ client_id: clientId, callback: window.handleGoogleCredential });
    window.google.accounts.id.renderButton(button, { theme: "outline", size: "large", width: 300, text: "continue_with" });
    section.classList.remove("hidden");
    return true;
  };
  if (!render()) {
    window.setTimeout(render, 500);
  }
};

window.handleGoogleCredential = async (response) => {
  try {
    const result = await window.api.googleLogin(response.credential);
    window.api.setAuth(result.access_token, result.user);
    document.getElementById("auth-modal")?.remove();
    window.showToast?.("Sesión iniciada con Google", "success");
    window.setTimeout(() => location.reload(), 400);
  } catch (error) {
    window.showToast?.(error.message || "No se pudo iniciar sesión con Google", "error");
  }
};

window.switchAuthTab = (mode) => {
  const isLogin = mode === "login";
  document.getElementById("login-form").classList.toggle("hidden", !isLogin);
  document.getElementById("register-form").classList.toggle("hidden", isLogin);

  document.getElementById("auth-tab-login").className = isLogin
    ? "flex-1 py-2 rounded-lg bg-blue-600 text-white shadow font-bold"
    : "flex-1 py-2 rounded-lg text-slate-400 hover:text-white font-semibold";

  document.getElementById("auth-tab-register").className = !isLogin
    ? "flex-1 py-2 rounded-lg bg-emerald-600 text-white shadow font-bold"
    : "flex-1 py-2 rounded-lg text-slate-400 hover:text-white font-semibold";
};

window.submitLogin = async (e) => {
  e.preventDefault();
  const form = e.target;
  try {
    const res = await window.api.login(form.email.value, form.password.value);
    window.api.setAuth(res.access_token, res.user);
    document.getElementById("auth-modal")?.remove();
    window.showToast?.("¡Sesión iniciada con éxito!", "success");
    setTimeout(() => location.reload(), 400);
  } catch(err) {
    window.showToast?.(err.message || "Error al iniciar sesión", "error");
  }
};

window.updateRegisterAvatarPreview = (url) => {
  const box = document.getElementById("register-avatar-preview-box");
  if (!box) return;
  const nameInput = document.querySelector('#register-form input[name=display_name]')?.value || "Nuevo Blader";
  box.innerHTML = window.renderAvatar({ display_name: nameInput, avatar_url: url }, "w-14 h-14", "text-xl", "border-2 border-cyan-400 shadow-lg");
};

window.handleRegisterAvatarUpload = (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    window.showToast?.("Por favor selecciona un archivo de imagen válido (PNG, JPG, WebP)", "error");
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target?.result;
    if (dataUrl) {
      const input = document.getElementById("register-avatar-url");
      if (input) input.value = dataUrl;
      window.updateRegisterAvatarPreview(dataUrl);
    }
  };
  reader.readAsDataURL(file);
};

window.submitRegister = async (e) => {
  e.preventDefault();
  const form = e.target;
  try {
    const avatarVal = form.avatar_url?.value?.trim() || "";
    const res = await window.api.register({
      username: form.username.value,
      display_name: form.display_name.value,
      email: form.email.value,
      password: form.password.value,
      avatar_url: avatarVal,
      role: "blader",
      country: form.country.value.toUpperCase()
    });
    window.api.setAuth(res.access_token, res.user);
    document.getElementById("auth-modal")?.remove();
    window.showToast?.("¡Cuenta creada exitosamente! Bienvenido a AppBey.", "success");
    setTimeout(() => location.reload(), 400);
  } catch(err) {
    window.showToast?.(err.message || "Error al registrarse", "error");
  }
};
