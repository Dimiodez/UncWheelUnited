export type PlayerStatus = "available" | "assigned" | "next";

export type Player = {
  id: string;
  name: string;
  status: PlayerStatus;
  rating: number;
};

export type Team = {
  id: string;
  name: string;
  abbreviation: string;
  capacity: number;
  allowOverflow: boolean;
  playerIds: string[];
  captainId?: string;
  budget: number;
};

export type OverflowMode = "strict" | "prompt" | "balanced";

export type Assignment = {
  id: string;
  playerId: string;
  teamId: string;
  createdAt: string;
  overflow: boolean;
  position?: string;
  customValues?: Record<string, string>;
};

export type CustomWheel = {
  id: string;
  name: string;
  entries: string[];
  removeAfterRoll: boolean;
  usedEntries: string[];
};

export type Session = {
  schemaVersion: 1;
  players: Player[];
  teams: Team[];
  assignments: Assignment[];
  overflowMode: OverflowMode;
  positionMode: "none" | "simple" | "specific";
  positionLimitsEnabled: boolean;
  positionLimits: Record<"Attacker" | "Midfield" | "Defense", number>;
  customWheels: CustomWheel[];
};
