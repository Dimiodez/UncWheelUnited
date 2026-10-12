export type PlayerStatus = "available" | "assigned" | "next";
export type PlayerRole = "Any" | "Attacker" | "Midfield" | "Defense";

export type Player = {
  id: string;
  name: string;
  status: PlayerStatus;
  rating: number;
  role: PlayerRole;
};

export type Team = {
  id: string;
  name: string;
  abbreviation: string;
  colorHue: number;
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
  positionLimits: Record<"Any" | "Attacker" | "Midfield" | "Defense", number>;
  customWheels: CustomWheel[];
  drafts?: Partial<Record<"captain" | "fantasy", DraftState>>;
};

export type DraftState = {
  style: "snake" | "standard" | "random";
  order: string[];
  pickIndex: number;
  replacementTeamId?: string;
  selectedCaptainIds: string[];
  whiteElephant: boolean;
  stealLimit: 1 | 2;
  holidayTheme: boolean;
  steals: Record<string, number>;
  complete: boolean;
  message: string;
};
