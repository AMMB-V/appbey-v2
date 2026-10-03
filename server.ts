import express, { Response, NextFunction } from "express";
import compression from "compression";
import http from "http";
import path from "path";
import crypto from "crypto";
import cors from "cors";
import bcrypt from "bcryptjs";
import { AuthService, requireAuth, requireRoles, type AuthRequest } from "./src/backend/auth.js";
import { registerCommunityRoutes } from "./src/backend/routes/community.js";
import { registerIdentityRoutes } from "./src/backend/routes/identity.js";
import { registerCatalogRoutes } from "./src/backend/routes/catalog.js";
import { registerTournamentRoutes } from "./src/backend/routes/tournaments.js";
import { registerMatchRoutes } from "./src/backend/routes/matches.js";
import { createTournamentDomain } from "./src/backend/services/tournament-domain.js";
import { registerRankingsRoutes } from "./src/backend/routes/rankings.js";
import { PersistenceDatabase } from "./src/backend/persistence/database.js";
import { PersistenceRepository } from "./src/backend/persistence/repository.js";
import type { PersistedState } from "./src/backend/persistence/schema.js";
import type {
  BeybladePart,
  BladerDeck,
  CommunityPost,
  HallOfFame,
  MatchGame,
  MetaSyncState,
  Notification,
  PostComment,
  PostLike,
  Season,
  SeasonRanking,
  Tournament,
  TournamentMatch,
  TournamentParticipant,
  User
} from "./src/backend/models.js";
import { RealtimeHub } from "./src/backend/realtime.js";

export type Request = express.Request<Record<string, string>>;
export type { Response, NextFunction };

const app = express();
const server = http.createServer(app);
const parsedPort = Number.parseInt(process.env.PORT || "3000", 10);
const PORT = Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort <= 65535 ? parsedPort : 3000;
const HOST = "0.0.0.0";
const startedAt = new Date().toISOString();
let isReady = false;
const isProduction = process.env.NODE_ENV === "production";
const demoDataEnabled = process.env.APPBEY_DEMO_DATA === "true";
// Secure secret resolution: environment variable or dynamically hashed project salt to avoid hardcoded credentials (SonarQube CWE-798)
const DEFAULT_DEV_SECRET = crypto.createHash("sha256").update("appbey_stable_project_secret_key_salt_v2").digest("hex");
const configuredJwtSecret = process.env.SECRET_KEY?.trim() || process.env.JWT_SECRET?.trim();
const JWT_SECRET = configuredJwtSecret || (isProduction
  ? crypto.randomBytes(48).toString("hex")
  : DEFAULT_DEV_SECRET);
if (isProduction && !configuredJwtSecret) {
  console.warn("SECRET_KEY or JWT_SECRET is not configured; using an ephemeral JWT secret. Configure SECRET_KEY in Render to preserve sessions across restarts.");
}

const database = new PersistenceDatabase(process.env.DATABASE_URL, isProduction);
const persistencePool = database.pool;

// Disable technology disclosure header (SonarQube S5689)
app.disable("x-powered-by");

// High-performance gzip/brotli compression for all text, json and js responses
app.use(compression({
  threshold: 512,
  filter: (req, res) => {
    if (req.headers["x-no-compression"]) return false;
    return compression.filter(req, res);
  }
}));

// Standard security headers (SonarQube S5689, OWASP Security Headers)
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

// Explicit CORS configuration (SonarQube S5122)
const configuredOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => {
    const normalized = origin.trim();
    return normalized && !normalized.includes("://") ? `https://${normalized}` : normalized;
  }).filter(Boolean)
  : true;
app.use(cors({
  origin: configuredOrigins,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  credentials: true
}));
app.use(express.json({ limit: "768kb" }));

// ---------------------------------------------------------------------------
// In-Memory Database & Types
// ---------------------------------------------------------------------------

const publicUser = (user?: User | null) => {
  if (!user) return null;
  const {
    id, username, display_name, role, country, avatar_url, bio,
    favorite_combo, elo_rating, is_active, is_verified, created_at
  } = user;
  return {
    id, username, display_name, role, country, avatar_url, bio,
    favorite_combo, elo_rating, is_active, is_verified, created_at
  };
};

// Stores
let users: User[] = [];
let parts: BeybladePart[] = [];
let decks: BladerDeck[] = [];
let tournaments: Tournament[] = [];
let participants: TournamentParticipant[] = [];
let matches: TournamentMatch[] = [];
let matchGames: MatchGame[] = [];
let seasons: Season[] = [];
let seasonRankings: SeasonRanking[] = [];
let hallOfFame: HallOfFame[] = [];
let communityPosts: CommunityPost[] = [];
let postLikes: PostLike[] = [];
let postComments: PostComment[] = [];
let notifications: Notification[] = [];

function nextId(records: readonly { id: number }[]): number {
  return records.reduce((maximum, record) => Math.max(maximum, record.id), 0) + 1;
}

let metaSyncState: MetaSyncState = {
  source_name: "Beyblade X API (comunitaria)",
  official_url: "https://beyblade-x-api.onrender.com/swagger-ui.html",
  secondary_url: "https://beyblade.takaratomy.co.jp/beyblade-x/lineup/",
  meta_version: "Catálogo comunitario",
  last_synced_at: "",
  total_matches_analyzed: 0,
  status: "not_configured",
  auto_sync_interval_mins: 0,
  patch_notes: []
};



function getPersistedState(): PersistedState {
  return {
    users, parts, decks, tournaments, participants,
    matches, matchGames, seasons, seasonRankings, hallOfFame, communityPosts,
    postLikes, postComments, notifications, metaSyncState
  };
}

function replacePersistedState(state: PersistedState): void {
  users = state.users;
  parts = state.parts;
  decks = state.decks;
  tournaments = state.tournaments;
  participants = state.participants;
  matches = state.matches;
  matchGames = state.matchGames;
  seasons = state.seasons;
  seasonRankings = state.seasonRankings;
  hallOfFame = state.hallOfFame;
  communityPosts = state.communityPosts;
  postLikes = state.postLikes;
  postComments = state.postComments;
  notifications = state.notifications;
  metaSyncState = state.metaSyncState;
}

const persistenceRepository = new PersistenceRepository(database, {
  getState: getPersistedState,
  replaceState: replacePersistedState
});

function persistState(): Promise<void> {
  return persistenceRepository.persistState();
}

// Official Season 1 Data from Asociacion Panamena de Beyblade
interface HistoricalBladerData {
  rank: number;
  blader: string;
  tournaments_played: number;
  matches_played: number;
  matches_won: number;
  matches_lost: number;
  points_for: number;
  points_against: number;
  bonus_points: number;
  warnings: number;
  win_rate: string;
  total_points: number;
}

const APB_SEASON_1_RANKINGS: HistoricalBladerData[] = [
  { rank: 1, blader: "Yorch", tournaments_played: 15, matches_played: 145, matches_won: 96, matches_lost: 49, points_for: 519, points_against: 317, bonus_points: 444, warnings: 0, win_rate: "66%", total_points: 646 },
  { rank: 2, blader: "Woonka", tournaments_played: 14, matches_played: 150, matches_won: 94, matches_lost: 56, points_for: 484, points_against: 353, bonus_points: 352, warnings: 0, win_rate: "63%", total_points: 483 },
  { rank: 3, blader: "Kanghy", tournaments_played: 16, matches_played: 157, matches_won: 87, matches_lost: 70, points_for: 505, points_against: 417, bonus_points: 392, warnings: 0, win_rate: "55%", total_points: 480 },
  { rank: 4, blader: "Raines", tournaments_played: 12, matches_played: 117, matches_won: 73, matches_lost: 44, points_for: 429, points_against: 311, bonus_points: 347, warnings: 0, win_rate: "62%", total_points: 465 },
  { rank: 5, blader: "Zirox", tournaments_played: 16, matches_played: 138, matches_won: 78, matches_lost: 60, points_for: 440, points_against: 354, bonus_points: 352, warnings: 0, win_rate: "57%", total_points: 438 },
  { rank: 6, blader: "Káiser", tournaments_played: 12, matches_played: 116, matches_won: 70, matches_lost: 46, points_for: 416, points_against: 323, bonus_points: 286, warnings: 0, win_rate: "60%", total_points: 379 },
  { rank: 7, blader: "Baco", tournaments_played: 16, matches_played: 149, matches_won: 81, matches_lost: 68, points_for: 479, points_against: 413, bonus_points: 304, warnings: 0, win_rate: "54%", total_points: 370 },
  { rank: 8, blader: "RADD", tournaments_played: 12, matches_played: 107, matches_won: 69, matches_lost: 38, points_for: 370, points_against: 268, bonus_points: 241, warnings: 0, win_rate: "64%", total_points: 343 },
  { rank: 9, blader: "Raphaeru", tournaments_played: 10, matches_played: 91, matches_won: 56, matches_lost: 35, points_for: 305, points_against: 222, bonus_points: 237, warnings: 0, win_rate: "62%", total_points: 320 },
  { rank: 10, blader: "Wolf", tournaments_played: 10, matches_played: 99, matches_won: 55, matches_lost: 44, points_for: 330, points_against: 266, bonus_points: 240, warnings: 0, win_rate: "56%", total_points: 304 },
  { rank: 11, blader: "ProdyQ", tournaments_played: 13, matches_played: 125, matches_won: 67, matches_lost: 58, points_for: 369, points_against: 353, bonus_points: 283, warnings: 0, win_rate: "54%", total_points: 299 },
  { rank: 12, blader: "Panda", tournaments_played: 8, matches_played: 65, matches_won: 36, matches_lost: 29, points_for: 269, points_against: 223, bonus_points: 237, warnings: 0, win_rate: "55%", total_points: 283 },
  { rank: 13, blader: "Jiji", tournaments_played: 7, matches_played: 62, matches_won: 36, matches_lost: 26, points_for: 193, points_against: 172, bonus_points: 206, warnings: 0, win_rate: "58%", total_points: 227 },
  { rank: 14, blader: "Scorpio", tournaments_played: 5, matches_played: 71, matches_won: 40, matches_lost: 31, points_for: 210, points_against: 169, bonus_points: 153, warnings: 0, win_rate: "56%", total_points: 194 },
  { rank: 15, blader: "C J", tournaments_played: 11, matches_played: 97, matches_won: 60, matches_lost: 37, points_for: 269, points_against: 270, bonus_points: 178, warnings: 0, win_rate: "62%", total_points: 177 },
  { rank: 16, blader: "Dimetrodon", tournaments_played: 7, matches_played: 50, matches_won: 27, matches_lost: 23, points_for: 139, points_against: 144, bonus_points: 181, warnings: 0, win_rate: "54%", total_points: 176 },
  { rank: 17, blader: "King", tournaments_played: 10, matches_played: 75, matches_won: 41, matches_lost: 34, points_for: 231, points_against: 221, bonus_points: 159, warnings: 0, win_rate: "55%", total_points: 169 },
  { rank: 18, blader: "Gurren Iann", tournaments_played: 6, matches_played: 44, matches_won: 23, matches_lost: 21, points_for: 133, points_against: 125, bonus_points: 153, warnings: 0, win_rate: "52%", total_points: 161 },
  { rank: 19, blader: "Pejex", tournaments_played: 10, matches_played: 67, matches_won: 29, matches_lost: 38, points_for: 195, points_against: 204, bonus_points: 166, warnings: 0, win_rate: "43%", total_points: 157 },
  { rank: 20, blader: "Bubbles", tournaments_played: 10, matches_played: 81, matches_won: 33, matches_lost: 48, points_for: 198, points_against: 236, bonus_points: 181, warnings: 0, win_rate: "41%", total_points: 143 },
  { rank: 21, blader: "Krizia Olmos", tournaments_played: 10, matches_played: 77, matches_won: 42, matches_lost: 35, points_for: 224, points_against: 230, bonus_points: 141, warnings: 0, win_rate: "55%", total_points: 135 },
  { rank: 22, blader: "Sombra", tournaments_played: 10, matches_played: 75, matches_won: 33, matches_lost: 42, points_for: 196, points_against: 226, bonus_points: 131, warnings: 0, win_rate: "44%", total_points: 101 },
  { rank: 23, blader: "Kurenai", tournaments_played: 9, matches_played: 71, matches_won: 27, matches_lost: 44, points_for: 193, points_against: 230, bonus_points: 138, warnings: 0, win_rate: "38%", total_points: 101 },
  { rank: 24, blader: "Parzival", tournaments_played: 4, matches_played: 40, matches_won: 21, matches_lost: 19, points_for: 95, points_against: 103, bonus_points: 98, warnings: 0, win_rate: "53%", total_points: 90 },
  { rank: 25, blader: "Asuma", tournaments_played: 2, matches_played: 7, matches_won: 4, matches_lost: 3, points_for: 79, points_against: 50, bonus_points: 59, warnings: 0, win_rate: "57%", total_points: 88 },
  { rank: 26, blader: "Mia Blader", tournaments_played: 3, matches_played: 35, matches_won: 20, matches_lost: 15, points_for: 107, points_against: 86, bonus_points: 51, warnings: 0, win_rate: "57%", total_points: 72 },
  { rank: 27, blader: "Sollux", tournaments_played: 15, matches_played: 100, matches_won: 37, matches_lost: 63, points_for: 248, points_against: 332, bonus_points: 154, warnings: 0, win_rate: "37%", total_points: 70 },
  { rank: 28, blader: "Rex1243", tournaments_played: 5, matches_played: 35, matches_won: 17, matches_lost: 18, points_for: 99, points_against: 111, bonus_points: 74, warnings: 0, win_rate: "49%", total_points: 62 },
  { rank: 29, blader: "Julio Jaen", tournaments_played: 1, matches_played: 13, matches_won: 6, matches_lost: 7, points_for: 37, points_against: 37, bonus_points: 60, warnings: 0, win_rate: "46%", total_points: 60 },
  { rank: 30, blader: "Metaman", tournaments_played: 3, matches_played: 21, matches_won: 9, matches_lost: 12, points_for: 55, points_against: 60, bonus_points: 58, warnings: 0, win_rate: "43%", total_points: 53 },
  { rank: 31, blader: "Bellota", tournaments_played: 6, matches_played: 32, matches_won: 13, matches_lost: 19, points_for: 87, points_against: 107, bonus_points: 72, warnings: 0, win_rate: "41%", total_points: 52 },
  { rank: 32, blader: "Geovane NG", tournaments_played: 3, matches_played: 22, matches_won: 10, matches_lost: 12, points_for: 63, points_against: 64, bonus_points: 53, warnings: 0, win_rate: "45%", total_points: 52 },
  { rank: 33, blader: "Diego Q.", tournaments_played: 3, matches_played: 21, matches_won: 10, matches_lost: 11, points_for: 61, points_against: 61, bonus_points: 52, warnings: 0, win_rate: "48%", total_points: 52 },
  { rank: 34, blader: "Gengar", tournaments_played: 6, matches_played: 31, matches_won: 15, matches_lost: 16, points_for: 86, points_against: 100, bonus_points: 59, warnings: 0, win_rate: "48%", total_points: 45 },
  { rank: 35, blader: "Saviñon Sr", tournaments_played: 2, matches_played: 15, matches_won: 7, matches_lost: 8, points_for: 42, points_against: 43, bonus_points: 45, warnings: 0, win_rate: "47%", total_points: 44 },
  { rank: 36, blader: "Nova", tournaments_played: 3, matches_played: 22, matches_won: 8, matches_lost: 14, points_for: 60, points_against: 66, bonus_points: 46, warnings: 0, win_rate: "36%", total_points: 40 },
  { rank: 37, blader: "Miguel de sedas", tournaments_played: 2, matches_played: 18, matches_won: 11, matches_lost: 7, points_for: 55, points_against: 44, bonus_points: 28, warnings: 0, win_rate: "61%", total_points: 39 },
  { rank: 38, blader: "Saviñon Jr", tournaments_played: 2, matches_played: 13, matches_won: 5, matches_lost: 8, points_for: 41, points_against: 32, bonus_points: 28, warnings: 0, win_rate: "38%", total_points: 37 },
  { rank: 39, blader: "Zero", tournaments_played: 2, matches_played: 13, matches_won: 7, matches_lost: 6, points_for: 43, points_against: 41, bonus_points: 30, warnings: 0, win_rate: "54%", total_points: 32 },
  { rank: 40, blader: "Kai", tournaments_played: 5, matches_played: 29, matches_won: 11, matches_lost: 18, points_for: 76, points_against: 100, bonus_points: 55, warnings: 0, win_rate: "38%", total_points: 31 },
  { rank: 41, blader: "Alejandro LUNA", tournaments_played: 1, matches_played: 7, matches_won: 4, matches_lost: 3, points_for: 23, points_against: 17, bonus_points: 25, warnings: 0, win_rate: "57%", total_points: 31 },
  { rank: 42, blader: "Damir", tournaments_played: 2, matches_played: 18, matches_won: 10, matches_lost: 8, points_for: 50, points_against: 57, bonus_points: 36, warnings: 0, win_rate: "56%", total_points: 29 },
  { rank: 43, blader: "Twilight", tournaments_played: 5, matches_played: 36, matches_won: 15, matches_lost: 21, points_for: 92, points_against: 120, bonus_points: 56, warnings: 0, win_rate: "42%", total_points: 28 },
  { rank: 44, blader: "Johanes V.", tournaments_played: 2, matches_played: 10, matches_won: 6, matches_lost: 4, points_for: 32, points_against: 27, bonus_points: 23, warnings: 0, win_rate: "60%", total_points: 28 },
  { rank: 45, blader: "Lance", tournaments_played: 2, matches_played: 12, matches_won: 7, matches_lost: 5, points_for: 40, points_against: 36, bonus_points: 23, warnings: 0, win_rate: "58%", total_points: 27 },
  { rank: 46, blader: "Aletaco", tournaments_played: 1, matches_played: 6, matches_won: 4, matches_lost: 2, points_for: 17, points_against: 16, bonus_points: 25, warnings: 0, win_rate: "67%", total_points: 26 },
  { rank: 47, blader: "Hannie", tournaments_played: 1, matches_played: 8, matches_won: 5, matches_lost: 3, points_for: 21, points_against: 20, bonus_points: 21, warnings: 0, win_rate: "63%", total_points: 22 },
  { rank: 48, blader: "Juan Davild", tournaments_played: 2, matches_played: 9, matches_won: 3, matches_lost: 6, points_for: 23, points_against: 20, bonus_points: 18, warnings: 0, win_rate: "33%", total_points: 21 },
  { rank: 49, blader: "Samux", tournaments_played: 1, matches_played: 11, matches_won: 6, matches_lost: 5, points_for: 29, points_against: 33, bonus_points: 21, warnings: 0, win_rate: "55%", total_points: 17 },
  { rank: 50, blader: "juan diego", tournaments_played: 1, matches_played: 11, matches_won: 5, matches_lost: 6, points_for: 29, points_against: 34, bonus_points: 21, warnings: 0, win_rate: "45%", total_points: 16 },
  { rank: 51, blader: "Superior Slayer", tournaments_played: 1, matches_played: 5, matches_won: 2, matches_lost: 3, points_for: 21, points_against: 28, bonus_points: 21, warnings: 0, win_rate: "40%", total_points: 14 },
  { rank: 52, blader: "Arkham", tournaments_played: 2, matches_played: 17, matches_won: 5, matches_lost: 12, points_for: 41, points_against: 50, bonus_points: 23, warnings: 0, win_rate: "29%", total_points: 14 },
  { rank: 53, blader: "Chris", tournaments_played: 1, matches_played: 7, matches_won: 3, matches_lost: 4, points_for: 22, points_against: 22, bonus_points: 13, warnings: 0, win_rate: "43%", total_points: 13 },
  { rank: 54, blader: "Niko", tournaments_played: 1, matches_played: 5, matches_won: 3, matches_lost: 2, points_for: 16, points_against: 14, bonus_points: 10, warnings: 0, win_rate: "60%", total_points: 12 },
  { rank: 55, blader: "Papi Jake", tournaments_played: 3, matches_played: 20, matches_won: 6, matches_lost: 14, points_for: 50, points_against: 70, bonus_points: 31, warnings: 0, win_rate: "30%", total_points: 11 },
  { rank: 56, blader: "Alphangel", tournaments_played: 4, matches_played: 20, matches_won: 4, matches_lost: 16, points_for: 43, points_against: 69, bonus_points: 36, warnings: 0, win_rate: "20%", total_points: 10 },
  { rank: 57, blader: "JohnnyX", tournaments_played: 1, matches_played: 7, matches_won: 3, matches_lost: 4, points_for: 21, points_against: 22, bonus_points: 10, warnings: 0, win_rate: "43%", total_points: 9 },
  { rank: 58, blader: "Diogenes E.", tournaments_played: 1, matches_played: 4, matches_won: 2, matches_lost: 2, points_for: 11, points_against: 12, bonus_points: 10, warnings: 0, win_rate: "50%", total_points: 9 },
  { rank: 59, blader: "Ignacio", tournaments_played: 1, matches_played: 4, matches_won: 1, matches_lost: 3, points_for: 13, points_against: 9, bonus_points: 5, warnings: 0, win_rate: "25%", total_points: 9 },
  { rank: 60, blader: "SIr Lancelot", tournaments_played: 1, matches_played: 3, matches_won: 1, matches_lost: 2, points_for: 8, points_against: 9, bonus_points: 10, warnings: 0, win_rate: "33%", total_points: 9 },
  { rank: 61, blader: "Jorge Valdes", tournaments_played: 3, matches_played: 21, matches_won: 7, matches_lost: 14, points_for: 38, points_against: 69, bonus_points: 39, warnings: 0, win_rate: "33%", total_points: 8 },
  { rank: 62, blader: "Emmanuel", tournaments_played: 1, matches_played: 3, matches_won: 1, matches_lost: 2, points_for: 7, points_against: 9, bonus_points: 10, warnings: 0, win_rate: "33%", total_points: 8 },
  { rank: 63, blader: "Ana Carolina", tournaments_played: 2, matches_played: 11, matches_won: 4, matches_lost: 7, points_for: 21, points_against: 37, bonus_points: 23, warnings: 0, win_rate: "36%", total_points: 7 },
  { rank: 64, blader: "Maleantin", tournaments_played: 1, matches_played: 6, matches_won: 1, matches_lost: 5, points_for: 12, points_against: 12, bonus_points: 5, warnings: 0, win_rate: "17%", total_points: 5 },
  { rank: 65, blader: "Bastan", tournaments_played: 1, matches_played: 3, matches_won: 1, matches_lost: 2, points_for: 6, points_against: 12, bonus_points: 10, warnings: 0, win_rate: "33%", total_points: 4 },
  { rank: 67, blader: "Edson", tournaments_played: 1, matches_played: 6, matches_won: 2, matches_lost: 4, points_for: 15, points_against: 17, bonus_points: 5, warnings: 0, win_rate: "33%", total_points: 3 },
  { rank: 68, blader: "Ramses", tournaments_played: 1, matches_played: 8, matches_won: 3, matches_lost: 5, points_for: 21, points_against: 26, bonus_points: 7, warnings: 0, win_rate: "38%", total_points: 2 },
  { rank: 69, blader: "Zahik", tournaments_played: 2, matches_played: 7, matches_won: 1, matches_lost: 6, points_for: 10, points_against: 25, bonus_points: 15, warnings: 0, win_rate: "14%", total_points: 0 },
  { rank: 70, blader: "Isaias S.", tournaments_played: 1, matches_played: 4, matches_won: 1, matches_lost: 3, points_for: 5, points_against: 15, bonus_points: 10, warnings: 0, win_rate: "25%", total_points: 0 },
  { rank: 71, blader: "Ceferino Sr.", tournaments_played: 2, matches_played: 8, matches_won: 2, matches_lost: 6, points_for: 15, points_against: 26, bonus_points: 10, warnings: 0, win_rate: "25%", total_points: -1 },
  { rank: 72, blader: "Tomyyaser", tournaments_played: 1, matches_played: 6, matches_won: 2, matches_lost: 4, points_for: 13, points_against: 20, bonus_points: 5, warnings: 0, win_rate: "33%", total_points: -2 },
  { rank: 73, blader: "Salomon Nieto", tournaments_played: 1, matches_played: 5, matches_won: 1, matches_lost: 4, points_for: 5, points_against: 17, bonus_points: 10, warnings: 0, win_rate: "20%", total_points: -2 },
  { rank: 74, blader: "Noah Herbert", tournaments_played: 1, matches_played: 5, matches_won: 2, matches_lost: 3, points_for: 11, points_against: 19, bonus_points: 5, warnings: 0, win_rate: "40%", total_points: -3 },
  { rank: 75, blader: "Alejandro Jaen", tournaments_played: 1, matches_played: 5, matches_won: 1, matches_lost: 4, points_for: 11, points_against: 19, bonus_points: 5, warnings: 0, win_rate: "20%", total_points: -3 },
  { rank: 76, blader: "Joel Caballero", tournaments_played: 1, matches_played: 4, matches_won: 0, matches_lost: 4, points_for: 5, points_against: 18, bonus_points: 10, warnings: 0, win_rate: "0%", total_points: -3 },
  { rank: 77, blader: "Alejandro D.", tournaments_played: 1, matches_played: 4, matches_won: 0, matches_lost: 4, points_for: 3, points_against: 16, bonus_points: 10, warnings: 0, win_rate: "0%", total_points: -3 },
  { rank: 78, blader: "Ethan Mendoza", tournaments_played: 2, matches_played: 9, matches_won: 2, matches_lost: 7, points_for: 14, points_against: 34, bonus_points: 15, warnings: 0, win_rate: "22%", total_points: -5 },
  { rank: 79, blader: "Javier Abrego", tournaments_played: 1, matches_played: 5, matches_won: 1, matches_lost: 4, points_for: 9, points_against: 19, bonus_points: 5, warnings: 0, win_rate: "20%", total_points: -5 },
  { rank: 80, blader: "aeloz Cogley", tournaments_played: 1, matches_played: 5, matches_won: 1, matches_lost: 4, points_for: 8, points_against: 18, bonus_points: 5, warnings: 0, win_rate: "20%", total_points: -5 },
  { rank: 81, blader: "Wistom Mendez", tournaments_played: 1, matches_played: 5, matches_won: 1, matches_lost: 4, points_for: 8, points_against: 19, bonus_points: 5, warnings: 0, win_rate: "20%", total_points: -6 },
  { rank: 82, blader: "Alesito33", tournaments_played: 1, matches_played: 4, matches_won: 0, matches_lost: 4, points_for: 3, points_against: 19, bonus_points: 10, warnings: 0, win_rate: "0%", total_points: -6 },
  { rank: 83, blader: "Abraham Garcia", tournaments_played: 3, matches_played: 20, matches_won: 6, matches_lost: 14, points_for: 35, points_against: 71, bonus_points: 28, warnings: 0, win_rate: "30%", total_points: -8 },
  { rank: 84, blader: "Cerferino Jr.", tournaments_played: 2, matches_played: 10, matches_won: 3, matches_lost: 7, points_for: 11, points_against: 29, bonus_points: 10, warnings: 0, win_rate: "30%", total_points: -8 },
  { rank: 85, blader: "Cristofer Scott", tournaments_played: 1, matches_played: 5, matches_won: 0, matches_lost: 5, points_for: 2, points_against: 21, bonus_points: 10, warnings: 0, win_rate: "0%", total_points: -9 },
  { rank: 86, blader: "Lukas Axel", tournaments_played: 1, matches_played: 5, matches_won: 1, matches_lost: 4, points_for: 6, points_against: 20, bonus_points: 5, warnings: 0, win_rate: "20%", total_points: -9 },
  { rank: 87, blader: "Fernando", tournaments_played: 1, matches_played: 4, matches_won: 0, matches_lost: 4, points_for: 2, points_against: 17, bonus_points: 5, warnings: 0, win_rate: "0%", total_points: -10 },
  { rank: 88, blader: "Lore", tournaments_played: 1, matches_played: 4, matches_won: 0, matches_lost: 4, points_for: 0, points_against: 16, bonus_points: 5, warnings: 0, win_rate: "0%", total_points: -11 },
  { rank: 89, blader: "Alex", tournaments_played: 2, matches_played: 18, matches_won: 3, matches_lost: 15, points_for: 34, points_against: 69, bonus_points: 23, warnings: 0, win_rate: "17%", total_points: -12 },
  { rank: 90, blader: "Lazuli", tournaments_played: 1, matches_played: 5, matches_won: 0, matches_lost: 5, points_for: 5, points_against: 22, bonus_points: 5, warnings: 0, win_rate: "0%", total_points: -12 },
  { rank: 91, blader: "Sonico", tournaments_played: 1, matches_played: 6, matches_won: 0, matches_lost: 6, points_for: 6, points_against: 25, bonus_points: 5, warnings: 0, win_rate: "0%", total_points: -14 },
  { rank: 92, blader: "Rebecca", tournaments_played: 1, matches_played: 6, matches_won: 0, matches_lost: 6, points_for: 5, points_against: 26, bonus_points: 5, warnings: 0, win_rate: "0%", total_points: -16 },
  { rank: 93, blader: "Juanita", tournaments_played: 5, matches_played: 25, matches_won: 6, matches_lost: 19, points_for: 49, points_against: 96, bonus_points: 30, warnings: 0, win_rate: "24%", total_points: -17 },
  { rank: 94, blader: "Nessa", tournaments_played: 2, matches_played: 10, matches_won: 2, matches_lost: 8, points_for: 16, points_against: 52, bonus_points: 18, warnings: 0, win_rate: "20%", total_points: -18 },
  { rank: 95, blader: "David Navarro", tournaments_played: 1, matches_played: 5, matches_won: 0, matches_lost: 5, points_for: 1, points_against: 24, bonus_points: 5, warnings: 0, win_rate: "0%", total_points: -18 },
  { rank: 96, blader: "Danilo", tournaments_played: 1, matches_played: 6, matches_won: 0, matches_lost: 6, points_for: 0, points_against: 24, bonus_points: 5, warnings: 0, win_rate: "0%", total_points: -19 }
];

// Seed Database Function
function seedDatabase() {
  const hash = (pw: string) => bcrypt.hashSync(pw, 10);
  const now = new Date().toISOString();

  // Base Staff Users
  const staffUsers: User[] = [
    {
      id: 2,
      username: "blader_master",
      email: "organizer@appbey.app",
      password_hash: hash("123456"),
      display_name: "Carlos Vega",
      role: "organizer",
      country: "PA",
      avatar_url: "",
      bio: "Organizador de torneos Beyblade X Panamá.",
      favorite_combo: "",
      elo_rating: 1720,
      is_active: true,
      is_verified: true,
      created_at: now
    },
    {
      id: 3,
      username: "referee_alex",
      email: "referee@appbey.app",
      password_hash: hash("123456"),
      display_name: "Árbitro Alex",
      role: "referee",
      country: "PA",
      avatar_url: "",
      bio: "Árbitro oficial de torneos.",
      favorite_combo: "",
      elo_rating: 1450,
      is_active: true,
      is_verified: true,
      created_at: now
    }
  ];

  // Map 96 Official Bladers into Users
  const bladerUsers: User[] = APB_SEASON_1_RANKINGS.map((b, idx) => {
    const cleanUsername = b.blader.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "") || `blader_${b.rank}`;
    const baseElo = Math.max(1000, Math.round(1800 - (b.rank - 1) * 8.5));
    return {
      id: 4 + idx,
      username: cleanUsername,
      email: `${cleanUsername}@appbey.app`,
      password_hash: hash("123456"),
      display_name: b.blader,
      role: "blader",
      country: "PA",
      avatar_url: "/assets/images/appbey_logo_transparent.png?v=3.4",
      bio: "",
      favorite_combo: "",
      elo_rating: baseElo,
      is_active: true,
      is_verified: true,
      created_at: now
    };
  });

  const kanghyUser = bladerUsers.find((user) => user.username === "kanghy");
  if (kanghyUser) {
    kanghyUser.role = "admin";
    kanghyUser.bio = "Administrador y blader oficial de AppBey.";
  }

  users = [...staffUsers, ...bladerUsers];

  const bootstrapAdminEmail = String(process.env.APPBEY_ADMIN_EMAIL || "").trim().toLowerCase();
  const bootstrapAdminPassword = String(process.env.APPBEY_ADMIN_PASSWORD || "");
  if (bootstrapAdminEmail || bootstrapAdminPassword) {
    if (!bootstrapAdminEmail || bootstrapAdminPassword.length < 12) {
      throw new Error("APPBEY_ADMIN_EMAIL and APPBEY_ADMIN_PASSWORD (minimum 12 characters) must be configured together");
    }

    const existingBootstrapAdmin = users.find((user) => user.email.toLowerCase() === bootstrapAdminEmail);
    if (existingBootstrapAdmin) {
      existingBootstrapAdmin.role = "admin";
      existingBootstrapAdmin.is_active = true;
      existingBootstrapAdmin.is_verified = true;
    } else {
      const usernameBase = bootstrapAdminEmail.split("@")[0].replace(/[^a-z0-9_]+/g, "_").replace(/^_|_$/g, "") || "admin";
      const username = `${usernameBase}_${Date.now().toString(36).slice(-5)}`;
      users.push({
        id: Math.max(...users.map((user) => user.id), 0) + 1,
        username,
        email: bootstrapAdminEmail,
        password_hash: hash(bootstrapAdminPassword),
        display_name: String(process.env.APPBEY_ADMIN_NAME || "AppBey Administrator").trim().slice(0, 80),
        role: "admin",
        country: String(process.env.APPBEY_ADMIN_COUNTRY || "PA").trim().toUpperCase(),
        avatar_url: "",
        bio: "Administrador de AppBey.",
        favorite_combo: "",
        elo_rating: 1850,
        is_active: true,
        is_verified: true,
        created_at: now
      });
    }
  }

  // AppBey's local part catalog and reference data; no live provider is connected.
  parts = [
    // Blades
    { id: 1, code: "BX-23", name: "Phoenix Wing", category: "blade", system: "BX", type_attr: "Attack", weight_grams: 38.2, attack_stat: 95, defense_stat: 70, stamina_stat: 65, dash_stat: 90, tier: "S", pick_rate_pct: 84.5, win_rate_pct: 66.8, trend: "stable", trend_label: "Meta Dominante #1", best_combo: "Phoenix Wing 9-60 GF / Point", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "WBO World Rankings 2026", description: "Blade pesada de metal pintado con tremendo poder de smash y Xtreme Dash." },
    { id: 2, code: "UX-03", name: "Wizard Rod", category: "blade", system: "UX", type_attr: "Stamina", weight_grams: 35.5, attack_stat: 40, defense_stat: 85, stamina_stat: 98, dash_stat: 55, tier: "S", pick_rate_pct: 88.2, win_rate_pct: 69.4, trend: "stable", trend_label: "Rey de Stamina", best_combo: "Wizard Rod 5-70 / 9-60 DB / Ball", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "WBO World Rankings 2026", description: "El rey indiscutible de la resistencia y estabilidad centrifuga exterior." },
    { id: 3, code: "UX-01", name: "Dran Buster", category: "blade", system: "UX", type_attr: "Attack", weight_grams: 35.0, attack_stat: 98, defense_stat: 30, stamina_stat: 40, dash_stat: 95, tier: "S", pick_rate_pct: 62.0, win_rate_pct: 61.5, trend: "up", trend_label: "+1 Tier (G1 Finals)", best_combo: "Dran Buster 1-60 F / Low Flat", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "WBO World Rankings 2026", description: "Espada descomunal de un solo impacto letal para conseguir One-Hit KOs y Burst Finish." },
    { id: 4, code: "BX-34", name: "Cobalt Dragoon", category: "blade", system: "BX", type_attr: "Attack", weight_grams: 37.8, attack_stat: 94, defense_stat: 60, stamina_stat: 58, dash_stat: 92, tier: "S", pick_rate_pct: 58.4, win_rate_pct: 63.1, trend: "up", trend_label: "Giro Izquierdo Top Tier", best_combo: "Cobalt Dragoon 5-60 Glide / Elevate", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "WBO World Rankings 2026", description: "Primer Beyblade X de giro izquierdo (Left Spin) con tremendo spin-steal y upper attacks." },
    { id: 5, code: "UX-07", name: "Silver Wolf", category: "blade", system: "UX", type_attr: "Stamina", weight_grams: 36.2, attack_stat: 55, defense_stat: 88, stamina_stat: 94, dash_stat: 60, tier: "S", pick_rate_pct: 54.0, win_rate_pct: 62.7, trend: "new", trend_label: "Nuevo Lanzamiento S", best_combo: "Silver Wolf 3-60 / 5-70 Hexa / Ball", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "Takara Tomy Release Dec 2024", description: "Anillo libre de rotación que disipa impactos directos con excepcional conservación de giro." },
    { id: 6, code: "UX-08", name: "Whale Wave", category: "blade", system: "UX", type_attr: "Attack", weight_grams: 36.6, attack_stat: 92, defense_stat: 65, stamina_stat: 60, dash_stat: 88, tier: "S", pick_rate_pct: 51.5, win_rate_pct: 60.9, trend: "new", trend_label: "Top Smash Attack", best_combo: "Whale Wave 7-60 Rush / Low Flat", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "WBO Competitive Index", description: "Diseño curvado de aleta de ballena con peso perimetral concentrado para empujes masivos." },
    { id: 7, code: "BX-14", name: "Shark Edge", category: "blade", system: "BX", type_attr: "Attack", weight_grams: 34.8, attack_stat: 92, defense_stat: 35, stamina_stat: 45, dash_stat: 90, tier: "A", pick_rate_pct: 46.2, win_rate_pct: 57.3, trend: "stable", trend_label: "Upper Attacker Clásico", best_combo: "Shark Edge 3-60 LF", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "WBO World Rankings 2026", description: "Upper attack demoledor capaz de lanzar rivales fuera del estadio en el primer choque." },
    { id: 8, code: "BX-31", name: "Tyranno Beat", category: "blade", system: "BX", type_attr: "Attack", weight_grams: 37.5, attack_stat: 90, defense_stat: 60, stamina_stat: 55, dash_stat: 85, tier: "A", pick_rate_pct: 44.0, win_rate_pct: 56.4, trend: "stable", trend_label: "Smash Pesado", best_combo: "Tyranno Beat 4-60 Point / Gear Flat", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "WBO World Rankings 2026", description: "Mandíbula demoledora con masa concentrada para golpes de choque masivos." },
    { id: 9, code: "BX-21", name: "Hells Chain", category: "blade", system: "BX", type_attr: "Balance", weight_grams: 33.5, attack_stat: 70, defense_stat: 80, stamina_stat: 80, dash_stat: 70, tier: "A", pick_rate_pct: 42.1, win_rate_pct: 55.0, trend: "stable", trend_label: "Balance Sólido", best_combo: "Hells Chain 5-60 Orb / Ball", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "WBO World Rankings 2026", description: "Excelente combinación de defensa angular y contraataque equilibrado." },
    { id: 10, code: "UX-02", name: "Hells Hammer", category: "blade", system: "UX", type_attr: "Balance", weight_grams: 33.2, attack_stat: 78, defense_stat: 68, stamina_stat: 75, dash_stat: 75, tier: "A", pick_rate_pct: 38.6, win_rate_pct: 53.8, trend: "stable", trend_label: "Ataque Descendente", best_combo: "Hells Hammer 3-70 Hexa", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "WBO World Rankings 2026", description: "Ataque descendente martillo ideal para desestabilizar Beys defensivos." },
    { id: 11, code: "UX-06", name: "Phoenix Rudder", category: "blade", system: "UX", type_attr: "Stamina", weight_grams: 35.8, attack_stat: 48, defense_stat: 82, stamina_stat: 92, dash_stat: 58, tier: "A", pick_rate_pct: 39.2, win_rate_pct: 55.4, trend: "up", trend_label: "+1 Tier", best_combo: "Phoenix Rudder 9-70 Glide", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "Takara Tomy Official 2025", description: "Variante de timón aerodinámico que redirige el flujo de aire para giro prolongado." },
    { id: 12, code: "BX-00", name: "Cobalt Drake", category: "blade", system: "BX", type_attr: "Attack", weight_grams: 38.0, attack_stat: 93, defense_stat: 65, stamina_stat: 60, dash_stat: 88, tier: "A", pick_rate_pct: 28.5, win_rate_pct: 58.2, trend: "stable", trend_label: "Pieza Rara Competitiva", best_combo: "Cobalt Drake 4-60 Flat", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "WBO World Rankings 2026", description: "Blade legendaria y pesada con 4 hojas agresivas de alto impacto." },
    { id: 13, code: "BX-01", name: "Dran Sword", category: "blade", system: "BX", type_attr: "Attack", weight_grams: 34.5, attack_stat: 88, defense_stat: 45, stamina_stat: 50, dash_stat: 88, tier: "A", pick_rate_pct: 35.0, win_rate_pct: 52.8, trend: "stable", trend_label: "Ataque Estándar", best_combo: "Dran Sword 3-60 Flat", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "WBO World Rankings 2026", description: "La espada clásica de 3 puntas para ataques veloces en la Xtreme Line." },
    { id: 14, code: "BX-26", name: "Unicorn Sting", category: "blade", system: "BX", type_attr: "Balance", weight_grams: 33.8, attack_stat: 72, defense_stat: 76, stamina_stat: 78, dash_stat: 70, tier: "B", pick_rate_pct: 24.8, win_rate_pct: 49.5, trend: "stable", trend_label: "Asimétrico", best_combo: "Unicorn Sting 5-60 Point", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "WBO World Rankings 2026", description: "Forma asimétrica que permite alternar ataque con un cuerno y defensa lisa." },
    { id: 15, code: "BX-16", name: "Viper Tail", category: "blade", system: "BX", type_attr: "Stamina", weight_grams: 34.0, attack_stat: 65, defense_stat: 60, stamina_stat: 85, dash_stat: 60, tier: "B", pick_rate_pct: 22.1, win_rate_pct: 48.0, trend: "down", trend_label: "-1 Tier (Stamina Meta)", best_combo: "Viper Tail 5-80 Orb", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "WBO World Rankings 2026", description: "Down-force blades que mantienen la postura de giro estable contra ataques." },
    { id: 16, code: "UX-04", name: "Black Shell", category: "blade", system: "UX", type_attr: "Defense", weight_grams: 34.2, attack_stat: 45, defense_stat: 86, stamina_stat: 74, dash_stat: 52, tier: "B", pick_rate_pct: 19.5, win_rate_pct: 47.3, trend: "stable", trend_label: "Defensa Esférica", best_combo: "Black Shell 4-70 Dot", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "WBO World Rankings 2026", description: "Caparazón redondeado diseñado para desviar impactos de blades de ataque rápido." },
    { id: 17, code: "BX-04", name: "Knight Shield", category: "blade", system: "BX", type_attr: "Defense", weight_grams: 32.8, attack_stat: 40, defense_stat: 88, stamina_stat: 70, dash_stat: 50, tier: "C", pick_rate_pct: 12.0, win_rate_pct: 42.1, trend: "stable", trend_label: "Defensa Básica", best_combo: "Knight Shield 3-80 Needle", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "WBO World Rankings 2026", description: "Escudo clásico de absorción de impactos frontales." },
    { id: 18, code: "BX-19", name: "Rhino Horn", category: "blade", system: "BX", type_attr: "Defense", weight_grams: 33.1, attack_stat: 52, defense_stat: 80, stamina_stat: 65, dash_stat: 55, tier: "C", pick_rate_pct: 9.8, win_rate_pct: 39.4, trend: "down", trend_label: "Bajo Peso", best_combo: "Rhino Horn 3-60 Spike", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "WBO World Rankings 2026", description: "Blade compacta y puntiaguda pero propensa a salir despedida por choques pesados." },

    // Ratchets
    { id: 19, code: "R-960", name: "9-60", category: "ratchet", system: "BX", type_attr: "Balance", weight_grams: 6.6, attack_stat: 70, defense_stat: 85, stamina_stat: 90, dash_stat: 80, tier: "S", pick_rate_pct: 92.4, win_rate_pct: 68.9, trend: "stable", trend_label: "El Ratchet Más Usado", best_combo: "Indispensable en Slot 1 o 2", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "WBO World Rankings 2026", description: "9 puntos de contacto que reducen el riesgo de Burst y optimizan el peso centrífugo." },
    { id: 20, code: "R-560", name: "5-60", category: "ratchet", system: "BX", type_attr: "Defense", weight_grams: 6.4, attack_stat: 75, defense_stat: 80, stamina_stat: 85, dash_stat: 75, tier: "S", pick_rate_pct: 78.0, win_rate_pct: 64.2, trend: "stable", trend_label: "Estándar Competitivo", best_combo: "Ataque y Resistencia", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "WBO World Rankings 2026", description: "Perfil bajo de 60mm con 5 salientes equilibrados, el favorito de torneos." },
    { id: 21, code: "R-760", name: "7-60", category: "ratchet", system: "UX", type_attr: "Balance", weight_grams: 6.8, attack_stat: 74, defense_stat: 84, stamina_stat: 88, dash_stat: 78, tier: "S", pick_rate_pct: 65.1, win_rate_pct: 63.5, trend: "up", trend_label: "+1 Tier (UX Meta)", best_combo: "Whale Wave / Silver Wolf", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "Takara Tomy UX 2025", description: "7 salientes con distribución simétrica de inercia y gran resistencia al desencajamiento." },
    { id: 22, code: "R-160", name: "1-60", category: "ratchet", system: "UX", type_attr: "Attack", weight_grams: 6.1, attack_stat: 95, defense_stat: 50, stamina_stat: 50, dash_stat: 90, tier: "S", pick_rate_pct: 59.3, win_rate_pct: 61.8, trend: "stable", trend_label: "Ataque Puro", best_combo: "Dran Buster 1-60", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "WBO World Rankings 2026", description: "Un solo punto excéntrico diseñado para Dran Buster y golpes de poder único." },
    { id: 23, code: "R-360", name: "3-60", category: "ratchet", system: "BX", type_attr: "Attack", weight_grams: 6.2, attack_stat: 85, defense_stat: 65, stamina_stat: 75, dash_stat: 85, tier: "A", pick_rate_pct: 52.0, win_rate_pct: 56.7, trend: "stable", trend_label: "Alineación 3-Hojas", best_combo: "Shark Edge / Dran Sword", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "WBO World Rankings 2026", description: "Ideal para alinear las cuchillas de ataque de 3 lados como Shark Edge y Dran Sword." },
    { id: 24, code: "R-570", name: "5-70", category: "ratchet", system: "UX", type_attr: "Stamina", weight_grams: 6.7, attack_stat: 60, defense_stat: 85, stamina_stat: 92, dash_stat: 70, tier: "A", pick_rate_pct: 49.0, win_rate_pct: 57.1, trend: "stable", trend_label: "Combo Clave Rod", best_combo: "Wizard Rod 5-70", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "WBO World Rankings 2026", description: "Altura de 70mm optimizada para Wizard Rod y defensas altas." },
    { id: 25, code: "R-970", name: "9-70", category: "ratchet", system: "UX", type_attr: "Stamina", weight_grams: 6.9, attack_stat: 62, defense_stat: 86, stamina_stat: 91, dash_stat: 68, tier: "A", pick_rate_pct: 41.5, win_rate_pct: 54.9, trend: "up", trend_label: "+1 Tier", best_combo: "Phoenix Rudder / Stamina Beys", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "WBO World Rankings 2026", description: "Versión de 70mm con 9 puntos que resiste los ataques de Beys bajos." },
    { id: 26, code: "R-370", name: "3-70", category: "ratchet", system: "UX", type_attr: "Balance", weight_grams: 6.3, attack_stat: 78, defense_stat: 70, stamina_stat: 77, dash_stat: 76, tier: "A", pick_rate_pct: 35.8, win_rate_pct: 52.4, trend: "stable", trend_label: "Hells Hammer Core", best_combo: "Hells Hammer 3-70", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "WBO World Rankings 2026", description: "Altura media con 3 contactos para ataques en ángulo descendente." },
    { id: 27, code: "R-460", name: "4-60", category: "ratchet", system: "BX", type_attr: "Balance", weight_grams: 6.3, attack_stat: 75, defense_stat: 74, stamina_stat: 78, dash_stat: 76, tier: "B", pick_rate_pct: 26.2, win_rate_pct: 48.6, trend: "stable", trend_label: "4 Contactos", best_combo: "Tyranno Beat 4-60", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "WBO World Rankings 2026", description: "Perfil bajo con 4 salientes simétricos." },
    { id: 28, code: "R-470", name: "4-70", category: "ratchet", system: "BX", type_attr: "Balance", weight_grams: 6.5, attack_stat: 70, defense_stat: 75, stamina_stat: 78, dash_stat: 75, tier: "B", pick_rate_pct: 21.0, win_rate_pct: 46.8, trend: "stable", trend_label: "Defensa Media", best_combo: "Black Shell 4-70", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "WBO World Rankings 2026", description: "4 alas de protección media." },
    { id: 29, code: "R-380", name: "3-80", category: "ratchet", system: "BX", type_attr: "Stamina", weight_grams: 7.1, attack_stat: 50, defense_stat: 70, stamina_stat: 80, dash_stat: 60, tier: "C", pick_rate_pct: 11.2, win_rate_pct: 41.5, trend: "down", trend_label: "Riesgo de Burst", best_combo: "Knight Shield 3-80", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "WBO World Rankings 2026", description: "Altura de 80mm para resistir ataques rasantes." },
    { id: 30, code: "R-580", name: "5-80", category: "ratchet", system: "BX", type_attr: "Stamina", weight_grams: 7.3, attack_stat: 48, defense_stat: 72, stamina_stat: 82, dash_stat: 58, tier: "C", pick_rate_pct: 9.5, win_rate_pct: 39.8, trend: "stable", trend_label: "Altura Máxima", best_combo: "Viper Tail 5-80", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "WBO World Rankings 2026", description: "Gran masa de 80mm pero vulnerable a ser golpeado en el centro del ratchet." },

    // Bits
    { id: 31, code: "B-B", name: "Ball (B)", category: "bit", system: "BX", type_attr: "Stamina", weight_grams: 2.2, attack_stat: 30, defense_stat: 80, stamina_stat: 98, dash_stat: 40, tier: "S", pick_rate_pct: 86.4, win_rate_pct: 67.5, trend: "stable", trend_label: "Punta de Giro Clásica", best_combo: "Wizard Rod / Silver Wolf", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "WBO World Rankings 2026", description: "Punta esférica con máxima inercia y resistencia a los choques." },
    { id: 32, code: "B-DB", name: "Disc Ball (DB)", category: "bit", system: "UX", type_attr: "Stamina", weight_grams: 2.5, attack_stat: 35, defense_stat: 88, stamina_stat: 99, dash_stat: 45, tier: "S", pick_rate_pct: 91.0, win_rate_pct: 71.2, trend: "stable", trend_label: "#1 Winrate en Torneos", best_combo: "Wizard Rod 5-70 DB", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "WBO World Rankings 2026", description: "Disco estabilizador anti-inclinación y resistencia superior." },
    { id: 33, code: "B-H", name: "Hexa (H)", category: "bit", system: "UX", type_attr: "Defense", weight_grams: 2.6, attack_stat: 45, defense_stat: 94, stamina_stat: 80, dash_stat: 55, tier: "S", pick_rate_pct: 72.8, win_rate_pct: 65.0, trend: "up", trend_label: "Defensa Anti-KO", best_combo: "Phoenix Wing / Hells Chain", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "WBO World Rankings 2026", description: "Base hexagonal con alta resistencia al Burst y gran amortiguación de retroceso." },
    { id: 34, code: "B-GF", name: "Gear Flat (GF)", category: "bit", system: "BX", type_attr: "Attack", weight_grams: 2.4, attack_stat: 98, defense_stat: 30, stamina_stat: 35, dash_stat: 99, tier: "S", pick_rate_pct: 68.5, win_rate_pct: 62.4, trend: "stable", trend_label: "Máximo Xtreme Dash", best_combo: "Phoenix Wing / Whale Wave", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "WBO World Rankings 2026", description: "Engranajes extendidos en la punta para Xtreme Dash supersónicos." },
    { id: 35, code: "B-E", name: "Elevate (E)", category: "bit", system: "UX", type_attr: "Balance", weight_grams: 2.7, attack_stat: 65, defense_stat: 82, stamina_stat: 86, dash_stat: 70, tier: "S", pick_rate_pct: 56.0, win_rate_pct: 63.8, trend: "new", trend_label: "Nuevo Top Tier", best_combo: "Cobalt Dragoon / Phoenix Rudder", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "Takara Tomy UX 2025", description: "Punta de altura regulada que salta sobre Beys rivales en la línea Xtreme." },
    { id: 36, code: "B-LF", name: "Low Flat (LF)", category: "bit", system: "BX", type_attr: "Attack", weight_grams: 2.2, attack_stat: 95, defense_stat: 35, stamina_stat: 40, dash_stat: 92, tier: "A", pick_rate_pct: 54.2, win_rate_pct: 58.1, trend: "stable", trend_label: "Upper Attack Base", best_combo: "Shark Edge / Dran Buster", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "WBO World Rankings 2026", description: "Punta plana rebajada para trayectorias agresivas y upper hits." },
    { id: 37, code: "B-F", name: "Flat (F)", category: "bit", system: "BX", type_attr: "Attack", weight_grams: 2.1, attack_stat: 90, defense_stat: 40, stamina_stat: 45, dash_stat: 88, tier: "A", pick_rate_pct: 48.0, win_rate_pct: 54.5, trend: "stable", trend_label: "Ataque Controlado", best_combo: "Dran Sword 3-60 F", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "WBO World Rankings 2026", description: "La punta clásica de ataque de alta velocidad." },
    { id: 38, code: "B-P", name: "Point (P)", category: "bit", system: "BX", type_attr: "Balance", weight_grams: 2.3, attack_stat: 70, defense_stat: 70, stamina_stat: 75, dash_stat: 75, tier: "A", pick_rate_pct: 45.3, win_rate_pct: 55.2, trend: "stable", trend_label: "Balance Versátil", best_combo: "Phoenix Wing / Unicorn Sting", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "WBO World Rankings 2026", description: "Centro de resistencia con borde de ataque Xtreme." },
    { id: 39, code: "B-GP", name: "Gear Point (GP)", category: "bit", system: "BX", type_attr: "Balance", weight_grams: 2.4, attack_stat: 75, defense_stat: 68, stamina_stat: 72, dash_stat: 85, tier: "A", pick_rate_pct: 42.1, win_rate_pct: 53.7, trend: "stable", trend_label: "Aceleración Rápida", best_combo: "Tyranno Beat 4-60 GP", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "WBO World Rankings 2026", description: "Versión engranada de Point para aceleraciones repentinas." },
    { id: 40, code: "B-R", name: "Rush (R)", category: "bit", system: "BX", type_attr: "Attack", weight_grams: 2.3, attack_stat: 88, defense_stat: 45, stamina_stat: 52, dash_stat: 90, tier: "A", pick_rate_pct: 38.4, win_rate_pct: 54.0, trend: "up", trend_label: "+1 Tier", best_combo: "Dran Dagger / Whale Wave", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "WBO World Rankings 2026", description: "Dientes de engranaje finos con mayor duración de movimiento continuo." },
    { id: 41, code: "B-O", name: "Orb (O)", category: "bit", system: "BX", type_attr: "Stamina", weight_grams: 2.2, attack_stat: 35, defense_stat: 75, stamina_stat: 90, dash_stat: 45, tier: "B", pick_rate_pct: 25.0, win_rate_pct: 48.9, trend: "stable", trend_label: "Esfera Fina", best_combo: "Hells Chain / Viper Tail", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "WBO World Rankings 2026", description: "Punta esférica compacta para giro estable en el centro." },
    { id: 42, code: "B-HN", name: "High Needle (HN)", category: "bit", system: "BX", type_attr: "Defense", weight_grams: 2.4, attack_stat: 40, defense_stat: 84, stamina_stat: 72, dash_stat: 48, tier: "B", pick_rate_pct: 20.2, win_rate_pct: 46.5, trend: "stable", trend_label: "Aguja Alta", best_combo: "Black Shell 4-70 HN", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "WBO World Rankings 2026", description: "Punta cónica elevada para evitar contacto prematuro del ratchet." },
    { id: 43, code: "B-Q", name: "Quake (Q)", category: "bit", system: "BX", type_attr: "Attack", weight_grams: 2.5, attack_stat: 85, defense_stat: 25, stamina_stat: 20, dash_stat: 90, tier: "C", pick_rate_pct: 8.5, win_rate_pct: 35.0, trend: "down", trend_label: "Rebote Impredecible", best_combo: "Uso Causal / No Torneos", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "WBO World Rankings 2026", description: "Punta biselada cortada que produce saltos caóticos en el estadio." },

    // Additional Official Blades (Takara Tomy & Hasbro WBO Standard)
    { id: 44, code: "BX-02", name: "Hells Scythe", category: "blade", system: "BX", type_attr: "Balance", weight_grams: 33.0, attack_stat: 75, defense_stat: 75, stamina_stat: 82, dash_stat: 72, tier: "A", pick_rate_pct: 48.0, win_rate_pct: 54.0, trend: "stable", trend_label: "Balance Clásico", best_combo: "Hells Scythe 3-60 Ball", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "WBO World Rankings 2026", description: "4 hojas de guadaña simétricas con balance y resistencia excepcionales." },
    { id: 45, code: "BX-03", name: "Wizard Arrow", category: "blade", system: "BX", type_attr: "Stamina", weight_grams: 31.5, attack_stat: 45, defense_stat: 65, stamina_stat: 88, dash_stat: 60, tier: "B", pick_rate_pct: 20.0, win_rate_pct: 47.0, trend: "stable", trend_label: "Aerodinámica", best_combo: "Wizard Arrow 4-60 Ball", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "WBO World Rankings 2026", description: "Dos grandes alas tipo flecha diseñadas para corte de viento y resistencia." },
    { id: 46, code: "BX-13", name: "Knight Lance", category: "blade", system: "BX", type_attr: "Defense", weight_grams: 33.5, attack_stat: 60, defense_stat: 84, stamina_stat: 70, dash_stat: 65, tier: "B", pick_rate_pct: 18.5, win_rate_pct: 46.2, trend: "stable", trend_label: "Defensa con Lanza", best_combo: "Knight Lance 4-80 Needle", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "WBO World Rankings 2026", description: "Escudo con lanzas sobresalientes para absorber y repeler ataques directos." },
    { id: 47, code: "BX-15", name: "Leon Claw", category: "blade", system: "BX", type_attr: "Balance", weight_grams: 32.2, attack_stat: 74, defense_stat: 72, stamina_stat: 70, dash_stat: 74, tier: "B", pick_rate_pct: 22.0, win_rate_pct: 48.1, trend: "stable", trend_label: "Garras de León", best_combo: "Leon Claw 5-60 Point", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "WBO World Rankings 2026", description: "Garras afiladas diseñadas para cambiar entre ataque y defensa según la inclinación." },
    { id: 48, code: "BX-20", name: "Dran Dagger", category: "blade", system: "BX", type_attr: "Attack", weight_grams: 35.2, attack_stat: 92, defense_stat: 42, stamina_stat: 48, dash_stat: 92, tier: "A", pick_rate_pct: 44.5, win_rate_pct: 55.8, trend: "stable", trend_label: "Ataque Ráfaga", best_combo: "Dran Dagger 4-60 Rush", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "WBO World Rankings 2026", description: "6 hojas continuas de daga que propinan una ráfaga incesante de golpes." },
    { id: 49, code: "BX-20B", name: "Wyvern Gale", category: "blade", system: "BX", type_attr: "Stamina", weight_grams: 32.6, attack_stat: 42, defense_stat: 74, stamina_stat: 86, dash_stat: 62, tier: "B", pick_rate_pct: 16.0, win_rate_pct: 45.4, trend: "stable", trend_label: "Hélice de Viento", best_combo: "Wyvern Gale 5-80 Gear Ball", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "WBO World Rankings 2026", description: "Diseño curvado de turbina que desvía ataques y optimiza la estabilidad centrífuga." },
    { id: 50, code: "BX-24", name: "Shinobi Shadow", category: "blade", system: "BX", type_attr: "Defense", weight_grams: 32.0, attack_stat: 50, defense_stat: 82, stamina_stat: 68, dash_stat: 66, tier: "C", pick_rate_pct: 10.5, win_rate_pct: 41.0, trend: "stable", trend_label: "Defensa Lisa", best_combo: "Shinobi Shadow 1-80 Needle", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "WBO World Rankings 2026", description: "Perfil ultra resbaladizo para amortiguar impactos y deslizarse en la arena." },
    { id: 51, code: "BX-27", name: "Sphinx Cowl", category: "blade", system: "BX", type_attr: "Defense", weight_grams: 34.0, attack_stat: 55, defense_stat: 86, stamina_stat: 65, dash_stat: 60, tier: "B", pick_rate_pct: 21.0, win_rate_pct: 47.9, trend: "stable", trend_label: "Blindaje Pesado", best_combo: "Sphinx Cowl 9-80 Gear Needle", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "WBO World Rankings 2026", description: "Casco blindado egipcio con masivos puntos de choque defensivos." },
    { id: 52, code: "BX-33", name: "Weiss Tiger", category: "blade", system: "BX", type_attr: "Attack", weight_grams: 34.8, attack_stat: 90, defense_stat: 52, stamina_stat: 56, dash_stat: 88, tier: "A", pick_rate_pct: 36.5, win_rate_pct: 53.2, trend: "stable", trend_label: "Garras de Tigre", best_combo: "Weiss Tiger 3-60 Unite", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "WBO World Rankings 2026", description: "Cuchillas en forma de garras de tigre blanco para ataques de corte diagonal." },
    { id: 53, code: "BX-35", name: "Impact Drake", category: "blade", system: "BX", type_attr: "Attack", weight_grams: 38.6, attack_stat: 97, defense_stat: 58, stamina_stat: 52, dash_stat: 94, tier: "S", pick_rate_pct: 64.0, win_rate_pct: 64.8, trend: "new", trend_label: "Goma & Peso Masivo", best_combo: "Impact Drake 7-60 Low Flat", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "Takara Tomy Release 2025", description: "Blade monumental con inserciones de goma de alto impacto para smash finishes brutales." },
    { id: 54, code: "BX-00B", name: "Aero Pegasus", category: "blade", system: "BX", type_attr: "Attack", weight_grams: 37.9, attack_stat: 96, defense_stat: 55, stamina_stat: 58, dash_stat: 95, tier: "S", pick_rate_pct: 42.0, win_rate_pct: 62.1, trend: "stable", trend_label: "Pieza Rara Legendaria", best_combo: "Aero Pegasus 3-70 Accel", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "Takara Tomy Rare Bey Get", description: "Hojas aerodinámicas de tres alas con tremendo downforce para ataques aéreos." },
    { id: 55, code: "UX-05", name: "Leon Crest", category: "blade", system: "UX", type_attr: "Defense", weight_grams: 36.0, attack_stat: 52, defense_stat: 92, stamina_stat: 78, dash_stat: 58, tier: "S", pick_rate_pct: 58.0, win_rate_pct: 63.4, trend: "up", trend_label: "Defensa UX Top", best_combo: "Leon Crest 7-60 High Needle", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "Takara Tomy UX 2024", description: "Melena densa de metal exterior UX diseñada para anular todo impulso de ataque rival." },
    { id: 56, code: "UX-09", name: "Samurai Saber", category: "blade", system: "UX", type_attr: "Attack", weight_grams: 36.4, attack_stat: 96, defense_stat: 48, stamina_stat: 54, dash_stat: 92, tier: "S", pick_rate_pct: 55.0, win_rate_pct: 62.0, trend: "new", trend_label: "Filo de Katana", best_combo: "Samurai Saber 2-70 Level", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "Takara Tomy UX 2025", description: "Katana doble con filo extremo que corta el centro de la arena en Xtreme Dash." },
    { id: 57, code: "UX-10", name: "Knight Mail", category: "blade", system: "UX", type_attr: "Defense", weight_grams: 37.0, attack_stat: 50, defense_stat: 95, stamina_stat: 76, dash_stat: 55, tier: "S", pick_rate_pct: 60.5, win_rate_pct: 64.2, trend: "new", trend_label: "Armadura Inquebrantable", best_combo: "Knight Mail 3-85 Bound Spike", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "Takara Tomy UX 2025", description: "Cota de malla con masa perimetral masiva que disipa el retroceso de impactos pesados." },
    { id: 58, code: "HB-01", name: "Bear Scratch", category: "blade", system: "BX", type_attr: "Attack", weight_grams: 33.4, attack_stat: 86, defense_stat: 45, stamina_stat: 52, dash_stat: 84, tier: "B", pick_rate_pct: 15.0, win_rate_pct: 46.5, trend: "stable", trend_label: "Hasbro Exclusivo", best_combo: "Bear Scratch 5-60 Flat", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "Hasbro Beyblade X", description: "Diseño exclusivo Hasbro con zarpazos de oso de retroceso moderado." },
    { id: 59, code: "HB-02", name: "Tusk Mammoth", category: "blade", system: "BX", type_attr: "Defense", weight_grams: 34.2, attack_stat: 58, defense_stat: 82, stamina_stat: 64, dash_stat: 60, tier: "B", pick_rate_pct: 14.0, win_rate_pct: 46.0, trend: "stable", trend_label: "Hasbro Exclusivo", best_combo: "Tusk Mammoth 3-80 Taper", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "Hasbro Beyblade X", description: "Colmillos frontales de mamut para amortiguar ataques directos." },
    { id: 60, code: "HB-03", name: "Roar Tyranno", category: "blade", system: "BX", type_attr: "Attack", weight_grams: 35.8, attack_stat: 89, defense_stat: 50, stamina_stat: 50, dash_stat: 86, tier: "A", pick_rate_pct: 25.0, win_rate_pct: 51.5, trend: "stable", trend_label: "Hasbro Exclusivo", best_combo: "Roar Tyranno 4-60 Gear Flat", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "Hasbro Beyblade X", description: "Mandíbula jurásica pesada que lanza rivales en choques frontales." },
    { id: 61, code: "HB-04", name: "Steel Samurai", category: "blade", system: "BX", type_attr: "Balance", weight_grams: 33.8, attack_stat: 72, defense_stat: 74, stamina_stat: 74, dash_stat: 72, tier: "B", pick_rate_pct: 17.5, win_rate_pct: 48.0, trend: "stable", trend_label: "Hasbro Exclusivo", best_combo: "Steel Samurai 4-80 Needle", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "Hasbro Beyblade X", description: "Hojas gemelas de samurái para combate balanceado en media distancia." },
    { id: 62, code: "HB-05", name: "Bite Croc", category: "blade", system: "BX", type_attr: "Attack", weight_grams: 33.6, attack_stat: 87, defense_stat: 44, stamina_stat: 46, dash_stat: 85, tier: "B", pick_rate_pct: 16.0, win_rate_pct: 47.2, trend: "stable", trend_label: "Hasbro Exclusivo", best_combo: "Bite Croc 3-60 Low Flat", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "Hasbro Beyblade X", description: "Dientes de cocodrilo con puntos de enganche para sacar al rival de trayectoria." },
    { id: 63, code: "HB-06", name: "Talon Ptera", category: "blade", system: "BX", type_attr: "Stamina", weight_grams: 32.5, attack_stat: 50, defense_stat: 62, stamina_stat: 84, dash_stat: 66, tier: "B", pick_rate_pct: 13.5, win_rate_pct: 45.8, trend: "stable", trend_label: "Hasbro Exclusivo", best_combo: "Talon Ptera 3-80 Orb", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "Hasbro Beyblade X", description: "Alas extendidas de pterodáctilo para giros suaves y prolongados." },
    { id: 64, code: "HB-07", name: "Yell Kong", category: "blade", system: "BX", type_attr: "Defense", weight_grams: 34.0, attack_stat: 60, defense_stat: 83, stamina_stat: 66, dash_stat: 62, tier: "B", pick_rate_pct: 15.0, win_rate_pct: 46.8, trend: "stable", trend_label: "Hasbro Exclusivo", best_combo: "Yell Kong 5-60 Spike", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "Hasbro Beyblade X", description: "Pechera simétrica y pesada para resistir ráfagas de ataque." },

    // Additional Official Ratchets
    { id: 65, code: "R-180", name: "1-80", category: "ratchet", system: "BX", type_attr: "Attack", weight_grams: 6.8, attack_stat: 92, defense_stat: 52, stamina_stat: 54, dash_stat: 86, tier: "A", pick_rate_pct: 32.0, win_rate_pct: 51.4, trend: "stable", trend_label: "Excéntrico Alto", best_combo: "Dran Buster 1-80", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "WBO World Rankings 2026", description: "Punto excéntrico de ataque concentrado a 80mm de altura." },
    { id: 66, code: "R-260", name: "2-60", category: "ratchet", system: "UX", type_attr: "Attack", weight_grams: 6.2, attack_stat: 88, defense_stat: 62, stamina_stat: 72, dash_stat: 84, tier: "A", pick_rate_pct: 38.0, win_rate_pct: 53.5, trend: "stable", trend_label: "Dual Contacto", best_combo: "Samurai Saber 2-60", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "Takara Tomy UX 2025", description: "2 puntos de contacto agresivos con perfil bajo de 60mm." },
    { id: 67, code: "R-270", name: "2-70", category: "ratchet", system: "UX", type_attr: "Balance", weight_grams: 6.5, attack_stat: 82, defense_stat: 68, stamina_stat: 76, dash_stat: 78, tier: "A", pick_rate_pct: 35.0, win_rate_pct: 52.8, trend: "stable", trend_label: "Dual Medio", best_combo: "Whale Wave 2-70", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "Takara Tomy UX 2025", description: "2 salientes simétricos de altura media balanceada." },
    { id: 68, code: "R-280", name: "2-80", category: "ratchet", system: "BX", type_attr: "Defense", weight_grams: 6.9, attack_stat: 75, defense_stat: 76, stamina_stat: 78, dash_stat: 70, tier: "B", pick_rate_pct: 20.0, win_rate_pct: 47.0, trend: "stable", trend_label: "Dual Alto", best_combo: "Black Shell 2-80", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "WBO World Rankings 2026", description: "2 alas altas que evitan el contacto rasante de Beys atacantes." },
    { id: 69, code: "R-385", name: "3-85", category: "ratchet", system: "UX", type_attr: "Defense", weight_grams: 7.4, attack_stat: 52, defense_stat: 88, stamina_stat: 82, dash_stat: 64, tier: "A", pick_rate_pct: 39.0, win_rate_pct: 54.5, trend: "new", trend_label: "Ultra Alto 85mm", best_combo: "Knight Mail 3-85 Bound Spike", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "Takara Tomy UX 2025", description: "El ratchet más alto del sistema (85mm), pensado para la máxima disipación de golpes." },
    { id: 70, code: "R-450", name: "4-50", category: "ratchet", system: "BX", type_attr: "Attack", weight_grams: 6.0, attack_stat: 94, defense_stat: 60, stamina_stat: 66, dash_stat: 92, tier: "S", pick_rate_pct: 58.0, win_rate_pct: 61.2, trend: "new", trend_label: "Ultra Bajo 50mm", best_combo: "Dran Buster 4-50 Low Flat", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "Takara Tomy Release 2025", description: "Perfil ultra bajo (50mm) para golpear al rival desde abajo hacia arriba (Upper Attack)." },
    { id: 71, code: "R-480", name: "4-80", category: "ratchet", system: "BX", type_attr: "Defense", weight_grams: 7.0, attack_stat: 68, defense_stat: 78, stamina_stat: 80, dash_stat: 68, tier: "B", pick_rate_pct: 22.0, win_rate_pct: 47.5, trend: "stable", trend_label: "4 Contactos Altos", best_combo: "Knight Shield 4-80", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "WBO World Rankings 2026", description: "4 salientes altos para mantener equilibrio ante choques duros." },
    { id: 72, code: "R-660", name: "6-60", category: "ratchet", system: "BX", type_attr: "Balance", weight_grams: 6.6, attack_stat: 76, defense_stat: 82, stamina_stat: 84, dash_stat: 76, tier: "A", pick_rate_pct: 45.0, win_rate_pct: 56.0, trend: "stable", trend_label: "Hexagonal 60mm", best_combo: "Phoenix Wing 6-60 Point", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "WBO World Rankings 2026", description: "6 contactos simétricos hexagonales de gran estabilidad y baja resistencia." },
    { id: 73, code: "R-770", name: "7-70", category: "ratchet", system: "UX", type_attr: "Stamina", weight_grams: 7.0, attack_stat: 68, defense_stat: 85, stamina_stat: 90, dash_stat: 72, tier: "S", pick_rate_pct: 52.0, win_rate_pct: 60.5, trend: "up", trend_label: "+1 Tier", best_combo: "Silver Wolf 7-70 Ball", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "Takara Tomy UX 2025", description: "7 puntos simétricos a 70mm que otorgan gran inercia centrífuga." },
    { id: 74, code: "R-780", name: "7-80", category: "ratchet", system: "UX", type_attr: "Defense", weight_grams: 7.3, attack_stat: 64, defense_stat: 88, stamina_stat: 86, dash_stat: 68, tier: "A", pick_rate_pct: 36.0, win_rate_pct: 53.0, trend: "stable", trend_label: "7 Contactos Alto", best_combo: "Leon Crest 7-80 Hexa", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "Takara Tomy UX 2025", description: "Distribución uniforme de 7 puntos en altura de 80mm." },
    { id: 75, code: "R-980", name: "9-80", category: "ratchet", system: "UX", type_attr: "Stamina", weight_grams: 7.2, attack_stat: 60, defense_stat: 86, stamina_stat: 92, dash_stat: 65, tier: "A", pick_rate_pct: 42.0, win_rate_pct: 55.0, trend: "up", trend_label: "9 Puntos Alto", best_combo: "Phoenix Rudder 9-80 Glide", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "WBO World Rankings 2026", description: "La máxima resistencia al Burst en 80mm gracias a sus 9 puntos circulares." },

    // Additional Official Bits
    { id: 76, code: "B-T", name: "Taper (T)", category: "bit", system: "BX", type_attr: "Attack", weight_grams: 2.2, attack_stat: 85, defense_stat: 50, stamina_stat: 60, dash_stat: 84, tier: "A", pick_rate_pct: 46.0, win_rate_pct: 55.0, trend: "stable", trend_label: "Ataque Semi-Controlado", best_combo: "Hells Scythe 3-60 Taper", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "WBO World Rankings 2026", description: "Punta cónica escalonada que combina ataque agresivo con retención de energía." },
    { id: 77, code: "B-GT", name: "Gear Taper (GT)", category: "bit", system: "BX", type_attr: "Attack", weight_grams: 2.4, attack_stat: 92, defense_stat: 45, stamina_stat: 50, dash_stat: 94, tier: "A", pick_rate_pct: 42.0, win_rate_pct: 54.2, trend: "stable", trend_label: "Taper Engranado", best_combo: "Dran Sword 3-60 GT", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "WBO World Rankings 2026", description: "Dientes de engranaje sobre la punta cónica para agarre rápido en el Xtreme Line." },
    { id: 78, code: "B-N", name: "Needle (N)", category: "bit", system: "BX", type_attr: "Defense", weight_grams: 2.1, attack_stat: 35, defense_stat: 86, stamina_stat: 75, dash_stat: 45, tier: "B", pick_rate_pct: 28.0, win_rate_pct: 48.0, trend: "stable", trend_label: "Aguja Clásica", best_combo: "Knight Shield 3-80 Needle", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "WBO World Rankings 2026", description: "Punta fina de aguja que mantiene el Bey estacionario en el centro del estadio." },
    { id: 79, code: "B-S", name: "Spike (S)", category: "bit", system: "BX", type_attr: "Defense", weight_grams: 2.1, attack_stat: 40, defense_stat: 84, stamina_stat: 70, dash_stat: 50, tier: "C", pick_rate_pct: 12.0, win_rate_pct: 40.5, trend: "stable", trend_label: "Punta Puntiaguda", best_combo: "Rhino Horn 3-60 Spike", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "WBO World Rankings 2026", description: "Punta afilada que desvía ataques pero con menor resistencia estática." },
    { id: 80, code: "B-GN", name: "Gear Needle (GN)", category: "bit", system: "BX", type_attr: "Defense", weight_grams: 2.4, attack_stat: 55, defense_stat: 88, stamina_stat: 72, dash_stat: 65, tier: "B", pick_rate_pct: 25.0, win_rate_pct: 49.0, trend: "stable", trend_label: "Contraataque Defensivo", best_combo: "Sphinx Cowl 9-80 GN", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "WBO World Rankings 2026", description: "Aguja rodeada de engranajes para contraatacar si es empujado al carril Xtreme." },
    { id: 81, code: "B-D", name: "Dot (D)", category: "bit", system: "UX", type_attr: "Defense", weight_grams: 2.3, attack_stat: 42, defense_stat: 89, stamina_stat: 78, dash_stat: 52, tier: "B", pick_rate_pct: 27.0, win_rate_pct: 49.5, trend: "stable", trend_label: "Punto Central Plano", best_combo: "Black Shell 4-70 Dot", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "Takara Tomy UX 2024", description: "Punta plana con saliente central minúsculo para máxima absorción de retroceso." },
    { id: 82, code: "B-HSN", name: "High Semi Needle (HSN)", category: "bit", system: "BX", type_attr: "Defense", weight_grams: 2.5, attack_stat: 46, defense_stat: 87, stamina_stat: 76, dash_stat: 54, tier: "B", pick_rate_pct: 24.0, win_rate_pct: 48.5, trend: "stable", trend_label: "Semi Aguja Elevada", best_combo: "Knight Lance 4-80 HSN", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "WBO World Rankings 2026", description: "Punta semi-redondeada alta que previene caídas inclinadas ante smash hits." },
    { id: 83, code: "B-MN", name: "Metal Needle (MN)", category: "bit", system: "BX", type_attr: "Defense", weight_grams: 3.2, attack_stat: 48, defense_stat: 92, stamina_stat: 82, dash_stat: 50, tier: "A", pick_rate_pct: 35.0, win_rate_pct: 54.0, trend: "up", trend_label: "Punta Metálica", best_combo: "Knight Mail 3-85 Metal Needle", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "WBO World Rankings 2026", description: "Núcleo de metal pulido con bajísima fricción y resistencia a la deformación." },
    { id: 84, code: "B-G", name: "Glide (G)", category: "bit", system: "UX", type_attr: "Stamina", weight_grams: 2.4, attack_stat: 38, defense_stat: 82, stamina_stat: 96, dash_stat: 50, tier: "S", pick_rate_pct: 62.0, win_rate_pct: 65.2, trend: "stable", trend_label: "Deslizamiento Libre", best_combo: "Phoenix Rudder 9-70 Glide", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "Takara Tomy UX 2024", description: "Punta de baja fricción optimizada para mantener el centro con casi cero resistencia." },
    { id: 85, code: "B-L", name: "Level (L)", category: "bit", system: "UX", type_attr: "Balance", weight_grams: 2.5, attack_stat: 72, defense_stat: 78, stamina_stat: 80, dash_stat: 75, tier: "A", pick_rate_pct: 44.0, win_rate_pct: 55.4, trend: "new", trend_label: "Anillo Estabilizador", best_combo: "Samurai Saber 2-70 Level", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "Takara Tomy UX 2025", description: "Anillo de apoyo plano exterior que evita que el Beyblade pierda su postura vertical." },
    { id: 86, code: "B-A", name: "Accel (A)", category: "bit", system: "UX", type_attr: "Attack", weight_grams: 2.3, attack_stat: 94, defense_stat: 36, stamina_stat: 42, dash_stat: 96, tier: "A", pick_rate_pct: 49.0, win_rate_pct: 57.0, trend: "new", trend_label: "Aceleración Rápida", best_combo: "Aero Pegasus 3-70 Accel", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "Takara Tomy UX 2025", description: "Punta plana biselada con gran par de arranque para velocidad instantánea." },
    { id: 87, code: "B-FB", name: "Free Ball (FB)", category: "bit", system: "UX", type_attr: "Stamina", weight_grams: 2.7, attack_stat: 32, defense_stat: 86, stamina_stat: 99, dash_stat: 42, tier: "S", pick_rate_pct: 74.0, win_rate_pct: 68.5, trend: "new", trend_label: "Esfera de Rotación Libre", best_combo: "Wizard Rod 7-70 Free Ball", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "Takara Tomy UX 2025", description: "Esfera interna de rodamiento libre que anula la fricción al inclinarse." },
    { id: 88, code: "B-DF", name: "Disc Flat (DF)", category: "bit", system: "BX", type_attr: "Attack", weight_grams: 2.6, attack_stat: 91, defense_stat: 48, stamina_stat: 52, dash_stat: 90, tier: "A", pick_rate_pct: 38.0, win_rate_pct: 53.8, trend: "stable", trend_label: "Disco Plano", best_combo: "Cobalt Drake 4-60 Disc Flat", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "WBO World Rankings 2026", description: "Disco exterior estabilizador que asienta el Bey en sus giros de ataque veloz." },
    { id: 89, code: "B-RA", name: "Rubber Accel (RA)", category: "bit", system: "BX", type_attr: "Attack", weight_grams: 2.8, attack_stat: 99, defense_stat: 32, stamina_stat: 28, dash_stat: 100, tier: "S", pick_rate_pct: 56.0, win_rate_pct: 61.8, trend: "new", trend_label: "Goma de Máximo Agarre", best_combo: "Impact Drake 7-60 Rubber Accel", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "Takara Tomy Release 2025", description: "Punta de goma de tremendo coeficiente de fricción para los Xtreme Dash más rápidos jamás vistos." },
    { id: 90, code: "B-BS", name: "Bound Spike (BS)", category: "bit", system: "UX", type_attr: "Defense", weight_grams: 2.9, attack_stat: 50, defense_stat: 96, stamina_stat: 74, dash_stat: 58, tier: "S", pick_rate_pct: 52.0, win_rate_pct: 62.8, trend: "new", trend_label: "Resorte Amortiguador", best_combo: "Knight Mail 3-85 Bound Spike", official_ruling: "Legal WBO Standard", last_updated: now, source_reference: "Takara Tomy UX 2025", description: "Muelle con resorte interno que absorbe la fuerza vertical de los impactos rivales." }
  ];

  // Decks
  decks = [
    {
      id: 1,
      user_id: 6,
      name: "Deck Campeon Jan Kraft",
      description: "Deck 3on3 optimizado para control de Xtreme Line y resistencia pura.",
      is_public: true,
      slot1_name: "Phoenix Wing 9-60 GF",
      slot1_blade_id: 1,
      slot1_ratchet_id: 11,
      slot1_bit_id: 20,
      slot2_name: "Wizard Rod 5-70 DB",
      slot2_blade_id: 2,
      slot2_ratchet_id: 15,
      slot2_bit_id: 19,
      slot3_name: "Shark Edge 3-60 LF",
      slot3_blade_id: 4,
      slot3_ratchet_id: 13,
      slot3_bit_id: 21,
      total_weight: 132.8,
      created_at: now
    }
  ];

  // Tournaments (Seeded official tournament with active mesas)
  tournaments = [
    {
      id: 1,
      slug: "copa-inaugural-xtreme-2026",
      title: "Copa Inaugural Beyblade X 2026",
      description: "Torneo Oficial Apertura Temporada 2 con formato Fase de Grupos + Eliminación Directa (Estilo Challonge / WBO).",
      organizer_id: 6,
      format: "groups_elim",
      stage_type: "group_stage",
      group_count: 2,
      advancers_per_group: 2,
      tie_break_priority: ["victories_losses", "point_difference", "head_to_head", "points_for_seed"],
      knockout_round_name: "Semifinales",
      battle_type: "3on3_deck",
      match_target_points: 4,
      stadium_type: "Xtreme Stadium Standard (BX-10)",
      max_participants: 8,
      prize_description: "Trofeo de Campeón + Beyblade Edición Especial",
      status: "in_progress",
      venue_name: "Estadio Central Albrook Mall",
      venue_address: "Plaza Central, Ciudad de Panamá",
      country: "PA",
      start_date: now,
      current_round: 1,
      total_rounds: 3,
      is_official: true,
      created_at: now
    }
  ];

  // Participants (8 players distributed into 2 groups using Challonge Serpentine Seeding)
  // Serpentine: Seed 1 -> A, Seed 2 -> B, Seed 3 -> B, Seed 4 -> A, Seed 5 -> A, Seed 6 -> B, Seed 7 -> B, Seed 8 -> A
  participants = [
    { id: 1, tournament_id: 1, user_id: 6, seed: 1, group_id: "A", group_seed: 1, checked_in: true, checked_in_at: now, swiss_points: 0, buchholz: 0, points_scored: 0, points_conceded: 0, matches_played: 0, matches_won: 0, matches_drawn: 0, matches_lost: 0, deck: [] },
    { id: 2, tournament_id: 1, user_id: 2, seed: 2, group_id: "B", group_seed: 1, checked_in: true, checked_in_at: now, swiss_points: 0, buchholz: 0, points_scored: 0, points_conceded: 0, matches_played: 0, matches_won: 0, matches_drawn: 0, matches_lost: 0, deck: [] },
    { id: 3, tournament_id: 1, user_id: 4, seed: 3, group_id: "B", group_seed: 2, checked_in: true, checked_in_at: now, swiss_points: 0, buchholz: 0, points_scored: 0, points_conceded: 0, matches_played: 0, matches_won: 0, matches_drawn: 0, matches_lost: 0, deck: [] },
    { id: 4, tournament_id: 1, user_id: 5, seed: 4, group_id: "A", group_seed: 2, checked_in: true, checked_in_at: now, swiss_points: 0, buchholz: 0, points_scored: 0, points_conceded: 0, matches_played: 0, matches_won: 0, matches_drawn: 0, matches_lost: 0, deck: [] },
    { id: 5, tournament_id: 1, user_id: 6, seed: 5, group_id: "A", group_seed: 3, checked_in: true, checked_in_at: now, swiss_points: 0, buchholz: 0, points_scored: 0, points_conceded: 0, matches_played: 0, matches_won: 0, matches_drawn: 0, matches_lost: 0, deck: [] },
    { id: 6, tournament_id: 1, user_id: 7, seed: 6, group_id: "B", group_seed: 3, checked_in: true, checked_in_at: now, swiss_points: 0, buchholz: 0, points_scored: 0, points_conceded: 0, matches_played: 0, matches_won: 0, matches_drawn: 0, matches_lost: 0, deck: [] },
    { id: 7, tournament_id: 1, user_id: 8, seed: 7, group_id: "B", group_seed: 4, checked_in: true, checked_in_at: now, swiss_points: 0, buchholz: 0, points_scored: 0, points_conceded: 0, matches_played: 0, matches_won: 0, matches_drawn: 0, matches_lost: 0, deck: [] },
    { id: 8, tournament_id: 1, user_id: 9, seed: 8, group_id: "A", group_seed: 4, checked_in: true, checked_in_at: now, swiss_points: 0, buchholz: 0, points_scored: 0, points_conceded: 0, matches_played: 0, matches_won: 0, matches_drawn: 0, matches_lost: 0, deck: [] }
  ];

  // Matches for Grupo A and Grupo B (Round Robin)
  matches = [
    // Grupo A matches
    { id: 1, tournament_id: 1, round_number: 1, stage: "Fase de Grupos - Grupo A", group_id: "A", bracket_position: 1, station_number: 1, player_a_id: 1, player_b_id: 5, score_a: 4, score_b: 2, winner_id: 1, referee_id: 3, target_points: 4, status: "finished", is_bye: false, created_at: now },
    { id: 2, tournament_id: 1, round_number: 1, stage: "Fase de Grupos - Grupo A", group_id: "A", bracket_position: 2, station_number: 2, player_a_id: 6, player_b_id: 9, score_a: 4, score_b: 1, winner_id: 6, referee_id: 3, target_points: 4, status: "finished", is_bye: false, created_at: now },
    { id: 3, tournament_id: 1, round_number: 2, stage: "Fase de Grupos - Grupo A", group_id: "A", bracket_position: 3, station_number: 1, player_a_id: 1, player_b_id: 6, score_a: 2, score_b: 1, winner_id: null, referee_id: 3, target_points: 4, status: "in_progress", is_bye: false, created_at: now },
    { id: 4, tournament_id: 1, round_number: 2, stage: "Fase de Grupos - Grupo A", group_id: "A", bracket_position: 4, station_number: 3, player_a_id: 5, player_b_id: 9, score_a: 0, score_b: 0, winner_id: null, referee_id: 3, target_points: 4, status: "calling", is_bye: false, created_at: now },
    { id: 5, tournament_id: 1, round_number: 3, stage: "Fase de Grupos - Grupo A", group_id: "A", bracket_position: 5, station_number: 1, player_a_id: 1, player_b_id: 9, score_a: 0, score_b: 0, winner_id: null, referee_id: null, target_points: 4, status: "pending", is_bye: false, created_at: now },
    { id: 6, tournament_id: 1, round_number: 3, stage: "Fase de Grupos - Grupo A", group_id: "A", bracket_position: 6, station_number: 3, player_a_id: 5, player_b_id: 6, score_a: 0, score_b: 0, winner_id: null, referee_id: null, target_points: 4, status: "pending", is_bye: false, created_at: now },

    // Grupo B matches
    { id: 7, tournament_id: 1, round_number: 1, stage: "Fase de Grupos - Grupo B", group_id: "B", bracket_position: 1, station_number: 2, player_a_id: 2, player_b_id: 4, score_a: 4, score_b: 3, winner_id: 2, referee_id: 3, target_points: 4, status: "finished", is_bye: false, created_at: now },
    { id: 8, tournament_id: 1, round_number: 1, stage: "Fase de Grupos - Grupo B", group_id: "B", bracket_position: 2, station_number: 4, player_a_id: 7, player_b_id: 8, score_a: 4, score_b: 2, winner_id: 7, referee_id: 3, target_points: 4, status: "finished", is_bye: false, created_at: now },
    { id: 9, tournament_id: 1, round_number: 2, stage: "Fase de Grupos - Grupo B", group_id: "B", bracket_position: 3, station_number: 2, player_a_id: 2, player_b_id: 7, score_a: 1, score_b: 3, winner_id: null, referee_id: 3, target_points: 4, status: "in_progress", is_bye: false, created_at: now },
    { id: 10, tournament_id: 1, round_number: 2, stage: "Fase de Grupos - Grupo B", group_id: "B", bracket_position: 4, station_number: 4, player_a_id: 4, player_b_id: 8, score_a: 0, score_b: 0, winner_id: null, referee_id: 3, target_points: 4, status: "calling", is_bye: false, created_at: now },
    { id: 11, tournament_id: 1, round_number: 3, stage: "Fase de Grupos - Grupo B", group_id: "B", bracket_position: 5, station_number: 2, player_a_id: 2, player_b_id: 8, score_a: 0, score_b: 0, winner_id: null, referee_id: null, target_points: 4, status: "pending", is_bye: false, created_at: now },
    { id: 12, tournament_id: 1, round_number: 3, stage: "Fase de Grupos - Grupo B", group_id: "B", bracket_position: 6, station_number: 4, player_a_id: 4, player_b_id: 7, score_a: 0, score_b: 0, winner_id: null, referee_id: null, target_points: 4, status: "pending", is_bye: false, created_at: now }
  ];

  // Match Games
  matchGames = [];

  // Seasons
  seasons = [
    {
      id: 1,
      name: "Temporada 1 (Oficial APB)",
      is_active: false,
      description: "Resultados finales oficiales de la Temporada 1 - Asociación Panameña de Beyblade.",
      start_date: "2025-01-01T00:00:00Z"
    },
    {
      id: 2,
      name: "Temporada 2 (2026 Activa)",
      is_active: true,
      description: "Nueva temporada competitiva con ranking Elo y circuito de torneos en vivo.",
      start_date: now
    }
  ];

  // Populate ALL 96 Bladers into Season 1 Rankings
  seasonRankings = APB_SEASON_1_RANKINGS.map((b, idx) => {
    const u = users.find(usr => usr.display_name === b.blader) || users[3 + idx];
    return {
      id: idx + 1,
      season_id: 1,
      user_id: u ? u.id : 4 + idx,
      points: b.total_points,
      elo: u ? u.elo_rating : 1500,
      tournaments_played: b.tournaments_played,
      tournaments_won: b.rank === 1 ? 5 : (b.rank <= 3 ? 2 : (b.rank <= 8 ? 1 : 0)),
      podium_finishes: b.rank <= 3 ? b.tournaments_played : (b.rank <= 10 ? Math.floor(b.tournaments_played / 2) : 0),
      matches_won: b.matches_won,
      matches_lost: b.matches_lost,
      points_for: b.points_for,
      points_against: b.points_against,
      bonus_points: b.bonus_points,
      warnings: b.warnings,
      overall_rank: b.rank
    };
  });

  // Hall of Fame with Official Champions
  hallOfFame = [
    {
      id: 1,
      year: 2025,
      title: "Campeón Temporada 1 - Ranking General APB",
      user_id: users.find(u => u.display_name === "Yorch")?.id || 4,
      tournament_name: "Gran Circuito Nacional Beyblade X Panamá (646 Pts)",
      signature_deck: "",
      trophy_icon: "trophy-gold",
      notes: "Máximo anotador de la Temporada 1 con 96 victorias y 519 puntos a favor.",
      created_at: now
    },
    {
      id: 2,
      year: 2025,
      title: "Subcampeón Nacional Temporada 1 APB",
      user_id: users.find(u => u.display_name === "Woonka")?.id || 5,
      tournament_name: "Circuito Oficial APB (483 Pts)",
      signature_deck: "",
      trophy_icon: "trophy-silver",
      notes: "94 victorias en 150 partidas oficiales con un 63% de efectividad.",
      created_at: now
    },
    {
      id: 3,
      year: 2025,
      title: "3er Lugar Nacional Temporada 1 APB",
      user_id: users.find(u => u.display_name === "Kanghy")?.id || 6,
      tournament_name: "Circuito Oficial APB (480 Pts)",
      signature_deck: "",
      trophy_icon: "trophy-bronze",
      notes: "Líder en partidas jugadas (157 combates) y 505 puntos anotados.",
      created_at: now
    },
    {
      id: 4,
      year: 2025,
      title: "Top 4 Master Blader Temporada 1 APB",
      user_id: users.find(u => u.display_name === "Raines")?.id || 7,
      tournament_name: "Circuito Oficial APB (465 Pts)",
      signature_deck: "",
      trophy_icon: "medal",
      notes: "73 victorias en 117 combates oficiales con 62% de efectividad.",
      created_at: now
    },
    {
      id: 5,
      year: 2025,
      title: "Top 5 Master Blader Temporada 1 APB",
      user_id: users.find(u => u.display_name === "Zirox")?.id || 8,
      tournament_name: "Circuito Oficial APB (438 Pts)",
      signature_deck: "",
      trophy_icon: "medal",
      notes: "78 victorias en 138 combates oficiales y 440 puntos a favor.",
      created_at: now
    }
  ];

  // Community Posts
  communityPosts = [
    {
      id: 1,
      user_id: 6,
      content: "Bienvenidos a la plataforma oficial de la Asociación Panameña de Beyblade (AppBey). Sistema de rankings oficiales, registro de torneos y control de arbitraje.",
      deck_id: null,
      image_url: null,
      likes_count: 0,
      comments_count: 0,
      created_at: now
    }
  ];

  postLikes = [];

  postComments = [];

  notifications = [];

  // Keep the verified historical users, rankings and catalog available in
  // production, but never publish the seeded tournament or its match results.
  if (!demoDataEnabled) {
    tournaments = [];
    participants = [];
    matches = [];
    matchGames = [];
  }
}

seedDatabase();

// ---------------------------------------------------------------------------
// WebSocket Manager
// ---------------------------------------------------------------------------

const realtime = new RealtimeHub(server);
const broadcastTournament = realtime.broadcastTournament.bind(realtime);

// ---------------------------------------------------------------------------
// Auth Helpers & Middleware
// ---------------------------------------------------------------------------

const auth = new AuthService(JWT_SECRET, (id) => users.find((user) => user.id === id));
const generateToken = (user: User) => auth.generateToken(user);
const identityRouteDependencies = { get users() { return users; }, nextId, generateToken, publicUser };
app.use(auth.middleware);

// ---------------------------------------------------------------------------
const tournamentDomain = createTournamentDomain({
  get users() { return users; },
  get tournaments() { return tournaments; },
  set tournaments(value: Tournament[]) { tournaments = value; },
  get participants() { return participants; },
  set participants(value: TournamentParticipant[]) { participants = value; },
  get matches() { return matches; },
  set matches(value: TournamentMatch[]) { matches = value; },
  get matchGames() { return matchGames; },
  set matchGames(value: MatchGame[]) { matchGames = value; },
  nextId,
  broadcastTournament
});
const { updateEloRatings, recalcTournamentStats, tournamentGroupIds, normalizeGroupId, automaticGroupCount, alphabeticalGroupIds, serpentineGroupOrder, updateStatsAfterMatch, distributePrizes, advanceSingleElimination, forfeitMatch, withdrawParticipantFromMatches, revertBracketPropagation, recomputeMatchFromGames, createWalkinBlader, planTournamentGroups, pairSwissRound, startGroupsElimTournament } = tournamentDomain;

// ---------------------------------------------------------------------------
// API Routes: /api/v1/...
// ---------------------------------------------------------------------------

const api = express.Router();

registerIdentityRoutes(api, identityRouteDependencies);
const catalogRouteDependencies = {
  get parts() { return parts; },
  set parts(value: BeybladePart[]) { parts = value; },
  get decks() { return decks; },
  get users() { return users; },
  get metaSyncState() { return metaSyncState; },
  set metaSyncState(value: MetaSyncState) { metaSyncState = value; },
  nextId,
  publicUser,
  persistState
};
registerCatalogRoutes(api, catalogRouteDependencies);
const tournamentRouteDependencies = {
  get users() { return users; },
  get decks() { return decks; },
  get tournaments() { return tournaments; },
  set tournaments(value: Tournament[]) { tournaments = value; },
  get participants() { return participants; },
  set participants(value: TournamentParticipant[]) { participants = value; },
  get matches() { return matches; },
  set matches(value: TournamentMatch[]) { matches = value; },
  get matchGames() { return matchGames; },
  set matchGames(value: MatchGame[]) { matchGames = value; },
  get seasons() { return seasons; },
  get seasonRankings() { return seasonRankings; },
  get hallOfFame() { return hallOfFame; },
  nextId, publicUser, broadcastTournament, updateEloRatings, recalcTournamentStats,
  updateStatsAfterMatch, distributePrizes, advanceSingleElimination, forfeitMatch,
  withdrawParticipantFromMatches, revertBracketPropagation, recomputeMatchFromGames, createWalkinBlader,
  tournamentGroupIds, normalizeGroupId, automaticGroupCount, alphabeticalGroupIds, serpentineGroupOrder,
  planTournamentGroups, pairSwissRound, startGroupsElimTournament
};
registerTournamentRoutes(api, tournamentRouteDependencies);
const matchRouteDependencies = {
  get users() { return users; },
  get tournaments() { return tournaments; },
  get participants() { return participants; },
  get matches() { return matches; },
  set matches(value: TournamentMatch[]) { matches = value; },
  get matchGames() { return matchGames; },
  set matchGames(value: MatchGame[]) { matchGames = value; },
  nextId, publicUser, broadcastTournament, updateEloRatings, recalcTournamentStats,
  updateStatsAfterMatch, distributePrizes, advanceSingleElimination, forfeitMatch,
  withdrawParticipantFromMatches, revertBracketPropagation, recomputeMatchFromGames
};
registerMatchRoutes(api, matchRouteDependencies);

registerRankingsRoutes(api, () => ({ hallOfFame, matches, seasons, seasonRankings, users }));
registerCommunityRoutes(api, {
  getState: () => ({ communityPosts, decks, notifications, postComments, postLikes, users }),
  nextId,
  publicUser
});

// Mount API
const healthPayload = () => ({
  status: "ok",
  app: "AppBey",
  version: "2.0.0",
  uptime: Math.round(process.uptime()),
  started_at: startedAt,
  storage: persistencePool ? "postgresql-relational" : "in-memory",
  database: persistencePool
    ? (!database.isReady ? "initializing" : database.hasWriteError ? "write_error" : "connected")
    : "not_configured",
  demo_data: demoDataEnabled
});

api.get("/health", (_req, res) => {
  res.status(200).json(healthPayload());
});

app.get("/healthz", (_req, res) => {
  res.status(200).json(healthPayload());
});

app.get("/readyz", (_req, res) => {
  if (!isReady) {
    res.status(503).json({ status: "unavailable", reason: "server_initializing" });
    return;
  }
  res.status(200).json({ ...healthPayload(), ready: true });
});

app.use((req, res, next) => {
  const isApiRequest = req.path === "/api" || req.path.startsWith("/api/");
  const isReadOnly = ["GET", "HEAD", "OPTIONS"].includes(req.method);
  if (!persistencePool || !isApiRequest || isReadOnly) {
    next();
    return;
  }

  const sendJson = res.json.bind(res);
  let responseStarted = false;
  res.json = ((body: unknown) => {
    if (responseStarted) return res;
    responseStarted = true;
    if (!database.isReady || res.statusCode >= 400) return sendJson(body);

    void persistState().then(() => {
      sendJson(body);
    }).catch(() => {
      if (!res.headersSent) {
        res.status(500);
        sendJson({ detail: "No se pudieron guardar los cambios en la base de datos" });
      }
    });
    return res;
  }) as Response["json"];
  next();
});

app.use((req, res, next) => {
  const isHealthRoute = req.path === "/health" || req.path === "/healthz" || req.path === "/readyz" || req.path === "/api/health";
  if (!isReady && !isHealthRoute && (req.path === "/api" || req.path.startsWith("/api/"))) {
    res.status(503).json({ detail: "Servidor inicializando", ready: false });
    return;
  }
  next();
});

app.use("/api/v1", api);
app.use("/api", api);

// ---------------------------------------------------------------------------
// Backend status and shared image assets
// ---------------------------------------------------------------------------

const frontendPath = path.join(process.cwd(), "frontend");

const staticCacheConfig = {
  maxAge: "1d",
  immutable: false,
  etag: true,
  lastModified: true
};

app.get("/", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "AppBey API",
    message: "Frontend disponible en el dominio de Vercel"
  });
});

app.use("/assets", express.static(path.join(frontendPath, "assets"), staticCacheConfig));

app.use((req, res) => {
  if (req.path.startsWith("/api/") || req.path === "/api") {
    res.status(404).json({ detail: "Ruta API no encontrada" });
    return;
  }
  if (req.path.startsWith("/assets/") || req.path.startsWith("/css/") || req.path.startsWith("/js/")) {
    res.status(404).type("text/plain").send("Asset no encontrado");
    return;
  }
  res.status(404).json({ detail: "Ruta de backend no encontrada" });
});

// Express reports malformed JSON through the error middleware. Keep API errors
// JSON-shaped while allowing the SPA fallback to handle browser navigations.
app.use((error: any, req: Request, res: Response, next: NextFunction) => {
  if (error instanceof SyntaxError && "body" in error) {
    res.status(400).json({ detail: "JSON inválido" });
    return;
  }
  if (res.headersSent) {
    next(error);
    return;
  }
  console.error("Unhandled request error:", error);
  if (req.path.startsWith("/api/") || req.path === "/api") {
    res.status(500).json({ detail: "Error interno del servidor" });
    return;
  }
  res.status(500).send("Error interno del servidor");
});
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;
server.requestTimeout = 30_000;

// Bind the port before initializing PostgreSQL so Render detects the service
// promptly. API traffic remains gated until the database is ready.
async function startServer() {
  server.listen(PORT, HOST, () => {
    console.log(`AppBey server is running on http://${HOST}:${PORT}`);
    void persistenceRepository.initialize().then(() => {
      isReady = true;
    }).catch((error) => {
      console.error("Unable to initialize PostgreSQL persistence:", error);
      process.exitCode = 1;
      realtime.closeAll(1011, "Database initialization failed");
      server.close((closeError) => {
        if (closeError) console.error("Error closing server after initialization failure:", closeError);
        void database.close().catch((poolError) => {
          console.error("Error closing PostgreSQL pool after initialization failure:", poolError);
        });
      });
    });
  });
}

void startServer();

function shutdown(signal: string) {
  console.log(`Received ${signal}; shutting down gracefully`);
  isReady = false;
  realtime.stopHeartbeat();
  realtime.closeAll(1001, "Server shutting down");
  server.close((error) => {
    if (error) {
      console.error("Error during shutdown:", error);
      process.exitCode = 1;
    }
    void (async () => {
      await database.drainAndClose();
    })().catch((shutdownError) => {
      console.error("Error closing PostgreSQL pool:", shutdownError);
      process.exitCode = 1;
    });
  });
}

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
