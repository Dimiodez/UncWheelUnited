import { describe, expect, it } from "vitest";
import { createBracket, setBracketScore } from "./bracket";

describe("UWU knockout bracket", () => {
  it("creates a six-player bracket with two byes", () => {
    const rounds = createBracket(["A", "B", "C", "D", "E", "F"], () => 0.5);
    expect(rounds.map((round) => round.length)).toEqual([4, 2, 1]);
    expect(rounds[0].filter((match) => match.away === null)).toHaveLength(2);
    expect(rounds[1].filter((match) => match.home || match.away)).toHaveLength(1);
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
});
