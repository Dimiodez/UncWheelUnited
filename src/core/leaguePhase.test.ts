import { describe, expect, it } from "vitest";
import { calculateLeagueTable, createLeagueFixtures, validGameCounts } from "./leaguePhase";

describe("UWU league phase", () => {
  it("creates an equal number of unique matches for every entrant", () => {
    const names = Array.from({ length: 12 }, (_, index) => `P${index + 1}`);
    const fixtures = createLeagueFixtures(names, 5, () => 0.99);
    expect(fixtures).toHaveLength(30);
    names.forEach((name) => expect(fixtures.filter((fixture) => fixture.home === name || fixture.away === name)).toHaveLength(5));
  });

  it("only offers even game counts for an odd number of entrants", () => {
    expect(validGameCounts(9)).toEqual([2, 4, 6, 8]);
  });

  it("ranks the combined table by points and goal difference", () => {
    const names = ["A", "B", "C", "D"];
    const fixtures = createLeagueFixtures(names, 3, () => 0.99);
    fixtures.forEach((fixture) => { fixture.homeScore = "2"; fixture.awayScore = "0"; });
    const table = calculateLeagueTable(names, fixtures);
    expect(table[0].points).toBeGreaterThanOrEqual(table[1].points);
    expect(table[0].goalDifference).toBeGreaterThanOrEqual(table[1].goalDifference);
  });
});
