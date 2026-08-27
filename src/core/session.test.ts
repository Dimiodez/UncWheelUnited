import { describe, expect, it } from "vitest";
import { assignPlayer, eligibleTeams, resetAssignments, rollNext, undoLast } from "./session";
import type { Session } from "../types";

const session = (): Session => ({
  schemaVersion: 1,
  players: [
    { id: "p1", name: "Bob", status: "available", rating: 7.7 },
    { id: "p2", name: "Joe", status: "available", rating: 6.2 },
    { id: "p3", name: "Tom", status: "next", rating: 5.5 }
  ],
  teams: [
    { id: "t1", name: "Red", abbreviation: "RED", capacity: 1, allowOverflow: true, playerIds: [], budget: 45 },
    { id: "t2", name: "Blue", abbreviation: "BLU", capacity: 1, allowOverflow: true, playerIds: [], budget: 45 }
  ],
  assignments: [],
  overflowMode: "balanced",
  positionMode: "none",
  positionLimitsEnabled: false,
  positionLimits: { Attacker: 1, Midfield: 1, Defense: 1 },
  customWheels: []
});

describe("UWU assignment engine", () => {
  it("assigns an available player and fills a team", () => {
    const result = assignPlayer(session(), "p1", "t1");
    expect(result.players[0].status).toBe("assigned");
    expect(result.teams[0].playerIds).toEqual(["p1"]);
  });

  it("removes full teams from normal eligibility", () => {
    const state = assignPlayer(session(), "p1", "t1");
    expect(eligibleTeams(state).map((team) => team.id)).toEqual(["t2"]);
  });

  it("uses only available players during a roll", () => {
    const result = rollNext(session(), false, () => 0);
    expect(result.assignments).toHaveLength(1);
    expect(result.assignments[0].playerId).toBe("p1");
  });

  it("adds a position when a position wheel is enabled", () => {
    const state = { ...session(), positionMode: "specific" as const };
    const result = rollNext(state, false, () => 0);
    expect(result.assignments[0].position).toBe("ST");
  });

  it("respects per-team position limits", () => {
    const base = session();
    const state = {
      ...base,
      teams: [{ ...base.teams[0], capacity: 3 }],
      positionMode: "simple" as const,
      positionLimitsEnabled: true
    };
    const first = rollNext(state, false, () => 0);
    const second = rollNext(first, false, () => 0);
    expect(first.assignments[0].position).toBe("Attacker");
    expect(second.assignments[1].position).toBe("Midfield");
  });

  it("removes custom wheel entries after use when enabled", () => {
    const base = session();
    const state = {
      ...base,
      teams: [{ ...base.teams[0], capacity: 3 }],
      customWheels: [{ id: "w1", name: "Kit", entries: ["Home", "Away"], removeAfterRoll: true, usedEntries: [] }]
    };
    const first = rollNext(state, false, () => 0);
    const second = rollNext(first, false, () => 0);
    expect(first.assignments[0].customValues?.w1).toBe("Home");
    expect(second.assignments[1].customValues?.w1).toBe("Away");
  });

  it("undoes the latest assignment", () => {
    const assigned = assignPlayer(session(), "p1", "t1");
    const result = undoLast(assigned);
    expect(result.players[0].status).toBe("available");
    expect(result.teams[0].playerIds).toEqual([]);
  });

  it("reset restores assigned and waiting players to the available wheel", () => {
    const assigned = assignPlayer(session(), "p1", "t1");
    const result = resetAssignments(assigned);
    expect(result.players.every((player) => player.status === "available")).toBe(true);
    expect(result.assignments).toHaveLength(0);
  });
});
