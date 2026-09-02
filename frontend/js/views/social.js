// Community Social Feed View
window.renderSocialView = async (container) => {
  container.innerHTML = `<div class="text-center py-16 text-slate-500">Cargando Feed de la Comunidad...</div>`;

  const loadFeed = async () => {
    try {
      const posts = await window.api.getPosts();

      container.innerHTML = `
        <div class="space-y-6 max-w-2xl mx-auto pb-12">
          <div>
            <h1 class="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-2">
              <span class="text-cyan-400">💬</span> Comunidad & Feed Blader
            </h1>
            <p class="text-slate-400 text-sm">Comparte tus combinaciones, estrategias y análisis de torneos.</p>
          </div>

          <!-- Create Post Card (if logged in) -->
          ${window.api.user ? `
            <div class="glass-card rounded-2xl p-5 border border-cyan-500/30 space-y-3">
              <div class="flex items-center gap-3">
                <img src="${window.api.user.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}" class="w-9 h-9 rounded-full object-cover"/>
                <span class="font-bold text-sm text-white">${window.api.user.display_name}</span>
              </div>
              <textarea id="new-post-content" rows="3" placeholder="¿Qué combos estás probando hoy para el próximo torneo?" class="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-400"></textarea>
              <div class="flex justify-end">
                <button onclick="submitNewPost()" class="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow">
                  Publicar
                </button>
              </div>
            </div>
          ` : ''}

          <!-- Posts List -->
          <div class="space-y-4">
            ${posts.map(p => `
              <div class="glass-card rounded-2xl p-6 border border-slate-800 space-y-4">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <img src="${p.user.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}" class="w-10 h-10 rounded-full object-cover border border-slate-700"/>
                    <div>
                      <div class="font-bold text-white text-sm">${p.user.display_name}</div>
                      <div class="text-xs text-slate-400 font-mono">@${p.user.username} • ${new Date(p.created_at).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-cyan-300 uppercase">${p.user.role}</span>
                </div>

                <p class="text-sm text-slate-200 leading-relaxed whitespace-pre-line">${p.content}</p>

                <!-- Post Actions & Likes -->
                <div class="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <button onclick="handleLikePost(${p.id}, this)" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${p.has_liked ? 'border-rose-500/50 bg-rose-500/10 text-rose-400' : 'border-slate-800 bg-slate-900/60 hover:text-rose-400 hover:border-slate-700'} font-bold transition">
                    <span>${p.has_liked ? '❤️' : '🤍'}</span>
                    <span class="like-count">${p.likes_count} Me gusta</span>
                  </button>
                  <span class="text-slate-500">${p.comments_count || 0} comentarios</span>
                </div>

                <!-- Comments List -->
                ${p.comments && p.comments.length ? `
                  <div class="pt-2 space-y-2 border-t border-slate-800/60">
                    ${p.comments.map(c => `
                      <div class="p-2.5 rounded-xl bg-slate-900/60 text-xs space-y-0.5">
                        <div class="flex items-center justify-between font-bold text-slate-300">
                          <span>${c.user.display_name}</span>
                          <span class="text-[10px] text-slate-500 font-mono font-normal">${new Date(c.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                        <p class="text-slate-400">${c.content}</p>
                      </div>
                    `).join("")}
                  </div>
                ` : ''}

                <!-- Add Comment Input (if logged in) -->
                ${window.api.user ? `
                  <div class="pt-2 flex gap-2">
                    <input type="text" id="comment-input-${p.id}" placeholder="Escribe un comentario..." class="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-500"/>
                    <button onclick="submitComment(${p.id})" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-cyan-300">Enviar</button>
                  </div>
                ` : ''}
              </div>
            `).join("")}
          </div>
        </div>
      `;
    } catch(e) {
      container.innerHTML = `<div class="text-center py-16 text-rose-400">Error: ${e.message}</div>`;
    }
  };

  window.submitNewPost = async () => {
    const el = document.getElementById("new-post-content");
    if (!el || !el.value.trim()) return;
    try {
      await window.api.createPost(el.value);
      el.value = "";
      loadFeed();
    } catch(err) {
      alert(err.message || "Error al publicar");
    }
  };

  window.handleLikePost = async (postId, btn) => {
    if (!window.api.user) {
      window.showAuthModal();
      return;
    }
    btn.disabled = true;
    try {
      const res = await window.api.likePost(postId);
      const isLiked = res.liked;
      btn.className = `flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${isLiked ? 'border-rose-500/50 bg-rose-500/10 text-rose-400' : 'border-slate-800 bg-slate-900/60 hover:text-rose-400 hover:border-slate-700'} font-bold transition`;
      btn.innerHTML = `<span>${isLiked ? '❤️' : '🤍'}</span> <span class="like-count">${res.likes_count} Me gusta</span>`;
    } catch(e) {
      alert(e.message || "Error al procesar el like");
    } finally {
      btn.disabled = false;
    }
  };

  window.submitComment = async (postId) => {
    const input = document.getElementById(`comment-input-${postId}`);
    if (!input || !input.value.trim()) return;
    try {
      await window.api.addComment(postId, input.value);
      input.value = "";
      loadFeed();
    } catch(err) {
      alert(err.message || "Error al comentar");
    }
  };

  loadFeed();
};
