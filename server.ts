import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
import cors from "cors";
import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

type Request = any;
type Response = any;
type NextFunction = any;

const app = express();
const server = http.createServer(app);
const PORT = 3000;
const HOST = "0.0.0.0";
const JWT_SECRET = process.env.SECRET_KEY || process.env.JWT_SECRET || "appbey-super-secret-jwt-key-2026-beyblade";

app.use(cors());
app.use(express.json());

// ---------------------------------------------------------------------------
// In-Memory Database & Types
// ---------------------------------------------------------------------------

interface User {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  display_name: string;
  role: "admin" | "organizer" | "referee" | "blader" | "spectator";
  country: string;
  avatar_url?: string;
  bio?: string;
  favorite_combo?: string;
  elo_rating: number;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
}

interface Wallet {
  id: number;
  user_id: number;
  balance: number;
  created_at: string;
}

interface Transaction {
  id: number;
  wallet_id: number;
  amount: number;
  tx_type: string;
  reason: string;
  reference_id?: string;
  created_at: string;
}

interface BeybladePart {
  id: number;
  code: string;
  name: string;
  category: "blade" | "ratchet" | "bit";
  system: string;
  type_attr: string;
  weight_grams: number;
  attack_stat: number;
  defense_stat: number;
  stamina_stat: number;
  dash_stat: number;
  tier: string;
  description: string;
}

interface BladerDeck {
  id: number;
  user_id: number;
  name: string;
  description?: string;
  is_public: boolean;
  slot1_name?: string;
  slot1_blade_id?: number;
  slot1_ratchet_id?: number;
  slot1_bit_id?: number;
  slot2_name?: string;
  slot2_blade_id?: number;
  slot2_ratchet_id?: number;
  slot2_bit_id?: number;
  slot3_name?: string;
  slot3_blade_id?: number;
  slot3_ratchet_id?: number;
  slot3_bit_id?: number;
  total_weight: number;
  created_at: string;
}

interface Tournament {
  id: number;
  slug: string;
  title: string;
  description: string;
  organizer_id: number;
  format: "swiss" | "single_elim";
  battle_type: string;
  match_target_points: number;
  stadium_type: string;
  max_participants: number;
  entry_fee_ap: number;
  prize_pool_ap: number;
  status: "registration_open" | "check_in" | "in_progress" | "completed" | "cancelled";
  venue_name: string;
  venue_address: string;
  country: string;
  start_date: string;
  current_round: number;
  total_rounds: number;
  is_official: boolean;
  winner_user_id?: number | null;
  runner_up_user_id?: number | null;
  third_place_user_id?: number | null;
  created_at: string;
}

interface TournamentParticipant {
  id: number;
  tournament_id: number;
  user_id: number;
  seed: number;
  checked_in: boolean;
  checked_in_at?: string | null;
  swiss_points: number;
  buchholz: number;
  points_scored: number;
  points_conceded: number;
  matches_played: number;
  matches_won: number;
  matches_drawn: number;
  matches_lost: number;
  final_rank?: number | null;
}

interface MatchGame {
  id: number;
  match_id: number;
  game_order: number;
  finish_type: string;
  awarded_to: "player_a" | "player_b" | "draw";
  points: number;
  notes?: string;
  created_at: string;
}

interface TournamentMatch {
  id: number;
  tournament_id: number;
  round_number: number;
  stage: string;
  bracket_position: number;
  station_number: number;
  player_a_id: number | null;
  player_b_id: number | null;
  score_a: number;
  score_b: number;
  winner_id: number | null;
  referee_id?: number | null;
  status: "pending" | "calling" | "in_progress" | "finished";
  is_bye: boolean;
  created_at: string;
}

interface Season {
  id: number;
  name: string;
  is_active: boolean;
  description: string;
  start_date: string;
}

interface SeasonRanking {
  id: number;
  season_id: number;
  user_id: number;
  points: number;
  elo: number;
  tournaments_played: number;
  tournaments_won: number;
  podium_finishes: number;
  matches_won: number;
  matches_lost: number;
  points_for: number;
  points_against: number;
  bonus_points: number;
  warnings: number;
  overall_rank?: number;
}

interface HallOfFame {
  id: number;
  year: number;
  title: string;
  user_id: number;
  tournament_name: string;
  signature_deck: string;
  trophy_icon: string;
  notes: string;
  created_at: string;
}

interface CommunityPost {
  id: number;
  user_id: number;
  content: string;
  deck_id?: number | null;
  image_url?: string | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
}

interface PostComment {
  id: number;
  post_id: number;
  user_id: number;
  content: string;
  created_at: string;
}

interface Notification {
  id: number;
  user_id: number;
  notif_type: string;
  title: string;
  message: string;
  link?: string;
  is_read: boolean;
  created_at: string;
}

// Stores
let users: User[] = [];
let wallets: Wallet[] = [];
let transactions: Transaction[] = [];
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
let postComments: PostComment[] = [];
let notifications: Notification[] = [];

// Seed Database Function
function seedDatabase() {
  const hash = (pw: string) => bcrypt.hashSync(pw, 10);
  const now = new Date().toISOString();

  // Users
  users = [
    {
      id: 1,
      username: "byjankraftyt",
      email: "byjankraftyt@gmail.com",
      password_hash: hash("123456"),
      display_name: "Jan Kraft (Admin)",
      role: "admin",
      country: "PA",
      avatar_url: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
      bio: "Organizador Oficial de Torneos Beyblade X en Panama.",
      favorite_combo: "Phoenix Wing 9-60 GF",
      elo_rating: 1850,
      is_active: true,
      is_verified: true,
      created_at: now
    },
    {
      id: 2,
      username: "blader_master",
      email: "organizer@appbey.app",
      password_hash: hash("123456"),
      display_name: "Carlos 'Xtreme' Vega",
      role: "organizer",
      country: "MX",
      avatar_url: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80",
      bio: "Juez oficial y organizador de la liga competitiva de Beyblade Xtreme.",
      favorite_combo: "Wizard Rod 5-70 DB",
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
      display_name: "Arbitro Alex",
      role: "referee",
      country: "PA",
      avatar_url: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=150&auto=format&fit=crop&q=80",
      bio: "Arbitro certificado WBO y Takara Tomy para combates 3on3 Xtreme Stadium.",
      favorite_combo: "Dran Buster 1-60 F",
      elo_rating: 1450,
      is_active: true,
      is_verified: true,
      created_at: now
    },
    {
      id: 4,
      username: "ryu_blader",
      email: "ryu@appbey.app",
      password_hash: hash("123456"),
      display_name: "Ryu Kusanagi",
      role: "blader",
      country: "PA",
      avatar_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
      bio: "Especialista en ataque y rush finish.",
      favorite_combo: "Shark Edge 3-60 LF",
      elo_rating: 1680,
      is_active: true,
      is_verified: true,
      created_at: now
    },
    {
      id: 5,
      username: "valkyrie_pro",
      email: "valk@appbey.app",
      password_hash: hash("123456"),
      display_name: "Sofia 'Valkyrie' Gomez",
      role: "blader",
      country: "CL",
      avatar_url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
      bio: "Capitana del equipo Valkyrie Chile.",
      favorite_combo: "Cobalt Dragoon 1-60 E",
      elo_rating: 1620,
      is_active: true,
      is_verified: true,
      created_at: now
    },
    {
      id: 6,
      username: "dran_legend",
      email: "dran@appbey.app",
      password_hash: hash("123456"),
      display_name: "Mateo Morales",
      role: "blader",
      country: "MX",
      avatar_url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
      bio: "Puro ataque smash y potencia.",
      favorite_combo: "Tyranno Beat 4-70 Q",
      elo_rating: 1590,
      is_active: true,
      is_verified: true,
      created_at: now
    },
    {
      id: 7,
      username: "storm_blader",
      email: "storm@appbey.app",
      password_hash: hash("123456"),
      display_name: "Gabriel Mendez",
      role: "blader",
      country: "PE",
      avatar_url: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80",
      bio: "Control y balance.",
      favorite_combo: "Hells Chain 5-60 HT",
      elo_rating: 1510,
      is_active: true,
      is_verified: true,
      created_at: now
    },
    {
      id: 8,
      username: "pegasus_fire",
      email: "pegasus@appbey.app",
      password_hash: hash("123456"),
      display_name: "Lucas Rossi",
      role: "blader",
      country: "AR",
      avatar_url: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80",
      bio: "Especialista en Unicorn Sting.",
      favorite_combo: "Unicorn Sting 5-60 GP",
      elo_rating: 1480,
      is_active: true,
      is_verified: true,
      created_at: now
    },
    {
      id: 9,
      username: "viper_fang",
      email: "viper@appbey.app",
      password_hash: hash("123456"),
      display_name: "Diego Santos",
      role: "blader",
      country: "CO",
      avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
      bio: "Stamina pura.",
      favorite_combo: "Viper Tail 5-80 O",
      elo_rating: 1420,
      is_active: true,
      is_verified: true,
      created_at: now
    },
    {
      id: 10,
      username: "phoenix_queen",
      email: "phoenix@appbey.app",
      password_hash: hash("123456"),
      display_name: "Elena Castillo",
      role: "blader",
      country: "PA",
      avatar_url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
      bio: "Invicta en torneos locales.",
      favorite_combo: "Phoenix Wing 9-60 GF",
      elo_rating: 1650,
      is_active: true,
      is_verified: true,
      created_at: now
    },
    {
      id: 11,
      username: "knight_shield",
      email: "knight@appbey.app",
      password_hash: hash("123456"),
      display_name: "Victor Bravo",
      role: "blader",
      country: "PA",
      avatar_url: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80",
      bio: "Defensa absoluta y contraataque.",
      favorite_combo: "Knight Shield 3-80 N",
      elo_rating: 1380,
      is_active: true,
      is_verified: true,
      created_at: now
    }
  ];

  // Wallets
  wallets = users.map((u, i) => ({
    id: i + 1,
    user_id: u.id,
    balance: ["admin", "organizer"].includes(u.role) ? 1200 : 500,
    created_at: now
  }));

  transactions = wallets.map((w, i) => ({
    id: i + 1,
    wallet_id: w.id,
    amount: w.balance,
    tx_type: "signup_bonus",
    reason: "Saldo inicial y bienvenida AppBey",
    created_at: now
  }));

  // Parts
  parts = [
    // Blades
    { id: 1, code: "BX-23", name: "Phoenix Wing", category: "blade", system: "BX", type_attr: "Attack", weight_grams: 38.2, attack_stat: 95, defense_stat: 70, stamina_stat: 65, dash_stat: 90, tier: "S", description: "Blade pesada de metal pintado con tremendo poder de smash y Xtreme Dash." },
    { id: 2, code: "UX-03", name: "Wizard Rod", category: "blade", system: "UX", type_attr: "Stamina", weight_grams: 35.5, attack_stat: 40, defense_stat: 85, stamina_stat: 98, dash_stat: 55, tier: "S", description: "El rey indiscutible de la resistencia y estabilidad centrifuga exterior." },
    { id: 3, code: "UX-01", name: "Dran Buster", category: "blade", system: "UX", type_attr: "Attack", weight_grams: 35.0, attack_stat: 98, defense_stat: 30, stamina_stat: 40, dash_stat: 95, tier: "S", description: "Espada descomunal de un solo impacto letal para conseguir One-Hit KOs y Burst Finish." },
    { id: 4, code: "BX-14", name: "Shark Edge", category: "blade", system: "BX", type_attr: "Attack", weight_grams: 34.8, attack_stat: 92, defense_stat: 35, stamina_stat: 45, dash_stat: 90, tier: "A", description: "Upper attack demoledor capaz de lanzar rivales fuera del estadio en el primer choque." },
    { id: 5, code: "BX-21", name: "Hells Chain", category: "blade", system: "BX", type_attr: "Balance", weight_grams: 33.5, attack_stat: 70, defense_stat: 80, stamina_stat: 80, dash_stat: 70, tier: "A", description: "Excelente combinacion de defensa angular y contraataque equilibrado." },
    { id: 6, code: "UX-02", name: "Hells Hammer", category: "blade", system: "UX", type_attr: "Balance", weight_grams: 33.2, attack_stat: 78, defense_stat: 68, stamina_stat: 75, dash_stat: 75, tier: "A", description: "Ataque descendente martillo ideal para desestabilizar Beys defensivos." },
    { id: 7, code: "BX-31", name: "Tyranno Beat", category: "blade", system: "BX", type_attr: "Attack", weight_grams: 37.5, attack_stat: 90, defense_stat: 60, stamina_stat: 55, dash_stat: 85, tier: "A", description: "Mandibula demoledora con masa concentrada para golpes de choque masivos." },
    { id: 8, code: "BX-26", name: "Unicorn Sting", category: "blade", system: "BX", type_attr: "Balance", weight_grams: 33.8, attack_stat: 72, defense_stat: 76, stamina_stat: 78, dash_stat: 70, tier: "B", description: "Forma asimetrica que permite alternar ataque con un cuerno y defensa lisa." },
    { id: 9, code: "BX-16", name: "Viper Tail", category: "blade", system: "BX", type_attr: "Stamina", weight_grams: 34.0, attack_stat: 65, defense_stat: 60, stamina_stat: 85, dash_stat: 60, tier: "B", description: "Down-force blades que mantienen la postura de giro estable contra ataques." },
    { id: 10, code: "BX-04", name: "Knight Shield", category: "blade", system: "BX", type_attr: "Defense", weight_grams: 32.8, attack_stat: 40, defense_stat: 88, stamina_stat: 70, dash_stat: 50, tier: "C", description: "Escudo clasico de absorcion de impactos frontales." },

    // Ratchets
    { id: 11, code: "R-960", name: "9-60", category: "ratchet", system: "BX", type_attr: "Balance", weight_grams: 6.6, attack_stat: 70, defense_stat: 85, stamina_stat: 90, dash_stat: 80, tier: "S", description: "9 puntos de contacto que reducen el riesgo de Burst y optimizan el peso centrifugo." },
    { id: 12, code: "R-560", name: "5-60", category: "ratchet", system: "BX", type_attr: "Defense", weight_grams: 6.4, attack_stat: 75, defense_stat: 80, stamina_stat: 85, dash_stat: 75, tier: "S", description: "Perfil bajo de 60mm con 5 salientes equilibrados, el favorito de torneos." },
    { id: 13, code: "R-360", name: "3-60", category: "ratchet", system: "BX", type_attr: "Attack", weight_grams: 6.2, attack_stat: 85, defense_stat: 65, stamina_stat: 75, dash_stat: 85, tier: "A", description: "Ideal para alinear las cuchillas de ataque de 3 lados como Shark Edge y Dran Sword." },
    { id: 14, code: "R-160", name: "1-60", category: "ratchet", system: "UX", type_attr: "Attack", weight_grams: 6.1, attack_stat: 95, defense_stat: 50, stamina_stat: 50, dash_stat: 90, tier: "A", description: "Un solo punto excentrico diseñado para Dran Buster y golpes de poder unico." },
    { id: 15, code: "R-570", name: "5-70", category: "ratchet", system: "UX", type_attr: "Stamina", weight_grams: 6.7, attack_stat: 60, defense_stat: 85, stamina_stat: 92, dash_stat: 70, tier: "A", description: "Altura de 70mm optimizada para Wizard Rod y defensas altas." },
    { id: 16, code: "R-470", name: "4-70", category: "ratchet", system: "BX", type_attr: "Balance", weight_grams: 6.5, attack_stat: 70, defense_stat: 75, stamina_stat: 78, dash_stat: 75, tier: "B", description: "4 alas de proteccion media." },
    { id: 17, code: "R-380", name: "3-80", category: "ratchet", system: "BX", type_attr: "Stamina", weight_grams: 7.1, attack_stat: 50, defense_stat: 70, stamina_stat: 80, dash_stat: 60, tier: "C", description: "Altura de 80mm para resistir ataques rasantes." },

    // Bits
    { id: 18, code: "B-B", name: "Ball (B)", category: "bit", system: "BX", type_attr: "Stamina", weight_grams: 2.2, attack_stat: 30, defense_stat: 80, stamina_stat: 98, dash_stat: 40, tier: "S", description: "Punta esferica con maxima inercia y resistencia a los choques." },
    { id: 19, code: "B-DB", name: "Disc Ball (DB)", category: "bit", system: "UX", type_attr: "Stamina", weight_grams: 2.5, attack_stat: 35, defense_stat: 88, stamina_stat: 99, dash_stat: 45, tier: "S", description: "Disco estabilizador anti-inclinacion y resistencia superior." },
    { id: 20, code: "B-GF", name: "Gear Flat (GF)", category: "bit", system: "BX", type_attr: "Attack", weight_grams: 2.4, attack_stat: 98, defense_stat: 30, stamina_stat: 35, dash_stat: 99, tier: "S", description: "Engranajes extendidos en la punta para Xtreme Dash supersonicos." },
    { id: 21, code: "B-LF", name: "Low Flat (LF)", category: "bit", system: "BX", type_attr: "Attack", weight_grams: 2.2, attack_stat: 95, defense_stat: 35, stamina_stat: 40, dash_stat: 92, tier: "A", description: "Punta plana rebajada para trayectorias agresivas y upper hits." },
    { id: 22, code: "B-F", name: "Flat (F)", category: "bit", system: "BX", type_attr: "Attack", weight_grams: 2.1, attack_stat: 90, defense_stat: 40, stamina_stat: 45, dash_stat: 88, tier: "A", description: "La punta clasica de ataque de alta velocidad." },
    { id: 23, code: "B-P", name: "Point (P)", category: "bit", system: "BX", type_attr: "Balance", weight_grams: 2.3, attack_stat: 70, defense_stat: 70, stamina_stat: 75, dash_stat: 75, tier: "A", description: "Centro de resistencia con borde de ataque Xtreme." },
    { id: 24, code: "B-GP", name: "Gear Point (GP)", category: "bit", system: "BX", type_attr: "Balance", weight_grams: 2.4, attack_stat: 75, defense_stat: 68, stamina_stat: 72, dash_stat: 85, tier: "A", description: "Version engranada de Point para aceleraciones repentinas." },
    { id: 25, code: "B-H", name: "Hexa (H)", category: "bit", system: "UX", type_attr: "Defense", weight_grams: 2.6, attack_stat: 45, defense_stat: 94, stamina_stat: 80, dash_stat: 55, tier: "A", description: "Base hexagonal con alta resistencia al Burst y gran amortiguacion." },
    { id: 26, code: "B-O", name: "Orb (O)", category: "bit", system: "BX", type_attr: "Stamina", weight_grams: 2.2, attack_stat: 35, defense_stat: 75, stamina_stat: 90, dash_stat: 45, tier: "B", description: "Punta esferica compacta para giro estable en el centro." }
  ];

  // Decks
  decks = [
    {
      id: 1,
      user_id: 1,
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

  // Tournaments
  tournaments = [
    {
      id: 1,
      slug: "copa-nacional-beyblade-x-panama-2026",
      title: "Gran Copa Nacional Beyblade X - Panama 2026",
      description: "Torneo oficial clasificatorio al Campeonato Latinoamericano. Formato 3on3 Deck, Fase Suiza de 4 rondas + Top 8 Cut en Xtreme Stadium.",
      organizer_id: 1,
      format: "swiss",
      battle_type: "3on3_deck",
      match_target_points: 4,
      stadium_type: "Xtreme Stadium (BX-10)",
      max_participants: 16,
      entry_fee_ap: 50,
      prize_pool_ap: 2500,
      status: "in_progress",
      venue_name: "Arena Beyblade Panama - Albrook Mall",
      venue_address: "Albrook Mall, Pasillo del Koala, Local B-12",
      country: "PA",
      start_date: now,
      current_round: 1,
      total_rounds: 4,
      is_official: true,
      winner_user_id: null,
      created_at: now
    },
    {
      id: 2,
      slug: "torneo-relampago-xtreme-dash-mexico",
      title: "Torneo Relampago Xtreme Dash CDMX",
      description: "Torneo rapido de eliminacion directa 1on1 al mejor de 3 puntos.",
      organizer_id: 2,
      format: "single_elim",
      battle_type: "1on1",
      match_target_points: 3,
      stadium_type: "Xtreme Stadium (BX-10)",
      max_participants: 8,
      entry_fee_ap: 30,
      prize_pool_ap: 800,
      status: "registration_open",
      venue_name: "Frikiplaza Eje Central",
      venue_address: "Eje Central Lazaro Cardenas 9, CDMX",
      country: "MX",
      start_date: new Date(Date.now() + 2 * 86400000).toISOString(),
      current_round: 0,
      total_rounds: 3,
      is_official: true,
      winner_user_id: null,
      created_at: now
    }
  ];

  // Participants in Tournament 1
  const sampleBladers = [users[0], ...users.slice(3, 10)];
  participants = sampleBladers.map((u, idx) => ({
    id: idx + 1,
    tournament_id: 1,
    user_id: u.id,
    seed: idx + 1,
    checked_in: true,
    checked_in_at: now,
    swiss_points: idx === 1 ? 3 : 0,
    buchholz: 0,
    points_scored: idx === 1 ? 4 : (idx === 0 ? 3 : 0),
    points_conceded: idx === 1 ? 1 : (idx === 0 ? 2 : 0),
    matches_played: [0, 1, 2, 3].includes(idx) ? 1 : 0,
    matches_won: idx === 1 ? 1 : 0,
    matches_drawn: 0,
    matches_lost: idx === 3 ? 1 : 0,
    final_rank: null
  }));

  // Matches in Tournament 1
  matches = [
    {
      id: 1,
      tournament_id: 1,
      round_number: 1,
      stage: "swiss",
      bracket_position: 1,
      station_number: 1,
      player_a_id: sampleBladers[0].id,
      player_b_id: sampleBladers[1].id,
      score_a: 3,
      score_b: 2,
      winner_id: null,
      referee_id: 3,
      status: "in_progress",
      is_bye: false,
      created_at: now
    },
    {
      id: 2,
      tournament_id: 1,
      round_number: 1,
      stage: "swiss",
      bracket_position: 2,
      station_number: 2,
      player_a_id: sampleBladers[2].id,
      player_b_id: sampleBladers[3].id,
      score_a: 4,
      score_b: 1,
      winner_id: sampleBladers[2].id,
      referee_id: 3,
      status: "finished",
      is_bye: false,
      created_at: now
    },
    {
      id: 3,
      tournament_id: 1,
      round_number: 1,
      stage: "swiss",
      bracket_position: 3,
      station_number: 3,
      player_a_id: sampleBladers[4].id,
      player_b_id: sampleBladers[5].id,
      score_a: 0,
      score_b: 0,
      winner_id: null,
      referee_id: null,
      status: "calling",
      is_bye: false,
      created_at: now
    },
    {
      id: 4,
      tournament_id: 1,
      round_number: 1,
      stage: "swiss",
      bracket_position: 4,
      station_number: 4,
      player_a_id: sampleBladers[6].id,
      player_b_id: sampleBladers[7].id,
      score_a: 0,
      score_b: 0,
      winner_id: null,
      referee_id: null,
      status: "pending",
      is_bye: false,
      created_at: now
    }
  ];

  // Match Games
  matchGames = [
    { id: 1, match_id: 1, game_order: 1, finish_type: "spin_finish_1p", awarded_to: "player_a", points: 1, notes: "Phoenix Wing desgasta a Shark Edge", created_at: now },
    { id: 2, match_id: 1, game_order: 2, finish_type: "over_finish_2p", awarded_to: "player_b", points: 2, notes: "Shark Edge aprovecha Over Zone", created_at: now },
    { id: 3, match_id: 1, game_order: 3, finish_type: "over_finish_2p", awarded_to: "player_a", points: 2, notes: "Phoenix Wing contraataca con Xtreme Dash", created_at: now },
    { id: 4, match_id: 2, game_order: 1, finish_type: "spin_finish_1p", awarded_to: "player_b", points: 1, created_at: now },
    { id: 5, match_id: 2, game_order: 2, finish_type: "xtreme_finish_3p", awarded_to: "player_a", points: 3, notes: "Valkyrie ejecuta un Xtreme Dash fulminante de 3 puntos!", created_at: now },
    { id: 6, match_id: 2, game_order: 3, finish_type: "spin_finish_1p", awarded_to: "player_a", points: 1, created_at: now }
  ];

  // Seasons
  seasons = [
    {
      id: 1,
      name: "Temporada 2025 - Temporada Inaugural",
      is_active: false,
      description: "Resultados finales oficiales de la temporada anterior con ganadores históricos por puntos.",
      start_date: "2025-01-01T00:00:00Z"
    },
    {
      id: 2,
      name: "Temporada 2026 - Nueva Temporada",
      is_active: true,
      description: "Nueva temporada con ranking Elo reiniciado y nuevo multiplicador competitivo.",
      start_date: now
    }
  ];

  // Season 1 (Temporada Pasada: Ganadores Reales de Temporada Anterior)
  // Season 2 (Nueva Temporada: Ranking ELO vacío para la nueva temporada)
  seasonRankings = [
    // Temporada 1 - Ganadores históricos reales por puntos
    {
      id: 1,
      season_id: 1,
      user_id: 1, // Jan Kraft
      points: 2450,
      elo: 1850,
      tournaments_played: 6,
      tournaments_won: 3,
      podium_finishes: 5,
      matches_won: 22,
      matches_lost: 3,
      points_for: 88,
      points_against: 31,
      bonus_points: 300,
      warnings: 0,
      overall_rank: 1
    },
    {
      id: 2,
      season_id: 1,
      user_id: 4, // Ryu Kusanagi
      points: 2120,
      elo: 1680,
      tournaments_played: 6,
      tournaments_won: 2,
      podium_finishes: 4,
      matches_won: 18,
      matches_lost: 5,
      points_for: 74,
      points_against: 38,
      bonus_points: 200,
      warnings: 0,
      overall_rank: 2
    },
    {
      id: 3,
      season_id: 1,
      user_id: 5, // Sofia Gomez
      points: 1890,
      elo: 1620,
      tournaments_played: 5,
      tournaments_won: 1,
      podium_finishes: 3,
      matches_won: 15,
      matches_lost: 6,
      points_for: 62,
      points_against: 40,
      bonus_points: 150,
      warnings: 0,
      overall_rank: 3
    },
    {
      id: 4,
      season_id: 1,
      user_id: 6, // Mateo Morales
      points: 1640,
      elo: 1590,
      tournaments_played: 5,
      tournaments_won: 0,
      podium_finishes: 2,
      matches_won: 12,
      matches_lost: 7,
      points_for: 51,
      points_against: 44,
      bonus_points: 80,
      warnings: 0,
      overall_rank: 4
    },
    {
      id: 5,
      season_id: 1,
      user_id: 10, // Elena Castillo
      points: 1520,
      elo: 1650,
      tournaments_played: 4,
      tournaments_won: 1,
      podium_finishes: 2,
      matches_won: 11,
      matches_lost: 4,
      points_for: 46,
      points_against: 28,
      bonus_points: 100,
      warnings: 0,
      overall_rank: 5
    }
  ];

  // Hall of Fame
  hallOfFame = [
    {
      id: 1,
      year: 2025,
      title: "Campeon Latinoamericano Inaugural Beyblade X",
      user_id: 1,
      tournament_name: "Pan-American Xtreme Open 2025",
      signature_deck: "Phoenix Wing 9-60 GF / Wizard Rod 5-70 DB / Dran Buster 1-60 F",
      trophy_icon: "trophy-gold",
      notes: "Campeon invicto con un record de 12-0 en el torneo internacional.",
      created_at: now
    },
    {
      id: 2,
      year: 2025,
      title: "Maestro del Xtreme Dash",
      user_id: 4,
      tournament_name: "Copa de Otono Shark Attack",
      signature_deck: "Shark Edge 3-60 LF / Cobalt Dragoon 1-60 E / Tyranno Beat 4-70 Q",
      trophy_icon: "trophy-silver",
      notes: "Record del mayor numero de Xtreme Finishes (18) en un solo fin de semana.",
      created_at: now
    }
  ];

  // Community Posts
  communityPosts = [
    {
      id: 1,
      user_id: 1,
      content: "Bienvenidos a la nueva plataforma de **AppBey**. Hemos redisenado por completo el motor de torneos, constructor de decks y marcador de arbitraje tactil.",
      deck_id: null,
      image_url: null,
      likes_count: 24,
      comments_count: 2,
      created_at: now
    },
    {
      id: 2,
      user_id: 5,
      content: "Cual consideran que es el mejor Bit para Wizard Rod actualmente? He testeado Disc Ball (DB) vs Ball (B) y la estabilidad contra choques laterales es increible.",
      deck_id: null,
      image_url: null,
      likes_count: 18,
      comments_count: 1,
      created_at: now
    }
  ];

  postComments = [
    { id: 1, post_id: 1, user_id: 4, content: "Excelente actualizacion! El marcador tactil en tiempo real va a acelerar muchisimo los combates en mesa.", created_at: now },
    { id: 2, post_id: 1, user_id: 2, content: "Listos para proyectar el bracket en las pantallas de la arena.", created_at: now },
    { id: 3, post_id: 2, user_id: 1, content: "Disc Ball 100% recomendado con 5-70 para prevenir rozamientos en el piso del estadio.", created_at: now }
  ];

  notifications = [
    {
      id: 1,
      user_id: 1,
      notif_type: "match_call",
      title: "Llamado a Combate",
      message: "Mesa 1: Jan Kraft vs Sofia Gomez esta en progreso.",
      link: "#/tournaments/1",
      is_read: false,
      created_at: now
    }
  ];
}

seedDatabase();

// ---------------------------------------------------------------------------
// WebSocket Manager
// ---------------------------------------------------------------------------

const wss = new WebSocketServer({ noServer: true });
const globalSockets = new Set<WebSocket>();
const tournamentSockets = new Map<number, Set<WebSocket>>();

server.on("upgrade", (request, socket, head) => {
  const url = request.url || "";
  if (url === "/ws/global" || url.startsWith("/ws/tournaments/")) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  } else {
    socket.destroy();
  }
});

wss.on("connection", (ws: WebSocket, req: http.IncomingMessage) => {
  const url = req.url || "";
  let currentTournamentId: number | null = null;

  if (url === "/ws/global") {
    globalSockets.add(ws);
  } else if (url.startsWith("/ws/tournaments/")) {
    const parts = url.split("/");
    const id = parseInt(parts[3], 10);
    if (!isNaN(id)) {
      currentTournamentId = id;
      if (!tournamentSockets.has(id)) {
        tournamentSockets.set(id, new Set());
      }
      tournamentSockets.get(id)!.add(ws);
    }
  }

  ws.on("close", () => {
    globalSockets.delete(ws);
    if (currentTournamentId && tournamentSockets.has(currentTournamentId)) {
      tournamentSockets.get(currentTournamentId)!.delete(ws);
    }
  });

  ws.on("message", (msg) => {
    // Keep alive or echo
  });
});

function broadcastTournament(tournamentId: number, event: string, data: any) {
  const payload = JSON.stringify({ event, data });
  const set = tournamentSockets.get(tournamentId);
  if (set) {
    for (const ws of set) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }
  for (const ws of globalSockets) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

// ---------------------------------------------------------------------------
// Auth Helpers & Middleware
// ---------------------------------------------------------------------------

interface AuthRequest extends Request {
  user?: User;
}

function generateToken(user: User): string {
  return jwt.sign(
    { sub: String(user.id), username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      const user = users.find((u) => u.id === Number(decoded.sub));
      if (user) {
        req.user = user;
      }
    } catch (e) {}
  }
  next();
}

function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ detail: "No autenticado" });
    return;
  }
  next();
}

function requireRoles(roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ detail: "Permisos insuficientes" });
      return;
    }
    next();
  };
}

app.use(authMiddleware);

// ---------------------------------------------------------------------------
// ELO & Tournament Calculations
// ---------------------------------------------------------------------------

function updateEloRatings(userAId: number, userBId: number, winnerId: number | null) {
  const userA = users.find((u) => u.id === userAId);
  const userB = users.find((u) => u.id === userBId);
  if (!userA || !userB) return;

  const K = 32;
  const expectedA = 1.0 / (1.0 + Math.pow(10, (userB.elo_rating - userA.elo_rating) / 400.0));
  const expectedB = 1.0 / (1.0 + Math.pow(10, (userA.elo_rating - userB.elo_rating) / 400.0));

  let actualA = 0.5;
  let actualB = 0.5;
  if (winnerId === userAId) {
    actualA = 1.0;
    actualB = 0.0;
  } else if (winnerId === userBId) {
    actualA = 0.0;
    actualB = 1.0;
  }

  const deltaA = Math.round(K * (actualA - expectedA));
  const deltaB = Math.round(K * (actualB - expectedB));

  userA.elo_rating = Math.max(100, userA.elo_rating + deltaA);
  userB.elo_rating = Math.max(100, userB.elo_rating + deltaB);
}

function getWallet(userId: number): Wallet {
  let w = wallets.find((w) => w.user_id === userId);
  if (!w) {
    w = {
      id: wallets.length + 1,
      user_id: userId,
      balance: 250,
      created_at: new Date().toISOString()
    };
    wallets.push(w);
    transactions.push({
      id: transactions.length + 1,
      wallet_id: w.id,
      amount: 250,
      tx_type: "signup_bonus",
      reason: "Bono de bienvenida AppBey",
      created_at: new Date().toISOString()
    });
  }
  return w;
}

function creditWallet(userId: number, amount: number, tx_type: string, reason: string, ref_id?: string): Transaction {
  const w = getWallet(userId);
  w.balance += amount;
  const tx: Transaction = {
    id: transactions.length + 1,
    wallet_id: w.id,
    amount,
    tx_type,
    reason,
    reference_id: ref_id,
    created_at: new Date().toISOString()
  };
  transactions.push(tx);
  return tx;
}

function debitWallet(userId: number, amount: number, tx_type: string, reason: string, ref_id?: string): Transaction {
  const w = getWallet(userId);
  if (w.balance < amount) {
    throw new Error(`Saldo insuficiente de AP Coins (${w.balance} disponibles, se requieren ${amount})`);
  }
  w.balance -= amount;
  const tx: Transaction = {
    id: transactions.length + 1,
    wallet_id: w.id,
    amount: -amount,
    tx_type,
    reason,
    reference_id: ref_id,
    created_at: new Date().toISOString()
  };
  transactions.push(tx);
  return tx;
}

function updateStatsAfterMatch(m: TournamentMatch) {
  const paPart = participants.find((p) => p.tournament_id === m.tournament_id && p.user_id === m.player_a_id);
  const pbPart = participants.find((p) => p.tournament_id === m.tournament_id && p.user_id === m.player_b_id);

  if (paPart) {
    paPart.matches_played += 1;
    paPart.points_scored += m.score_a;
    paPart.points_conceded += m.score_b;
    if (m.winner_id === paPart.user_id) {
      paPart.matches_won += 1;
      paPart.swiss_points += 3;
    } else if (m.winner_id === null) {
      paPart.matches_drawn += 1;
      paPart.swiss_points += 1;
    } else {
      paPart.matches_lost += 1;
    }
  }

  if (pbPart) {
    pbPart.matches_played += 1;
    pbPart.points_scored += m.score_b;
    pbPart.points_conceded += m.score_a;
    if (m.winner_id === pbPart.user_id) {
      pbPart.matches_won += 1;
      pbPart.swiss_points += 3;
    } else if (m.winner_id === null) {
      pbPart.matches_drawn += 1;
      pbPart.swiss_points += 1;
    } else {
      pbPart.matches_lost += 1;
    }
  }

  // Calculate Buchholz
  const allT = participants.filter((p) => p.tournament_id === m.tournament_id);
  const userMap = new Map(allT.map((p) => [p.user_id, p]));
  const tMatches = matches.filter((match) => match.tournament_id === m.tournament_id && match.status === "finished");
  
  for (const p of allT) {
    const oppIds: number[] = [];
    for (const match of tMatches) {
      if (match.player_a_id === p.user_id && match.player_b_id) oppIds.push(match.player_b_id);
      if (match.player_b_id === p.user_id && match.player_a_id) oppIds.push(match.player_a_id);
    }
    p.buchholz = oppIds.reduce((sum, oppId) => sum + (userMap.get(oppId)?.swiss_points || 0), 0);
  }
}

function distributePrizes(t: Tournament) {
  const pool = t.prize_pool_ap;
  if (pool <= 0) return;

  const p1 = Math.floor(pool * 0.60);
  const p2 = Math.floor(pool * 0.25);
  const p3 = Math.floor(pool * 0.15);

  if (t.winner_user_id) creditWallet(t.winner_user_id, p1, "tournament_prize", `1er Lugar: ${t.title}`, String(t.id));
  if (t.runner_up_user_id) creditWallet(t.runner_up_user_id, p2, "tournament_prize", `2do Lugar: ${t.title}`, String(t.id));
  if (t.third_place_user_id) creditWallet(t.third_place_user_id, p3, "tournament_prize", `3er Lugar: ${t.title}`, String(t.id));
}

function advanceSingleElimination(m: TournamentMatch) {
  const t = tournaments.find((tour) => tour.id === m.tournament_id);
  if (!t) return;

  const nextRound = m.round_number + 1;
  if (nextRound > t.total_rounds) {
    t.status = "completed";
    t.winner_user_id = m.winner_id;
    t.runner_up_user_id = m.winner_id === m.player_a_id ? m.player_b_id : m.player_a_id;
    distributePrizes(t);
    return;
  }

  const nextPos = Math.floor((m.bracket_position + 1) / 2);
  const isSlotA = m.bracket_position % 2 === 1;

  let nextMatch = matches.find((match) => match.tournament_id === t.id && match.round_number === nextRound && match.bracket_position === nextPos);
  if (!nextMatch) {
    nextMatch = {
      id: matches.length + 1,
      tournament_id: t.id,
      round_number: nextRound,
      stage: `Round ${nextRound}`,
      bracket_position: nextPos,
      station_number: (nextPos % 4) + 1,
      player_a_id: null,
      player_b_id: null,
      score_a: 0,
      score_b: 0,
      winner_id: null,
      status: "pending",
      is_bye: false,
      created_at: new Date().toISOString()
    };
    matches.push(nextMatch);
  }

  if (isSlotA) {
    nextMatch.player_a_id = m.winner_id;
  } else {
    nextMatch.player_b_id = m.winner_id;
  }
}

// ---------------------------------------------------------------------------
// API Routes: /api/v1/...
// ---------------------------------------------------------------------------

const api = express.Router();

// --- Auth ---
api.post("/auth/register", (req, res) => {
  const { username, email, password, display_name, country } = req.body;
  if (!username || !email || !password) {
    res.status(400).json({ detail: "Todos los campos son obligatorios" });
    return;
  }
  if (users.some((u) => u.username === username)) {
    res.status(400).json({ detail: "El nombre de usuario ya esta en uso" });
    return;
  }
  if (users.some((u) => u.email === email)) {
    res.status(400).json({ detail: "El correo electronico ya esta registrado" });
    return;
  }

  const newUser: User = {
    id: users.length + 1,
    username,
    email,
    password_hash: bcrypt.hashSync(password, 10),
    display_name: display_name || username,
    role: "blader",
    country: country || "PA",
    elo_rating: 1200,
    is_active: true,
    is_verified: false,
    created_at: new Date().toISOString()
  };
  users.push(newUser);
  getWallet(newUser.id);

  const token = generateToken(newUser);
  res.json({
    access_token: token,
    token_type: "bearer",
    user: {
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      display_name: newUser.display_name,
      role: newUser.role,
      country: newUser.country,
      avatar_url: newUser.avatar_url,
      elo_rating: newUser.elo_rating
    }
  });
});

api.post("/auth/login", (req, res) => {
  const { email, password } = req.body;
  const user = users.find((u) => u.email === email || u.username === email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    res.status(400).json({ detail: "Credenciales incorrectas" });
    return;
  }

  const token = generateToken(user);
  res.json({
    access_token: token,
    token_type: "bearer",
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      display_name: user.display_name,
      role: user.role,
      country: user.country,
      avatar_url: user.avatar_url,
      elo_rating: user.elo_rating
    }
  });
});

api.get("/auth/me", requireAuth, (req: AuthRequest, res) => {
  const u = req.user!;
  const w = getWallet(u.id);
  res.json({
    id: u.id,
    username: u.username,
    email: u.email,
    display_name: u.display_name,
    role: u.role,
    country: u.country,
    avatar_url: u.avatar_url,
    bio: u.bio,
    favorite_combo: u.favorite_combo,
    elo_rating: u.elo_rating,
    is_active: u.is_active,
    is_verified: u.is_verified,
    created_at: u.created_at,
    balance_ap: w.balance
  });
});

// --- Users ---
api.get("/users", (req, res) => {
  const role = req.query.role as string;
  const limit = parseInt((req.query.limit as string) || "50", 10);
  let list = users.filter((u) => u.is_active);
  if (role) list = list.filter((u) => u.role === role);
  list.sort((a, b) => b.elo_rating - a.elo_rating);
  res.json(
    list.slice(0, limit).map((u) => ({
      ...u,
      balance_ap: getWallet(u.id).balance
    }))
  );
});

api.get("/users/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  const u = users.find((user) => user.id === id);
  if (!u) {
    res.status(404).json({ detail: "Usuario no encontrado" });
    return;
  }
  res.json({
    ...u,
    balance_ap: getWallet(u.id).balance
  });
});

api.put("/users/me", requireAuth, (req: AuthRequest, res) => {
  const u = req.user!;
  const { display_name, country, avatar_url, bio, favorite_combo, role } = req.body;
  if (display_name !== undefined) u.display_name = display_name;
  if (country !== undefined) u.country = country;
  if (avatar_url !== undefined) u.avatar_url = avatar_url;
  if (bio !== undefined) u.bio = bio;
  if (favorite_combo !== undefined) u.favorite_combo = favorite_combo;
  if (role !== undefined && u.role === "admin") u.role = role;

  res.json({
    ...u,
    balance_ap: getWallet(u.id).balance
  });
});

api.post("/users/admin-create", requireRoles(["admin"]), (req: AuthRequest, res) => {
  const { username, email, password, display_name, role, country } = req.body;
  if (users.some((u) => u.username === username)) {
    res.status(400).json({ detail: "El nombre de usuario ya esta en uso" });
    return;
  }
  const newUser: User = {
    id: users.length + 1,
    username,
    email,
    password_hash: bcrypt.hashSync(password, 10),
    display_name: display_name || username,
    role: role || "blader",
    country: country || "PA",
    elo_rating: 1200,
    is_active: true,
    is_verified: true,
    created_at: new Date().toISOString()
  };
  users.push(newUser);
  getWallet(newUser.id);
  res.json({
    ...newUser,
    balance_ap: getWallet(newUser.id).balance
  });
});

api.put("/users/:id/role", requireRoles(["admin"]), (req: AuthRequest, res) => {
  const id = parseInt(req.params.id, 10);
  const target = users.find((u) => u.id === id);
  if (!target) {
    res.status(404).json({ detail: "Usuario no encontrado" });
    return;
  }
  target.role = req.body.role;
  res.json({
    ...target,
    balance_ap: getWallet(target.id).balance
  });
});

// --- Beyblades & Decks ---
api.get("/beyblades/parts", (req, res) => {
  const category = req.query.category as string;
  const system = req.query.system as string;
  const tier = req.query.tier as string;

  let list = [...parts];
  if (category) list = list.filter((p) => p.category === category);
  if (system) list = list.filter((p) => p.system === system);
  if (tier) list = list.filter((p) => p.tier === tier);
  res.json(list);
});

api.get("/beyblades/parts/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  const p = parts.find((part) => part.id === id);
  if (!p) {
    res.status(404).json({ detail: "Pieza no encontrada" });
    return;
  }
  res.json(p);
});

api.get("/beyblades/decks", (req, res) => {
  const userId = req.query.user_id ? parseInt(req.query.user_id as string, 10) : null;
  let list = [...decks];
  if (userId) {
    list = list.filter((d) => d.user_id === userId);
  } else {
    list = list.filter((d) => d.is_public);
  }
  res.json(
    list.map((d) => ({
      ...d,
      user: users.find((u) => u.id === d.user_id),
      slot1_blade: parts.find((p) => p.id === d.slot1_blade_id),
      slot1_ratchet: parts.find((p) => p.id === d.slot1_ratchet_id),
      slot1_bit: parts.find((p) => p.id === d.slot1_bit_id),
      slot2_blade: parts.find((p) => p.id === d.slot2_blade_id),
      slot2_ratchet: parts.find((p) => p.id === d.slot2_ratchet_id),
      slot2_bit: parts.find((p) => p.id === d.slot2_bit_id),
      slot3_blade: parts.find((p) => p.id === d.slot3_blade_id),
      slot3_ratchet: parts.find((p) => p.id === d.slot3_ratchet_id),
      slot3_bit: parts.find((p) => p.id === d.slot3_bit_id)
    }))
  );
});

api.post("/beyblades/decks", requireAuth, (req: AuthRequest, res) => {
  const u = req.user!;
  const data = req.body;
  const pIds = [
    data.slot1_blade_id, data.slot1_ratchet_id, data.slot1_bit_id,
    data.slot2_blade_id, data.slot2_ratchet_id, data.slot2_bit_id,
    data.slot3_blade_id, data.slot3_ratchet_id, data.slot3_bit_id
  ].filter(Boolean);

  const selectedParts = parts.filter((p) => pIds.includes(p.id));
  const totalW = selectedParts.reduce((sum, p) => sum + p.weight_grams, 0);

  const newDeck: BladerDeck = {
    id: decks.length + 1,
    user_id: u.id,
    name: data.name,
    description: data.description,
    is_public: data.is_public !== false,
    slot1_name: data.slot1_name,
    slot1_blade_id: data.slot1_blade_id,
    slot1_ratchet_id: data.slot1_ratchet_id,
    slot1_bit_id: data.slot1_bit_id,
    slot2_name: data.slot2_name,
    slot2_blade_id: data.slot2_blade_id,
    slot2_ratchet_id: data.slot2_ratchet_id,
    slot2_bit_id: data.slot2_bit_id,
    slot3_name: data.slot3_name,
    slot3_blade_id: data.slot3_blade_id,
    slot3_ratchet_id: data.slot3_ratchet_id,
    slot3_bit_id: data.slot3_bit_id,
    total_weight: Math.round(totalW * 10) / 10,
    created_at: new Date().toISOString()
  };
  decks.unshift(newDeck);
  res.json({
    ...newDeck,
    user: u,
    slot1_blade: parts.find((p) => p.id === newDeck.slot1_blade_id),
    slot1_ratchet: parts.find((p) => p.id === newDeck.slot1_ratchet_id),
    slot1_bit: parts.find((p) => p.id === newDeck.slot1_bit_id),
    slot2_blade: parts.find((p) => p.id === newDeck.slot2_blade_id),
    slot2_ratchet: parts.find((p) => p.id === newDeck.slot2_ratchet_id),
    slot2_bit: parts.find((p) => p.id === newDeck.slot2_bit_id),
    slot3_blade: parts.find((p) => p.id === newDeck.slot3_blade_id),
    slot3_ratchet: parts.find((p) => p.id === newDeck.slot3_ratchet_id),
    slot3_bit: parts.find((p) => p.id === newDeck.slot3_bit_id)
  });
});

api.delete("/beyblades/decks/:id", requireAuth, (req: AuthRequest, res) => {
  const id = parseInt(req.params.id, 10);
  const deckIndex = decks.findIndex((d) => d.id === id);
  if (deckIndex === -1) {
    res.status(404).json({ detail: "Deck no encontrado" });
    return;
  }
  const deck = decks[deckIndex];
  if (deck.user_id !== req.user!.id && req.user!.role !== "admin") {
    res.status(403).json({ detail: "No tienes permisos para eliminar este deck" });
    return;
  }
  decks.splice(deckIndex, 1);
  res.json({ message: "Deck eliminado exitosamente" });
});

// --- Tournaments ---
api.get("/tournaments", (req, res) => {
  const status = req.query.status as string;
  const country = req.query.country as string;
  let list = [...tournaments];
  if (status) list = list.filter((t) => t.status === status);
  if (country) list = list.filter((t) => t.country === country);

  res.json(
    list.map((t) => ({
      ...t,
      organizer: users.find((u) => u.id === t.organizer_id),
      winner: users.find((u) => u.id === t.winner_user_id),
      participants_count: participants.filter((p) => p.tournament_id === t.id).length
    }))
  );
});

api.post("/tournaments", requireRoles(["organizer", "admin"]), (req: AuthRequest, res) => {
  const data = req.body;
  const slug = (data.title || "torneo").toLowerCase().replace(/[^a-z0-9]+/g, "-") + `-${Date.now()}`;
  const newT: Tournament = {
    id: tournaments.length + 1,
    slug,
    title: data.title,
    description: data.description,
    organizer_id: req.user!.id,
    format: data.format || "swiss",
    battle_type: data.battle_type || "3on3_deck",
    match_target_points: data.match_target_points || 4,
    stadium_type: data.stadium_type || "Xtreme Stadium (BX-10)",
    max_participants: data.max_participants || 16,
    entry_fee_ap: data.entry_fee_ap || 0,
    prize_pool_ap: data.prize_pool_ap || 1000,
    status: "registration_open",
    venue_name: data.venue_name || "Arena Beyblade",
    venue_address: data.venue_address || "Ciudad",
    country: data.country || "PA",
    start_date: data.start_date || new Date().toISOString(),
    current_round: 0,
    total_rounds: data.total_rounds || 4,
    is_official: data.is_official !== false,
    winner_user_id: null,
    created_at: new Date().toISOString()
  };
  tournaments.unshift(newT);
  res.json({
    ...newT,
    organizer: req.user,
    winner: null,
    participants_count: 0
  });
});

api.get("/tournaments/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  const t = tournaments.find((tour) => tour.id === id);
  if (!t) {
    res.status(404).json({ detail: "Torneo no encontrado" });
    return;
  }
  res.json({
    ...t,
    organizer: users.find((u) => u.id === t.organizer_id),
    winner: users.find((u) => u.id === t.winner_user_id),
    participants_count: participants.filter((p) => p.tournament_id === t.id).length
  });
});

api.post("/tournaments/:id/register", requireAuth, (req: AuthRequest, res) => {
  const id = parseInt(req.params.id, 10);
  const t = tournaments.find((tour) => tour.id === id);
  if (!t) {
    res.status(404).json({ detail: "Torneo no encontrado" });
    return;
  }
  if (!["registration_open", "check_in"].includes(t.status)) {
    res.status(400).json({ detail: "Las inscripciones para este torneo estan cerradas" });
    return;
  }

  const existing = participants.find((p) => p.tournament_id === id && p.user_id === req.user!.id);
  if (existing) {
    res.status(400).json({ detail: "Ya estas inscrito en este torneo" });
    return;
  }

  const count = participants.filter((p) => p.tournament_id === id).length;
  if (count >= t.max_participants) {
    res.status(400).json({ detail: "El cupo maximo de participantes se ha completado" });
    return;
  }

  if (t.entry_fee_ap > 0) {
    try {
      debitWallet(req.user!.id, t.entry_fee_ap, "tournament_entry", `Inscripcion a: ${t.title}`, String(t.id));
    } catch (err: any) {
      res.status(400).json({ detail: err.message });
      return;
    }
  }

  const newPart: TournamentParticipant = {
    id: participants.length + 1,
    tournament_id: t.id,
    user_id: req.user!.id,
    seed: count + 1,
    checked_in: false,
    checked_in_at: null,
    swiss_points: 0,
    buchholz: 0,
    points_scored: 0,
    points_conceded: 0,
    matches_played: 0,
    matches_won: 0,
    matches_drawn: 0,
    matches_lost: 0,
    final_rank: null
  };
  participants.push(newPart);
  res.json({ message: "Inscripcion exitosa", participant_id: newPart.id });
});

// Admin / Organizer manual participant addition (e.g. Easy Tournament desk entry)
api.post("/tournaments/:id/add-participant", requireRoles(["organizer", "admin"]), (req: AuthRequest, res) => {
  const id = parseInt(req.params.id, 10);
  const { user_id, checked_in } = req.body;
  const t = tournaments.find((tour) => tour.id === id);
  if (!t) {
    res.status(404).json({ detail: "Torneo no encontrado" });
    return;
  }
  const targetUser = users.find((u) => u.id === parseInt(user_id, 10));
  if (!targetUser) {
    res.status(404).json({ detail: "Usuario no encontrado" });
    return;
  }

  const existing = participants.find((p) => p.tournament_id === id && p.user_id === targetUser.id);
  if (existing) {
    res.status(400).json({ detail: "El usuario ya está registrado en este torneo" });
    return;
  }

  const count = participants.filter((p) => p.tournament_id === id).length;
  const newPart: TournamentParticipant = {
    id: participants.length + 1,
    tournament_id: t.id,
    user_id: targetUser.id,
    seed: count + 1,
    checked_in: checked_in !== false,
    checked_in_at: checked_in !== false ? new Date().toISOString() : null,
    swiss_points: 0,
    buchholz: 0,
    points_scored: 0,
    points_conceded: 0,
    matches_played: 0,
    matches_won: 0,
    matches_drawn: 0,
    matches_lost: 0,
    final_rank: null
  };
  participants.push(newPart);
  res.json({ message: "Participante agregado exitosamente", participant: { ...newPart, user: targetUser } });
});

// Admin / Organizer assign referee to match or station
api.post("/matches/:id/assign-referee", requireRoles(["organizer", "admin"]), (req: AuthRequest, res) => {
  const id = parseInt(req.params.id, 10);
  const { referee_id } = req.body;
  const m = matches.find((match) => match.id === id);
  if (!m) {
    res.status(404).json({ detail: "Match no encontrado" });
    return;
  }
  const referee = users.find((u) => u.id === parseInt(referee_id, 10));
  if (!referee) {
    res.status(404).json({ detail: "Árbitro no encontrado" });
    return;
  }
  m.referee_id = referee.id;
  broadcastTournament(m.tournament_id, "match_referee_assigned", { match_id: m.id, referee_id: referee.id, referee_name: referee.display_name });
  res.json({ message: "Árbitro asignado al match", match: m, referee });
});

api.post("/tournaments/:id/checkin", requireAuth, (req: AuthRequest, res) => {
  const id = parseInt(req.params.id, 10);
  const userId = parseInt(req.query.user_id as string, 10);
  const t = tournaments.find((tour) => tour.id === id);
  if (!t) {
    res.status(404).json({ detail: "Torneo no encontrado" });
    return;
  }
  if (req.user!.id !== userId && !["organizer", "referee", "admin"].includes(req.user!.role)) {
    res.status(403).json({ detail: "No tienes permisos para realizar check-in de otro Blader" });
    return;
  }

  const part = participants.find((p) => p.tournament_id === id && p.user_id === userId);
  if (!part) {
    res.status(404).json({ detail: "El usuario no esta inscrito en este torneo" });
    return;
  }
  part.checked_in = true;
  part.checked_in_at = new Date().toISOString();
  res.json({ message: "Check-in confirmado", user_id: userId });
});

api.get("/tournaments/:id/participants", (req, res) => {
  const id = parseInt(req.params.id, 10);
  const list = participants
    .filter((p) => p.tournament_id === id)
    .sort((a, b) => b.swiss_points - a.swiss_points || b.buchholz - a.buchholz);

  res.json(
    list.map((p) => ({
      ...p,
      user: users.find((u) => u.id === p.user_id)
    }))
  );
});

api.get("/tournaments/:id/matches", (req, res) => {
  const id = parseInt(req.params.id, 10);
  const round = req.query.round_number ? parseInt(req.query.round_number as string, 10) : null;
  let list = matches.filter((m) => m.tournament_id === id);
  if (round) list = list.filter((m) => m.round_number === round);
  list.sort((a, b) => a.round_number - b.round_number || a.bracket_position - b.bracket_position);

  res.json(
    list.map((m) => ({
      ...m,
      player_a: users.find((u) => u.id === m.player_a_id) || null,
      player_b: users.find((u) => u.id === m.player_b_id) || null,
      winner: users.find((u) => u.id === m.winner_id) || null,
      referee: users.find((u) => u.id === m.referee_id) || null,
      games: matchGames.filter((g) => g.match_id === m.id)
    }))
  );
});

api.post("/tournaments/:id/start", requireRoles(["organizer", "admin"]), (req: AuthRequest, res) => {
  const id = parseInt(req.params.id, 10);
  const t = tournaments.find((tour) => tour.id === id);
  if (!t) {
    res.status(404).json({ detail: "Torneo no encontrado" });
    return;
  }

  const parts = participants.filter((p) => p.tournament_id === id && p.checked_in);
  if (parts.length < 2) {
    res.status(400).json({ detail: "Se requieren al menos 2 participantes confirmados" });
    return;
  }

  t.status = "in_progress";
  t.current_round = 1;

  if (t.format === "swiss") {
    // Generate Round 1 pairings
    for (let i = 0; i < parts.length; i += 2) {
      const p1 = parts[i];
      const p2 = parts[i + 1] || null;
      const isBye = !p2;

      matches.push({
        id: matches.length + 1,
        tournament_id: t.id,
        round_number: 1,
        stage: "swiss",
        bracket_position: Math.floor(i / 2) + 1,
        station_number: (Math.floor(i / 2) % 4) + 1,
        player_a_id: p1.user_id,
        player_b_id: p2 ? p2.user_id : null,
        score_a: isBye ? t.match_target_points : 0,
        score_b: 0,
        winner_id: isBye ? p1.user_id : null,
        status: isBye ? "finished" : "pending",
        is_bye: isBye,
        created_at: new Date().toISOString()
      });
      if (isBye) {
        p1.swiss_points += 3;
        p1.matches_won += 1;
        p1.matches_played += 1;
      }
    }
  } else {
    // Single Elim Bracket
    let bracketSize = 1;
    while (bracketSize < parts.length) bracketSize *= 2;
    t.total_rounds = Math.log2(bracketSize);

    for (let pos = 0; pos < bracketSize / 2; pos++) {
      const p1 = parts[pos] || null;
      const p2 = parts[bracketSize - 1 - pos] || null;
      const p1_id = p1 ? p1.user_id : null;
      const p2_id = p2 ? p2.user_id : null;
      const isBye = !p1_id || !p2_id;
      const winner_id = !p2_id ? p1_id : (!p1_id ? p2_id : null);

      matches.push({
        id: matches.length + 1,
        tournament_id: t.id,
        round_number: 1,
        stage: "Round 1",
        bracket_position: pos + 1,
        station_number: (pos % 4) + 1,
        player_a_id: p1_id,
        player_b_id: p2_id,
        score_a: isBye ? t.match_target_points : 0,
        score_b: 0,
        winner_id,
        status: isBye ? "finished" : "pending",
        is_bye: isBye,
        created_at: new Date().toISOString()
      });
    }
  }

  broadcastTournament(t.id, "tournament_updated", { tournament_id: t.id, status: t.status, current_round: t.current_round });
  res.json({ message: "Torneo iniciado exitosamente", current_round: t.current_round });
});

api.post("/tournaments/:id/next-round", requireRoles(["organizer", "admin"]), (req: AuthRequest, res) => {
  const id = parseInt(req.params.id, 10);
  const t = tournaments.find((tour) => tour.id === id);
  if (!t) {
    res.status(404).json({ detail: "Torneo no encontrado" });
    return;
  }

  if (t.format === "swiss") {
    const nextRound = t.current_round + 1;
    if (nextRound > t.total_rounds) {
      t.status = "completed";
      const parts = participants
        .filter((p) => p.tournament_id === id)
        .sort((a, b) => b.swiss_points - a.swiss_points || b.buchholz - a.buchholz);
      if (parts[0]) t.winner_user_id = parts[0].user_id;
      if (parts[1]) t.runner_up_user_id = parts[1].user_id;
      if (parts[2]) t.third_place_user_id = parts[2].user_id;
      distributePrizes(t);
      broadcastTournament(t.id, "tournament_updated", { tournament_id: t.id, status: "completed" });
      res.json({ message: "Torneo finalizado", current_round: t.current_round });
      return;
    }

    t.current_round = nextRound;
    const parts = participants
      .filter((p) => p.tournament_id === id && p.checked_in)
      .sort((a, b) => b.swiss_points - a.swiss_points || b.buchholz - a.buchholz);

    for (let i = 0; i < parts.length; i += 2) {
      const p1 = parts[i];
      const p2 = parts[i + 1] || null;
      const isBye = !p2;

      matches.push({
        id: matches.length + 1,
        tournament_id: t.id,
        round_number: nextRound,
        stage: "swiss",
        bracket_position: Math.floor(i / 2) + 1,
        station_number: (Math.floor(i / 2) % 4) + 1,
        player_a_id: p1.user_id,
        player_b_id: p2 ? p2.user_id : null,
        score_a: isBye ? t.match_target_points : 0,
        score_b: 0,
        winner_id: isBye ? p1.user_id : null,
        status: isBye ? "finished" : "pending",
        is_bye: isBye,
        created_at: new Date().toISOString()
      });
      if (isBye) {
        p1.swiss_points += 3;
        p1.matches_won += 1;
        p1.matches_played += 1;
      }
    }

    broadcastTournament(t.id, "tournament_updated", { tournament_id: t.id, current_round: nextRound });
    res.json({ message: `Ronda ${nextRound} generada exitosamente`, current_round: nextRound });
  } else {
    res.json({ message: "Las rondas de eliminacion avanzan automaticamente al finalizar cada match" });
  }
});

// --- Matches & Referee Pad ---
api.get("/matches/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  const m = matches.find((match) => match.id === id);
  if (!m) {
    res.status(404).json({ detail: "Match no encontrado" });
    return;
  }
  res.json({
    ...m,
    player_a: users.find((u) => u.id === m.player_a_id) || null,
    player_b: users.find((u) => u.id === m.player_b_id) || null,
    winner: users.find((u) => u.id === m.winner_id) || null,
    referee: users.find((u) => u.id === m.referee_id) || null,
    tournament: tournaments.find((t) => t.id === m.tournament_id),
    games: matchGames.filter((g) => g.match_id === m.id)
  });
});

api.post("/matches/:id/call", requireAuth, (req: AuthRequest, res) => {
  const id = parseInt(req.params.id, 10);
  const m = matches.find((match) => match.id === id);
  if (!m) {
    res.status(404).json({ detail: "Match no encontrado" });
    return;
  }
  const { station_number, status } = req.body;
  if (station_number) m.station_number = station_number;
  if (status) m.status = status;

  const playerA = users.find((u) => u.id === m.player_a_id);
  const playerB = users.find((u) => u.id === m.player_b_id);

  broadcastTournament(m.tournament_id, "match_call", {
    match_id: m.id,
    station_number: m.station_number,
    status: m.status,
    player_a: playerA ? playerA.display_name : "TBD",
    player_b: playerB ? playerB.display_name : "TBD"
  });

  res.json({ message: `Match llamado a Stadium ${m.station_number}`, match_id: m.id });
});

api.post("/matches/:id/record-finish", requireAuth, (req: AuthRequest, res) => {
  const id = parseInt(req.params.id, 10);
  const m = matches.find((match) => match.id === id);
  if (!m) {
    res.status(404).json({ detail: "Match no encontrado" });
    return;
  }

  const { finish_type, awarded_to, notes } = req.body;
  const pointsMap: Record<string, number> = {
    spin_finish_1p: 1,
    over_finish_2p: 2,
    burst_finish_2p: 2,
    xtreme_finish_3p: 3,
    penalty_1p: 1,
    draw_0p: 0
  };
  const pts = pointsMap[finish_type] || 1;

  if (!m.referee_id) m.referee_id = req.user!.id;

  const newGame: MatchGame = {
    id: matchGames.length + 1,
    match_id: m.id,
    game_order: matchGames.filter((g) => g.match_id === m.id).length + 1,
    finish_type,
    awarded_to,
    points: pts,
    notes,
    created_at: new Date().toISOString()
  };
  matchGames.push(newGame);

  if (awarded_to === "player_a") m.score_a += pts;
  else if (awarded_to === "player_b") m.score_b += pts;

  const t = tournaments.find((tour) => tour.id === m.tournament_id);
  const target = t?.match_target_points || 4;

  if (m.score_a >= target || m.score_b >= target) {
    m.status = "finished";
    if (m.score_a > m.score_b) m.winner_id = m.player_a_id;
    else if (m.score_b > m.score_a) m.winner_id = m.player_b_id;

    updateStatsAfterMatch(m);
    if (m.player_a_id && m.player_b_id && m.winner_id) {
      updateEloRatings(m.player_a_id, m.player_b_id, m.winner_id);
    }
    if (t && t.format === "single_elim") {
      advanceSingleElimination(m);
    }
  } else {
    m.status = "in_progress";
  }

  broadcastTournament(m.tournament_id, "score_update", {
    match_id: m.id,
    station_number: m.station_number,
    score_a: m.score_a,
    score_b: m.score_b,
    status: m.status,
    winner_id: m.winner_id,
    last_finish: finish_type,
    awarded_to
  });

  res.json({
    ...m,
    player_a: users.find((u) => u.id === m.player_a_id) || null,
    player_b: users.find((u) => u.id === m.player_b_id) || null,
    winner: users.find((u) => u.id === m.winner_id) || null,
    referee: users.find((u) => u.id === m.referee_id) || null,
    games: matchGames.filter((g) => g.match_id === m.id)
  });
});

// --- Wallets ---
api.get("/wallets/me", requireAuth, (req: AuthRequest, res) => {
  const w = getWallet(req.user!.id);
  const txs = transactions.filter((t) => t.wallet_id === w.id);
  res.json({
    ...w,
    transactions: txs
  });
});

api.post("/wallets/transfer", requireAuth, (req: AuthRequest, res) => {
  const { recipient_username, amount, reason } = req.body;
  if (!amount || amount <= 0) {
    res.status(400).json({ detail: "El monto debe ser mayor a 0 AP" });
    return;
  }
  const recipient = users.find((u) => u.username === recipient_username);
  if (!recipient) {
    res.status(404).json({ detail: "Usuario destinatario no encontrado" });
    return;
  }
  if (recipient.id === req.user!.id) {
    res.status(400).json({ detail: "No puedes transferirte a ti mismo" });
    return;
  }

  try {
    debitWallet(req.user!.id, amount, "transfer_out", `Transferencia a @${recipient.username}: ${reason}`);
    const tx = creditWallet(recipient.id, amount, "transfer_in", `Transferencia recibida de @${req.user!.username}: ${reason}`);
    res.json(tx);
  } catch (err: any) {
    res.status(400).json({ detail: err.message });
  }
});

api.post("/wallets/daily-reward", requireAuth, (req: AuthRequest, res) => {
  const tx = creditWallet(req.user!.id, 50, "daily_bonus", "Recompensa diaria de entrenamiento Blader");
  res.json(tx);
});

// --- Rankings & Hall of Fame ---
api.get("/rankings/leaderboard", (req, res) => {
  const country = req.query.country as string;
  let list = users.filter((u) => u.is_active);
  if (country) list = list.filter((u) => u.country === country);
  list.sort((a, b) => b.elo_rating - a.elo_rating);

  res.json(
    list.map((u, idx) => ({
      rank: idx + 1,
      user_id: u.id,
      username: u.username,
      display_name: u.display_name,
      country: u.country,
      avatar_url: u.avatar_url,
      elo_rating: u.elo_rating,
      favorite_combo: u.favorite_combo,
      role: u.role
    }))
  );
});

api.get("/rankings/hall-of-fame", (req, res) => {
  res.json(
    hallOfFame.map((e) => {
      const u = users.find((user) => user.id === e.user_id);
      return {
        id: e.id,
        year: e.year,
        title: e.title,
        blader_name: u?.display_name || "Blader Leyenda",
        blader_username: u?.username || "blader",
        blader_avatar: u?.avatar_url,
        country: u?.country || "PA",
        tournament_name: e.tournament_name,
        signature_deck: e.signature_deck,
        trophy_icon: e.trophy_icon,
        notes: e.notes
      };
    })
  );
});

api.get("/rankings/seasons", (req, res) => {
  res.json(seasons);
});

api.get("/rankings/season/:id/points", (req, res) => {
  const seasonId = parseInt(req.params.id, 10);
  const rows = seasonRankings
    .filter((r) => r.season_id === seasonId)
    .sort((a, b) => b.points - a.points);

  res.json(
    rows.map((r, idx) => {
      const u = users.find((user) => user.id === r.user_id);
      const played = r.matches_won + r.matches_lost;
      return {
        rank: r.overall_rank || idx + 1,
        user_id: r.user_id,
        display_name: u?.display_name,
        username: u?.username,
        tournaments_played: r.tournaments_played,
        matches_played: played,
        matches_won: r.matches_won,
        matches_lost: r.matches_lost,
        points_for: r.points_for,
        points_against: r.points_against,
        bonus_points: r.bonus_points,
        warnings: r.warnings,
        win_rate: played ? Math.round((r.matches_won / played) * 1000) / 10 : 0,
        points: r.points
      };
    })
  );
});

api.get("/rankings/season/:id/elo", (req, res) => {
  const seasonId = parseInt(req.params.id, 10);
  const rows = seasonRankings
    .filter((r) => r.season_id === seasonId)
    .sort((a, b) => b.elo - a.elo);

  res.json(
    rows.map((r, idx) => {
      const u = users.find((user) => user.id === r.user_id);
      return {
        rank: idx + 1,
        user_id: r.user_id,
        display_name: u?.display_name,
        username: u?.username,
        elo: r.elo
      };
    })
  );
});

// --- Social & Community ---
api.get("/social/posts", (req, res) => {
  const limit = parseInt((req.query.limit as string) || "30", 10);
  const list = [...communityPosts].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, limit);
  res.json(
    list.map((p) => ({
      ...p,
      user: users.find((u) => u.id === p.user_id),
      deck: decks.find((d) => d.id === p.deck_id),
      comments: postComments.filter((c) => c.post_id === p.id).map((c) => ({
        ...c,
        user: users.find((u) => u.id === c.user_id)
      }))
    }))
  );
});

api.post("/social/posts", requireAuth, (req: AuthRequest, res) => {
  const { content, deck_id, image_url } = req.body;
  const newPost: CommunityPost = {
    id: communityPosts.length + 1,
    user_id: req.user!.id,
    content,
    deck_id: deck_id || null,
    image_url: image_url || null,
    likes_count: 0,
    comments_count: 0,
    created_at: new Date().toISOString()
  };
  communityPosts.unshift(newPost);
  res.json({
    ...newPost,
    user: req.user,
    deck: decks.find((d) => d.id === newPost.deck_id),
    comments: []
  });
});

api.post("/social/posts/:id/like", (req, res) => {
  const id = parseInt(req.params.id, 10);
  const p = communityPosts.find((post) => post.id === id);
  if (!p) {
    res.status(404).json({ detail: "Publicacion no encontrada" });
    return;
  }
  p.likes_count += 1;
  res.json({ likes_count: p.likes_count });
});

api.post("/social/posts/:id/comments", requireAuth, (req: AuthRequest, res) => {
  const id = parseInt(req.params.id, 10);
  const p = communityPosts.find((post) => post.id === id);
  if (!p) {
    res.status(404).json({ detail: "Publicacion no encontrada" });
    return;
  }
  const newComment: PostComment = {
    id: postComments.length + 1,
    post_id: p.id,
    user_id: req.user!.id,
    content: req.body.content,
    created_at: new Date().toISOString()
  };
  postComments.push(newComment);
  p.comments_count += 1;
  res.json({
    ...newComment,
    user: req.user
  });
});

api.get("/social/notifications", requireAuth, (req: AuthRequest, res) => {
  const list = notifications
    .filter((n) => n.user_id === req.user!.id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  res.json(list);
});

api.post("/social/notifications/mark-read", requireAuth, (req: AuthRequest, res) => {
  for (const n of notifications) {
    if (n.user_id === req.user!.id) {
      n.is_read = true;
    }
  }
  res.json({ message: "Notificaciones marcadas como leidas" });
});

// Mount API
api.get("/health", (req, res) => {
  res.json({ status: "ok", app: "AppBey", version: "2.0.0" });
});

app.use("/api/v1", api);

// ---------------------------------------------------------------------------
// Static Assets & Frontend Serving
// ---------------------------------------------------------------------------

const frontendPath = path.join(process.cwd(), "frontend");

app.use("/assets", express.static(path.join(frontendPath, "assets")));
app.use("/css", express.static(path.join(frontendPath, "css")));
app.use("/js", express.static(path.join(frontendPath, "js")));

app.get("/manifest.json", (req, res) => {
  const manifestFile = path.join(frontendPath, "manifest.json");
  if (fs.existsSync(manifestFile)) {
    res.sendFile(manifestFile);
  } else {
    res.json({ name: "AppBey" });
  }
});

app.get("/sw.js", (req, res) => {
  const swFile = path.join(frontendPath, "sw.js");
  if (fs.existsSync(swFile)) {
    res.type("application/javascript").sendFile(swFile);
  } else {
    res.send("");
  }
});

app.use((req, res) => {
  const indexFile = path.join(frontendPath, "index.html");
  if (fs.existsSync(indexFile)) {
    res.sendFile(indexFile);
  } else {
    res.send("AppBey Server Online");
  }
});

// Start Server
server.listen(PORT, "0.0.0.0", () => {
  console.log(`AppBey server is running on http://0.0.0.0:${PORT}`);
});
