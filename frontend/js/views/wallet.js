// AP Coins Virtual Wallet View
window.renderWalletView = async (container) => {
  if (!window.api.user) {
    container.innerHTML = `
      <div class="glass-card max-w-md mx-auto my-12 p-8 rounded-2xl text-center space-y-4">
        <div class="text-5xl">🪙</div>
        <h2 class="text-xl font-bold text-white">Inicia Sesión para ver tu Billetera</h2>
        <p class="text-xs text-slate-400">Accede a tu saldo de AP Coins, historial de transacciones y recompensas de torneos.</p>
        <button onclick="window.showAuthModal()" class="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow">
          Iniciar Sesión
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = `<div class="text-center py-16 text-slate-500">Cargando Billetera AP Coins...</div>`;

  try {
    const wallet = await window.api.getMyWallet();

    container.innerHTML = `
      <div class="space-y-6 max-w-4xl mx-auto pb-12">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 class="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-2">
              <span class="text-amber-400">🪙</span> Billetera AP Coins
            </h1>
            <p class="text-slate-400 text-sm">Moneda virtual oficial para inscripciones a torneos, premios y cosméticos.</p>
          </div>

          <button onclick="claimDailyRewardWallet()" class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-slate-950 font-black text-sm shadow-lg shadow-amber-500/25 transition active:scale-95 flex items-center gap-2">
            <span>🎁</span> Reclamar Bono Diario (+50 AP)
          </button>
        </div>

        <!-- Balance Card -->
        <div class="glass-card rounded-3xl p-8 border border-amber-500/40 glow-gold relative overflow-hidden bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
            <div class="space-y-1">
              <span class="text-xs font-bold uppercase tracking-widest text-slate-400">Saldo Disponible</span>
              <div class="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-yellow-200 font-mono">
                ${wallet.balance} <span class="text-2xl text-amber-400">AP Coins</span>
              </div>
              <p class="text-xs text-slate-400">Equivalente a ${Math.floor(wallet.balance / 50)} entradas a torneos estándar.</p>
            </div>

            <!-- Transfer Button Trigger -->
            <button onclick="window.openTransferModal()" class="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold border border-cyan-500/40 text-sm shadow flex items-center gap-2">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>
              Transferir a otro Blader
            </button>
          </div>
        </div>

        <!-- Transaction Ledger -->
        <div class="glass-card rounded-2xl p-6 space-y-4">
          <h3 class="font-bold text-base text-white flex items-center gap-2">
            <span>📜</span> Historial de Transacciones
          </h3>
          <div class="divide-y divide-slate-800">
            ${wallet.transactions && wallet.transactions.length ? wallet.transactions.map(tx => `
              <div class="py-3.5 flex items-center justify-between text-xs first:pt-0 last:pb-0">
                <div class="space-y-0.5">
                  <div class="font-bold text-white text-sm">${tx.reason}</div>
                  <div class="text-[10px] text-slate-500 font-mono">${new Date(tx.created_at).toLocaleString()} • Tipo: ${tx.tx_type}</div>
                </div>
                <div class="font-mono font-black text-sm ${tx.amount > 0 ? 'text-emerald-400' : 'text-rose-400'}">
                  ${tx.amount > 0 ? `+${tx.amount}` : tx.amount} AP
                </div>
              </div>
            `).join("") : '<div class="text-center py-6 text-slate-500">No hay transacciones registradas aún.</div>'}
          </div>
        </div>
      </div>
    `;
  } catch(e) {
    container.innerHTML = `<div class="text-center py-16 text-rose-400">Error: ${e.message}</div>`;
  }
};

window.claimDailyRewardWallet = async () => {
  try {
    await window.api.claimDailyReward();
    alert("¡Bono diario reclamado exitosamente!");
    window.renderWalletView(document.getElementById("main-content"));
  } catch(err) {
    alert(err.message || "Error al reclamar bono");
  }
};

window.openTransferModal = () => {
  const modal = document.createElement("div");
  modal.id = "transfer-modal";
  modal.className = "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm";
  modal.innerHTML = `
    <div class="glass-card max-w-sm w-full rounded-2xl p-6 border border-cyan-500/40 space-y-4">
      <div class="flex items-center justify-between border-b border-slate-800 pb-3">
        <h3 class="font-bold text-white text-lg">Transferir AP Coins</h3>
        <button onclick="document.getElementById('transfer-modal').remove()" class="text-slate-400 hover:text-white">&times;</button>
      </div>
      <form onsubmit="submitTransferCoins(event)" class="space-y-3 text-xs">
        <div>
          <label class="block text-slate-300 font-semibold mb-1">Username del Destinatario (sin @)</label>
          <input type="text" name="recipient" required placeholder="Ej: ryu_blader" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-cyan-500"/>
        </div>
        <div>
          <label class="block text-slate-300 font-semibold mb-1">Monto (AP Coins)</label>
          <input type="number" name="amount" min="10" max="5000" value="50" required class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-cyan-500 font-mono"/>
        </div>
        <div>
          <label class="block text-slate-300 font-semibold mb-1">Motivo / Mensaje</label>
          <input type="text" name="reason" value="Transferencia entre Bladers" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white outline-none focus:border-cyan-500"/>
        </div>
        <button type="submit" class="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow transition">
          Enviar AP Coins
        </button>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
};

window.submitTransferCoins = async (e) => {
  e.preventDefault();
  const form = e.target;
  try {
    await window.api.transferCoins(form.recipient.value, parseInt(form.amount.value), form.reason.value);
    document.getElementById("transfer-modal").remove();
    alert("¡Transferencia enviada con éxito!");
    window.renderWalletView(document.getElementById("main-content"));
  } catch(err) {
    alert(err.message || "Error en la transferencia");
  }
};
