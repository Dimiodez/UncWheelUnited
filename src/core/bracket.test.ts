import { describe, expect, it } from "vitest";
import { createBracket, fillBracketScores, setBracketScore } from "./bracket";

describe("UWU knockout bracket", () => {
  it("creates a six-player bracket with two byes", () => {
    const rounds = createBracket(["A", "B", "C", "D", "E", "F"], () => 0.5);
    expect(rounds.map((round) => round.length)).toEqual([4, 2, 1]);
    expect(rounds[0].filter((match) => match.away === null)).toHaveLength(2);
    expect(rounds[0].map((match, index) => match.away === null ? index : null).filter((index) => index !== null)).toEqual([0, 2]);
    expect(rounds[1].filter((match) => match.home || match.away)).toHaveLength(2);
    expect(rounds[1].every((match) => Boolean(match.home) !== Boolean(match.away))).toBe(true);
  });

  it("spreads unavoidable byes across bracket sections as evenly as possible", () => {
    [9, 10, 11, 12, 13, 14, 15].forEach((entrantCount) => {
      const rounds = createBracket(Array.from({ length: entrantCount }, (_, index) => `P${index + 1}`), () => 0.5);
      const opening = rounds[0];
      const byeCount = opening.filter((match) => !match.away).length;
      const siblingPairsWithTwoByes = Array.from({ length: opening.length / 2 }, (_, index) => [opening[index * 2], opening[index * 2 + 1]])
        .filter((pair) => pair.every((match) => !match.away)).length;
      expect(siblingPairsWithTwoByes).toBe(Math.max(0, byeCount - opening.length / 2));
    });
  });

  it("advances winners when both scores are decisive", () => {
    let rounds = createBracket(["A", "B", "C", "D"], () => 0.99);
    rounds = setBracketScore(rounds, 0, 0, "home", "3");
    rounds = setBracketScore(rounds, 0, 0, "away", "1");
    expect(rounds[0][0].winner).toBe(rounds[0][0].home);
    expect(rounds[1][0].home).toBe(rounds[0][0].home);
  });

  it("does not advance a tied score", () => {
    let rounds = createBracket(["A", "B", "C", "D"], () => 0.25);
    rounds = setBracketScore(rounds, 0, 0, "home", "2");
    rounds = setBracketScore(rounds, 0, 0, "away", "2");
    expect(rounds[0][0].winner).toBeNull();
  });

  it("fills every playable match for test runs", () => {
    const rounds = fillBracketScores(createBracket(["A", "B", "C", "D"], () => 0.99));
    expect(rounds.flat().filter((match) => match.home && match.away).every((match) => match.winner)).toBe(true);
    expect(rounds.at(-1)?.[0].winner).toBeTruthy();
  });
});
