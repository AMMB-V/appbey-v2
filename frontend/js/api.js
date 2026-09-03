// AppBey API Client
const API_BASE = window.location.origin + "/api/v1";

class ApiClient {
  constructor() {
    this.token = localStorage.getItem("appbey_token") || null;
    this.user = JSON.parse(localStorage.getItem("appbey_user") || "null");
  }

  setAuth(token, user) {
    this.token = token;
    this.user = user;
    if (token) {
      localStorage.setItem("appbey_token", token);
      localStorage.setItem("appbey_user", JSON.stringify(user));
    } else {
      localStorage.removeItem("appbey_token");
      localStorage.removeItem("appbey_user");
    }
    window.dispatchEvent(new CustomEvent("auth-change", { detail: { user } }));
  }

  getHeaders() {
    const headers = { "Content-Type": "application/json" };
    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }
    return headers;
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const headers = this.getHeaders();
    const config = {
      headers,
      ...options
    };

    if (options.body && typeof options.body === "object") {
      config.body = JSON.stringify(options.body);
    }

    try {
      const res = await fetch(url, config);
      if (res.status === 401) {
        this.setAuth(null, null);
      }
      
      const contentType = res.headers.get("content-type");
      let data = {};
      if (contentType && contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const text = await res.text();
        data = { message: text };
      }

      if (!res.ok) {
        const error = new Error(data.detail || data.message || `Error en el servidor (${res.status})`);
        error.status = res.status;
        throw error;
      }
      return data;
    } catch (err) {
      if (err.status !== 401) {
        console.warn(`API Error on ${endpoint}:`, err.message || err);
      }
      throw err;
    }
  }

  // Auth endpoints
  login(email, password) {
    return this.request("/auth/login", { method: "POST", body: { email, password } });
  }

  register(userData) {
    return this.request("/auth/register", { method: "POST", body: userData });
  }

  getMe() {
    return this.request("/auth/me");
  }

  // Users
  getUsers(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/users?${query}`);
  }

  getUser(id) {
    return this.request(`/users/${id}`);
  }

  updateProfile(profileData) {
    return this.request("/users/me", { method: "PUT", body: profileData });
  }

  adminCreateUser(userData) {
    return this.request("/users/admin-create", { method: "POST", body: userData });
  }

  updateUserRole(userId, role) {
    return this.request(`/users/${userId}/role`, { method: "PUT", body: { role } });
  }

  // Beyblades & Decks
  getParts(category = "") {
    return this.request(`/beyblades/parts?category=${category}`);
  }

  getMetaTierList() {
    return this.request("/beyblades/meta-tierlist");
  }

  syncMetaTierList() {
    return this.request("/beyblades/meta-tierlist/sync", { method: "POST" });
  }

  updatePartTier(partId, data) {
    return this.request(`/beyblades/parts/${partId}/tier`, { method: "PUT", body: data });
  }

  getDecks(userId = null) {
    const query = userId ? `?user_id=${userId}` : "";
    return this.request(`/beyblades/decks${query}`);
  }

  createDeck(deckData) {
    return this.request("/beyblades/decks", { method: "POST", body: deckData });
  }

  deleteDeck(deckId) {
    return this.request(`/beyblades/decks/${deckId}`, { method: "DELETE" });
  }

  // Tournaments
  getTournaments(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/tournaments?${query}`);
  }

  getTournament(id) {
    return this.request(`/tournaments/${id}`);
  }

  createTournament(tData) {
    return this.request("/tournaments", { method: "POST", body: tData });
  }

  registerTournament(id) {
    return this.request(`/tournaments/${id}/register`, { method: "POST" });
  }

  checkinParticipant(tId, userId) {
    return this.request(`/tournaments/${tId}/checkin?user_id=${userId}`, { method: "POST" });
  }

  addTournamentParticipant(tId, data, checkedIn = true) {
    let body = {};
    if (typeof data === "object" && data !== null) {
      body = data;
    } else {
      body = { user_id: data, checked_in: checkedIn };
    }
    return this.request(`/tournaments/${tId}/add-participant`, { method: "POST", body });
  }

  updateParticipantDeck(tId, userId, deck, deckNotes = "") {
    return this.request(`/tournaments/${tId}/participants/${userId}/deck`, {
      method: "PUT",
      body: { deck, deck_notes: deckNotes }
    });
  }

  assignMatchReferee(matchId, refereeId) {
    return this.request(`/matches/${matchId}/assign-referee`, { method: "POST", body: { referee_id: refereeId } });
  }

  startTournament(id) {
    return this.request(`/tournaments/${id}/start`, { method: "POST" });
  }

  nextRoundTournament(id) {
    return this.request(`/tournaments/${id}/next-round`, { method: "POST" });
  }

  getParticipants(tId) {
    return this.request(`/tournaments/${tId}/participants`);
  }

  getMatches(tId, round = null) {
    const query = round ? `?round_number=${round}` : "";
    return this.request(`/tournaments/${tId}/matches${query}`);
  }

  // Matches & Referee
  getMatch(id) {
    return this.request(`/matches/${id}`);
  }

  callMatch(id, stationNumber, status = "calling") {
    return this.request(`/matches/${id}/call`, { method: "POST", body: { station_number: stationNumber, status } });
  }

  recordFinish(matchId, finishData) {
    return this.request(`/matches/${matchId}/record-finish`, { method: "POST", body: finishData });
  }

  undoFinish(matchId) {
    return this.request(`/matches/${matchId}/undo-finish`, { method: "POST" });
  }

  reopenMatch(matchId) {
    return this.request(`/matches/${matchId}/reopen`, { method: "POST" });
  }

  resetMatch(matchId) {
    return this.request(`/matches/${matchId}/reset`, { method: "POST" });
  }

  updateManualScore(matchId, scoreData) {
    return this.request(`/matches/${matchId}/manual-score`, { method: "PUT", body: scoreData });
  }

  updateMatchTarget(matchId, targetPoints) {
    return this.request(`/matches/${matchId}/target-points`, { method: "POST", body: { target_points: targetPoints } });
  }

  declareWinner(matchId, winnerData) {
    return this.request(`/matches/${matchId}/declare-winner`, { method: "POST", body: winnerData });
  }

  // Wallet
  getMyWallet() {
    if (!this.token) {
      return Promise.resolve({ balance: 0, transactions: [] });
    }
    return this.request("/wallets/me");
  }

  transferCoins(recipientUsername, amount, reason) {
    return this.request("/wallets/transfer", { method: "POST", body: { recipient_username: recipientUsername, amount, reason } });
  }

  claimDailyReward() {
    return this.request("/wallets/daily-reward", { method: "POST" });
  }

  // Rankings & Social
  getLeaderboard(country = "") {
    return this.request(`/rankings/leaderboard?country=${country}`);
  }

  getSeasons() {
    return this.request("/rankings/seasons");
  }

  getSeasonPoints(seasonId) {
    return this.request(`/rankings/season/${seasonId}/points`);
  }

  getSeasonElo(seasonId) {
    return this.request(`/rankings/season/${seasonId}/elo`);
  }

  getHallOfFame() {
    return this.request("/rankings/hall-of-fame");
  }

  getPosts() {
    return this.request("/social/posts");
  }

  createPost(content, deckId = null, imageUrl = null) {
    return this.request("/social/posts", { method: "POST", body: { content, deck_id: deckId, image_url: imageUrl } });
  }

  likePost(postId) {
    return this.request(`/social/posts/${postId}/like`, { method: "POST" });
  }

  addComment(postId, content) {
    return this.request(`/social/posts/${postId}/comments`, { method: "POST", body: { content } });
  }

  getNotifications() {
    return this.request("/social/notifications");
  }

  markNotificationsRead() {
    return this.request("/social/notifications/mark-read", { method: "POST" });
  }
}

window.api = new ApiClient();
