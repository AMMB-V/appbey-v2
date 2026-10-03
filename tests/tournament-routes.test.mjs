import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import test from "node:test";
import { createTournamentDomain } from "../src/backend/services/tournament-domain.ts";
import { registerTournamentRoutes } from "../src/backend/routes/tournaments.ts";
import { registerMatchRoutes } from "../src/backend/routes/matches.ts";

function routeDependencies() {
  const tournaments = [{ id: 4, title: "Open", status: "registration_open", organizer_id: 1, country: "PA" }];
  const dependencies = {
    users: [{ id: 1, username: "organizer", display_name: "Organizer" }],
    decks: [],
    tournaments,
    participants: [],
    matches: [],
    matchGames: [],
    seasons: [],
    seasonRankings: [],
    hallOfFame: [],
    nextId: (records) => records.reduce((max, record) => Math.max(max, record.id), 0) + 1,
    publicUser: (user) => user ? { id: user.id, username: user.username } : null,
    broadcastTournament() {},
    updateEloRatings() {},
    recalcTournamentStats() {},
    updateStatsAfterMatch() {},
    distributePrizes() {},
    advanceSingleElimination() {},
    forfeitMatch() {},
    withdrawParticipantFromMatches() {},
    revertBracketPropagation: () => ({ blocked: false }),
    recomputeMatchFromGames() {},
    createWalkinBlader: () => { throw new Error("Unexpected walk-in creation"); },
    tournamentGroupIds: () => [],
    normalizeGroupId: () => null,
    automaticGroupCount: () => 1,
    alphabeticalGroupIds: () => [],
    serpentineGroupOrder: () => []
  };
  return dependencies;
}

test("tournament and match routes register and preserve their HTTP responses", async (context) => {
  const app = express();
  const router = express.Router();
  const state = routeDependencies();
  registerTournamentRoutes(router, state);
  registerMatchRoutes(router, state);
  app.use(express.json(), router);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const tournamentResponse = await fetch(`${baseUrl}/tournaments`);
  const tournamentList = await tournamentResponse.json();
  assert.equal(tournamentResponse.status, 200);
  assert.equal(tournamentList[0].id, 4);
  assert.deepEqual(tournamentList[0].organizer, { id: 1, username: "organizer" });

  const missingMatchResponse = await fetch(`${baseUrl}/matches/999`);
  assert.equal(missingMatchResponse.status, 404);
  assert.deepEqual(await missingMatchResponse.json(), { detail: "Match no encontrado" });
});

test("starting a single-elimination tournament creates byes and seeds the next round", async (context) => {
  const app = express();
  const router = express.Router();
  const state = routeDependencies();
  const organizer = { id: 1, username: "organizer", role: "organizer" };
  state.tournaments[0] = {
    ...state.tournaments[0],
    format: "single_elim",
    match_target_points: 4,
    total_rounds: 3,
    current_round: 0
  };
  state.participants.push(
    ...[1, 2, 3, 4, 5].map((id) => ({
      id,
      tournament_id: 4,
      user_id: id,
      seed: id,
      checked_in: true
    }))
  );
  Object.assign(state, createTournamentDomain({
    users: state.users,
    tournaments: state.tournaments,
    participants: state.participants,
    matches: state.matches,
    matchGames: state.matchGames,
    nextId: state.nextId,
    broadcastTournament: state.broadcastTournament
  }));
  registerTournamentRoutes(router, state);
  app.use(express.json(), (req, _res, next) => {
    req.user = organizer;
    next();
  }, router);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const response = await fetch(`${baseUrl}/tournaments/4/start`, { method: "POST" });
  assert.equal(response.status, 200);
  assert.equal(state.tournaments[0].total_rounds, 3);

  const openingMatches = state.matches.filter((match) => match.round_number === 1);
  assert.equal(openingMatches.length, 4);
  assert.equal(openingMatches.filter((match) => match.is_bye).length, 3);

  const semifinalMatches = state.matches.filter((match) => match.round_number === 2);
  assert.equal(semifinalMatches.length, 2);
  assert.ok(semifinalMatches.every((match) => match.stage === "Semifinales"));
  assert.deepEqual(
    semifinalMatches.map((match) => [match.player_a_id, match.player_b_id]),
    [[1, 2], [3, null]]
  );
});

test("seed shuffle preserves the seed permutation", async (context) => {
  const app = express();
  const router = express.Router();
  const state = routeDependencies();
  state.tournaments[0].status = "registration_open";
  state.participants.push(
    ...[1, 2, 3, 4].map((seed) => ({ id: seed, tournament_id: 4, user_id: seed, seed }))
  );
  registerTournamentRoutes(router, state);
  app.use(express.json(), (req, _res, next) => {
    req.user = { id: 1, role: "organizer" };
    next();
  }, router);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(`${baseUrl}/tournaments/4/shuffle-seeds`, { method: "POST" });

  assert.equal(response.status, 200);
  assert.deepEqual(state.participants.map((participant) => participant.seed).sort((a, b) => a - b), [1, 2, 3, 4]);
});

test("single-elimination score responses expose set wins instead of match points", async (context) => {
  const app = express();
  const router = express.Router();
  const state = routeDependencies();
  state.tournaments[0] = {
    ...state.tournaments[0],
    format: "single_elim",
    match_target_points: 4
  };
  state.users.push(
    { id: 2, username: "blader-a", display_name: "Blader A" },
    { id: 3, username: "blader-b", display_name: "Blader B" }
  );
  state.participants.push(
    { id: 1, tournament_id: 4, user_id: 2, deck: [] },
    { id: 2, tournament_id: 4, user_id: 3, deck: [] }
  );
  state.matches.push({
    id: 10,
    tournament_id: 4,
    round_number: 1,
    stage: "Semifinales",
    bracket_position: 1,
    station_number: 1,
    player_a_id: 2,
    player_b_id: 3,
    score_a: 0,
    score_b: 0,
    winner_id: null,
    status: "pending",
    is_bye: false,
    target_points: 4,
    created_at: new Date().toISOString()
  });
  registerMatchRoutes(router, state);
  app.use(express.json(), (req, _res, next) => {
    req.user = { id: 1, role: "organizer" };
    next();
  }, router);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  for (let set = 0; set < 2; set++) {
    for (let point = 0; point < 4; point++) {
      const response = await fetch(`${baseUrl}/matches/10/record-finish`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ finish_type: "spin_finish_1p", awarded_to: "player_a" })
      });
      assert.equal(response.status, 200);
    }
  }

  const matchResponse = await fetch(`${baseUrl}/matches/10`);
  const match = await matchResponse.json();
  assert.equal(match.is_elimination, true);
  assert.equal(match.score_a, 0);
  assert.equal(match.score_b, 0);
  assert.equal(match.sets_won_a, 2);
  assert.equal(match.sets_won_b, 0);
  assert.equal(match.status, "finished");
  assert.equal(match.winner_id, 2);
});
