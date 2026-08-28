export type BracketMatch = {
  id: string;
  home: string | null;
  away: string | null;
  homeScore: string;
  awayScore: string;
  winner: string | null;
};

export type BracketRounds = BracketMatch[][];

const shuffle = <T,>(items: T[], random: () => number) => {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
};

const scoreWinner = (match: BracketMatch, allowBye = false) => {
  if (allowBye && match.home && !match.away) return match.home;
  if (!match.home || !match.away || match.homeScore === "" || match.awayScore === "") return null;
  const home = Number(match.homeScore);
  const away = Number(match.awayScore);
  if (!Number.isFinite(home) || !Number.isFinite(away) || home === away) return null;
  return home > away ? match.home : match.away;
};

export const recalculateBracket = (rounds: BracketRounds): BracketRounds => {
  const next = rounds.map((round) => round.map((match) => ({ ...match })));
  next[0].forEach((match) => { match.winner = scoreWinner(match, true); });

  for (let roundIndex = 1; roundIndex < next.length; roundIndex += 1) {
    next[roundIndex].forEach((match, matchIndex) => {
      const oldHome = match.home;
      const oldAway = match.away;
      match.home = next[roundIndex - 1][matchIndex * 2]?.winner ?? null;
      match.away = next[roundIndex - 1][matchIndex * 2 + 1]?.winner ?? null;
      if (match.home !== oldHome || match.away !== oldAway) {
        match.homeScore = "";
        match.awayScore = "";
      }
      match.winner = scoreWinner(match);
    });
  }
  return next;
};

export const createBracket = (names: string[], random = Math.random): BracketRounds => {
  const entrants = shuffle(names.map((name) => name.trim()).filter(Boolean), random);
  const bracketSize = 2 ** Math.ceil(Math.log2(Math.max(2, entrants.length)));
  const byeCount = bracketSize - entrants.length;
  const rounds: BracketRounds = [];
  let cursor = 0;
  const opening: BracketMatch[] = [];
  for (let index = 0; index < bracketSize / 2; index += 1) {
    const hasBye = index < byeCount;
    opening.push({
      id: `r0-m${index}`,
      home: entrants[cursor++] ?? null,
      away: hasBye ? null : entrants[cursor++] ?? null,
      homeScore: "",
      awayScore: "",
      winner: null
    });
  }
  rounds.push(opening);
  for (let matchCount = opening.length / 2, roundIndex = 1; matchCount >= 1; matchCount /= 2, roundIndex += 1) {
    rounds.push(Array.from({ length: matchCount }, (_, index) => ({ id: `r${roundIndex}-m${index}`, home: null, away: null, homeScore: "", awayScore: "", winner: null })));
  }
  return recalculateBracket(rounds);
};

export const setBracketScore = (rounds: BracketRounds, roundIndex: number, matchIndex: number, side: "home" | "away", value: string) => {
  const next = rounds.map((round) => round.map((match) => ({ ...match })));
  next[roundIndex][matchIndex][side === "home" ? "homeScore" : "awayScore"] = value;
  return recalculateBracket(next);
};

export const roundName = (roundIndex: number, roundCount: number) => {
  const remaining = roundCount - roundIndex;
  if (remaining === 1) return "Final";
  if (remaining === 2) return "Semifinals";
  if (remaining === 3) return "Quarterfinals";
  return `Round ${roundIndex + 1}`;
};
