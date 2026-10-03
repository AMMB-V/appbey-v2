import crypto from "crypto";
import bcrypt from "bcryptjs";
import type {
  MatchGame, Tournament, TournamentMatch, TournamentParticipant, User
} from "../models.js";

export interface TournamentDomainState {
  users: User[];
  tournaments: Tournament[];
  participants: TournamentParticipant[];
  matches: TournamentMatch[];
  matchGames: MatchGame[];
  nextId: (records: readonly { id: number }[]) => number;
  broadcastTournament: (tournamentId: number, event: string, data: unknown) => void;
}

export function createTournamentDomain(state: TournamentDomainState) {
// ---------------------------------------------------------------------------

function updateEloRatings(userAId: number, userBId: number, winnerId: number | null) {
  const userA = state.users.find((u) => u.id === userAId);
  const userB = state.users.find((u) => u.id === userBId);
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

function recalcTournamentStats(tournamentId: number) {
  const allT = state.participants.filter((p) => p.tournament_id === tournamentId);
  const tMatches = state.matches.filter((match) => match.tournament_id === tournamentId && match.status === "finished");
  const tour = state.tournaments.find((t) => t.id === tournamentId);

  for (const p of allT) {
    p.matches_played = 0;
    p.matches_won = 0;
    p.matches_drawn = 0;
    p.matches_lost = 0;
    p.points_scored = 0;
    p.points_conceded = 0;
    p.swiss_points = 0;
    p.buchholz = 0;
    p.group_points = 0;
    p.group_matches_won = 0;
    p.group_matches_drawn = 0;
    p.group_matches_lost = 0;
    p.group_points_scored = 0;
    p.group_points_conceded = 0;
    p.group_diff = 0;
  }

  for (const m of tMatches) {
    const pa = allT.find((p) => p.user_id === m.player_a_id);
    const pb = allT.find((p) => p.user_id === m.player_b_id);
    const isGroupMatch = Boolean(m.group_id);

    if (pa) {
      pa.matches_played += 1;
      pa.points_scored += m.score_a;
      pa.points_conceded += m.score_b;
      if (m.winner_id === pa.user_id) {
        pa.matches_won += 1;
        pa.swiss_points += 3;
        if (isGroupMatch) {
          pa.group_matches_won = (pa.group_matches_won || 0) + 1;
          pa.group_points = (pa.group_points || 0) + 3;
        }
      } else if (m.winner_id === null) {
        pa.matches_drawn += 1;
        pa.swiss_points += 1;
        if (isGroupMatch) {
          pa.group_matches_drawn = (pa.group_matches_drawn || 0) + 1;
          pa.group_points = (pa.group_points || 0) + 1;
        }
      } else {
        pa.matches_lost += 1;
        if (isGroupMatch) {
          pa.group_matches_lost = (pa.group_matches_lost || 0) + 1;
        }
      }
      if (isGroupMatch) {
        pa.group_points_scored = (pa.group_points_scored || 0) + m.score_a;
        pa.group_points_conceded = (pa.group_points_conceded || 0) + m.score_b;
        pa.group_diff = (pa.group_points_scored || 0) - (pa.group_points_conceded || 0);
      }
    }

    if (pb) {
      pb.matches_played += 1;
      pb.points_scored += m.score_b;
      pb.points_conceded += m.score_a;
      if (m.winner_id === pb.user_id) {
        pb.matches_won += 1;
        pb.swiss_points += 3;
        if (isGroupMatch) {
          pb.group_matches_won = (pb.group_matches_won || 0) + 1;
          pb.group_points = (pb.group_points || 0) + 3;
        }
      } else if (m.winner_id === null) {
        pb.matches_drawn += 1;
        pb.swiss_points += 1;
        if (isGroupMatch) {
          pb.group_matches_drawn = (pb.group_matches_drawn || 0) + 1;
          pb.group_points = (pb.group_points || 0) + 1;
        }
      } else {
        pb.matches_lost += 1;
        if (isGroupMatch) {
          pb.group_matches_lost = (pb.group_matches_lost || 0) + 1;
        }
      }
      if (isGroupMatch) {
        pb.group_points_scored = (pb.group_points_scored || 0) + m.score_b;
        pb.group_points_conceded = (pb.group_points_conceded || 0) + m.score_a;
        pb.group_diff = (pb.group_points_scored || 0) - (pb.group_points_conceded || 0);
      }
    }
  }

  // Calculate Buchholz for Swiss
  const userMap = new Map(allT.map((p) => [p.user_id, p]));
  for (const p of allT) {
    const oppIds: number[] = [];
    for (const match of tMatches) {
      if (match.player_a_id === p.user_id && match.player_b_id) oppIds.push(match.player_b_id);
      if (match.player_b_id === p.user_id && match.player_a_id) oppIds.push(match.player_a_id);
    }
    p.buchholz = oppIds.reduce((sum, oppId) => sum + (userMap.get(oppId)?.swiss_points || 0), 0);
  }

  // Group stage standings ranking (configured tournament tiebreak rule).
  // Applies to both groups_elim (multiple groups feeding a playoff bracket)
  // and round_robin (a single group "A" with no playoff phase) since both
  // create matches with group_id set and the frontend renders the same
  // group-standings table (group_rank, W/D/L, diff, head-to-head) for either.
  if (tour && (tour.format === "groups_elim" || tour.format === "round_robin")) {
    const advancers = tour.advancers_per_group || 2;
    const groupStageMatches = state.matches.filter((match) => match.tournament_id === tournamentId && (match.group_id || match.stage === "group_stage"));
    const groupStageComplete = groupStageMatches.length > 0 && groupStageMatches.every((match) => match.status === "finished");
    const groupLetters = Array.from(new Set(allT.map((p) => p.group_id).filter(Boolean))) as string[];
    for (const gId of groupLetters) {
      const gParts = allT.filter((p) => p.group_id === gId);
      const priority = tour.tie_break_priority || ["victories_losses", "point_difference", "head_to_head", "points_for_seed"];
      const compareCriterion = (a: TournamentParticipant, b: TournamentParticipant, criterion: string) => {
        if (criterion === "victories_losses") {
          return (b.group_matches_won || 0) - (a.group_matches_won || 0) ||
            (a.group_matches_lost || 0) - (b.group_matches_lost || 0);
        }
        if (criterion === "point_difference") return (b.group_diff || 0) - (a.group_diff || 0);
        if (criterion === "points_for_seed") return (b.group_points_scored || 0) - (a.group_points_scored || 0);
        return 0;
      };
      gParts.sort((a, b) => {
        for (let index = 0; index < priority.length; index++) {
          const criterion = priority[index];
          if (criterion === "head_to_head") {
            const priorCriteria = priority.slice(0, index).filter((item) => item !== "head_to_head");
            const tiedIds = new Set(
              gParts
                .filter((candidate) => priorCriteria.every((prior) => compareCriterion(candidate, a, prior) === 0))
                .map((candidate) => candidate.user_id)
            );
            const miniLeaguePoints = (participant: TournamentParticipant) => tMatches
              .filter((match) => match.group_id === gId &&
                ((match.player_a_id === participant.user_id && match.player_b_id !== null && tiedIds.has(match.player_b_id)) ||
                 (match.player_b_id === participant.user_id && match.player_a_id !== null && tiedIds.has(match.player_a_id))))
              .reduce((points, match) => points + (
                match.winner_id === participant.user_id ? 3 : match.winner_id === null ? 1 : 0
              ), 0);
            const directResult = miniLeaguePoints(b) - miniLeaguePoints(a);
            if (directResult) return directResult;
          } else {
            const result = compareCriterion(a, b, criterion);
            if (result) return result;
          }
        }
        return a.seed - b.seed;
      });

      gParts.forEach((p, idx) => {
        p.group_rank = idx + 1;
        p.is_qualified_playoffs = groupStageComplete && idx < advancers;
      });
    }

    // round_robin has no playoff phase (unlike groups_elim, which advances via
    // /generate-playoffs): once every match is finished the final standings ARE
    // the result, so the tournament must complete itself here automatically
    // (mirrors how advanceSingleElimination completes single_elim/knockout, and
    // how /next-round completes swiss after the last round).
    if (tour.format === "round_robin" && groupStageComplete && tour.status !== "completed") {
      const ranked = allT
        .filter((p) => p.group_id)
        .sort((a, b) => (a.group_rank || Number.MAX_SAFE_INTEGER) - (b.group_rank || Number.MAX_SAFE_INTEGER));
      tour.status = "completed";
      tour.stage_type = "completed";
      tour.winner_user_id = ranked[0]?.user_id ?? null;
      tour.runner_up_user_id = ranked[1]?.user_id ?? null;
      tour.third_place_user_id = ranked[2]?.user_id ?? null;
      distributePrizes(tour);
      state.broadcastTournament(tour.id, "tournament_updated", { tournament_id: tour.id, status: "completed", winner_id: tour.winner_user_id });
    }
  }
}

function tournamentGroupIds(t: Tournament, tournamentId: number): string[] {
  const ids = new Set<string>();
  (t.group_ids || []).forEach((groupId) => ids.add(groupId));
  if (!t.group_ids?.length) {
    const configuredCount = Math.max(0, t.group_count || 0);
    for (let index = 0; index < configuredCount; index++) {
      ids.add(String.fromCharCode(65 + index));
    }
  }
  state.participants
    .filter((participant) => participant.tournament_id === tournamentId && participant.group_id)
    .forEach((participant) => ids.add(participant.group_id!));
  return Array.from(ids).sort();
}

function normalizeGroupId(value: unknown): string | null {
  const groupId = String(value || "").trim().toUpperCase();
  return /^[A-Z]+$/.test(groupId) ? groupId : null;
}

function automaticGroupCount(participantCount: number): number {
  let count = participantCount >= 48 ? 16 : participantCount >= 24 ? 8 : participantCount >= 12 ? 4 : 2;
  count = Math.min(count, Math.max(1, Math.floor(participantCount / 2)));
  return Math.max(1, count);
}

function alphabeticalGroupIds(count: number): string[] {
  return Array.from({ length: count }, (_, index) => String.fromCharCode(65 + index));
}

function serpentineGroupOrder(groupCount: number): number[] {
  if (groupCount <= 1) return [0];
  const order: number[] = [];
  let index = 0;
  let direction = 1;
  while (order.length < groupCount * 2) {
    order.push(index);
    if (direction === 1 && index === groupCount - 1) direction = -1;
    else if (direction === -1 && index === 0) direction = 1;
    else index += direction;
  }
  return order;
}

function updateStatsAfterMatch(m: TournamentMatch) {
  recalcTournamentStats(m.tournament_id);
}

function distributePrizes(t: Tournament) {
  // Coins & wallet system completely removed
}

function advanceSingleElimination(m: TournamentMatch) {
  const t = state.tournaments.find((tour) => tour.id === m.tournament_id);
  if (!t) return;

  const isPlayoffOrElim = t.format === "single_elim" || t.stage_type === "knockout";
  if (!isPlayoffOrElim) return;

  const nextRound = m.round_number + 1;
  if (nextRound > t.total_rounds) {
    t.status = "completed";
    t.stage_type = "completed";
    t.winner_user_id = m.winner_id;
    t.runner_up_user_id = m.winner_id === m.player_a_id ? m.player_b_id : m.player_a_id;
    distributePrizes(t);
    state.broadcastTournament(t.id, "tournament_updated", { tournament_id: t.id, status: "completed", winner_id: t.winner_user_id });
    return;
  }

  const nextPos = Math.floor((m.bracket_position + 1) / 2);
  const isSlotA = m.bracket_position % 2 === 1;

  // Determine stage name for the next round based on remaining matches in nextRound
  const remainingInNext = Math.pow(2, Math.max(0, t.total_rounds - nextRound));
  let nextStageName = `Ronda ${nextRound}`;
  if (remainingInNext === 1) nextStageName = "Gran Final";
  else if (remainingInNext === 2) nextStageName = "Semifinales";
  else if (remainingInNext === 4) nextStageName = "Cuartos de Final";
  else if (remainingInNext === 8) nextStageName = "8vos de Final";
  else if (remainingInNext === 16) nextStageName = "16vos de Final";

  let nextMatch = state.matches.find((match) => match.tournament_id === t.id && !match.group_id && match.round_number === nextRound && match.bracket_position === nextPos);
  if (!nextMatch) {
    nextMatch = {
      id: state.nextId(state.matches),
      tournament_id: t.id,
      round_number: nextRound,
      stage: nextStageName,
      bracket_position: nextPos,
      station_number: (nextPos % 4) + 1,
      player_a_id: null,
      player_b_id: null,
      score_a: 0,
      score_b: 0,
      winner_id: null,
      status: "pending",
      is_bye: false,
      target_points: t.match_target_points,
      created_at: new Date().toISOString()
    };
    state.matches.push(nextMatch);
  }

  if (isSlotA) {
    nextMatch.player_a_id = m.winner_id;
  } else {
    nextMatch.player_b_id = m.winner_id;
  }

  state.broadcastTournament(t.id, "tournament_updated", { tournament_id: t.id, match_id: m.id, next_match_id: nextMatch.id });
  state.broadcastTournament(t.id, "score_update", {
    match_id: m.id,
    tournament_id: t.id,
    status: m.status,
    winner_id: m.winner_id,
    next_match_id: nextMatch.id
  });

  // If the opponent slot of nextMatch was already vacated by a withdrawn
  // participant (see withdrawParticipantFromMatches), the player who just
  // filled the other slot advances automatically without playing.
  if (nextMatch.walkover_pending === "player_a" && nextMatch.player_a_id === null && nextMatch.player_b_id) {
    forfeitMatch(nextMatch, nextMatch.player_b_id);
  } else if (nextMatch.walkover_pending === "player_b" && nextMatch.player_b_id === null && nextMatch.player_a_id) {
    forfeitMatch(nextMatch, nextMatch.player_a_id);
  }
}

// Finishes a match by walkover in favor of winnerId (used when the opponent
// withdraws/is removed from the tournament). Skips ELO updates since no game
// was actually played, but still recalculates stats and advances the bracket
// so the tournament doesn't get stuck on a forfeited match.
function forfeitMatch(m: TournamentMatch, winnerId: number) {
  m.status = "finished";
  m.winner_id = winnerId;
  state.matchGames.push({
    id: state.nextId(state.matchGames),
    match_id: m.id,
    game_order: state.matchGames.filter((g) => g.match_id === m.id).length + 1,
    finish_type: "forfeit",
    awarded_to: winnerId === m.player_a_id ? "player_a" : "player_b",
    points: 0,
    created_at: new Date().toISOString()
  });
  updateStatsAfterMatch(m);
  advanceSingleElimination(m);
  state.broadcastTournament(m.tournament_id, "score_update", {
    match_id: m.id,
    station_number: m.station_number,
    score_a: m.score_a,
    score_b: m.score_b,
    status: m.status,
    winner_id: m.winner_id
  });
}

// Called right before removing a participant from an in-progress tournament.
// Resolves every one of their pending/in_progress/calling matches so the
// bracket/group stage never gets stuck waiting on someone who is no longer
// competing:
//   - If the opponent is already known, the opponent wins by walkover.
//   - If the opponent slot is still TBD (bracket match awaiting the winner
//     of another match), the withdrawing player's slot is vacated and the
//     match is flagged so the eventual opponent wins by walkover once known.
function withdrawParticipantFromMatches(tournamentId: number, userId: number) {
  const pending = state.matches.filter((m) =>
    m.tournament_id === tournamentId &&
    m.status !== "finished" &&
    (m.player_a_id === userId || m.player_b_id === userId)
  );

  for (const m of pending) {
    const isA = m.player_a_id === userId;
    const opponentId = isA ? m.player_b_id : m.player_a_id;
    if (opponentId) {
      forfeitMatch(m, opponentId);
    } else {
      if (isA) {
        m.player_a_id = null;
        m.walkover_pending = "player_a";
      } else {
        m.player_b_id = null;
        m.walkover_pending = "player_b";
      }
      state.broadcastTournament(tournamentId, "tournament_updated", { tournament_id: tournamentId, match_id: m.id, message: "Participante removido, casilla vacante en espera de rival" });
    }
  }
}

// Reverses the bracket-slot propagation done by advanceSingleElimination when a
// finished elimination match is reopened/undone. Returns { blocked: true } when
// the winner's next match has already started/finished, since undoing then
// would silently desync a bracket that already moved on.
function revertBracketPropagation(m: TournamentMatch): { blocked: boolean; detail?: string } {
  const t = state.tournaments.find((tour) => tour.id === m.tournament_id);
  if (!t || !m.winner_id) return { blocked: false };

  const isPlayoffOrElim = t.format === "single_elim" || t.stage_type === "knockout";
  if (!isPlayoffOrElim) return { blocked: false };

  const nextRound = m.round_number + 1;
  if (nextRound > (t.total_rounds || 0)) {
    // m was the Gran Final; revert the tournament completion it triggered.
    if (t.status === "completed") {
      t.status = "in_progress";
      t.stage_type = "knockout";
      t.winner_user_id = null;
      t.runner_up_user_id = null;
      state.broadcastTournament(t.id, "tournament_updated", { tournament_id: t.id, status: "in_progress" });
    }
    return { blocked: false };
  }

  const nextPos = Math.floor((m.bracket_position + 1) / 2);
  const isSlotA = m.bracket_position % 2 === 1;
  const nextMatch = state.matches.find((match) => match.tournament_id === t.id && !match.group_id && match.round_number === nextRound && match.bracket_position === nextPos);
  if (!nextMatch) return { blocked: false };

  const slotPlayer = isSlotA ? nextMatch.player_a_id : nextMatch.player_b_id;
  if (slotPlayer !== m.winner_id) return { blocked: false };

  const nextHasProgress = nextMatch.status !== "pending" || state.matchGames.some((g) => g.match_id === nextMatch.id);
  if (nextHasProgress) {
    return { blocked: true, detail: "No se puede deshacer: el ganador ya avanzó y su siguiente combate ya inició o finalizó." };
  }

  if (isSlotA) nextMatch.player_a_id = null;
  else nextMatch.player_b_id = null;
  return { blocked: false };
}

// Rebuilds score_a/score_b/sets/sets_won_a/sets_won_b/status/winner_id purely
// from the recorded matchGames, mirroring record-finish's set-closing logic.
// Used after removing a game (undo-finish) so multi-set elimination matches
// stay consistent instead of summing points across already-closed sets.
function recomputeMatchFromGames(m: TournamentMatch) {
  const t = state.tournaments.find((tour) => tour.id === m.tournament_id);
  const target = m.target_points || t?.match_target_points || 4;
  const isElimination = !m.group_id && (t?.stage_type === "knockout" || t?.format === "single_elim");
  const setTarget = m.set_target_points || target;

  const games = state.matchGames.filter((g) => g.match_id === m.id).sort((a, b) => a.id - b.id);

  m.score_a = 0;
  m.score_b = 0;
  m.winner_id = null;
  m.status = games.length ? "in_progress" : "pending";

  if (isElimination) {
    m.sets = [];
    m.sets_won_a = 0;
    m.sets_won_b = 0;
    m.set_target_points = setTarget;
  }

  for (const g of games) {
    if (g.awarded_to === "player_a") m.score_a += g.points;
    else if (g.awarded_to === "player_b") m.score_b += g.points;

    const threshold = isElimination ? setTarget : target;
    if (m.score_a >= threshold || m.score_b >= threshold) {
      if (isElimination) {
        const setWinner = m.score_a > m.score_b ? m.player_a_id : m.player_b_id;
        m.sets!.push({ set_number: (m.sets || []).length + 1, score_a: m.score_a, score_b: m.score_b, winner_id: setWinner });
        if (setWinner === m.player_a_id) m.sets_won_a = (m.sets_won_a || 0) + 1;
        else if (setWinner === m.player_b_id) m.sets_won_b = (m.sets_won_b || 0) + 1;
        m.score_a = 0;
        m.score_b = 0;
        if ((m.sets_won_a || 0) >= 2 || (m.sets_won_b || 0) >= 2) {
          m.status = "finished";
          m.winner_id = (m.sets_won_a || 0) > (m.sets_won_b || 0) ? m.player_a_id : m.player_b_id;
        } else {
          m.status = "in_progress";
        }
      } else {
        m.status = "finished";
        if (m.score_a > m.score_b) m.winner_id = m.player_a_id;
        else if (m.score_b > m.score_a) m.winner_id = m.player_b_id;
      }
    }
  }
}

function createWalkinBlader(displayName: string, country?: string, favoriteCombo?: string): User {
  const baseUsername = displayName.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 15) || "blader";
  let uniqueUsername = baseUsername;
  let counter = 1;
  while (state.users.some((u) => u.username === uniqueUsername)) {
    uniqueUsername = `${baseUsername}_${counter++}`;
  }
  const newUser: User = {
    id: state.nextId(state.users),
    username: uniqueUsername,
    email: `${uniqueUsername}@appbey.local`,
    password_hash: bcrypt.hashSync(crypto.randomBytes(32).toString("hex"), 10),
    display_name: displayName,
    avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(displayName)}`,
    bio: "Blader registrado en mesa de torneo",
    country: country ? String(country).trim().toUpperCase() : "PA",
    favorite_combo: favoriteCombo || "Custom Beyblade X",
    role: "blader",
    elo_rating: 1200,
    is_verified: true,
    is_active: true,
    created_at: new Date().toISOString()
  };
  state.users.push(newUser);
  return newUser;
}

function planTournamentGroups(t: Tournament, checkedInParts: TournamentParticipant[]) {
  const N = checkedInParts.length;
  const assignedIds = Array.from(new Set(
    checkedInParts.map((participant) => participant.group_id).filter((groupId): groupId is string => Boolean(groupId))
  )).sort();
  let groupIds = t.group_ids?.length
    ? [...t.group_ids]
    : t.group_count
      ? alphabeticalGroupIds(t.group_count)
      : alphabeticalGroupIds(automaticGroupCount(N));
  for (const assignedId of assignedIds) {
    if (!groupIds.includes(assignedId)) groupIds.push(assignedId);
  }
  groupIds.sort();
  const groupCount = groupIds.length;
  const sorted = [...checkedInParts].sort((a, b) => (a.seed || 999) - (b.seed || 999));
  const groups: TournamentParticipant[][] = Array.from({ length: groupCount }, () => []);
  const assignment = new Map<number, { group_id: string; group_seed: number }>();
  const serpentineOrder = serpentineGroupOrder(groupCount);
  for (let index = 0; index < sorted.length; index++) {
    const participant = sorted[index];
    let groupIndex = participant.group_id ? groupIds.indexOf(participant.group_id) : -1;
    if (groupIndex < 0) {
      const preferredIndex = serpentineOrder[index % serpentineOrder.length];
      const smallestSize = Math.min(...groups.map((group) => group.length));
      const candidates = groups
        .map((group, candidateIndex) => ({ candidateIndex, size: group.length }))
        .filter((candidate) => candidate.size === smallestSize)
        .map((candidate) => candidate.candidateIndex);
      groupIndex = candidates.reduce((best, candidate) => {
        const candidateDistance = (candidate - preferredIndex + groupCount) % groupCount;
        const bestDistance = (best - preferredIndex + groupCount) % groupCount;
        return candidateDistance < bestDistance ? candidate : best;
      }, candidates[0]);
    }
    groups[groupIndex].push(participant);
    assignment.set(participant.user_id, {
      group_id: groupIds[groupIndex],
      group_seed: groups[groupIndex].length
    });
  }
  return { groupIds, groups, assignment };
}

// Pairs a Swiss round while avoiding rematches when possible and never giving
// the same participant a bye twice unless every remaining participant already
// had one. Shared by tournament start (round 1) and /next-round.
function pairSwissRound(t: Tournament, checkedInParts: TournamentParticipant[]): { p1: TournamentParticipant; p2: TournamentParticipant | null }[] {
  const parts = [...checkedInParts].sort((a, b) => b.swiss_points - a.swiss_points || b.buchholz - a.buchholz || a.seed - b.seed);

  const playedPairs = new Set<string>();
  const hadBye = new Set<number>();
  state.matches
    .filter((m) => m.tournament_id === t.id && m.stage === "swiss")
    .forEach((m) => {
      if (m.is_bye) {
        if (m.player_a_id) hadBye.add(m.player_a_id);
        return;
      }
      if (m.player_a_id && m.player_b_id) {
        const key = [m.player_a_id, m.player_b_id].sort((a, b) => a - b).join("-");
        playedPairs.add(key);
      }
    });

  const pool = [...parts];
  let byePlayer: TournamentParticipant | null = null;
  if (pool.length % 2 === 1) {
    let byeIndex = -1;
    for (let i = pool.length - 1; i >= 0; i--) {
      if (!hadBye.has(pool[i].user_id)) {
        byeIndex = i;
        break;
      }
    }
    if (byeIndex === -1) byeIndex = pool.length - 1;
    byePlayer = pool.splice(byeIndex, 1)[0];
  }

  const pairings: { p1: TournamentParticipant; p2: TournamentParticipant | null }[] = [];
  while (pool.length) {
    const p1 = pool.shift()!;
    let idx = pool.findIndex((p2) => {
      const key = [p1.user_id, p2.user_id].sort((a, b) => a - b).join("-");
      return !playedPairs.has(key);
    });
    if (idx === -1) idx = 0; // forced rematch: no valid opponent left to avoid repeating
    const p2 = pool.splice(idx, 1)[0];
    pairings.push({ p1, p2 });
  }
  if (byePlayer) pairings.push({ p1: byePlayer, p2: null });
  return pairings;
}

function startGroupsElimTournament(t: Tournament, checkedInParts: TournamentParticipant[]) {
  const { groupIds, groups, assignment } = planTournamentGroups(t, checkedInParts);
  t.group_ids = groupIds;
  t.group_count = groupIds.length;
  t.advancers_per_group = t.advancers_per_group || 2;
  t.stage_type = "group_stage";
  checkedInParts.forEach((participant) => {
    const plannedGroup = assignment.get(participant.user_id);
    if (plannedGroup) {
      participant.group_id = plannedGroup.group_id;
      participant.group_seed = plannedGroup.group_seed;
    }
  });

  // Generate round robin matches for each group
  let stationCounter = 1;
  for (let g = 0; g < groupIds.length; g++) {
    const gList = groups[g];
    const letter = groupIds[g];
    let matchInGroup = 1;
    for (let i = 0; i < gList.length; i++) {
      for (let j = i + 1; j < gList.length; j++) {
        const p1 = gList[i];
        const p2 = gList[j];
        state.matches.push({
          id: state.nextId(state.matches),
          tournament_id: t.id,
          round_number: matchInGroup,
          stage: `Fase de Grupos - Grupo ${letter}`,
          group_id: letter,
          bracket_position: matchInGroup,
          station_number: stationCounter,
          player_a_id: p1.user_id,
          player_b_id: p2.user_id,
          score_a: 0,
          score_b: 0,
          winner_id: null,
          status: "pending",
          is_bye: false,
          target_points: t.match_target_points,
          created_at: new Date().toISOString()
        });
        stationCounter = (stationCounter % 4) + 1;
        matchInGroup++;
      }
    }
  }

  recalcTournamentStats(t.id);
}

  return { planTournamentGroups, pairSwissRound, startGroupsElimTournament, updateEloRatings, recalcTournamentStats, tournamentGroupIds, normalizeGroupId, automaticGroupCount, alphabeticalGroupIds, serpentineGroupOrder, updateStatsAfterMatch, distributePrizes, advanceSingleElimination, forfeitMatch, withdrawParticipantFromMatches, revertBracketPropagation, recomputeMatchFromGames, createWalkinBlader };
}
