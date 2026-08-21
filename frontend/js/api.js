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
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.message || "Error en el servidor");
      }
      return data;
    } catch (err) {
      console.error(`API Error on ${endpoint}:`, err);
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

  // Beyblades & Decks
  getParts(category = "") {
    return this.request(`/beyblades/parts?category=${category}`);
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

  // Wallet
  getMyWallet() {
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
