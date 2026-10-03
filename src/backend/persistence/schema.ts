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
  User} from "../models.js";
export type PersistedState = {
  users: User[];
  parts: BeybladePart[];
  decks: BladerDeck[];
  tournaments: Tournament[];
  participants: TournamentParticipant[];
  matches: TournamentMatch[];
  matchGames: MatchGame[];
  seasons: Season[];
  seasonRankings: SeasonRanking[];
  hallOfFame: HallOfFame[];
  communityPosts: CommunityPost[];
  postLikes: PostLike[];
  postComments: PostComment[];
  notifications: Notification[];
  metaSyncState: MetaSyncState;
};

export type PersistedCollectionName = Exclude<keyof PersistedState, "metaSyncState">;
type PersistenceColumn = { name: string; type: string; field: string };
export type PersistenceTable = {
  key: PersistedCollectionName;
  name: string;
  columns: PersistenceColumn[];
  indexes?: string[];
};

export const persistenceTables: PersistenceTable[] = [
  { key: "users", name: "appbey_users", columns: [
    { name: "username", type: "TEXT", field: "username" },
    { name: "email", type: "TEXT", field: "email" },
    { name: "password_hash", type: "TEXT", field: "password_hash" },
    { name: "role", type: "TEXT", field: "role" },
    { name: "display_name", type: "TEXT", field: "display_name" },
    { name: "country", type: "TEXT", field: "country" },
    { name: "avatar_url", type: "TEXT", field: "avatar_url" },
    { name: "bio", type: "TEXT", field: "bio" },
    { name: "favorite_combo", type: "TEXT", field: "favorite_combo" },
    { name: "elo_rating", type: "INTEGER", field: "elo_rating" },
    { name: "is_active", type: "BOOLEAN", field: "is_active" },
    { name: "is_verified", type: "BOOLEAN", field: "is_verified" },
    { name: "created_at", type: "TEXT", field: "created_at" }
  ], indexes: ["username", "email", "role"] },
  { key: "parts", name: "appbey_parts", columns: [
    { name: "code", type: "TEXT", field: "code" },
    { name: "name", type: "TEXT", field: "name" },
    { name: "category", type: "TEXT", field: "category" },
    { name: "system", type: "TEXT", field: "system" },
    { name: "type_attr", type: "TEXT", field: "type_attr" },
    { name: "weight_grams", type: "NUMERIC", field: "weight_grams" },
    { name: "attack_stat", type: "INTEGER", field: "attack_stat" },
    { name: "defense_stat", type: "INTEGER", field: "defense_stat" },
    { name: "stamina_stat", type: "INTEGER", field: "stamina_stat" },
    { name: "dash_stat", type: "INTEGER", field: "dash_stat" },
    { name: "tier", type: "TEXT", field: "tier" },
    { name: "description", type: "TEXT", field: "description" },
    { name: "pick_rate_pct", type: "NUMERIC", field: "pick_rate_pct" },
    { name: "win_rate_pct", type: "NUMERIC", field: "win_rate_pct" },
    { name: "trend", type: "TEXT", field: "trend" },
    { name: "trend_label", type: "TEXT", field: "trend_label" },
    { name: "best_combo", type: "TEXT", field: "best_combo" },
    { name: "official_ruling", type: "TEXT", field: "official_ruling" },
    { name: "last_updated", type: "TEXT", field: "last_updated" },
    { name: "source_reference", type: "TEXT", field: "source_reference" }
  ], indexes: ["code", "category"] },
  { key: "decks", name: "appbey_decks", columns: [
    { name: "user_id", type: "BIGINT", field: "user_id" },
    { name: "name", type: "TEXT", field: "name" },
    { name: "description", type: "TEXT", field: "description" },
    { name: "is_public", type: "BOOLEAN", field: "is_public" },
    { name: "slot1_name", type: "TEXT", field: "slot1_name" },
    { name: "slot1_blade_id", type: "BIGINT", field: "slot1_blade_id" },
    { name: "slot1_ratchet_id", type: "BIGINT", field: "slot1_ratchet_id" },
    { name: "slot1_bit_id", type: "BIGINT", field: "slot1_bit_id" },
    { name: "slot2_name", type: "TEXT", field: "slot2_name" },
    { name: "slot2_blade_id", type: "BIGINT", field: "slot2_blade_id" },
    { name: "slot2_ratchet_id", type: "BIGINT", field: "slot2_ratchet_id" },
    { name: "slot2_bit_id", type: "BIGINT", field: "slot2_bit_id" },
    { name: "slot3_name", type: "TEXT", field: "slot3_name" },
    { name: "slot3_blade_id", type: "BIGINT", field: "slot3_blade_id" },
    { name: "slot3_ratchet_id", type: "BIGINT", field: "slot3_ratchet_id" },
    { name: "slot3_bit_id", type: "BIGINT", field: "slot3_bit_id" },
    { name: "total_weight", type: "NUMERIC", field: "total_weight" },
    { name: "created_at", type: "TEXT", field: "created_at" }
  ], indexes: ["user_id"] },
  { key: "tournaments", name: "appbey_tournaments", columns: [
    { name: "slug", type: "TEXT", field: "slug" },
    { name: "title", type: "TEXT", field: "title" },
    { name: "description", type: "TEXT", field: "description" },
    { name: "organizer_id", type: "BIGINT", field: "organizer_id" },
    { name: "format", type: "TEXT", field: "format" },
    { name: "stage_type", type: "TEXT", field: "stage_type" },
    { name: "group_count", type: "INTEGER", field: "group_count" },
    { name: "group_ids", type: "JSONB", field: "group_ids" },
    { name: "advancers_per_group", type: "INTEGER", field: "advancers_per_group" },
    { name: "tie_break_priority", type: "JSONB", field: "tie_break_priority" },
    { name: "knockout_round_name", type: "TEXT", field: "knockout_round_name" },
    { name: "battle_type", type: "TEXT", field: "battle_type" },
    { name: "match_target_points", type: "INTEGER", field: "match_target_points" },
    { name: "stadium_type", type: "TEXT", field: "stadium_type" },
    { name: "max_participants", type: "INTEGER", field: "max_participants" },
    { name: "prize_description", type: "TEXT", field: "prize_description" },
    { name: "status", type: "TEXT", field: "status" },
    { name: "venue_address", type: "TEXT", field: "venue_address" },
    { name: "start_date", type: "TEXT", field: "start_date" },
    { name: "venue_name", type: "TEXT", field: "venue_name" },
    { name: "country", type: "TEXT", field: "country" },
    { name: "current_round", type: "INTEGER", field: "current_round" },
    { name: "total_rounds", type: "INTEGER", field: "total_rounds" },
    { name: "is_official", type: "BOOLEAN", field: "is_official" },
    { name: "winner_user_id", type: "BIGINT", field: "winner_user_id" },
    { name: "runner_up_user_id", type: "BIGINT", field: "runner_up_user_id" },
    { name: "third_place_user_id", type: "BIGINT", field: "third_place_user_id" },
    { name: "created_at", type: "TEXT", field: "created_at" }
  ], indexes: ["slug", "organizer_id", "status", "start_date"] },
  { key: "participants", name: "appbey_tournament_participants", columns: [
    { name: "tournament_id", type: "BIGINT", field: "tournament_id" },
    { name: "user_id", type: "BIGINT", field: "user_id" },
    { name: "seed", type: "INTEGER", field: "seed" },
    { name: "group_id", type: "TEXT", field: "group_id" },
    { name: "group_seed", type: "INTEGER", field: "group_seed" },
    { name: "group_points", type: "INTEGER", field: "group_points" },
    { name: "group_matches_won", type: "INTEGER", field: "group_matches_won" },
    { name: "group_matches_drawn", type: "INTEGER", field: "group_matches_drawn" },
    { name: "group_matches_lost", type: "INTEGER", field: "group_matches_lost" },
    { name: "group_points_scored", type: "INTEGER", field: "group_points_scored" },
    { name: "group_points_conceded", type: "INTEGER", field: "group_points_conceded" },
    { name: "group_diff", type: "INTEGER", field: "group_diff" },
    { name: "group_rank", type: "INTEGER", field: "group_rank" },
    { name: "is_qualified_playoffs", type: "BOOLEAN", field: "is_qualified_playoffs" },
    { name: "checked_in", type: "BOOLEAN", field: "checked_in" },
    { name: "checked_in_at", type: "TEXT", field: "checked_in_at" },
    { name: "swiss_points", type: "INTEGER", field: "swiss_points" },
    { name: "buchholz", type: "INTEGER", field: "buchholz" },
    { name: "points_scored", type: "INTEGER", field: "points_scored" },
    { name: "points_conceded", type: "INTEGER", field: "points_conceded" },
    { name: "matches_played", type: "INTEGER", field: "matches_played" },
    { name: "matches_won", type: "INTEGER", field: "matches_won" },
    { name: "matches_drawn", type: "INTEGER", field: "matches_drawn" },
    { name: "matches_lost", type: "INTEGER", field: "matches_lost" },
    { name: "final_rank", type: "INTEGER", field: "final_rank" },
    { name: "deck", type: "JSONB", field: "deck" },
    { name: "deck_notes", type: "TEXT", field: "deck_notes" }
  ], indexes: ["tournament_id", "user_id"] },
  { key: "matches", name: "appbey_matches", columns: [
    { name: "tournament_id", type: "BIGINT", field: "tournament_id" },
    { name: "round_number", type: "INTEGER", field: "round_number" },
    { name: "stage", type: "TEXT", field: "stage" },
    { name: "group_id", type: "TEXT", field: "group_id" },
    { name: "bracket_position", type: "INTEGER", field: "bracket_position" },
    { name: "station_number", type: "INTEGER", field: "station_number" },
    { name: "player_a_id", type: "BIGINT", field: "player_a_id" },
    { name: "player_b_id", type: "BIGINT", field: "player_b_id" },
    { name: "score_a", type: "INTEGER", field: "score_a" },
    { name: "score_b", type: "INTEGER", field: "score_b" },
    { name: "winner_id", type: "BIGINT", field: "winner_id" },
    { name: "referee_id", type: "BIGINT", field: "referee_id" },
    { name: "target_points", type: "INTEGER", field: "target_points" },
    { name: "set_target_points", type: "INTEGER", field: "set_target_points" },
    { name: "sets_won_a", type: "INTEGER", field: "sets_won_a" },
    { name: "sets_won_b", type: "INTEGER", field: "sets_won_b" },
    { name: "sets", type: "JSONB", field: "sets" },
    { name: "status", type: "TEXT", field: "status" },
    { name: "is_bye", type: "BOOLEAN", field: "is_bye" },
    { name: "created_at", type: "TEXT", field: "created_at" }
  ], indexes: ["tournament_id", "status", "player_a_id", "player_b_id"] },
  { key: "matchGames", name: "appbey_match_games", columns: [
    { name: "match_id", type: "BIGINT", field: "match_id" },
    { name: "game_order", type: "INTEGER", field: "game_order" },
    { name: "finish_type", type: "TEXT", field: "finish_type" },
    { name: "awarded_to", type: "TEXT", field: "awarded_to" },
    { name: "points", type: "INTEGER", field: "points" },
    { name: "set_number", type: "INTEGER", field: "set_number" },
    { name: "notes", type: "TEXT", field: "notes" },
    { name: "created_at", type: "TEXT", field: "created_at" }
  ], indexes: ["match_id"] },
  { key: "seasons", name: "appbey_seasons", columns: [
    { name: "name", type: "TEXT", field: "name" },
    { name: "is_active", type: "BOOLEAN", field: "is_active" },
    { name: "description", type: "TEXT", field: "description" },
    { name: "start_date", type: "TEXT", field: "start_date" }
  ] },
  { key: "seasonRankings", name: "appbey_season_rankings", columns: [
    { name: "season_id", type: "BIGINT", field: "season_id" },
    { name: "user_id", type: "BIGINT", field: "user_id" },
    { name: "points", type: "INTEGER", field: "points" },
    { name: "elo", type: "INTEGER", field: "elo" },
    { name: "tournaments_played", type: "INTEGER", field: "tournaments_played" },
    { name: "tournaments_won", type: "INTEGER", field: "tournaments_won" },
    { name: "podium_finishes", type: "INTEGER", field: "podium_finishes" },
    { name: "matches_won", type: "INTEGER", field: "matches_won" },
    { name: "matches_lost", type: "INTEGER", field: "matches_lost" },
    { name: "points_for", type: "INTEGER", field: "points_for" },
    { name: "points_against", type: "INTEGER", field: "points_against" },
    { name: "bonus_points", type: "INTEGER", field: "bonus_points" },
    { name: "warnings", type: "INTEGER", field: "warnings" },
    { name: "overall_rank", type: "INTEGER", field: "overall_rank" }
  ], indexes: ["season_id", "user_id"] },
  { key: "hallOfFame", name: "appbey_hall_of_fame", columns: [
    { name: "year", type: "INTEGER", field: "year" },
    { name: "title", type: "TEXT", field: "title" },
    { name: "user_id", type: "BIGINT", field: "user_id" },
    { name: "tournament_name", type: "TEXT", field: "tournament_name" },
    { name: "signature_deck", type: "TEXT", field: "signature_deck" },
    { name: "trophy_icon", type: "TEXT", field: "trophy_icon" },
    { name: "notes", type: "TEXT", field: "notes" },
    { name: "created_at", type: "TEXT", field: "created_at" }
  ], indexes: ["user_id", "year"] },
  { key: "communityPosts", name: "appbey_community_posts", columns: [
    { name: "user_id", type: "BIGINT", field: "user_id" },
    { name: "deck_id", type: "BIGINT", field: "deck_id" },
    { name: "content", type: "TEXT", field: "content" },
    { name: "image_url", type: "TEXT", field: "image_url" },
    { name: "likes_count", type: "INTEGER", field: "likes_count" },
    { name: "comments_count", type: "INTEGER", field: "comments_count" },
    { name: "created_at", type: "TEXT", field: "created_at" }
  ], indexes: ["user_id", "created_at"] },
  { key: "postLikes", name: "appbey_post_likes", columns: [
    { name: "post_id", type: "BIGINT", field: "post_id" },
    { name: "user_id", type: "BIGINT", field: "user_id" },
    { name: "created_at", type: "TEXT", field: "created_at" }
  ], indexes: ["post_id", "user_id"] },
  { key: "postComments", name: "appbey_post_comments", columns: [
    { name: "post_id", type: "BIGINT", field: "post_id" },
    { name: "user_id", type: "BIGINT", field: "user_id" },
    { name: "content", type: "TEXT", field: "content" },
    { name: "created_at", type: "TEXT", field: "created_at" }
  ], indexes: ["post_id", "user_id"] },
  { key: "notifications", name: "appbey_notifications", columns: [
    { name: "user_id", type: "BIGINT", field: "user_id" },
    { name: "notif_type", type: "TEXT", field: "notif_type" },
    { name: "title", type: "TEXT", field: "title" },
    { name: "message", type: "TEXT", field: "message" },
    { name: "link", type: "TEXT", field: "link" },
    { name: "is_read", type: "BOOLEAN", field: "is_read" },
    { name: "created_at", type: "TEXT", field: "created_at" }
  ], indexes: ["user_id", "is_read", "created_at"] }
];
