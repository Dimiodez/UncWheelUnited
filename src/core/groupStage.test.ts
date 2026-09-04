import { describe, expect, it } from "vitest";
import { calculateGroupStandings, createGroupStage, createGroupStageFromGroups, groupQualifiers, groupStageComplete, qualificationSlots } from "./groupStage";

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

  it("previews two-group crossover semifinals as A1-B2 and B1-A2", () => {
    expect(qualificationSlots(2, 2, true)).toEqual([
      { groupIndex: 0, position: 0 }, { groupIndex: 1, position: 1 },
      { groupIndex: 1, position: 0 }, { groupIndex: 0, position: 1 }
    ]);
  });

  it("creates home-and-away fixtures when double elimination is enabled", () => {
    const stage = createGroupStageFromGroups([["A", "B", "C"]], true);
    expect(stage.fixtures).toHaveLength(6);
    expect(stage.fixtures.filter((fixture) => fixture.home === "A" && fixture.away === "B")).toHaveLength(1);
    expect(stage.fixtures.filter((fixture) => fixture.home === "B" && fixture.away === "A")).toHaveLength(1);
  });
});
