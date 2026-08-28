import { describe, expect, it } from "vitest";
import { assignPlayer, eligibleTeams, resetAssignments, rollNext, undoLast } from "./session";
import type { Session } from "../types";

const session = (): Session => ({
  schemaVersion: 1,
  players: [
    { id: "p1", name: "Bob", status: "available", rating: 7.7, role: "Any" },
    { id: "p2", name: "Joe", status: "available", rating: 6.2, role: "Any" },
    { id: "p3", name: "Tom", status: "next", rating: 5.5, role: "Any" }
  ],
  teams: [
    { id: "t1", name: "Red", abbreviation: "RED", colorHue: 348, capacity: 1, allowOverflow: true, playerIds: [], budget: 45 },
    { id: "t2", name: "Blue", abbreviation: "BLU", colorHue: 220, capacity: 1, allowOverflow: true, playerIds: [], budget: 45 }
  ],
  assignments: [],
  overflowMode: "balanced",
  positionMode: "none",
  positionLimitsEnabled: false,
  positionLimits: { Any: 6, Attacker: 1, Midfield: 1, Defense: 1 },
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
    const base = session();
    const state = { ...base, players: base.players.map((player) => player.id === "p1" ? { ...player, role: "Attacker" as const } : player), positionMode: "specific" as const };
    const result = rollNext(state, false, () => 0);
    expect(result.assignments[0].position).toBe("ST");
  });

  it("uses a player's manually assigned positional role", () => {
    const base = session();
    const state = {
      ...base,
      players: base.players.map((player) => player.id === "p1" ? { ...player, role: "Defense" as const } : player),
      positionMode: "specific" as const
    };
    const result = rollNext(state, false, () => 0);
    expect(result.assignments[0].position).toBe("FB");
  });

  it("limits Any-role players per team", () => {
    const base = session();
    const state = {
      ...base,
      teams: [{ ...base.teams[0], capacity: 3 }],
      positionMode: "simple" as const,
      positionLimitsEnabled: true,
      positionLimits: { ...base.positionLimits, Any: 1 }
    };
    const first = rollNext(state, false, () => 0);
    const second = rollNext(first, false, () => 0);
    expect(first.assignments).toHaveLength(1);
    expect(first.assignments[0].position).toBe("Any");
    expect(second.assignments).toHaveLength(1);
  });

  it("assigns a balanced 24-player positional draft without stranding specialists", () => {
    const roles = ["Attacker", "Midfield", "Defense", "Any"] as const;
    const state: Session = {
      ...session(),
      players: Array.from({ length: 24 }, (_, index) => ({
        id: `p${index}`,
        name: `Player ${index + 1}`,
        status: "available",
        rating: 5,
        role: roles[Math.floor(index / 6)]
      })),
      teams: Array.from({ length: 4 }, (_, index) => ({
        id: `t${index}`,
        name: `Team ${index + 1}`,
        abbreviation: `T${index + 1}`,
        colorHue: index * 80,
        capacity: 6,
        allowOverflow: false,
        playerIds: [],
        budget: 45
      })),
      positionMode: "simple",
      positionLimitsEnabled: true,
      positionLimits: { Any: 2, Attacker: 2, Midfield: 2, Defense: 2 }
    };
    let result = state;
    let seed = 17;
    const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    for (let index = 0; index < 24; index += 1) result = rollNext(result, false, random);
    expect(result.assignments).toHaveLength(24);
    expect(result.players.filter((player) => player.status === "assigned")).toHaveLength(24);
    expect(result.teams.every((team) => team.playerIds.length === 6)).toBe(true);
    expect(new Set(result.teams.flatMap((team) => team.playerIds)).size).toBe(24);
  });

  it("respects per-team position limits", () => {
    const base = session();
    const state = {
      ...base,
      players: base.players.map((player) => player.id === "p1" ? { ...player, role: "Attacker" as const } : player.id === "p2" ? { ...player, role: "Midfield" as const } : player),
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
