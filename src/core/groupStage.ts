export type GroupFixture = {
  id: string;
  groupIndex: number;
  home: string;
  away: string;
  homeScore: string;
  awayScore: string;
};

export type GroupStage = {
  groups: string[][];
  fixtures: GroupFixture[];
};

export type GroupStanding = {
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

export const createGroupStageFromGroups = (groups: string[][], doubleElimination = false): GroupStage => {
  const copiedGroups = groups.map((group) => [...group]);
  const fixtures = copiedGroups.flatMap((group, groupIndex) => group.flatMap((home, homeIndex) => group.slice(homeIndex + 1).flatMap((away, awayIndex) => {
    const pairingId = `${homeIndex}-${homeIndex + awayIndex + 1}`;
    const firstFixture: GroupFixture = {
      id: `g${groupIndex}-m${pairingId}-1`,
      groupIndex,
      home,
      away,
      homeScore: "",
      awayScore: ""
    };
    if (!doubleElimination) return [firstFixture];
    return [firstFixture, {
      ...firstFixture,
      id: `g${groupIndex}-m${pairingId}-2`,
      home: away,
      away: home
    }];
  })));
  return { groups: copiedGroups, fixtures };
};

export const createGroupStage = (names: string[], groupCount: number, random = Math.random): GroupStage => {
  const shuffled = shuffle(names.map((name) => name.trim()).filter(Boolean), random);
  const groups = Array.from({ length: groupCount }, () => [] as string[]);
  shuffled.forEach((name, index) => groups[index % groupCount].push(name));
  return createGroupStageFromGroups(groups);
};

export const groupStageComplete = (stage: GroupStage) => stage.fixtures.every((fixture) => fixture.homeScore !== "" && fixture.awayScore !== "");

export const calculateGroupStandings = (group: string[], fixtures: GroupFixture[]): GroupStanding[] => {
  const table = new Map(group.map((name) => [name, { name, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 }]));
  fixtures.filter((fixture) => fixture.homeScore !== "" && fixture.awayScore !== "").forEach((fixture) => {
    const home = table.get(fixture.home);
    const away = table.get(fixture.away);
    if (!home || !away) return;
    const homeGoals = Number(fixture.homeScore);
    const awayGoals = Number(fixture.awayScore);
    home.played += 1; away.played += 1;
    home.goalsFor += homeGoals; home.goalsAgainst += awayGoals;
    away.goalsFor += awayGoals; away.goalsAgainst += homeGoals;
    if (homeGoals > awayGoals) { home.won += 1; away.lost += 1; home.points += 3; }
    else if (awayGoals > homeGoals) { away.won += 1; home.lost += 1; away.points += 3; }
    else { home.drawn += 1; away.drawn += 1; home.points += 1; away.points += 1; }
  });
  return [...table.values()].map((row) => ({ ...row, goalDifference: row.goalsFor - row.goalsAgainst })).sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor || a.name.localeCompare(b.name));
};

export const qualificationSlots = (groupCount: number, qualifiersPerGroup = 2, crossover = true) => {
  const places = Math.max(1, Math.min(2, qualifiersPerGroup));
  if (places === 1) return Array.from({ length: groupCount }, (_, groupIndex) => ({ groupIndex, position: 0 }));
  if (!crossover) return Array.from({ length: groupCount }, (_, groupIndex) => [
    { groupIndex, position: 0 }, { groupIndex, position: 1 }
  ]).flat();
  return Array.from({ length: groupCount }, (_, groupIndex) => [
    { groupIndex, position: 0 }, { groupIndex: (groupIndex + 1) % groupCount, position: 1 }
  ]).flat();
};

export const groupQualifiers = (stage: GroupStage, qualifiersPerGroup = 2, crossover = true) => {
  const ranked = stage.groups.map((group, groupIndex) => calculateGroupStandings(group, stage.fixtures.filter((fixture) => fixture.groupIndex === groupIndex)));
  return qualificationSlots(stage.groups.length, qualifiersPerGroup, crossover).map(slot => ranked[slot.groupIndex][slot.position].name);
};
