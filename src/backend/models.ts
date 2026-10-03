export interface User {
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

export interface BeybladePart {
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
  tier: "S" | "A" | "B" | "C" | "N";
  description: string;
  pick_rate_pct?: number;
  win_rate_pct?: number;
  trend?: "up" | "down" | "stable" | "new";
  trend_label?: string;
  best_combo?: string;
  official_ruling?: string;
  last_updated?: string;
  source_reference?: string;
}

export interface MetaSyncState {
  source_name: string;
  source_url?: string;
  official_url: string;
  secondary_url: string;
  meta_version: string;
  last_synced_at: string;
  total_matches_analyzed: number;
  status: "live_connected" | "synced" | "demo" | "not_configured" | "syncing" | "error";
  auto_sync_interval_mins: number;
  patch_notes: string[];
  last_error?: string;
}

export interface BladerDeck {
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

export interface Tournament {
  id: number;
  slug: string;
  title: string;
  description: string;
  organizer_id: number;
  format: "groups_elim" | "round_robin" | "swiss" | "single_elim";
  stage_type?: "group_stage" | "knockout" | "completed";
  group_count?: number;
  group_ids?: string[];
  advancers_per_group?: number;
  tie_break_priority: string[];
  knockout_round_name?: string;
  battle_type: string;
  match_target_points: number;
  stadium_type: string;
  max_participants: number;
  prize_description: string;
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

export interface TournamentParticipant {
  id: number;
  tournament_id: number;
  user_id: number;
  seed: number;
  group_id?: string | null;
  group_seed?: number | null;
  group_points?: number;
  group_matches_won?: number;
  group_matches_drawn?: number;
  group_matches_lost?: number;
  group_points_scored?: number;
  group_points_conceded?: number;
  group_diff?: number;
  group_rank?: number | null;
  is_qualified_playoffs?: boolean;
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
  deck?: string[];
  deck_notes?: string;
}

export interface MatchGame {
  id: number;
  match_id: number;
  game_order: number;
  finish_type: string;
  awarded_to: "player_a" | "player_b" | "draw";
  points: number;
  set_number?: number;
  notes?: string;
  created_at: string;
}

export interface TournamentMatch {
  id: number;
  tournament_id: number;
  round_number: number;
  stage: string;
  group_id?: string | null;
  bracket_position: number;
  station_number: number;
  player_a_id: number | null;
  player_b_id: number | null;
  score_a: number;
  score_b: number;
  winner_id: number | null;
  referee_id?: number | null;
  target_points?: number;
  set_target_points?: number;
  sets_won_a?: number;
  sets_won_b?: number;
  sets?: Array<{ set_number: number; score_a: number; score_b: number; winner_id: number | null }>;
  status: "pending" | "calling" | "in_progress" | "finished";
  is_bye: boolean;
  walkover_pending?: "player_a" | "player_b" | null;
  created_at: string;
  updated_at?: string;
}

export interface Season {
  id: number;
  name: string;
  is_active: boolean;
  description: string;
  start_date: string;
}

export interface SeasonRanking {
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

export interface HallOfFame {
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

export interface CommunityPost {
  id: number;
  user_id: number;
  content: string;
  deck_id?: number | null;
  image_url?: string | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
}

export interface PostLike {
  id: number;
  post_id: number;
  user_id: number;
  created_at: string;
}

export interface PostComment {
  id: number;
  post_id: number;
  user_id: number;
  content: string;
  created_at: string;
}

export interface Notification {
  id: number;
  user_id: number;
  notif_type: string;
  title: string;
  message: string;
  link?: string;
  is_read: boolean;
  created_at: string;
}
