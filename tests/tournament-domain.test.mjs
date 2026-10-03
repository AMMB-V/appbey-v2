import assert from "node:assert/strict";
import test from "node:test";
import { createTournamentDomain } from "../src/backend/services/tournament-domain.ts";

function participant(id, seed = id) {
  return {
    id,
    tournament_id: 1,
    user_id: id,
    seed,
    checked_in: true,
    swiss_points: 0,
    buchholz: 0,
    points_scored: 0,
    points_conceded: 0,
    matches_played: 0,
    matches_won: 0,
    matches_drawn: 0,
    matches_lost: 0
  };
}

function createDomain(overrides = {}) {
  const users = [
    { id: 1, elo_rating: 1200 },
    { id: 2, elo_rating: 1200 }
  ];
  const state = {
    users,
    tournaments: [],
    participants: [],
    matches: [],
    matchGames: [],
    nextId: (records) => records.reduce((max, record) => Math.max(max, record.id), 0) + 1,
    broadcastTournament() {},
    ...overrides
  };
  return { domain: createTournamentDomain(state), state };
}

test("tournament domain assigns seed order in serpentine group format", () => {
  const { domain } = createDomain();
  const tournament = {
    id: 1,
    format: "groups_elim",
    group_count: 2,
    group_ids: ["A", "B"],
    advancers_per_group: 2
  };
  const roster = [participant(1), participant(2), participant(3), participant(4)];

  const plan = domain.planTournamentGroups(tournament, roster);

  assert.deepEqual(plan.groupIds, ["A", "B"]);
  assert.deepEqual(plan.groups.map((group) => group.map((entry) => entry.user_id)), [[1, 4], [2, 3]]);
  assert.deepEqual(
    roster.map((entry) => plan.assignment.get(entry.user_id)),
    [
      { group_id: "A", group_seed: 1 },
      { group_id: "B", group_seed: 1 },
      { group_id: "B", group_seed: 2 },
      { group_id: "A", group_seed: 2 }
    ]
  );
});

test("Swiss pairing avoids rematches and gives an odd roster an unclaimed bye", () => {
  const roster = [participant(1), participant(2), participant(3), participant(4), participant(5)];
  const state = {
    tournaments: [{ id: 1 }],
    participants: roster,
    matches: [
      { id: 1, tournament_id: 1, stage: "swiss", player_a_id: 1, player_b_id: 2, is_bye: false },
      { id: 2, tournament_id: 1, stage: "swiss", player_a_id: 5, player_b_id: null, is_bye: true }
    ]
  };
  const { domain } = createDomain(state);

  const pairings = domain.pairSwissRound(state.tournaments[0], roster);

  assert.equal(pairings.at(-1).p2, null);
  assert.equal(pairings.at(-1).p1.user_id, 4);
  assert.equal(pairings.some(({ p1, p2 }) => p2 && [p1.user_id, p2.user_id].sort().join("-") === "1-2"), false);
  assert.deepEqual(pairings.flatMap(({ p1, p2 }) => [p1.user_id, ...(p2 ? [p2.user_id] : [])]).sort((a, b) => a - b), [1, 2, 3, 4, 5]);
});

test("ELO updates are symmetric and do not drop below the minimum rating", () => {
  const { domain, state } = createDomain({
    users: [
      { id: 1, elo_rating: 100 },
      { id: 2, elo_rating: 100 }
    ]
  });

  domain.updateEloRatings(1, 2, 2);

  assert.equal(state.users[0].elo_rating, 100);
  assert.equal(state.users[1].elo_rating, 116);
});

test("single-elimination winners fill the correct slots through the grand final", () => {
  const tournament = {
    id: 1,
    format: "single_elim",
    stage_type: undefined,
    total_rounds: 3,
    status: "in_progress",
    match_target_points: 4
  };
  const { domain, state } = createDomain({ tournaments: [tournament] });
  const firstRound = [1, 2, 3, 4].map((position) => ({
    id: position,
    tournament_id: 1,
    round_number: 1,
    bracket_position: position,
    player_a_id: position,
    player_b_id: position + 10,
    winner_id: position,
    status: "finished",
    is_bye: false
  }));
  state.matches.push(...firstRound);

  domain.advanceSingleElimination(firstRound[0]);
  domain.advanceSingleElimination(firstRound[1]);
  domain.advanceSingleElimination(firstRound[2]);
  domain.advanceSingleElimination(firstRound[3]);
  const semifinals = state.matches.filter((match) => match.round_number === 2);
  assert.deepEqual(
    semifinals.map((match) => [match.stage, match.player_a_id, match.player_b_id]),
    [["Semifinales", 1, 2], ["Semifinales", 3, 4]]
  );

  semifinals[0].winner_id = 1;
  semifinals[1].winner_id = 3;
  domain.advanceSingleElimination(semifinals[0]);
  domain.advanceSingleElimination(semifinals[1]);
  const final = state.matches.find((match) => match.round_number === 3);
  assert.deepEqual([final.stage, final.player_a_id, final.player_b_id], ["Gran Final", 1, 3]);

  final.status = "finished";
  final.winner_id = 1;
  domain.advanceSingleElimination(final);
  assert.equal(tournament.status, "completed");
  assert.equal(tournament.winner_user_id, 1);
  assert.equal(tournament.runner_up_user_id, 3);
});
