import type { Assignment, Player, Session, Team } from "../types";

const id = () => crypto.randomUUID();
export const abbreviateTeam = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) return words.map((word) => word[0]).join("").slice(0, 3).toUpperCase();
  return name.replace(/[^a-z0-9]/gi, "").slice(0, 3).toUpperCase();
};

export const SIMPLE_POSITIONS = ["Attacker", "Midfield", "Defense"];
export const SPECIFIC_POSITIONS = ["ST", "W", "CAM", "CM", "CDM", "WM", "FB", "CB"];
export const positionCategory = (position: string): "Attacker" | "Midfield" | "Defense" => {
  if (["Attacker", "ST", "W", "CAM"].includes(position)) return "Attacker";
  if (["Midfield", "CM", "CDM", "WM"].includes(position)) return "Midfield";
  return "Defense";
};

export const sampleSession = (): Session => ({
  schemaVersion: 1,
  players: [
    "Bob", "Joe", "Tom", "Tim", "John", "Mike", "Seth", "Andrew",
    "Caleb", "Marcus", "Jordan", "Chris", "Alex", "Sam", "Luke", "Ryan"
  ].map((name, index) => ({ id: id(), name, status: "available", rating: 6 + (index % 5) * 0.4 })),
  teams: ["Red United", "Blue City", "Gold Athletic", "Green Rovers"].map((name) => ({
    id: id(), name, abbreviation: abbreviateTeam(name), capacity: 4, allowOverflow: true, playerIds: [], budget: 45
  })),
  assignments: [],
  overflowMode: "prompt",
  positionMode: "none",
  positionLimitsEnabled: false,
  positionLimits: { Attacker: 2, Midfield: 2, Defense: 2 },
  customWheels: []
});

export const availablePlayers = (session: Session) =>
  session.players.filter((player) => player.status === "available");

export const nextPlayers = (session: Session) =>
  session.players.filter((player) => player.status === "next");

export const eligibleTeams = (session: Session, includeOverflow = false) => {
  const normal = session.teams.filter((team) => team.playerIds.length < team.capacity);
  if (normal.length > 0) return normal;
  if (!includeOverflow) return [];
  const overflow = session.teams.filter((team) => team.allowOverflow);
  if (session.overflowMode !== "balanced" || overflow.length < 2) return overflow;
  const minimum = Math.min(...overflow.map((team) => team.playerIds.length));
  return overflow.filter((team) => team.playerIds.length === minimum);
};

export const chooseRandom = <T,>(items: T[], random = Math.random): T | undefined => {
  if (items.length === 0) return undefined;
  return items[Math.floor(random() * items.length)];
};

export const assignPlayer = (
  session: Session,
  playerId: string,
  teamId: string,
  position?: string,
  customValues?: Record<string, string>
): Session => {
  const player = session.players.find((item) => item.id === playerId);
  const team = session.teams.find((item) => item.id === teamId);
  if (!player || player.status === "assigned" || !team) return session;

  const assignment: Assignment = {
    id: id(), playerId, teamId, createdAt: new Date().toISOString(),
    overflow: team.playerIds.length >= team.capacity,
    position,
    customValues
  };

  return {
    ...session,
    players: session.players.map((item) =>
      item.id === playerId ? { ...item, status: "assigned" } : item
    ),
    teams: session.teams.map((item) =>
      item.id === teamId ? { ...item, playerIds: [...item.playerIds, playerId] } : item
    ),
    assignments: [...session.assignments, assignment]
  };
};

export const rollNext = (
  session: Session,
  includeOverflow = false,
  random = Math.random
): Session => {
  const player = chooseRandom(availablePlayers(session), random);
  const positions = session.positionMode === "simple" ? SIMPLE_POSITIONS : session.positionMode === "specific" ? SPECIFIC_POSITIONS : [];
  const allowedPositionsForTeam = (team: Team) => {
    if (!session.positionLimitsEnabled || !positions.length) return positions;
    const counts = session.assignments.filter((assignment) => assignment.teamId === team.id && assignment.position).reduce<Record<string, number>>((totals, assignment) => {
      const category = positionCategory(assignment.position!);
      totals[category] = (totals[category] || 0) + 1;
      return totals;
    }, {});
    return positions.filter((position) => (counts[positionCategory(position)] || 0) < session.positionLimits[positionCategory(position)]);
  };
  const teams = eligibleTeams(session, includeOverflow).filter((team) => !positions.length || allowedPositionsForTeam(team).length > 0);
  const team = chooseRandom(teams, random);
  const position = team ? chooseRandom(allowedPositionsForTeam(team), random) : undefined;
  const customValues = Object.fromEntries(session.customWheels.flatMap((wheel) => {
    const entries = wheel.removeAfterRoll ? wheel.entries.filter((entry) => !wheel.usedEntries.includes(entry)) : wheel.entries;
    const value = chooseRandom(entries, random);
    return value ? [[wheel.id, value]] : [];
  }));
  if (!player || !team) return session;
  const assigned = assignPlayer(session, player.id, team.id, position, customValues);
  return {
    ...assigned,
    customWheels: assigned.customWheels.map((wheel) => {
      const value = customValues[wheel.id];
      return wheel.removeAfterRoll && value ? { ...wheel, usedEntries: [...wheel.usedEntries, value] } : wheel;
    })
  };
};

export const undoLast = (session: Session): Session => {
  const last = session.assignments.at(-1);
  if (!last) return session;
  return {
    ...session,
    assignments: session.assignments.slice(0, -1),
    players: session.players.map((player) =>
      player.id === last.playerId ? { ...player, status: "available" } : player
    ),
    teams: session.teams.map((team) =>
      team.id === last.teamId
        ? { ...team, playerIds: team.playerIds.filter((id) => id !== last.playerId) }
        : team
    ),
    customWheels: session.customWheels.map((wheel) => {
      const value = last.customValues?.[wheel.id];
      return value ? { ...wheel, usedEntries: wheel.usedEntries.filter((entry) => entry !== value) } : wheel;
    })
  };
};

export const resetAssignments = (session: Session): Session => ({
  ...session,
  assignments: [],
  players: session.players.map((player) => ({ ...player, status: "available" })),
  teams: session.teams.map((team) => ({ ...team, playerIds: [] })),
  customWheels: session.customWheels.map((wheel) => ({ ...wheel, usedEntries: [] }))
});

export const addPlayer = (session: Session, name: string, status: Player["status"] = "available"): Session => ({
  ...session,
  players: [...session.players, { id: id(), name: name.trim(), status, rating: 5 }]
});

export const addTeam = (session: Session, name: string, capacity = 4): Session => ({
  ...session,
  teams: [...session.teams, { id: id(), name: name.trim(), abbreviation: abbreviateTeam(name), capacity, allowOverflow: true, playerIds: [], budget: 45 }]
});

export const playerName = (players: Player[], playerId: string) =>
  players.find((player) => player.id === playerId)?.name ?? "Unknown player";

export const teamStatus = (team: Team) => {
  const extra = Math.max(0, team.playerIds.length - team.capacity);
  return `${team.playerIds.length} / ${team.capacity}${extra ? ` +${extra}` : ""}`;
};
