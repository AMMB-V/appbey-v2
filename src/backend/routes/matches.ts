import type { Router } from "express";
import { requireAuth, type AuthRequest } from "../auth.js";
import type { MatchGame, Tournament, TournamentMatch, TournamentParticipant, User } from "../models.js";

interface MatchRouteDependencies {
  readonly users: User[];
  readonly tournaments: Tournament[];
  readonly participants: TournamentParticipant[];
  matches: TournamentMatch[];
  matchGames: MatchGame[];
  nextId: (records: readonly { id: number }[]) => number;
  publicUser: (user?: User | null) => object | null;
  broadcastTournament: (tournamentId: number, event: string, data: unknown) => void;
  updateEloRatings: (userAId: number, userBId: number, winnerId: number | null) => void;
  recalcTournamentStats: (tournamentId: number) => void;
  updateStatsAfterMatch: (match: TournamentMatch) => void;
  distributePrizes: (tournament: Tournament) => void;
  advanceSingleElimination: (match: TournamentMatch) => void;
  forfeitMatch: (match: TournamentMatch, winnerId: number) => void;
  withdrawParticipantFromMatches: (tournamentId: number, userId: number) => void;
  revertBracketPropagation: (match: TournamentMatch) => { blocked: boolean; detail?: string };
  recomputeMatchFromGames: (match: TournamentMatch) => void;
}

export function registerMatchRoutes(api: Router, state: MatchRouteDependencies): void {
function getNextCombat(m: TournamentMatch) {
  // Find matches from the same tournament that are not completed yet and not byes.
  // We prioritize matches from the same group/stage first, followed by pending/calling matches.
  const candidates = state.matches.filter(
    (candidate) =>
      candidate.tournament_id === m.tournament_id &&
      candidate.id !== m.id &&
      !candidate.is_bye &&
      candidate.status !== "finished"
  );

  return (
    candidates.sort((a, b) => {
      // Prioritize same group first
      const sameGroupA = a.group_id === m.group_id ? 1 : 0;
      const sameGroupB = b.group_id === m.group_id ? 1 : 0;
      if (sameGroupA !== sameGroupB) return sameGroupB - sameGroupA;

      // Prioritize calling/in_progress matches that are ready to play over pending
      const statusWeight = (s: string) => (s === "calling" ? 3 : s === "in_progress" ? 2 : 1);
      const weightDiff = statusWeight(b.status) - statusWeight(a.status);
      if (weightDiff !== 0) return weightDiff;

      // In the same group, prioritize matches where neither player just played in `m` (anti-repeat / rest)
      const repeatsPlayerA = (a.player_a_id && (a.player_a_id === m.player_a_id || a.player_a_id === m.player_b_id)) ||
        (a.player_b_id && (a.player_b_id === m.player_a_id || a.player_b_id === m.player_b_id)) ? 1 : 0;
      const repeatsPlayerB = (b.player_a_id && (b.player_a_id === m.player_a_id || b.player_a_id === m.player_b_id)) ||
        (b.player_b_id && (b.player_b_id === m.player_a_id || b.player_b_id === m.player_b_id)) ? 1 : 0;
      if (repeatsPlayerA !== repeatsPlayerB) return repeatsPlayerA - repeatsPlayerB;

      return a.id - b.id;
    })[0] || null
  );
}

function formatMatchDetails(m: TournamentMatch) {
  const partA = state.participants.find((p) => p.tournament_id === m.tournament_id && p.user_id === m.player_a_id);
  const partB = state.participants.find((p) => p.tournament_id === m.tournament_id && p.user_id === m.player_b_id);
  const playerA = state.users.find((u) => u.id === m.player_a_id) || null;
  const playerB = state.users.find((u) => u.id === m.player_b_id) || null;
  const t = state.tournaments.find((tour) => tour.id === m.tournament_id);
  const target = m.target_points || t?.match_target_points || 4;
  const isElimination = !m.group_id && (t?.stage_type === "knockout" || t?.format === "single_elim");
  const setTarget = m.set_target_points || target;
  const sets = m.sets || [];
  const nextCombat = getNextCombat(m);

  return {
    ...m,
    target_points: target,
    is_elimination: isElimination,
    best_of_sets: isElimination ? 3 : 1,
    set_target_points: isElimination ? setTarget : undefined,
    sets_won_a: isElimination ? (m.sets_won_a || 0) : undefined,
    sets_won_b: isElimination ? (m.sets_won_b || 0) : undefined,
    sets,
    player_a: state.publicUser(playerA),
    player_b: state.publicUser(playerB),
    player_a_deck: partA?.deck || (playerA?.favorite_combo ? [playerA.favorite_combo] : []),
    player_b_deck: partB?.deck || (playerB?.favorite_combo ? [playerB.favorite_combo] : []),
    winner: state.publicUser(state.users.find((u) => u.id === m.winner_id)),
    referee: state.publicUser(state.users.find((u) => u.id === m.referee_id)),
    tournament: t,
    games: state.matchGames.filter((g) => g.match_id === m.id),
    tournament_matches: state.matches
      .filter((tm) => tm.tournament_id === m.tournament_id)
      .map((tm) => ({
        ...tm,
        player_a: state.publicUser(state.users.find((u) => u.id === tm.player_a_id)),
        player_b: state.publicUser(state.users.find((u) => u.id === tm.player_b_id)),
        winner: state.publicUser(state.users.find((u) => u.id === tm.winner_id))
      })),
    next_combat: nextCombat ? {
      ...nextCombat,
      player_a: state.publicUser(state.users.find((u) => u.id === nextCombat.player_a_id)),
      player_b: state.publicUser(state.users.find((u) => u.id === nextCombat.player_b_id))
    } : null
  };
}

api.get("/matches/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  const m = state.matches.find((match) => match.id === id);
  if (!m) {
    res.status(404).json({ detail: "Match no encontrado" });
    return;
  }
  res.json(formatMatchDetails(m));
});

api.get("/matches/:id/next-combat", (req, res) => {
  const id = parseInt(req.params.id, 10);
  const m = state.matches.find((match) => match.id === id);
  if (!m) {
    res.status(404).json({ detail: "Match no encontrado" });
    return;
  }
  const next = getNextCombat(m);
  res.json(next ? formatMatchDetails(next) : null);
});

api.post("/matches/:id/call", requireAuth, (req: AuthRequest, res) => {
  const id = parseInt(req.params.id, 10);
  const m = state.matches.find((match) => match.id === id);
  if (!m) {
    res.status(404).json({ detail: "Match no encontrado" });
    return;
  }
  const { station_number, status } = req.body;
  if (station_number) m.station_number = station_number;
  if (status) m.status = status;
  m.updated_at = new Date().toISOString();

  const playerA = state.users.find((u) => u.id === m.player_a_id);
  const playerB = state.users.find((u) => u.id === m.player_b_id);

  state.broadcastTournament(m.tournament_id, "match_call", {
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
  const m = state.matches.find((match) => match.id === id);
  if (!m) {
    res.status(404).json({ detail: "Match no encontrado" });
    return;
  }

  // If already finished, dynamically reactivate to let the referee continue.
  // Guarded the same way as reopen/undo-finish: if the winner already
  // advanced to a next match that has started/finished (or the tournament
  // already completed), block the reactivation instead of silently leaving
  // a stale bracket/tournament state behind (e.g. two referees both
  // recording the finishing point, or a duplicate/retried submission).
  if (m.status === "finished") {
    const revert = state.revertBracketPropagation(m);
    if (revert.blocked) {
      res.status(400).json({ detail: revert.detail });
      return;
    }
    m.status = "in_progress";
    m.winner_id = null;
  }

  const { finish_type, awarded_to, notes } = req.body;
  const pointsMap: Record<string, number> = {
    spin_finish_1p: 1,
    over_finish_2p: 2,
    burst_finish_2p: 2,
    xtreme_finish_3p: 3,
    penalty_1p: 1,
    own_finish_1p: 1,
    own_finish_2p: 2,
    draw_0p: 0
  };

  if (!finish_type || pointsMap[finish_type] === undefined) {
    res.status(400).json({ detail: "Tipo de finalización (finish_type) no válido para Beyblade X" });
    return;
  }
  if (!["player_a", "player_b", "draw"].includes(awarded_to)) {
    res.status(400).json({ detail: "Destinatario de puntos (awarded_to) no válido" });
    return;
  }

  const pts = pointsMap[finish_type];

  if (!m.referee_id && req.user) m.referee_id = req.user.id;
  m.updated_at = new Date().toISOString();

  const newGame: MatchGame = {
    id: state.nextId(state.matchGames),
    match_id: m.id,
    game_order: state.matchGames.filter((g) => g.match_id === m.id).length + 1,
    finish_type,
    awarded_to,
    points: pts,
    set_number: (m.sets || []).length + 1,
    notes: notes ? String(notes).trim().slice(0, 200) : undefined,
    created_at: new Date().toISOString()
  };
  state.matchGames.push(newGame);

  if (awarded_to === "player_a") m.score_a += pts;
  else if (awarded_to === "player_b") m.score_b += pts;

  const t = state.tournaments.find((tour) => tour.id === m.tournament_id);
  const target = m.target_points || t?.match_target_points || 4;
  const isElimination = !m.group_id && (t?.stage_type === "knockout" || t?.format === "single_elim");
  const setTarget = m.set_target_points || target;
  if (isElimination) {
    m.set_target_points = setTarget;
    m.sets_won_a = m.sets_won_a || 0;
    m.sets_won_b = m.sets_won_b || 0;
    m.sets = m.sets || [];
  }

  if (m.score_a >= (isElimination ? setTarget : target) || m.score_b >= (isElimination ? setTarget : target)) {
    if (isElimination) {
      const setWinner = m.score_a > m.score_b ? m.player_a_id : m.player_b_id;
      m.sets.push({ set_number: m.sets.length + 1, score_a: m.score_a, score_b: m.score_b, winner_id: setWinner });
      if (setWinner === m.player_a_id) m.sets_won_a = (m.sets_won_a || 0) + 1;
      else if (setWinner === m.player_b_id) m.sets_won_b = (m.sets_won_b || 0) + 1;
      m.score_a = 0;
      m.score_b = 0;
      if ((m.sets_won_a || 0) >= 2 || (m.sets_won_b || 0) >= 2) {
        m.status = "finished";
        m.winner_id = (m.sets_won_a || 0) > (m.sets_won_b || 0) ? m.player_a_id : m.player_b_id;
      } else {
        m.status = "in_progress";
        m.winner_id = null;
      }
    } else {
      m.status = "finished";
      if (m.score_a > m.score_b) m.winner_id = m.player_a_id;
      else if (m.score_b > m.score_a) m.winner_id = m.player_b_id;
    }

    state.updateStatsAfterMatch(m);
    if (m.player_a_id && m.player_b_id && m.winner_id) {
      state.updateEloRatings(m.player_a_id, m.player_b_id, m.winner_id);
    }
    // Advance the bracket for both pure single-elim tournaments and the knockout
    // stage of groups_elim tournaments (advanceSingleElimination checks stage_type).
    state.advanceSingleElimination(m);
  } else {
    m.status = "in_progress";
  }

  state.broadcastTournament(m.tournament_id, "score_update", {
    match_id: m.id,
    station_number: m.station_number,
    score_a: m.score_a,
    score_b: m.score_b,
    target_points: target,
    status: m.status,
    winner_id: m.winner_id,
    last_finish: finish_type,
    awarded_to,
    is_elimination: isElimination,
    sets_won_a: m.sets_won_a || 0,
    sets_won_b: m.sets_won_b || 0,
    sets: m.sets || []
  });

  res.json(formatMatchDetails(m));
});

api.post("/matches/:id/undo-finish", requireAuth, (req: AuthRequest, res) => {
  const id = parseInt(req.params.id, 10);
  const m = state.matches.find((match) => match.id === id);
  if (!m) {
    res.status(404).json({ detail: "Match no encontrado" });
    return;
  }

  const mGames = state.matchGames.filter((g) => g.match_id === m.id);
  if (mGames.length === 0) {
    res.status(400).json({ detail: "No hay asaltos registrados para deshacer" });
    return;
  }

  if (m.status === "finished") {
    const revert = state.revertBracketPropagation(m);
    if (revert.blocked) {
      res.status(400).json({ detail: revert.detail });
      return;
    }
  }

  const lastGame = mGames[mGames.length - 1];
  const gIdx = state.matchGames.findIndex((g) => g.id === lastGame.id);
  if (gIdx !== -1) {
    state.matchGames.splice(gIdx, 1);
  }
  m.updated_at = new Date().toISOString();

  // Rebuild score/sets state from the remaining games instead of naively
  // summing points across already-closed sets (bug: overcounted best-of-3
  // elimination matches when undoing a point from a later set).
  state.recomputeMatchFromGames(m);

  const t = state.tournaments.find((tour) => tour.id === m.tournament_id);
  const target = m.target_points || t?.match_target_points || 4;

  state.recalcTournamentStats(m.tournament_id);

  state.broadcastTournament(m.tournament_id, "score_update", {
    match_id: m.id,
    station_number: m.station_number,
    score_a: m.score_a,
    score_b: m.score_b,
    target_points: target,
    status: m.status,
    winner_id: m.winner_id,
    sets_won_a: m.sets_won_a || 0,
    sets_won_b: m.sets_won_b || 0,
    sets: m.sets || []
  });

  res.json(formatMatchDetails(m));
});

api.post("/matches/:id/reopen", requireAuth, (req: AuthRequest, res) => {
  const id = parseInt(req.params.id, 10);
  const m = state.matches.find((match) => match.id === id);
  if (!m) {
    res.status(404).json({ detail: "Match no encontrado" });
    return;
  }

  const t = state.tournaments.find((tour) => tour.id === m.tournament_id);
  const isAuthorized = req.user && (
    ["admin", "organizer", "referee"].includes(req.user.role) ||
    m.referee_id === req.user.id ||
    (t && t.organizer_id === req.user.id) ||
    !m.referee_id
  );
  if (!isAuthorized) {
    res.status(403).json({ detail: "Permisos insuficientes para administrar este combate" });
    return;
  }

  if (m.status === "finished") {
    const revert = state.revertBracketPropagation(m);
    if (revert.blocked) {
      res.status(400).json({ detail: revert.detail });
      return;
    }
  }

  m.status = "in_progress";
  m.winner_id = null;
  m.updated_at = new Date().toISOString();
  const currentTarget = m.target_points || t?.match_target_points || 4;
  if (req.body.target_points) {
    m.target_points = Math.max(1, parseInt(req.body.target_points, 10));
  } else if (m.score_a >= currentTarget || m.score_b >= currentTarget) {
    m.target_points = Math.max(currentTarget, Math.max(m.score_a, m.score_b) + 1);
  }

  state.recalcTournamentStats(m.tournament_id);

  state.broadcastTournament(m.tournament_id, "score_update", {
    match_id: m.id,
    station_number: m.station_number,
    score_a: m.score_a,
    score_b: m.score_b,
    target_points: m.target_points,
    status: m.status,
    winner_id: null
  });

  res.json(formatMatchDetails(m));
});

api.post("/matches/:id/target-points", requireAuth, (req: AuthRequest, res) => {
  const id = parseInt(req.params.id, 10);
  const m = state.matches.find((match) => match.id === id);
  if (!m) {
    res.status(404).json({ detail: "Match no encontrado" });
    return;
  }
  const t = state.tournaments.find((tour) => tour.id === m.tournament_id);
  const target = Math.max(1, parseInt(req.body.target_points, 10) || 4);
  const willUnfinish = m.status === "finished" && !(m.score_a >= target || m.score_b >= target);
  if (willUnfinish) {
    const revert = state.revertBracketPropagation(m);
    if (revert.blocked) {
      res.status(400).json({ detail: revert.detail });
      return;
    }
  }
  m.target_points = target;

  if (m.score_a >= target || m.score_b >= target) {
    m.status = "finished";
    m.winner_id = m.score_a > m.score_b ? m.player_a_id : m.player_b_id;
  } else {
    m.status = (m.score_a > 0 || m.score_b > 0) ? "in_progress" : "pending";
    m.winner_id = null;
  }

  state.recalcTournamentStats(m.tournament_id);

  state.broadcastTournament(m.tournament_id, "score_update", {
    match_id: m.id,
    station_number: m.station_number,
    target_points: m.target_points,
    score_a: m.score_a,
    score_b: m.score_b,
    status: m.status,
    winner_id: m.winner_id
  });

  res.json(formatMatchDetails(m));
});

api.post("/matches/:id/reset", requireAuth, (req: AuthRequest, res) => {
  const id = parseInt(req.params.id, 10);
  const m = state.matches.find((match) => match.id === id);
  if (!m) {
    res.status(404).json({ detail: "Match no encontrado" });
    return;
  }

  const t = state.tournaments.find((tour) => tour.id === m.tournament_id);
  const isAuthorized = req.user && (
    ["admin", "organizer", "referee"].includes(req.user.role) ||
    m.referee_id === req.user.id ||
    (t && t.organizer_id === req.user.id) ||
    !m.referee_id
  );
  if (!isAuthorized) {
    res.status(403).json({ detail: "Permisos insuficientes para administrar este combate" });
    return;
  }

  if (m.status === "finished") {
    const revert = state.revertBracketPropagation(m);
    if (revert.blocked) {
      res.status(400).json({ detail: revert.detail });
      return;
    }
  }

  state.matchGames = state.matchGames.filter((g) => g.match_id !== m.id);
  m.score_a = 0;
  m.score_b = 0;
  m.status = "pending";
  m.winner_id = null;
  m.sets = [];
  m.sets_won_a = 0;
  m.sets_won_b = 0;
  m.updated_at = new Date().toISOString();

  state.recalcTournamentStats(m.tournament_id);

  state.broadcastTournament(m.tournament_id, "score_update", {
    match_id: m.id,
    station_number: m.station_number,
    score_a: 0,
    score_b: 0,
    status: "pending",
    winner_id: null,
    sets_won_a: 0,
    sets_won_b: 0,
    sets: []
  });

  res.json(formatMatchDetails(m));
});

api.put("/matches/:id/manual-score", requireAuth, (req: AuthRequest, res) => {
  const id = parseInt(req.params.id, 10);
  const m = state.matches.find((match) => match.id === id);
  if (!m) {
    res.status(404).json({ detail: "Match no encontrado" });
    return;
  }

  const t = state.tournaments.find((tour) => tour.id === m.tournament_id);
  const isAuthorized = req.user && (
    ["admin", "organizer", "referee"].includes(req.user.role) ||
    m.referee_id === req.user.id ||
    (t && t.organizer_id === req.user.id) ||
    !m.referee_id
  );
  if (!isAuthorized) {
    res.status(403).json({ detail: "Permisos insuficientes" });
    return;
  }

  const { score_a, score_b, status, winner_id } = req.body;
  const newScoreA = score_a !== undefined ? Math.max(0, parseInt(score_a, 10) || 0) : m.score_a;
  const newScoreB = score_b !== undefined ? Math.max(0, parseInt(score_b, 10) || 0) : m.score_b;

  const target = m.target_points || t?.match_target_points || 4;

  let newStatus: "calling" | "finished" | "in_progress" | "pending";
  if (status) {
    newStatus = status;
  } else if (newScoreA >= target || newScoreB >= target) {
    newStatus = "finished";
  } else {
    newStatus = (newScoreA > 0 || newScoreB > 0) ? "in_progress" : "pending";
  }

  // Resolve the winner implied by the new state BEFORE mutating anything, so
  // we can detect a duplicate/concurrent re-finish (e.g. two referees, or a
  // retried request) submitting the same terminal result twice.
  let impliedWinnerId: number | null | undefined = winner_id;
  if (impliedWinnerId === undefined && newStatus === "finished") {
    impliedWinnerId = newScoreA > newScoreB ? m.player_a_id : (newScoreB > newScoreA ? m.player_b_id : null);
  }

  const wasFinished = m.status === "finished";
  const isIdempotentReplay = wasFinished && newStatus === "finished" && impliedWinnerId === m.winner_id;
  if (isIdempotentReplay) {
    // Same finished result submitted again: don't re-apply ELO/stats/bracket
    // advance a second time, just return the current state unchanged.
    res.json(formatMatchDetails(m));
    return;
  }
  if (wasFinished && (newStatus !== "finished" || impliedWinnerId !== m.winner_id)) {
    const revert = state.revertBracketPropagation(m);
    if (revert.blocked) {
      res.status(400).json({ detail: revert.detail });
      return;
    }
  }

  m.score_a = newScoreA;
  m.score_b = newScoreB;
  m.status = newStatus;
  m.updated_at = new Date().toISOString();

  if (winner_id !== undefined) {
    m.winner_id = winner_id;
  } else if (m.status === "finished") {
    m.winner_id = m.score_a > m.score_b ? m.player_a_id : (m.score_b > m.score_a ? m.player_b_id : null);
  } else {
    m.winner_id = null;
  }

  if (m.status === "finished") {
    state.updateStatsAfterMatch(m);
    if (m.player_a_id && m.player_b_id && m.winner_id) {
      state.updateEloRatings(m.player_a_id, m.player_b_id, m.winner_id);
    }
    // Advance the bracket for both pure single-elim tournaments and the knockout
    // stage of groups_elim tournaments (advanceSingleElimination checks stage_type).
    state.advanceSingleElimination(m);
  }

  state.recalcTournamentStats(m.tournament_id);

  state.broadcastTournament(m.tournament_id, "score_update", {
    match_id: m.id,
    station_number: m.station_number,
    score_a: m.score_a,
    score_b: m.score_b,
    target_points: target,
    status: m.status,
    winner_id: m.winner_id
  });

  res.json(formatMatchDetails(m));
});

api.post("/matches/:id/declare-winner", requireAuth, (req: AuthRequest, res) => {
  const id = parseInt(req.params.id, 10);
  const m = state.matches.find((match) => match.id === id);
  if (!m) {
    res.status(404).json({ detail: "Match no encontrado" });
    return;
  }

  const t = state.tournaments.find((tour) => tour.id === m.tournament_id);
  const isAuthorized = req.user && (
    ["admin", "organizer", "referee"].includes(req.user.role) ||
    m.referee_id === req.user.id ||
    (t && t.organizer_id === req.user.id) ||
    !m.referee_id
  );
  if (!isAuthorized) {
    res.status(403).json({ detail: "Permisos insuficientes para declarar ganador" });
    return;
  }

  const { winner_id, notes, finish_reason } = req.body;
  const parsedWinnerId = parseInt(winner_id, 10);
  if (!parsedWinnerId || (parsedWinnerId !== m.player_a_id && parsedWinnerId !== m.player_b_id)) {
    res.status(400).json({ detail: "ID de ganador no válido para este combate" });
    return;
  }

  const wasFinished = m.status === "finished";
  if (wasFinished && m.winner_id === parsedWinnerId) {
    // Same winner declared again (e.g. two referees, or a duplicate/retried
    // request): don't re-apply ELO/stats/bracket advance a second time.
    res.json(formatMatchDetails(m));
    return;
  }
  if (wasFinished) {
    const revert = state.revertBracketPropagation(m);
    if (revert.blocked) {
      res.status(400).json({ detail: revert.detail });
      return;
    }
  }

  m.status = "finished";
  m.winner_id = parsedWinnerId;
  if (!m.referee_id && req.user) m.referee_id = req.user.id;
  m.updated_at = new Date().toISOString();

  state.matchGames.push({
    id: state.nextId(state.matchGames),
    match_id: m.id,
    game_order: state.matchGames.filter((g) => g.match_id === m.id).length + 1,
    finish_type: finish_reason || "decision_official",
    awarded_to: parsedWinnerId === m.player_a_id ? "player_a" : "player_b",
    points: 0,
    created_at: new Date().toISOString()
  });

  state.updateStatsAfterMatch(m);
  if (m.player_a_id && m.player_b_id && m.winner_id) {
    state.updateEloRatings(m.player_a_id, m.player_b_id, m.winner_id);
  }
  // Advance the bracket for both pure single-elim tournaments and the knockout
  // stage of groups_elim tournaments (advanceSingleElimination checks stage_type).
  state.advanceSingleElimination(m);
  state.recalcTournamentStats(m.tournament_id);

  state.broadcastTournament(m.tournament_id, "score_update", {
    match_id: m.id,
    station_number: m.station_number,
    score_a: m.score_a,
    score_b: m.score_b,
    target_points: m.target_points || t?.match_target_points || 4,
    status: m.status,
    winner_id: m.winner_id,
    last_finish: finish_reason || "decision_official",
    awarded_to: parsedWinnerId === m.player_a_id ? "player_a" : "player_b"
  });

  res.json(formatMatchDetails(m));
});

}
