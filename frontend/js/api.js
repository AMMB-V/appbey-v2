// AppBey API Client
const API_BASE = "/api/v1";
const REQUEST_TIMEOUT_MS = 15000;

class ApiClient {
  constructor() {
    this.token = localStorage.getItem("appbey_token") || null;
    try {
      this.user = JSON.parse(localStorage.getItem("appbey_user") || "null");
    } catch (_error) {
      this.user = null;
      localStorage.removeItem("appbey_user");
    }
    this.cache = new Map();
  }

  clearCache() { this.cache.clear(); }

  setAuth(token, user) {
    this.token = token || null;
    this.user = user || null;
    this.clearCache();
    if (this.token) {
      localStorage.setItem("appbey_token", this.token);
      localStorage.setItem("appbey_user", JSON.stringify(this.user));
    } else {
      localStorage.removeItem("appbey_token");
      localStorage.removeItem("appbey_user");
    }
    window.dispatchEvent(new CustomEvent("auth-change", { detail: { user: this.user } }));
  }

  getHeaders() {
    const headers = { Accept: "application/json", "Content-Type": "application/json" };
    if (this.token) headers.Authorization = "Bearer " + this.token;
    return headers;
  }

  async request(endpoint, options = {}) {
    const method = (options.method || "GET").toUpperCase();
    const isGet = method === "GET";
    if (!isGet) this.clearCache();
    if (isGet && !options.noCache) {
      const cached = this.cache.get(endpoint);
      if (cached && Date.now() - cached.time < 5000) return structuredClone(cached.data);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const { noCache: _noCache, ...fetchOptions } = options;
    const config = { ...fetchOptions, method, headers: { ...this.getHeaders(), ...(options.headers || {}) }, signal: controller.signal };
    if (config.body && typeof config.body === "object") config.body = JSON.stringify(config.body);

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, config);
      const contentType = response.headers.get("content-type") || "";
      const body = await response.text();
      let data = null;
      if (body) {
        if (contentType.includes("application/json")) {
          try {
            data = JSON.parse(body);
          } catch (_error) {
            throw new Error("El servidor devolvio una respuesta JSON invalida.");
          }
        } else {
          data = { message: body };
        }
      }
      if (response.status === 401) this.setAuth(null, null);
      if (!response.ok) {
        const error = new Error(data?.detail || data?.message || `Error en el servidor (${response.status})`);
        error.status = response.status;
        throw error;
      }
      if (isGet && data !== null) this.cache.set(endpoint, { time: Date.now(), data: structuredClone(data) });
      return data;
    } catch (error) {
      if (error.name === "AbortError") {
        const timeoutError = new Error("La solicitud tardo demasiado. Verifica la conexion e intentalo de nuevo.");
        timeoutError.status = 408;
        throw timeoutError;
      }
      if (error.status !== 401) console.warn(`API Error on ${endpoint}:`, error.message || error);
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  login(email, password) { return this.request("/auth/login", { method: "POST", body: { email, password } }); }
  googleLogin(credential) { return this.request("/auth/google", { method: "POST", body: { credential } }); }
  register(userData) { return this.request("/auth/register", { method: "POST", body: userData }); }
  getMe() { return this.request("/auth/me"); }
  getUsers(params = {}) { const query = new URLSearchParams(params).toString(); return this.request(`/users${query ? `?${query}` : ""}`); }
  getUser(id) { return this.request(`/users/${id}`); }
  updateProfile(data) { return this.request("/users/me", { method: "PUT", body: data }); }
  adminCreateUser(data) { return this.request("/users/admin-create", { method: "POST", body: data }); }
  updateUserRole(id, role) { return this.request(`/users/${id}/role`, { method: "PUT", body: { role } }); }
  getParts(category = "") { return this.request(`/beyblades/parts${category ? `?category=${encodeURIComponent(category)}` : ""}`); }
  getMetaTierList() { return this.request("/beyblades/meta-tierlist"); }
  syncMetaTierList() { return this.request("/beyblades/meta-tierlist/sync", { method: "POST" }); }
  updatePartTier(id, data) { return this.request(`/beyblades/parts/${id}/tier`, { method: "PUT", body: data }); }
  getDecks(userId = null) { return this.request(`/beyblades/decks${userId ? `?user_id=${userId}` : ""}`); }
  createDeck(data) { return this.request("/beyblades/decks", { method: "POST", body: data }); }
  deleteDeck(id) { return this.request(`/beyblades/decks/${id}`, { method: "DELETE" }); }
  getTournaments(params = {}) { const query = new URLSearchParams(params).toString(); return this.request(`/tournaments${query ? `?${query}` : ""}`); }
  getTournament(id) { return this.request(`/tournaments/${id}`); }
  createTournament(data) { return this.request("/tournaments", { method: "POST", body: data }); }
  registerTournament(id) { return this.request(`/tournaments/${id}/register`, { method: "POST" }); }
  checkinParticipant(tId, userId) { return this.request(`/tournaments/${tId}/checkin?user_id=${encodeURIComponent(userId)}`, { method: "POST" }); }
  removeTournamentParticipant(tId, userId) { return this.request(`/tournaments/${tId}/participants/${userId}`, { method: "DELETE" }); }
  shuffleTournamentSeeds(id) { return this.request(`/tournaments/${id}/shuffle-seeds`, { method: "POST" }); }
  deleteTournament(id) { return this.request(`/tournaments/${id}`, { method: "DELETE" }); }
  updateTournamentParticipantGroup(tId, userId, groupId, seed) { return this.request(`/tournaments/${tId}/participants/${userId}/group`, { method: "PUT", body: { group_id: groupId, seed } }); }
  updateTournament(tId, data) { return this.request(`/tournaments/${tId}`, { method: "PUT", body: data }); }
  addTournamentParticipant(tId, data, checkedIn = true) { return this.request(`/tournaments/${tId}/add-participant`, { method: "POST", body: typeof data === "object" ? data : { user_id: data, checked_in: checkedIn } }); }
  updateParticipantDeck(tId, userId, deck, deckNotes = "") { return this.request(`/tournaments/${tId}/participants/${userId}/deck`, { method: "PUT", body: { deck, deck_notes: deckNotes } }); }
  assignMatchReferee(matchId, refereeId) { return this.request(`/matches/${matchId}/assign-referee`, { method: "POST", body: { referee_id: refereeId } }); }
  startTournament(id) { return this.request(`/tournaments/${id}/start`, { method: "POST" }); }
  nextRoundTournament(id) { return this.request(`/tournaments/${id}/next-round`, { method: "POST" }); }
  generatePlayoffs(id) { return this.request(`/tournaments/${id}/generate-playoffs`, { method: "POST" }); }
  getParticipants(id) { return this.request(`/tournaments/${id}/participants`); }
  getMatches(id, round = null) { return this.request(`/tournaments/${id}/matches${round ? `?round_number=${encodeURIComponent(round)}` : ""}`); }
  getMatch(id) { return this.request(`/matches/${id}`); }
  callMatch(id, stationNumber, status = "calling") { return this.request(`/matches/${id}/call`, { method: "POST", body: { station_number: stationNumber, status } }); }
  recordFinish(id, data) { return this.request(`/matches/${id}/record-finish`, { method: "POST", body: data }); }
  undoFinish(id) { return this.request(`/matches/${id}/undo-finish`, { method: "POST" }); }
  reopenMatch(id) { return this.request(`/matches/${id}/reopen`, { method: "POST" }); }
  resetMatch(id) { return this.request(`/matches/${id}/reset`, { method: "POST" }); }
  updateManualScore(id, data) { return this.request(`/matches/${id}/manual-score`, { method: "PUT", body: data }); }
  updateMatchTarget(id, points) { return this.request(`/matches/${id}/target-points`, { method: "POST", body: { target_points: points } }); }
  declareWinner(id, data) { return this.request(`/matches/${id}/declare-winner`, { method: "POST", body: data }); }
  getLeaderboard(country = "") { return this.request(`/rankings/leaderboard${country ? `?country=${encodeURIComponent(country)}` : ""}`); }
  getSeasons() { return this.request("/rankings/seasons"); }
  getSeasonPoints(id) { return this.request(`/rankings/season/${id}/points`); }
  getSeasonElo(id) { return this.request(`/rankings/season/${id}/elo`); }
  getHallOfFame() { return this.request("/rankings/hall-of-fame"); }
  getPosts() { return this.request("/social/posts"); }
  createPost(content, deckId = null, imageUrl = null) { return this.request("/social/posts", { method: "POST", body: { content, deck_id: deckId, image_url: imageUrl } }); }
  likePost(id) { return this.request(`/social/posts/${id}/like`, { method: "POST" }); }
  addComment(id, content) { return this.request(`/social/posts/${id}/comments`, { method: "POST", body: { content } }); }
  getNotifications() { return this.request("/social/notifications"); }
  markNotificationsRead() { return this.request("/social/notifications/mark-read", { method: "POST" }); }
}

window.api = new ApiClient();
