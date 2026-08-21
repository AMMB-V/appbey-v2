// Rankings & Leaderboard View
window.renderRankingsView = async (container) => {
  container.innerHTML = `<div class="text-center py-16 text-slate-500">Cargando Rankings Oficiales...</div>`;

  try {
    const leaderboard = await window.api.getLeaderboard();

    container.innerHTML = `
      <div class="space-y-6 max-w-5xl mx-auto pb-12">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 class="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-2">
              <span class="text-amber-400">🏅</span> Tabla de Clasificación Global
            </h1>
            <p class="text-slate-400 text-sm">Rankings competitivos basados en sistema Elo Oficial AppBey.</p>
          </div>

          <div class="flex items-center gap-2">
            <button onclick="location.hash='#/hall-of-fame'" class="px-4 py-2 rounded-xl bg-amber-600/20 hover:bg-amber-600/40 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5">
              <span>🏛️</span> Salón de la Fama
            </button>
          </div>
        </div>

        <!-- Podium of Top 3 Bladers -->
        ${leaderboard.length >= 3 ? `
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
            <!-- 2nd Place -->
            <div class="glass-card rounded-2xl p-6 text-center border border-slate-700 md:order-1 flex flex-col justify-between space-y-3">
              <div class="text-xs font-bold text-slate-400 uppercase tracking-wider">2do Lugar</div>
              <div class="relative inline-block mx-auto">
                <img src="${leaderboard[1].avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120'}" class="w-20 h-20 rounded-full border-4 border-slate-400 mx-auto object-cover shadow-lg"/>
                <span class="absolute -bottom-2 right-1/2 translate-x-1/2 px-2 py-0.5 rounded-full bg-slate-700 text-slate-200 text-xs font-black">#2</span>
              </div>
              <div>
                <h3 class="font-extrabold text-lg text-white">${leaderboard[1].display_name}</h3>
                <div class="text-xs text-slate-400 font-mono">@${leaderboard[1].username} • ${leaderboard[1].country}</div>
              </div>
              <div class="text-xl font-black text-slate-300 font-mono">${leaderboard[1].elo_rating} pts</div>
            </div>

            <!-- 1st Place Champion -->
            <div class="glass-card rounded-2xl p-6 text-center border-2 border-amber-400 glow-gold md:order-2 flex flex-col justify-between space-y-3 bg-gradient-to-b from-amber-950/40 via-slate-900 to-slate-950">
              <div class="text-xs font-black text-amber-400 uppercase tracking-widest flex items-center justify-center gap-1">
                <span>👑</span> Campeón de Liga
              </div>
              <div class="relative inline-block mx-auto">
                <img src="${leaderboard[0].avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120'}" class="w-24 h-24 rounded-full border-4 border-amber-400 mx-auto object-cover shadow-xl"/>
                <span class="absolute -bottom-2 right-1/2 translate-x-1/2 px-3 py-0.5 rounded-full bg-amber-500 text-black text-xs font-black shadow">#1</span>
              </div>
              <div>
                <h3 class="font-black text-xl text-white">${leaderboard[0].display_name}</h3>
                <div class="text-xs text-amber-300 font-mono">@${leaderboard[0].username} • ${leaderboard[0].country}</div>
                <div class="text-xs text-slate-400 mt-1">${leaderboard[0].favorite_combo || ''}</div>
              </div>
              <div class="text-2xl font-black text-amber-400 font-mono">${leaderboard[0].elo_rating} pts</div>
            </div>

            <!-- 3rd Place -->
            <div class="glass-card rounded-2xl p-6 text-center border border-amber-700/60 md:order-3 flex flex-col justify-between space-y-3">
              <div class="text-xs font-bold text-amber-600 uppercase tracking-wider">3er Lugar</div>
              <div class="relative inline-block mx-auto">
                <img src="${leaderboard[2].avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120'}" class="w-20 h-20 rounded-full border-4 border-amber-700 mx-auto object-cover shadow-lg"/>
                <span class="absolute -bottom-2 right-1/2 translate-x-1/2 px-2 py-0.5 rounded-full bg-amber-800 text-amber-200 text-xs font-black">#3</span>
              </div>
              <div>
                <h3 class="font-extrabold text-lg text-white">${leaderboard[2].display_name}</h3>
                <div class="text-xs text-slate-400 font-mono">@${leaderboard[2].username} • ${leaderboard[2].country}</div>
              </div>
              <div class="text-xl font-black text-amber-600 font-mono">${leaderboard[2].elo_rating} pts</div>
            </div>
          </div>
        ` : ''}

        <!-- Leaderboard Table -->
        <div class="glass-card rounded-2xl p-5 overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="text-xs uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th class="py-3 px-3"># Pos</th>
                <th class="py-3 px-3">Blader</th>
                <th class="py-3 px-3">Combo Insignia</th>
                <th class="py-3 px-3 text-center">País</th>
                <th class="py-3 px-3 text-right">Elo Rating</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800">
              ${leaderboard.map(b => `
                <tr class="hover:bg-slate-800/40">
                  <td class="py-3.5 px-3 font-bold ${b.rank === 1 ? 'text-amber-400' : b.rank === 2 ? 'text-slate-300' : b.rank === 3 ? 'text-amber-600' : 'text-slate-500'}">
                    #${b.rank}
                  </td>
                  <td class="py-3.5 px-3">
                    <div class="flex items-center gap-3">
                      <img src="${b.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}" class="w-8 h-8 rounded-full object-cover"/>
                      <div>
                        <div class="font-bold text-white">${b.display_name}</div>
                        <div class="text-xs text-slate-400">@${b.username}</div>
                      </div>
                    </div>
                  </td>
                  <td class="py-3.5 px-3 text-xs text-slate-300">${b.favorite_combo || "Phoenix Wing 9-60 GF"}</td>
                  <td class="py-3.5 px-3 text-center text-xs font-mono font-bold text-cyan-400">${b.country}</td>
                  <td class="py-3.5 px-3 text-right font-mono font-black text-amber-400">${b.elo_rating} pts</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch(e) {
    container.innerHTML = `<div class="text-center py-16 text-rose-400">Error: ${e.message}</div>`;
  }
};
