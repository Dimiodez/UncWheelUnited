export type LeagueFixture = {
  id: string;
  home: string;
  away: string;
  homeScore: string;
  awayScore: string;
};

export type LeagueRow = {
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
};

const shuffle = <T,>(items: T[], random: () => number) => {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
};

export const validGameCounts = (entrantCount: number) => Array.from({ length: entrantCount - 1 }, (_, index) => index + 1).filter((games) => entrantCount % 2 === 0 || games % 2 === 0);

export const createLeagueFixtures = (names: string[], gamesPerPlayer: number, random = Math.random): LeagueFixture[] => {
  const entrants = shuffle(names.map((name) => name.trim()).filter(Boolean), random);
  const edges = new Set<string>();
  const fixtures: LeagueFixture[] = [];
  const addEdge = (a: number, b: number) => {
    const key = [a, b].sort((left, right) => left - right).join("-");
    if (edges.has(key)) return;
    edges.add(key);
    fixtures.push({ id: `l-${key}`, home: entrants[a], away: entrants[b], homeScore: "", awayScore: "" });
  };
  for (let distance = 1; distance <= Math.floor(gamesPerPlayer / 2); distance += 1) {
    for (let index = 0; index < entrants.length; index += 1) addEdge(index, (index + distance) % entrants.length);
  }
  if (gamesPerPlayer % 2 === 1) {
    for (let index = 0; index < entrants.length / 2; index += 1) addEdge(index, index + entrants.length / 2);
  }
  return fixtures;
};

export const calculateLeagueTable = (names: string[], fixtures: LeagueFixture[]): LeagueRow[] => {
  const table = new Map(names.map((name) => [name, { name, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 }]));
  fixtures.filter((fixture) => fixture.homeScore !== "" && fixture.awayScore !== "").forEach((fixture) => {
    const home = table.get(fixture.home); const away = table.get(fixture.away);
    if (!home || !away) return;
    const hg = Number(fixture.homeScore); const ag = Number(fixture.awayScore);
    home.played += 1; away.played += 1; home.goalsFor += hg; home.goalsAgainst += ag; away.goalsFor += ag; away.goalsAgainst += hg;
    if (hg > ag) { home.won += 1; away.lost += 1; home.points += 3; }
    else if (ag > hg) { away.won += 1; home.lost += 1; away.points += 3; }
    else { home.drawn += 1; away.drawn += 1; home.points += 1; away.points += 1; }
  });
  return [...table.values()].map((row) => ({ ...row, goalDifference: row.goalsFor - row.goalsAgainst })).sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor || a.name.localeCompare(b.name));
};

export const leagueComplete = (fixtures: LeagueFixture[]) => fixtures.length > 0 && fixtures.every((fixture) => fixture.homeScore !== "" && fixture.awayScore !== "");
