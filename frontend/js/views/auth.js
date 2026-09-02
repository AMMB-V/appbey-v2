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
        <div class="flex items-center gap-2">
          <span class="text-2xl">⚡</span>
          <h2 class="text-xl font-extrabold text-white">AppBey</h2>
        </div>
        <button onclick="document.getElementById('auth-modal').remove()" class="text-slate-400 hover:text-white text-xl font-bold">&times;</button>
      </div>

      <!-- Mode Switcher -->
      <div class="flex rounded-xl bg-slate-900 p-1 border border-slate-800 text-xs font-bold">
        <button onclick="switchAuthTab('login')" id="auth-tab-login" class="flex-1 py-2 rounded-lg bg-blue-600 text-white shadow">Iniciar Sesión</button>
        <button onclick="switchAuthTab('register')" id="auth-tab-register" class="flex-1 py-2 rounded-lg text-slate-400 hover:text-white">Registrarse</button>
      </div>

      <!-- Login Form -->
      <form id="login-form" onsubmit="submitLogin(event)" class="space-y-3 text-xs">
        <div>
          <label class="block text-slate-300 font-semibold mb-1">Email o Nombre de Usuario</label>
          <input type="text" name="email" value="byjankraftyt@gmail.com" required class="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none focus:border-cyan-400 text-sm"/>
        </div>
        <div>
          <label class="block text-slate-300 font-semibold mb-1">Contraseña</label>
          <input type="password" name="password" value="123456" required class="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none focus:border-cyan-400 text-sm"/>
        </div>
        <button type="submit" class="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-black text-sm shadow-lg shadow-cyan-500/25 transition active:scale-95">
          Entrar a AppBey
        </button>
      </form>

      <!-- Register Form (Hidden by default) -->
      <form id="register-form" onsubmit="submitRegister(event)" class="space-y-3 text-xs hidden">
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
          Crear Cuenta (+250 AP Bono)
        </button>
      </form>

      <!-- Quick Demo Switcher -->
      <div class="pt-3 border-t border-slate-800 text-[11px] space-y-2">
        <span class="text-slate-400 block font-semibold">⚡ Cuentas de Demostración Rápida:</span>
        <div class="grid grid-cols-2 gap-1.5">
          <button onclick="quickFillAuth('byjankraftyt@gmail.com', '123456')" class="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-left truncate">
            <span class="font-bold text-amber-400 block">👑 Jan Kraft (Admin)</span>
            <span class="text-[10px] text-slate-500">byjankraftyt@gmail.com</span>
          </button>
          <button onclick="quickFillAuth('organizer@appbey.app', '123456')" class="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-left truncate">
            <span class="font-bold text-blue-400 block">📋 Carlos (Organizador)</span>
            <span class="text-[10px] text-slate-500">organizer@appbey.app</span>
          </button>
          <button onclick="quickFillAuth('referee@appbey.app', '123456')" class="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-left truncate">
            <span class="font-bold text-cyan-400 block">⚖️ Alex (Árbitro)</span>
            <span class="text-[10px] text-slate-500">referee@appbey.app</span>
          </button>
          <button onclick="quickFillAuth('ryu@appbey.app', '123456')" class="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-left truncate">
            <span class="font-bold text-emerald-400 block">⚔️ Ryu (Pro Blader)</span>
            <span class="text-[10px] text-slate-500">ryu@appbey.app</span>
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  if (initialMode === "register") switchAuthTab("register");
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

window.quickFillAuth = (email, password) => {
  switchAuthTab("login");
  const form = document.getElementById("login-form");
  if (form) {
    form.email.value = email;
    form.password.value = password;
  }
};

window.submitLogin = async (e) => {
  e.preventDefault();
  const form = e.target;
  try {
    const res = await window.api.login(form.email.value, form.password.value);
    window.api.setAuth(res.access_token, res.user);
    document.getElementById("auth-modal")?.remove();
    location.reload();
  } catch(err) {
    alert(err.message || "Error al iniciar sesión");
  }
};

window.submitRegister = async (e) => {
  e.preventDefault();
  const form = e.target;
  try {
    const res = await window.api.register({
      username: form.username.value,
      display_name: form.display_name.value,
      email: form.email.value,
      password: form.password.value,
      role: "blader",
      country: form.country.value.toUpperCase()
    });
    window.api.setAuth(res.access_token, res.user);
    document.getElementById("auth-modal")?.remove();
    alert("¡Cuenta creada exitosamente con bono de 250 AP Coins!");
    location.reload();
  } catch(err) {
    alert(err.message || "Error al registrarse");
  }
};
