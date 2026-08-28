import { describe, expect, it } from "vitest";
import { calculateGroupStandings, createGroupStage, groupQualifiers, groupStageComplete } from "./groupStage";

describe("UWU classic group stage", () => {
  it("creates balanced groups of four and one match per pairing", () => {
    const stage = createGroupStage(Array.from({ length: 8 }, (_, index) => `P${index + 1}`), 2, () => 0.99);
    expect(stage.groups.map((group) => group.length)).toEqual([4, 4]);
    expect(stage.fixtures).toHaveLength(12);
  });

  it("calculates points and goal difference", () => {
    const group = ["A", "B", "C", "D"];
    const stage = createGroupStage(group, 1, () => 0.99);
    stage.fixtures.forEach((fixture) => { fixture.homeScore = "2"; fixture.awayScore = "0"; });
    const table = calculateGroupStandings(group, stage.fixtures);
    expect(table[0].points).toBeGreaterThan(table[1].points);
    expect(table[0].goalDifference).toBeGreaterThan(0);
    expect(groupStageComplete(stage)).toBe(true);
  });

  it("sends two teams per group into the knockout bracket", () => {
    const stage = createGroupStage(Array.from({ length: 8 }, (_, index) => `P${index + 1}`), 2, () => 0.99);
    stage.fixtures.forEach((fixture) => { fixture.homeScore = "1"; fixture.awayScore = "0"; });
    expect(groupQualifiers(stage)).toHaveLength(4);
  });

  it("balances an odd number of entrants across a chosen group count", () => {
    const stage = createGroupStage(Array.from({ length: 11 }, (_, index) => `P${index + 1}`), 3, () => 0.99);
    expect(stage.groups.map((group) => group.length)).toEqual([4, 4, 3]);
  });
});
