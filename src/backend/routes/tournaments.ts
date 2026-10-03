import type { Router } from "express";
import { requireAuth, requireRoles, type AuthRequest } from "../auth.js";
import type {
  BladerDeck, HallOfFame, MatchGame, Season, SeasonRanking,
  Tournament, TournamentMatch, TournamentParticipant, User
} from "../models.js";

interface TournamentRouteDependencies {
  readonly users: User[];
  readonly decks: BladerDeck[];
  tournaments: Tournament[];
  participants: TournamentParticipant[];
  matches: TournamentMatch[];
  matchGames: MatchGame[];
  readonly seasons: Season[];
  readonly seasonRankings: SeasonRanking[];
  readonly hallOfFame: HallOfFame[];
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
  createWalkinBlader: (displayName: string, country?: string, favoriteCombo?: string) => User;
  tournamentGroupIds: (tournament: Tournament, tournamentId: number) => string[];
  normalizeGroupId: (value: unknown) => string | null;
  automaticGroupCount: (participantCount: number) => number;
  alphabeticalGroupIds: (count: number) => string[];
  serpentineGroupOrder: (groupCount: number) => number[];
  planTournamentGroups: (tournament: Tournament, participants: TournamentParticipant[]) => {
    groupIds: string[];
    groups: TournamentParticipant[][];
    assignment: Map<number, { group_id: string; group_seed: number }>;
  };
  pairSwissRound: (tournament: Tournament, participants: TournamentParticipant[]) => {
    p1: TournamentParticipant;
    p2: TournamentParticipant | null;
  }[];
  startGroupsElimTournament: (tournament: Tournament, participants: TournamentParticipant[]) => void;
}

export function registerTournamentRoutes(api: Router, state: TournamentRouteDependencies): void {
api.get("/tournaments", (req, res) => {
  const status = req.query.status as string;
  const country = req.query.country as string;
  let list = [...state.tournaments];
  if (status) list = list.filter((t) => t.status === status);
  if (country) list = list.filter((t) => t.country === country);

  res.json(
    list.map((t) => ({
      ...t,
      organizer: state.publicUser(state.users.find((u) => u.id === t.organizer_id)),
      winner: state.publicUser(state.users.find((u) => u.id === t.winner_user_id)),
      participants_count: state.participants.filter((p) => p.tournament_id === t.id).length
    }))
  );
});

api.post("/tournaments", requireRoles(["organizer", "admin"]), (req: AuthRequest, res) => {
  const data = req.body && typeof req.body === "object" ? req.body : {};
  if (!data.title || typeof data.title !== "string" || data.title.trim().length < 3) {
    res.status(400).json({ detail: "El título del torneo es obligatorio (mínimo 3 caracteres)" });
    return;
  }
  const cleanTitle = String(data.title).trim().slice(0, 100);
  let format: "groups_elim" | "round_robin" | "single_elim" | "swiss" = "groups_elim";
  if (data.format === "single_elim" || data.format === "round_robin" || data.format === "swiss") {
    format = data.format;
  }
  const rawGroupCount = data.group_count;
  const groupCount = rawGroupCount === undefined || rawGroupCount === null || rawGroupCount === ""
    ? undefined
    : Number(rawGroupCount);
  if (groupCount !== undefined && (!Number.isInteger(groupCount) || groupCount < 2 || groupCount > 16)) {
    res.status(400).json({ detail: "La cantidad de grupos debe estar entre 2 y 16" });
    return;
  }
  const rawAdvancers = data.advancers_per_group;
  const advancersPerGroup = rawAdvancers === undefined || rawAdvancers === null || rawAdvancers === ""
    ? 2
    : Number(rawAdvancers);
  if (!Number.isInteger(advancersPerGroup) || advancersPerGroup < 1 || advancersPerGroup > 4) {
    res.status(400).json({ detail: "Los clasificados por grupo deben estar entre 1 y 4" });
    return;
  }
  const defaultTieBreaks = ["victories_losses", "point_difference", "head_to_head", "points_for_seed"];
  const requestedTieBreaks: string[] = Array.isArray(data.tie_break_priority)
    ? data.tie_break_priority.map((value: unknown) => String(value)).filter((value: string) => defaultTieBreaks.includes(value))
    : [];
  const tieBreakPriority: string[] = [...new Set(requestedTieBreaks)];
  for (const fallback of defaultTieBreaks) {
    if (!tieBreakPriority.includes(fallback)) tieBreakPriority.push(fallback);
  }
  const battleType = data.battle_type === "1on1" ? "1on1" : "3on3_deck";
  const targetPoints = Math.max(1, Math.min(10, parseInt(data.match_target_points, 10) || 4));
  const maxParticipants = Math.max(2, Math.min(256, parseInt(data.max_participants, 10) || 128));
  const prizeDescription = data.prize_description ? String(data.prize_description).trim().slice(0, 200) : "";
  const totalRounds = Math.max(1, Math.min(10, parseInt(data.total_rounds, 10) || 4));

  const slug = cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-") + `-${Date.now()}`;
  const newT: Tournament = {
    id: state.nextId(state.tournaments),
    slug,
    title: cleanTitle,
    description: data.description ? String(data.description).trim().slice(0, 500) : "",
    organizer_id: req.user!.id,
    format,
    stage_type: format === "groups_elim" || format === "round_robin" ? "group_stage" : undefined,
    group_count: groupCount,
    advancers_per_group: advancersPerGroup,
    tie_break_priority: tieBreakPriority,
    battle_type: battleType,
    match_target_points: targetPoints,
    stadium_type: data.stadium_type ? String(data.stadium_type).trim().slice(0, 50) : "Xtreme Stadium (BX-10)",
    max_participants: maxParticipants,
    prize_description: prizeDescription,
    status: "registration_open",
    venue_name: data.venue_name ? String(data.venue_name).trim().slice(0, 80) : "Arena Beyblade",
    venue_address: data.venue_address ? String(data.venue_address).trim().slice(0, 120) : "Ciudad",
    country: (data.country ? String(data.country).trim().toUpperCase() : "PA").slice(0, 5),
    start_date: data.start_date || new Date().toISOString(),
    current_round: 0,
    total_rounds: totalRounds,
    is_official: data.is_official !== false,
    winner_user_id: null,
    created_at: new Date().toISOString()
  };
  state.tournaments.unshift(newT);
  res.json({
    ...newT,
    organizer: state.publicUser(req.user),
    winner: null,
    participants_count: 0
  });
});

api.get("/tournaments/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  const t = state.tournaments.find((tour) => tour.id === id);
  if (!t) {
    res.status(404).json({ detail: "Torneo no encontrado" });
    return;
  }
  res.json({
    ...t,
    organizer: state.publicUser(state.users.find((u) => u.id === t.organizer_id)),
    winner: state.publicUser(state.users.find((u) => u.id === t.winner_user_id)),
    participants_count: state.participants.filter((p) => p.tournament_id === t.id).length
  });
});

api.post("/tournaments/:id/register", requireAuth, (req: AuthRequest, res) => {
  const id = parseInt(req.params.id, 10);
  const t = state.tournaments.find((tour) => tour.id === id);
  if (!t) {
    res.status(404).json({ detail: "Torneo no encontrado" });
    return;
  }
  if (!["registration_open", "check_in"].includes(t.status)) {
    res.status(400).json({ detail: "Las inscripciones para este torneo están cerradas" });
    return;
  }

  const existing = state.participants.find((p) => p.tournament_id === id && p.user_id === req.user!.id);
  if (existing) {
    res.status(400).json({ detail: "Ya estás inscrito en este torneo" });
    return;
  }

  const count = state.participants.filter((p) => p.tournament_id === id).length;
  if (count >= t.max_participants) {
    res.status(400).json({ detail: "El cupo máximo de participantes se ha completado" });
    return;
  }


  const newPart: TournamentParticipant = {
    id: state.nextId(state.participants),
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
  state.participants.push(newPart);
  res.json({ message: "Inscripción exitosa", participant_id: newPart.id });
});

// Admin / Organizer manual participant addition (supports existing users & new walk-in bladers)
api.post("/tournaments/:id/add-participant", requireAuth, (req: AuthRequest, res) => {
  const id = parseInt(req.params.id, 10);
  const t = state.tournaments.find((tour) => tour.id === id);
  if (!t) {
    res.status(404).json({ detail: "Torneo no encontrado" });
    return;
  }
  const isAuthorized = req.user && (["admin", "organizer"].includes(req.user.role) || t.organizer_id === req.user.id);
  if (!isAuthorized) {
    res.status(403).json({ detail: "Solo los organizadores del torneo o administradores pueden inscribir participantes" });
    return;
  }
  if (t.status !== "registration_open" && t.status !== "check_in") {
    res.status(400).json({ detail: "Las inscripciones solo están disponibles antes de iniciar el torneo" });
    return;
  }
  const currentCount = state.participants.filter((p) => p.tournament_id === id).length;
  if (currentCount >= t.max_participants) {
    res.status(400).json({ detail: "El cupo máximo de participantes se ha completado" });
    return;
  }

  const { user_id, new_blader_name, name, blader_name, display_name, country, favorite_combo, deck, deck_notes, checked_in, group_id } = req.body;
  let requestedGroup: string | undefined;
  if (group_id !== undefined && group_id !== "") {
    const normalizedGroup = state.normalizeGroupId(group_id);
    if (!normalizedGroup) {
      res.status(400).json({ detail: "Identificador de grupo no válido" });
      return;
    }
    requestedGroup = normalizedGroup;
  }
  let targetUser: User | undefined;

  // Resolve raw name from any common field
  const candidateName = (new_blader_name || name || blader_name || display_name || "").toString().trim();

  // Parse deck (3 beys for the tournament day)
  let deckList: string[] = [];
  if (Array.isArray(deck)) {
    deckList = deck.map((d: unknown) => String(d).trim().slice(0, 100)).filter(Boolean).slice(0, 3);
  } else if (typeof deck === "string" && deck.trim()) {
    deckList = deck.split(",").map((s) => s.trim().slice(0, 100)).filter(Boolean).slice(0, 3);
  } else if (favorite_combo && String(favorite_combo).trim()) {
    deckList = [String(favorite_combo).trim().slice(0, 100)];
  }

  if (candidateName) {
    const cleanName = candidateName;
    const sameNameInTournament = state.participants
      .filter((p) => p.tournament_id === id)
      .filter((p) => {
        const u = state.users.find((usr) => usr.id === p.user_id);
        return u && u.display_name.trim().toLowerCase() === cleanName.toLowerCase();
      });

    const finalDisplayName = sameNameInTournament.length > 0
      ? `${cleanName} #${sameNameInTournament.length + 1}`
      : cleanName;

    targetUser = state.createWalkinBlader(
      finalDisplayName,
      country,
      deckList[0] || (favorite_combo ? String(favorite_combo).trim() : undefined)
    );
  } else if (user_id && !isNaN(parseInt(user_id, 10))) {
    targetUser = state.users.find((u) => u.id === parseInt(user_id, 10));
    if (!targetUser) {
      targetUser = state.createWalkinBlader(`Blader #${state.users.length + 1}`, country, deckList[0]);
    }
  } else {
    const count = state.participants.filter((p) => p.tournament_id === id).length;
    targetUser = state.createWalkinBlader(`Blader Invitado #${count + 1}`, country, deckList[0]);
  }

  const existing = state.participants.find((p) => p.tournament_id === id && p.user_id === targetUser!.id);
  if (existing) {
    res.status(400).json({ detail: `El participante ${targetUser!.display_name} ya está inscrito en este torneo` });
    return;
  }

  const count = state.participants.filter((p) => p.tournament_id === id).length;
  if (requestedGroup) {
    const groupIds = state.tournamentGroupIds(t, id);
    if (!groupIds.includes(requestedGroup)) {
      if (groupIds.length >= 16) {
        res.status(400).json({ detail: "El torneo admite un máximo de 16 grupos" });
        return;
      }
      t.group_ids = [...groupIds, requestedGroup].sort();
      t.group_count = t.group_ids.length;
    } else {
      t.group_ids = groupIds;
    }
  }
  const newPart: TournamentParticipant = {
    id: state.nextId(state.participants),
    tournament_id: t.id,
    user_id: targetUser.id,
    seed: count + 1,
    checked_in: checked_in !== false,
    checked_in_at: checked_in !== false ? new Date().toISOString() : null,
    group_id: requestedGroup || null,
    group_seed: requestedGroup
      ? state.participants.filter((p) => p.tournament_id === id && p.group_id === requestedGroup).length + 1
      : null,
    swiss_points: 0,
    buchholz: 0,
    points_scored: 0,
    points_conceded: 0,
    matches_played: 0,
    matches_won: 0,
    matches_drawn: 0,
    matches_lost: 0,
    final_rank: null,
    deck: deckList.length > 0 ? deckList : (targetUser.favorite_combo ? [targetUser.favorite_combo] : []),
    deck_notes: deck_notes ? String(deck_notes).trim() : undefined
  };
  state.participants.push(newPart);
  if (requestedGroup) {
    state.recalcTournamentStats(id);
    state.broadcastTournament(id, "tournament_updated", { tournament_id: id, message: `Participante agregado al Grupo ${requestedGroup}` });
  }
  res.json({ message: "Participante agregado exitosamente", participant: { ...newPart, user: state.publicUser(targetUser) } });
});

// Admin / Organizer: Create an empty manual group without reassigning participants.
api.post("/tournaments/:id/groups", requireAuth, (req: AuthRequest, res) => {
  const id = parseInt(req.params.id, 10);
  const t = state.tournaments.find((tour) => tour.id === id);
  if (!t) {
    res.status(404).json({ detail: "Torneo no encontrado" });
    return;
  }
  const isAuthorized = req.user && (["admin", "organizer"].includes(req.user.role) || t.organizer_id === req.user.id);
  if (!isAuthorized) {
    res.status(403).json({ detail: "Solo los organizadores o administradores pueden crear grupos" });
    return;
  }
  if (t.format !== "groups_elim") {
    res.status(400).json({ detail: "Solo se pueden crear grupos en torneos con fase de grupos" });
    return;
  }
  if (t.status === "completed") {
    res.status(400).json({ detail: "No se pueden crear grupos en un torneo completado" });
    return;
  }
  if (t.status === "in_progress" || state.matches.some((match) => match.tournament_id === id)) {
    res.status(400).json({ detail: "Los grupos solo se pueden configurar antes de iniciar la fase de grupos" });
    return;
  }
  const groupId = state.normalizeGroupId(req.body?.group_id);
  if (!groupId) {
    res.status(400).json({ detail: "Debes indicar un identificador de grupo válido" });
    return;
  }
  const groupIds = state.tournamentGroupIds(t, id);
  if (groupIds.includes(groupId)) {
    res.status(400).json({ detail: `El Grupo ${groupId} ya existe` });
    return;
  }
  if (groupIds.length >= 16) {
    res.status(400).json({ detail: "El torneo admite un máximo de 16 grupos" });
    return;
  }
  t.group_ids = [...groupIds, groupId].sort();
  t.group_count = t.group_ids.length;
  state.broadcastTournament(id, "tournament_updated", { tournament_id: id, message: `Grupo ${groupId} creado` });
  res.json({ message: `Grupo ${groupId} creado correctamente`, group_id: groupId, group_count: t.group_count });
});

api.put("/tournaments/:id/groups/config", requireAuth, (req: AuthRequest, res) => {
  const id = parseInt(req.params.id, 10);
  const t = state.tournaments.find((tour) => tour.id === id);
  if (!t) {
    res.status(404).json({ detail: "Torneo no encontrado" });
    return;
  }
  const isAuthorized = req.user && (["admin", "organizer"].includes(req.user.role) || t.organizer_id === req.user.id);
  if (!isAuthorized) {
    res.status(403).json({ detail: "Solo los organizadores o administradores pueden configurar los grupos" });
    return;
  }
  if (t.format !== "groups_elim" || !["registration_open", "check_in"].includes(t.status) || state.matches.some((match) => match.tournament_id === id)) {
    res.status(400).json({ detail: "La cantidad de grupos solo se puede cambiar antes de iniciar la fase de grupos" });
    return;
  }

  const requestedCount = Number.parseInt(String(req.body?.group_count), 10);
  if (!Number.isInteger(requestedCount) || requestedCount < 2 || requestedCount > 16) {
    res.status(400).json({ detail: "La cantidad de grupos debe estar entre 2 y 16" });
    return;
  }

  const currentIds = state.tournamentGroupIds(t, id);
  let nextIds = currentIds.slice();
  if (requestedCount < nextIds.length) {
    const occupiedIds = new Set(
      state.participants.filter((part) => part.tournament_id === id && part.group_id).map((part) => part.group_id!)
    );
    const removable = nextIds.filter((groupId) => !occupiedIds.has(groupId)).reverse();
    while (nextIds.length > requestedCount && removable.length) {
      const groupId = removable.shift()!;
      nextIds = nextIds.filter((existing) => existing !== groupId);
    }
    if (nextIds.length > requestedCount) {
      res.status(400).json({ detail: "Reasigna primero los participantes de los grupos que deseas quitar" });
      return;
    }
  } else {
    for (const groupId of state.alphabeticalGroupIds(16)) {
      if (nextIds.length >= requestedCount) break;
      if (!nextIds.includes(groupId)) nextIds.push(groupId);
    }
  }
  nextIds.sort();
  t.group_ids = nextIds;
  t.group_count = nextIds.length;
  state.broadcastTournament(id, "tournament_updated", {
    tournament_id: id,
    group_count: t.group_count,
    group_ids: t.group_ids,
    message: "Cantidad de grupos actualizada"
  });
  res.json({ message: `El torneo ahora tiene ${t.group_count} grupos`, group_count: t.group_count, group_ids: t.group_ids });
});

// Admin / Organizer bulk participant addition. Entries may identify an existing user
// by user_id, username, email, or display_name, or create a walk-in by display name.
api.post("/tournaments/:id/add-participants-bulk", requireAuth, (req: AuthRequest, res) => {
  const id = parseInt(req.params.id, 10);
  const t = state.tournaments.find((tour) => tour.id === id);
  if (!t) {
    res.status(404).json({ detail: "Torneo no encontrado" });
    return;
  }
  const isAuthorized = req.user && (["admin", "organizer"].includes(req.user.role) || t.organizer_id === req.user.id);
  if (!isAuthorized) {
    res.status(403).json({ detail: "Solo los organizadores del torneo o administradores pueden inscribir participantes" });
    return;
  }
  if (!["registration_open", "check_in"].includes(t.status)) {
    res.status(400).json({ detail: "Las inscripciones solo están disponibles antes de iniciar el torneo" });
    return;
  }

  const entries = Array.isArray(req.body?.participants) ? req.body.participants : [];
  if (!entries.length || entries.length > t.max_participants) {
    res.status(400).json({ detail: "Debes enviar una lista válida de participantes" });
    return;
  }
  const current = state.participants.filter((p) => p.tournament_id === id);
  if (current.length + entries.length > t.max_participants) {
    res.status(400).json({ detail: `El cupo permite agregar como máximo ${t.max_participants - current.length} participantes` });
    return;
  }

  const resolved: Array<{ entry: Record<string, unknown>; user?: User; name?: string; deck: string[] }> = [];
  const seen = new Set<number>();
  for (const raw of entries) {
    const entry = typeof raw === "string" ? { identifier: raw } : (raw || {}) as Record<string, unknown>;
    const identifier = String(entry.user_id || entry.username || entry.email || entry.display_name || entry.name || entry.identifier || "").trim();
    if (!identifier) {
      res.status(400).json({ detail: "Cada participante debe incluir username, email o display_name" });
      return;
    }
    const userId = entry.user_id && !isNaN(parseInt(String(entry.user_id), 10)) ? parseInt(String(entry.user_id), 10) : null;
    const targetUser = userId
      ? state.users.find((u) => u.id === userId)
      : state.users.find((u) => u.username.toLowerCase() === identifier.toLowerCase() || u.email.toLowerCase() === identifier.toLowerCase() || u.display_name.toLowerCase() === identifier.toLowerCase());
    const deckValue = entry.deck;
    const deck = Array.isArray(deckValue)
      ? deckValue.map((value) => String(value).trim()).filter(Boolean)
      : typeof deckValue === "string" ? deckValue.split(",").map((value) => value.trim()).filter(Boolean) : [];
    if (targetUser) {
      if (current.some((p) => p.user_id === targetUser.id) || seen.has(targetUser.id)) {
        res.status(400).json({ detail: `El participante ${targetUser.display_name} ya está inscrito o repetido en la lista` });
        return;
      }
      seen.add(targetUser.id);
      resolved.push({ entry, user: targetUser, deck });
    } else {
      if (resolved.some((item) => item.name?.toLowerCase() === identifier.toLowerCase())) {
        res.status(400).json({ detail: `El nombre ${identifier} está repetido en la lista` });
        return;
      }
      resolved.push({ entry, name: identifier.slice(0, 50), deck });
    }
  }

  const added = resolved.map((item, index) => {
    const targetUser = item.user || state.createWalkinBlader(item.name!, item.entry.country as string | undefined, item.deck[0]);
    const count = current.length + index;
    const newPart: TournamentParticipant = {
      id: state.nextId(state.participants),
      tournament_id: id,
      user_id: targetUser.id,
      seed: count + 1,
      checked_in: item.entry.checked_in !== false,
      checked_in_at: item.entry.checked_in !== false ? new Date().toISOString() : null,
      swiss_points: 0, buchholz: 0, points_scored: 0, points_conceded: 0,
      matches_played: 0, matches_won: 0, matches_drawn: 0, matches_lost: 0,
      final_rank: null,
      deck: item.deck.length ? item.deck : (targetUser.favorite_combo ? [targetUser.favorite_combo] : [])
    };
    state.participants.push(newPart);
    return { ...newPart, user: state.publicUser(targetUser) };
  });
  state.broadcastTournament(id, "tournament_updated", { tournament_id: id, message: "Participantes agregados" });
  res.json({ message: `${added.length} participantes agregados exitosamente`, participants: added });
});

// Update Participant Tournament Deck (for bladers or organizers)
api.put("/tournaments/:id/participants/:userId/deck", requireAuth, (req: AuthRequest, res) => {
  const tId = parseInt(req.params.id, 10);
  const userId = parseInt(req.params.userId, 10);
  const t = state.tournaments.find((tour) => tour.id === tId);
  if (!t) {
    res.status(404).json({ detail: "Torneo no encontrado" });
    return;
  }

  const isAuthorized = req.user && (
    req.user.id === userId ||
    ["admin", "organizer"].includes(req.user.role) ||
    t.organizer_id === req.user.id
  );
  if (!isAuthorized) {
    res.status(403).json({ detail: "No tienes permisos para modificar el deck de este participante" });
    return;
  }

  const part = state.participants.find((p) => p.tournament_id === tId && p.user_id === userId);
  if (!part) {
    res.status(404).json({ detail: "El participante no está inscrito en este torneo" });
    return;
  }

  const { deck, deck_notes } = req.body;
  let deckList: string[] = [];
  if (Array.isArray(deck)) {
    deckList = deck.map((d: unknown) => String(d).trim().slice(0, 100)).filter(Boolean).slice(0, 3);
  } else if (typeof deck === "string" && deck.trim()) {
    deckList = deck.split(",").map((s) => s.trim().slice(0, 100)).filter(Boolean).slice(0, 3);
  }

  part.deck = deckList;
  if (deck_notes !== undefined) part.deck_notes = String(deck_notes).trim().slice(0, 300);

  // Also update user's primary combo if provided
  const user = state.users.find((u) => u.id === userId);
  if (user && deckList[0]) {
    user.favorite_combo = deckList[0];
  }

  res.json({ message: "Deck de torneo actualizado exitosamente", deck: part.deck, deck_notes: part.deck_notes });
});

// Admin / Organizer assign referee to match or station
api.post("/matches/:id/assign-referee", requireRoles(["organizer", "admin"]), (req: AuthRequest, res) => {
  const id = parseInt(req.params.id, 10);
  const { referee_id } = req.body;
  const m = state.matches.find((match) => match.id === id);
  if (!m) {
    res.status(404).json({ detail: "Match no encontrado" });
    return;
  }
  const referee = state.users.find((u) => u.id === parseInt(referee_id, 10));
  if (!referee) {
    res.status(404).json({ detail: "Árbitro no encontrado" });
    return;
  }
  if (!["referee", "admin", "organizer"].includes(referee.role)) {
    res.status(400).json({ detail: "El usuario seleccionado no tiene rol de árbitro" });
    return;
  }
  m.referee_id = referee.id;
  state.broadcastTournament(m.tournament_id, "match_referee_assigned", { match_id: m.id, referee_id: referee.id, referee_name: referee.display_name });
  res.json({ message: "Árbitro asignado al match", match: m, referee });
});

api.post("/tournaments/:id/checkin", requireAuth, (req: AuthRequest, res) => {
  const id = parseInt(req.params.id, 10);
  const userId = parseInt(req.query.user_id as string, 10) || req.user!.id;
  const t = state.tournaments.find((tour) => tour.id === id);
  if (!t) {
    res.status(404).json({ detail: "Torneo no encontrado" });
    return;
  }
  if (req.user!.id !== userId && !["organizer", "referee", "admin"].includes(req.user!.role)) {
    res.status(403).json({ detail: "No tienes permisos para realizar check-in de otro Blader" });
    return;
  }

  const part = state.participants.find((p) => p.tournament_id === id && p.user_id === userId);
  if (!part) {
    res.status(404).json({ detail: "El usuario no está inscrito en este torneo" });
    return;
  }
  if (part.checked_in) {
    res.json({ message: "El participante ya tenía el check-in confirmado", user_id: userId });
    return;
  }
  part.checked_in = true;
  part.checked_in_at = new Date().toISOString();
  res.json({ message: "Check-in confirmado", user_id: userId });
});

// Admin / Organizer: Remove participant from tournament
api.delete("/tournaments/:id/participants/:userId", requireAuth, (req: AuthRequest, res) => {
  const id = parseInt(req.params.id, 10);
  const userId = parseInt(req.params.userId, 10);
  const t = state.tournaments.find((tour) => tour.id === id);
  if (!t) {
    res.status(404).json({ detail: "Torneo no encontrado" });
    return;
  }
  const isAuthorized = req.user && (["admin", "organizer"].includes(req.user.role) || t.organizer_id === req.user.id);
  if (!isAuthorized) {
    res.status(403).json({ detail: "Solo los organizadores o administradores pueden remover participantes" });
    return;
  }
  if (t.status === "completed") {
    res.status(400).json({ detail: "No se puede remover participantes de un torneo completado" });
    return;
  }

  const pIdx = state.participants.findIndex((p) => p.tournament_id === id && p.user_id === userId);
  if (pIdx === -1) {
    res.status(404).json({ detail: "El participante no está inscrito en este torneo" });
    return;
  }

  // Resolve any pending/in_progress/calling matches involving this participant
  // BEFORE removing them, so the bracket/group stage never gets stuck waiting
  // on someone who withdrew mid-tournament (opponent wins by walkover).
  if (t.status === "in_progress") {
    state.withdrawParticipantFromMatches(id, userId);
  }

  state.participants.splice(pIdx, 1);
  state.recalcTournamentStats(id);
  state.broadcastTournament(id, "tournament_updated", { tournament_id: id, message: "Participante removido" });
  res.json({ message: "Participante removido con éxito", user_id: userId });
});

// Admin / Organizer: Edit participant group assignment and/or seed
api.put("/tournaments/:id/participants/:userId/group", requireAuth, (req: AuthRequest, res) => {
  const id = parseInt(req.params.id, 10);
  const userId = parseInt(req.params.userId, 10);
  const t = state.tournaments.find((tour) => tour.id === id);
  if (!t) {
    res.status(404).json({ detail: "Torneo no encontrado" });
    return;
  }
  const isAuthorized = req.user && (["admin", "organizer"].includes(req.user.role) || t.organizer_id === req.user.id);
  if (!isAuthorized) {
    res.status(403).json({ detail: "Solo los organizadores o administradores pueden reasignar grupos" });
    return;
  }
  if (!["registration_open", "check_in"].includes(t.status) || state.matches.some((match) => match.tournament_id === id)) {
    res.status(400).json({ detail: "Los participantes solo se pueden mover antes de iniciar la fase de grupos" });
    return;
  }

  const part = state.participants.find((p) => p.tournament_id === id && p.user_id === userId);
  if (!part) {
    res.status(404).json({ detail: "Participante no encontrado en este torneo" });
    return;
  }

  const { group_id, seed } = req.body;
  if (group_id !== undefined) {
    const nextGroup = state.normalizeGroupId(group_id);
    if (!nextGroup) {
      res.status(400).json({ detail: "Identificador de grupo no válido" });
      return;
    }
    const groupIds = state.tournamentGroupIds(t, id);
    if (!groupIds.includes(nextGroup)) {
      res.status(400).json({ detail: `El Grupo ${nextGroup} no existe; créalo antes de mover participantes` });
      return;
    }
    part.group_id = nextGroup;
    for (const groupId of groupIds) {
      const tournamentParts = state.participants
        .filter((participant) => participant.tournament_id === id && participant.group_id === groupId)
        .sort((a, b) => a.seed - b.seed);
      tournamentParts.forEach((participant, index) => {
        participant.group_seed = index + 1;
      });
    }
  }
  if (seed !== undefined && !isNaN(parseInt(seed, 10))) {
    part.seed = parseInt(seed, 10);
  }
  // Recalculate stats for the tournament groups
  state.recalcTournamentStats(id);
  state.broadcastTournament(id, "tournament_updated", { tournament_id: id, message: "Asignación de grupo actualizada" });
  res.json({ message: "Grupo y siembra actualizados exitosamente", participant: part });
});

// Admin / Organizer: Edit tournament settings (title, description, venue, rules)
api.put("/tournaments/:id", requireAuth, (req: AuthRequest, res) => {
  const id = parseInt(req.params.id, 10);
  const t = state.tournaments.find((tour) => tour.id === id);
  if (!t) {
    res.status(404).json({ detail: "Torneo no encontrado" });
    return;
  }
  const isAuthorized = req.user && (["admin", "organizer"].includes(req.user.role) || t.organizer_id === req.user.id);
  if (!isAuthorized) {
    res.status(403).json({ detail: "No tienes permisos para editar este torneo" });
    return;
  }

  const { title, description, venue_name, country, match_target_points, max_participants, prize_description, tie_break_priority } = req.body;
  if (title) t.title = String(title).trim();
  if (description !== undefined) t.description = String(description).trim();
  if (venue_name) t.venue_name = String(venue_name).trim();
  if (country) t.country = String(country).trim();
  if (prize_description !== undefined) t.prize_description = String(prize_description).trim().slice(0, 200);
  if (match_target_points && !isNaN(parseInt(match_target_points, 10))) t.match_target_points = parseInt(match_target_points, 10);
  if (max_participants && !isNaN(parseInt(max_participants, 10))) t.max_participants = parseInt(max_participants, 10);
  if (Array.isArray(tie_break_priority)) {
    const allowed = ["victories_losses", "point_difference", "head_to_head", "points_for_seed"];
    const nextPriority = [...new Set(tie_break_priority.map((value: unknown) => String(value)).filter((value: string) => allowed.includes(value)))];
    for (const fallback of allowed) {
      if (!nextPriority.includes(fallback)) nextPriority.push(fallback);
    }
    t.tie_break_priority = nextPriority;
  }

  state.broadcastTournament(id, "tournament_updated", { tournament_id: id, message: "Ajustes de torneo actualizados" });
  res.json({ message: "Torneo actualizado exitosamente", tournament: t });
});

// Admin / Organizer: Randomize / Shuffle seeds (Challonge feature)
api.post("/tournaments/:id/shuffle-seeds", requireAuth, (req: AuthRequest, res) => {
  const id = parseInt(req.params.id, 10);
  const t = state.tournaments.find((tour) => tour.id === id);
  if (!t) {
    res.status(404).json({ detail: "Torneo no encontrado" });
    return;
  }
  const isAuthorized = req.user && (["admin", "organizer"].includes(req.user.role) || t.organizer_id === req.user.id);
  if (!isAuthorized) {
    res.status(403).json({ detail: "No tienes permisos para reordenar las siembras" });
    return;
  }
  if (t.status !== "registration_open") {
    res.status(400).json({ detail: "Solo se pueden alterar las siembras antes de iniciar el torneo" });
    return;
  }

  const tournamentParts = state.participants.filter((p) => p.tournament_id === id);
  // Fisher-Yates shuffle
  for (let i = tournamentParts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = tournamentParts[i].seed;
    tournamentParts[i].seed = tournamentParts[j].seed;
    tournamentParts[j].seed = temp;
  }
  state.broadcastTournament(id, "tournament_updated", { tournament_id: id, message: "Siembras reordenadas" });
  res.json({ message: "Siembras barajadas aleatoriamente con éxito" });
});

// Admin / Organizer: Delete tournament
api.delete("/tournaments/:id", requireAuth, (req: AuthRequest, res) => {
  const id = parseInt(req.params.id, 10);
  const tIdx = state.tournaments.findIndex((tour) => tour.id === id);
  if (tIdx === -1) {
    res.status(404).json({ detail: "Torneo no encontrado" });
    return;
  }
  const t = state.tournaments[tIdx];
  const isAuthorized = req.user && (req.user.role === "admin" || (req.user.role === "organizer" && t.organizer_id === req.user.id));
  if (!isAuthorized) {
    res.status(403).json({ detail: "Solo el organizador o un administrador pueden eliminar este torneo" });
    return;
  }

  // Remove tournament matches and participants
  for (let i = state.matches.length - 1; i >= 0; i--) {
    if (state.matches[i].tournament_id === id) state.matches.splice(i, 1);
  }
  for (let i = state.participants.length - 1; i >= 0; i--) {
    if (state.participants[i].tournament_id === id) state.participants.splice(i, 1);
  }
  state.tournaments.splice(tIdx, 1);

  state.broadcastTournament(id, "tournament_updated", { tournament_id: id, status: "deleted" });
  res.json({ message: "Torneo eliminado correctamente" });
});

api.get("/tournaments/:id/participants", (req, res) => {
  const id = parseInt(req.params.id, 10);
  const t = state.tournaments.find((tour) => tour.id === id);
  let list = state.participants.filter((p) => p.tournament_id === id);

  if (t?.format === "groups_elim") {
    list.sort((a, b) => (a.group_id || "").localeCompare(b.group_id || "") || (a.group_rank || 99) - (b.group_rank || 99) || a.seed - b.seed);
  } else {
    list.sort((a, b) => b.swiss_points - a.swiss_points || b.buchholz - a.buchholz || a.seed - b.seed);
  }

  res.json(
    list.map((p) => ({
      ...p,
      user: state.publicUser(state.users.find((u) => u.id === p.user_id))
    }))
  );
});

function serializeMatchForList(m: TournamentMatch, t?: Tournament) {
  const partA = state.participants.find((p) => p.tournament_id === m.tournament_id && p.user_id === m.player_a_id);
  const partB = state.participants.find((p) => p.tournament_id === m.tournament_id && p.user_id === m.player_b_id);
  const playerA = state.users.find((u) => u.id === m.player_a_id) || null;
  const playerB = state.users.find((u) => u.id === m.player_b_id) || null;
  return {
    ...m,
    is_elimination: !m.group_id && (t?.stage_type === "knockout" || t?.format === "single_elim"),
    best_of_sets: !m.group_id && (t?.stage_type === "knockout" || t?.format === "single_elim") ? 3 : 1,
    set_target_points: m.set_target_points || m.target_points || t?.match_target_points || 4,
    sets_won_a: m.sets_won_a || 0,
    sets_won_b: m.sets_won_b || 0,
    sets: m.sets || [],
    player_a: state.publicUser(playerA),
    player_b: state.publicUser(playerB),
    player_a_deck: partA?.deck || (playerA?.favorite_combo ? [playerA.favorite_combo] : []),
    player_b_deck: partB?.deck || (playerB?.favorite_combo ? [playerB.favorite_combo] : []),
    winner: state.publicUser(state.users.find((u) => u.id === m.winner_id)),
    referee: state.publicUser(state.users.find((u) => u.id === m.referee_id)),
    games: state.matchGames.filter((g) => g.match_id === m.id)
  };
}

api.get("/tournaments/:id/matches", (req, res) => {
  const id = parseInt(req.params.id, 10);
  const t = state.tournaments.find((tour) => tour.id === id);
  const round = req.query.round_number ? parseInt(req.query.round_number as string, 10) : null;
  let list = state.matches.filter((m) => m.tournament_id === id);
  if (round) list = list.filter((m) => m.round_number === round);
  list.sort((a, b) => a.round_number - b.round_number || a.bracket_position - b.bracket_position);

  res.json(list.map((m) => serializeMatchForList(m, t)));
});

// A referee is meant to work ONE group (or the knockout bracket) at a time,
// not the whole tournament at once. This endpoint lists the "tables" a
// referee can pick from: each active group plus a synthetic "no group"
// bucket for knockout/single-elim matches, with pending/live counts so the
// selector only surfaces groups that still need work.
api.get("/tournaments/:id/referee/groups", (req, res) => {
  const id = parseInt(req.params.id, 10);
  const t = state.tournaments.find((tour) => tour.id === id);
  if (!t) {
    res.status(404).json({ detail: "Torneo no encontrado" });
    return;
  }
  const tMatches = state.matches.filter((m) => m.tournament_id === id);
  const keys = Array.from(new Set(tMatches.map((m) => m.group_id || "")));
  const groups = keys
    .map((key) => {
      const groupId = key || null;
      const gMatches = tMatches.filter((m) => (m.group_id || "") === key);
      return {
        group_id: groupId,
        label: groupId ? `Grupo ${groupId}` : (t.stage_type === "knockout" || t.format === "single_elim" ? (t.knockout_round_name || "Eliminatorias / Bracket") : "Combates"),
        pending_count: gMatches.filter((m) => m.status === "pending").length,
        in_progress_count: gMatches.filter((m) => m.status === "in_progress" || m.status === "calling").length,
        finished_count: gMatches.filter((m) => m.status === "finished").length,
        total_count: gMatches.length
      };
    })
    .filter((g) => g.pending_count > 0 || g.in_progress_count > 0)
    .sort((a, b) => (a.group_id || "\uffff").localeCompare(b.group_id || "\uffff"));

  res.json({ tournament_id: t.id, tournament_title: t.title, groups });
});

// Builds an anti-repetition, randomized referee queue for one group (or the
// knockout bucket when groupKey is null): no blader should face two
// consecutive combats unless every remaining pending match unavoidably
// includes them (e.g. only rematches/tie-breaks are left for that group).
function buildRefereeMatchQueue(tournamentId: number, groupKey: string | null) {
  const groupMatches = state.matches.filter((m) => m.tournament_id === tournamentId && (m.group_id || null) === groupKey);
  const pending = groupMatches.filter((m) => m.status === "pending");

  // Seed "recent players" from whichever match in this group was touched
  // most recently (currently being arbitrated, or the last one finished),
  // so the very first recommendation also avoids an immediate repeat.
  const active = groupMatches
    .filter((m) => m.status === "in_progress" || m.status === "calling")
    .sort((a, b) => (b.updated_at || b.created_at).localeCompare(a.updated_at || a.created_at))[0];
  const lastTouched = active || groupMatches
    .filter((m) => m.status === "finished")
    .sort((a, b) => (b.updated_at || b.created_at).localeCompare(a.updated_at || a.created_at))[0];

  let recentPlayers = new Set<number>();
  if (lastTouched) {
    if (lastTouched.player_a_id) recentPlayers.add(lastTouched.player_a_id);
    if (lastTouched.player_b_id) recentPlayers.add(lastTouched.player_b_id);
  }

  // Shuffle first (Fisher-Yates) so equally-valid candidates come out "al
  // azar" instead of always following seed/creation order.
  const remaining = pending.slice();
  for (let i = remaining.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
  }

  const ordered: Array<{ match: TournamentMatch; forced_repeat: boolean }> = [];
  while (remaining.length) {
    let idx = remaining.findIndex((m) =>
      !(m.player_a_id && recentPlayers.has(m.player_a_id)) &&
      !(m.player_b_id && recentPlayers.has(m.player_b_id))
    );
    let forced = false;
    if (idx === -1) {
      // Every remaining match repeats someone: unavoidable (last match(es)
      // of the group, or all that's left are rematches for one blader).
      idx = 0;
      forced = true;
    }
    const chosen = remaining.splice(idx, 1)[0];
    ordered.push({ match: chosen, forced_repeat: forced });
    recentPlayers = new Set<number>();
    if (chosen.player_a_id) recentPlayers.add(chosen.player_a_id);
    if (chosen.player_b_id) recentPlayers.add(chosen.player_b_id);
  }

  return ordered;
}

api.get("/tournaments/:id/referee/queue", (req, res) => {
  const id = parseInt(req.params.id, 10);
  const t = state.tournaments.find((tour) => tour.id === id);
  if (!t) {
    res.status(404).json({ detail: "Torneo no encontrado" });
    return;
  }
  const rawGroup = typeof req.query.group === "string" ? req.query.group : "";
  const groupKey = rawGroup && rawGroup !== "__none__" ? rawGroup : null;
  const queue = buildRefereeMatchQueue(id, groupKey);

  res.json({
    tournament_id: t.id,
    group_id: groupKey,
    matches: queue.map(({ match, forced_repeat }) => ({ ...serializeMatchForList(match, t), forced_repeat }))
  });
});

api.post("/tournaments/:id/start", requireRoles(["organizer", "admin"]), (req: AuthRequest, res) => {
  const id = parseInt(req.params.id, 10);
  const t = state.tournaments.find((tour) => tour.id === id);
  if (!t) {
    res.status(404).json({ detail: "Torneo no encontrado" });
    return;
  }

  if (t.status === "completed") {
    res.status(400).json({ detail: "El torneo ya concluyó" });
    return;
  }
  const existingMatches = state.matches.filter((match) => match.tournament_id === id);
  if (t.status === "in_progress" || existingMatches.length > 0) {
    res.json({ message: "El torneo ya estaba iniciado; se conservaron sus grupos y partidas", current_round: t.current_round });
    return;
  }

  const parts = state.participants.filter((p) => p.tournament_id === id && p.checked_in);
  if (parts.length < 2) {
    res.status(400).json({ detail: "Se requieren al menos 2 participantes con Check-in confirmado para iniciar el torneo" });
    return;
  }
  if (t.format === "groups_elim") {
    const configuredGroupCount = t.group_ids?.length || t.group_count || state.automaticGroupCount(parts.length);
    if (parts.length < configuredGroupCount * 2) {
      res.status(400).json({
        detail: `Hay ${parts.length} participantes con check-in para ${configuredGroupCount} grupos. Reduce los grupos o confirma al menos ${configuredGroupCount * 2} participantes.`
      });
      return;
    }
    const groupPlan = state.planTournamentGroups(t, parts);
    const underfilledGroups = groupPlan.groups
      .map((group, index) => ({ groupId: groupPlan.groupIds[index], count: group.length }))
      .filter((group) => group.count < 2);
    if (underfilledGroups.length) {
      res.status(400).json({
        detail: `Cada grupo necesita al menos 2 participantes con check-in. Revisa: ${underfilledGroups.map((group) => `${group.groupId} (${group.count})`).join(", ")}.`
      });
      return;
    }
  }

  t.status = "in_progress";
  t.current_round = 1;

  if (t.format === "groups_elim") {
    state.startGroupsElimTournament(t, parts);
  } else if (t.format === "round_robin") {
    t.group_count = 1;
    t.group_ids = ["A"];
    parts.forEach((p, idx) => {
      p.group_id = "A";
      p.seed = idx + 1;
    });
    state.startGroupsElimTournament(t, parts);
  } else if (t.format === "swiss") {
    // Generate Round 1 pairings (rank-sorted, avoiding rematches by construction since none exist yet)
    const pairings = state.pairSwissRound(t, parts);
    pairings.forEach(({ p1, p2 }, index) => {
      const isBye = !p2;
      state.matches.push({
        id: state.nextId(state.matches),
        tournament_id: t.id,
        round_number: 1,
        stage: "swiss",
        bracket_position: index + 1,
        station_number: (index % 4) + 1,
        player_a_id: p1.user_id,
        player_b_id: p2 ? p2.user_id : null,
        score_a: isBye ? t.match_target_points : 0,
        score_b: 0,
        winner_id: isBye ? p1.user_id : null,
        status: isBye ? "finished" : "pending",
        is_bye: isBye,
        target_points: t.match_target_points,
        created_at: new Date().toISOString()
      });
      if (isBye) {
        p1.swiss_points += 3;
        p1.matches_won += 1;
        p1.matches_played += 1;
      }
    });
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

      state.matches.push({
        id: state.nextId(state.matches),
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
        target_points: t.match_target_points,
        created_at: new Date().toISOString()
      });
    }
    // Byes must immediately push the advancing player into round 2, otherwise
    // they sit "finished" forever and the bracket never fills subsequent rounds.
    for (const byeMatch of state.matches.filter((match) =>
      match.tournament_id === t.id && match.round_number === 1 && match.is_bye
    )) {
      state.advanceSingleElimination(byeMatch);
    }
  }

  state.broadcastTournament(t.id, "tournament_updated", { tournament_id: t.id, status: t.status, current_round: t.current_round, stage_type: t.stage_type });
  res.json({ message: "Torneo iniciado exitosamente", current_round: t.current_round });
});

api.post("/tournaments/:id/generate-playoffs", requireRoles(["organizer", "admin"]), (req: AuthRequest, res) => {
  const id = parseInt(req.params.id, 10);
  const t = state.tournaments.find((tour) => tour.id === id);
  if (!t) {
    res.status(404).json({ detail: "Torneo no encontrado" });
    return;
  }
  if (t.format !== "groups_elim") {
    res.status(400).json({ detail: "Solo aplicable a torneos con formato Fase de Grupos + Eliminación" });
    return;
  }
  if (t.stage_type === "knockout" || state.matches.some((m) => m.tournament_id === id && !m.group_id)) {
    res.status(400).json({ detail: "La fase de playoffs ya fue generada para este torneo" });
    return;
  }
  const unfinishedGroups = state.matches.filter((m) => m.tournament_id === id && Boolean(m.group_id) && m.status !== "finished");
  if (unfinishedGroups.length > 0) {
    res.status(400).json({ detail: `No se pueden generar playoffs: aún quedan ${unfinishedGroups.length} combate(s) de grupos pendientes.` });
    return;
  }

  const groupStageMatches = state.matches.filter((match) =>
    match.tournament_id === id && (Boolean(match.group_id) || match.stage === "group_stage")
  );
  if (!groupStageMatches.length) {
    res.status(400).json({ detail: "El torneo todavía no tiene partidas de grupos para clasificar" });
    return;
  }
  state.recalcTournamentStats(t.id);
  const tParts = state.participants.filter((participant) => participant.tournament_id === id && participant.group_id);
  const groupLetters = Array.from(new Set(tParts.map((participant) => participant.group_id!))).sort();
  const advancersCount = Math.max(1, t.advancers_per_group || 2);

  interface PlayoffPairing {
    playerA: TournamentParticipant | null;
    playerB: TournamentParticipant | null;
  }
  const qualifiers = groupLetters.flatMap((groupId) =>
    tParts
      .filter((participant) => participant.group_id === groupId)
      .sort((a, b) => (a.group_rank || Number.MAX_SAFE_INTEGER) - (b.group_rank || Number.MAX_SAFE_INTEGER))
      .slice(0, advancersCount)
  );
  if (qualifiers.length < 2) {
    res.status(400).json({ detail: "Se necesitan al menos 2 participantes clasificados para generar playoffs" });
    return;
  }

  const bracketSize = 2 ** Math.ceil(Math.log2(qualifiers.length));
  const byeCount = bracketSize - qualifiers.length;
  const byeQualifiers = qualifiers.slice(0, byeCount);
  const remainingQualifiers = qualifiers.slice(byeCount);
  const pairings: PlayoffPairing[] = byeQualifiers.map((player) => ({ playerA: player, playerB: null }));
  while (remainingQualifiers.length >= 2) {
    const playerA = remainingQualifiers.shift()!;
    let opponentIndex = remainingQualifiers.findIndex((candidate) => candidate.group_id !== playerA.group_id);
    if (opponentIndex < 0) opponentIndex = 0;
    const [playerB] = remainingQualifiers.splice(opponentIndex, 1);
    pairings.push({ playerA, playerB });
  }
  if (remainingQualifiers.length) {
    pairings.push({ playerA: remainingQualifiers[0], playerB: null });
  }

  if (!pairings.length) {
    res.status(400).json({ detail: "No se pudieron clasificar participantes para la fase de eliminación" });
    return;
  }

  let stageName = "Eliminatoria";
  if (bracketSize >= 32) stageName = "16vos de Final";
  else if (bracketSize === 16) stageName = "8vos de Final";
  else if (bracketSize === 8) stageName = "Cuartos de Final";
  else if (bracketSize === 4) stageName = "Semifinales";
  else if (bracketSize === 2) stageName = "Gran Final";

  t.stage_type = "knockout";
  t.knockout_round_name = stageName;
  const playoffRounds = Math.log2(bracketSize);
  t.total_rounds = playoffRounds;
  t.current_round = 1;

  for (let pos = 0; pos < pairings.length; pos++) {
    const pair = pairings[pos];
    const isBye = !pair.playerB;
    state.matches.push({
      id: state.nextId(state.matches),
      tournament_id: t.id,
      round_number: 1,
      stage: stageName,
      bracket_position: pos + 1,
      station_number: (pos % 4) + 1,
      player_a_id: pair.playerA?.user_id || null,
      player_b_id: pair.playerB?.user_id || null,
      score_a: 0,
      score_b: 0,
      winner_id: isBye ? pair.playerA?.user_id || null : null,
      status: isBye ? "finished" : "pending",
      is_bye: isBye,
      target_points: t.match_target_points,
      created_at: new Date().toISOString()
    });
  }
  for (const playoffMatch of state.matches.filter((match) =>
    match.tournament_id === id && !match.group_id && match.round_number === 1 && match.is_bye
  )) {
    state.advanceSingleElimination(playoffMatch);
  }

  state.broadcastTournament(t.id, "tournament_updated", { tournament_id: t.id, stage_type: "knockout", current_round: 1, knockout_round_name: stageName });
  res.json({ message: `¡Cuadro de eliminación generado exitosamente! Ronda inicial: ${stageName}`, stage: stageName, pairings_count: pairings.length });
});

api.post("/tournaments/:id/next-round", requireRoles(["organizer", "admin"]), (req: AuthRequest, res) => {
  const id = parseInt(req.params.id, 10);
  const t = state.tournaments.find((tour) => tour.id === id);
  if (!t) {
    res.status(404).json({ detail: "Torneo no encontrado" });
    return;
  }

  if (t.status !== "in_progress") {
    res.status(400).json({ detail: "El torneo debe estar en progreso para generar la siguiente ronda" });
    return;
  }

  // Validate that all current round matches are finished
  const currentMatches = state.matches.filter((m) => m.tournament_id === id && m.round_number === t.current_round);
  const unfinishedMatches = currentMatches.filter((m) => m.status !== "finished");
  if (unfinishedMatches.length > 0) {
    res.status(400).json({
      detail: `No se puede avanzar: aún quedan ${unfinishedMatches.length} combate(s) pendientes de finalizar en la Ronda ${t.current_round}.`
    });
    return;
  }

  if (t.format === "swiss") {
    const nextRound = t.current_round + 1;
    if (nextRound > t.total_rounds) {
      t.status = "completed";
      const parts = state.participants
        .filter((p) => p.tournament_id === id)
        .sort((a, b) => b.swiss_points - a.swiss_points || b.buchholz - a.buchholz);
      if (parts[0]) t.winner_user_id = parts[0].user_id;
      if (parts[1]) t.runner_up_user_id = parts[1].user_id;
      if (parts[2]) t.third_place_user_id = parts[2].user_id;
      state.distributePrizes(t);
      state.broadcastTournament(t.id, "tournament_updated", { tournament_id: t.id, status: "completed" });
      res.json({ message: "Torneo finalizado con éxito", current_round: t.current_round });
      return;
    }

    t.current_round = nextRound;
    const parts = state.participants.filter((p) => p.tournament_id === id && p.checked_in);
    const pairings = state.pairSwissRound(t, parts);

    pairings.forEach(({ p1, p2 }, index) => {
      const isBye = !p2;
      state.matches.push({
        id: state.nextId(state.matches),
        tournament_id: t.id,
        round_number: nextRound,
        stage: "swiss",
        bracket_position: index + 1,
        station_number: (index % 4) + 1,
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
    });

    state.broadcastTournament(t.id, "tournament_updated", { tournament_id: t.id, current_round: nextRound });
    res.json({ message: `Ronda ${nextRound} generada exitosamente`, current_round: nextRound });
  } else {
    res.json({ message: "Las rondas de eliminación avanzan automáticamente al finalizar cada match" });
  }
});

}
