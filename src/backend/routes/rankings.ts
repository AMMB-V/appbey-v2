import type { Router } from "express";
import type { HallOfFame, Season, SeasonRanking, TournamentMatch, User } from "../models.js";

interface RankingsState {
  hallOfFame: HallOfFame[];
  matches: TournamentMatch[];
  seasons: Season[];
  seasonRankings: SeasonRanking[];
  users: User[];
}

export function registerRankingsRoutes(api: Router, getState: () => RankingsState): void {
  api.get("/rankings/leaderboard", (req, res) => {
    const { matches, seasonRankings, users } = getState();
    const country = req.query.country as string;
    const historicalRankedUserIds = new Set(seasonRankings.map((ranking) => ranking.user_id));
    const activePlayerIds = new Set<number>();
    for (const match of matches) {
      if (match.status !== "finished") continue;
      if (match.player_a_id) activePlayerIds.add(match.player_a_id);
      if (match.player_b_id) activePlayerIds.add(match.player_b_id);
    }
    let list = users.filter((user) =>
      user.is_active && (historicalRankedUserIds.has(user.id) || (user.role === "blader" && activePlayerIds.has(user.id)))
    );
    if (country) list = list.filter((user) => user.country === country);
    list.sort((a, b) => b.elo_rating - a.elo_rating);

    res.json(
      list.map((user, index) => ({
        rank: index + 1,
        user_id: user.id,
        username: user.username,
        display_name: user.display_name,
        country: user.country,
        avatar_url: user.avatar_url || "/assets/images/appbey_logo_transparent.png?v=3.4",
        elo_rating: user.elo_rating,
        favorite_combo: user.favorite_combo,
        role: user.role
      }))
    );
  });

  api.get("/rankings/hall-of-fame", (_req, res) => {
    const { hallOfFame, users } = getState();
    res.json(
      hallOfFame.map((entry) => {
        const user = users.find((record) => record.id === entry.user_id);
        return {
          id: entry.id,
          year: entry.year,
          title: entry.title,
          blader_name: user?.display_name || "Blader Leyenda",
          blader_username: user?.username || "blader",
          blader_avatar: user?.avatar_url || "/assets/images/appbey_logo_transparent.png?v=3.4",
          country: user?.country || "PA",
          tournament_name: entry.tournament_name,
          signature_deck: entry.signature_deck,
          trophy_icon: entry.trophy_icon,
          notes: entry.notes
        };
      })
    );
  });

  api.get("/rankings/seasons", (_req, res) => {
    res.json(getState().seasons);
  });

  api.get("/rankings/season/:id/points", (req, res) => {
    const { seasonRankings, users } = getState();
    const seasonId = parseInt(req.params.id, 10);
    const rows = seasonRankings
      .filter((ranking) => ranking.season_id === seasonId)
      .sort((a, b) => b.points - a.points);

    res.json(
      rows.map((ranking, index) => {
        const user = users.find((record) => record.id === ranking.user_id);
        const played = ranking.matches_won + ranking.matches_lost;
        return {
          rank: ranking.overall_rank || index + 1,
          user_id: ranking.user_id,
          display_name: user?.display_name || `Blader ${ranking.overall_rank}`,
          username: user?.username || `blader_${ranking.user_id}`,
          avatar_url: user?.avatar_url || "/assets/images/appbey_logo_transparent.png?v=3.4",
          country: user?.country || "PA",
          favorite_combo: user?.favorite_combo || "Phoenix Wing 9-60 GF",
          elo_rating: user?.elo_rating || 1500,
          tournaments_played: ranking.tournaments_played,
          matches_played: played,
          matches_won: ranking.matches_won,
          matches_lost: ranking.matches_lost,
          points_for: ranking.points_for,
          points_against: ranking.points_against,
          bonus_points: ranking.bonus_points,
          warnings: ranking.warnings,
          win_rate: played ? `${Math.round((ranking.matches_won / played) * 100)}%` : "0%",
          points: ranking.points
        };
      })
    );
  });

  api.get("/rankings/season/:id/elo", (req, res) => {
    const { seasonRankings, users } = getState();
    const seasonId = parseInt(req.params.id, 10);
    const rows = seasonRankings
      .filter((ranking) => ranking.season_id === seasonId)
      .sort((a, b) => b.elo - a.elo);

    res.json(
      rows.map((ranking, index) => {
        const user = users.find((record) => record.id === ranking.user_id);
        const played = ranking.matches_won + ranking.matches_lost;
        return {
          rank: index + 1,
          user_id: ranking.user_id,
          display_name: user?.display_name || `Blader ${index + 1}`,
          username: user?.username || `blader_${ranking.user_id}`,
          avatar_url: user?.avatar_url || "/assets/images/appbey_logo_transparent.png?v=3.4",
          country: user?.country || "PA",
          favorite_combo: user?.favorite_combo || "Phoenix Wing 9-60 GF",
          elo_rating: ranking.elo || user?.elo_rating || 1500,
          elo: ranking.elo || user?.elo_rating || 1500,
          tournaments_played: ranking.tournaments_played,
          matches_played: played,
          matches_won: ranking.matches_won,
          matches_lost: ranking.matches_lost,
          points_for: ranking.points_for,
          points_against: ranking.points_against,
          bonus_points: ranking.bonus_points,
          warnings: ranking.warnings,
          win_rate: played ? `${Math.round((ranking.matches_won / played) * 100)}%` : "0%",
          points: ranking.points
        };
      })
    );
  });
}
