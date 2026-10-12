import type { DraftState, Session } from "../types";
import { addTeam } from "./session";

export const emptyDraft = (): DraftState => ({
  style: "snake", order: [], pickIndex: 0, selectedCaptainIds: [],
  whiteElephant: false, stealLimit: 1, holidayTheme: true,
  steals: {}, captainStealLimit: 1, captainSteals: {}, complete: false, message: ""
});
export const orderAt = (draft: DraftState, index = draft.pickIndex) =>
  draft.style === "snake" && Math.floor(index / draft.order.length) % 2 === 1
    ? [...draft.order].reverse() : draft.order;
export const pickingTeam = (draft: DraftState) =>
  !draft.complete && draft.order.length ? draft.replacementTeamId || orderAt(draft)[draft.pickIndex % draft.order.length] : undefined;

export function createDraftTeam(session: Session, rawName: string, capacity: number): {session: Session; error?: string} {
 const name=rawName.trim();
 if(session.drafts?.captain?.order.length) return {session,error:"The team list is locked after picking the draft order. Reset the draft pool before adding teams."};
 if(!name||name.length>80) return {session,error:"Enter a team name between 1 and 80 characters."};
 if(!Number.isInteger(capacity)||capacity<1||capacity>12) return {session,error:"Choose a roster size between 1 and 12."};
 if(session.teams.some(team=>team.name.trim().toLocaleLowerCase()===name.toLocaleLowerCase()))
   return {session,error:"A team with that name already exists."};
 return {session:addTeam(session,name,capacity)};
}

export function moveDraftPlayer(session: Session, mode: "captain" | "fantasy", playerId: string, teamId: string):
  { session: Session; error?: string } {
  const draft = session.drafts?.[mode] || emptyDraft();
  const elephant = mode === "captain" && draft.whiteElephant;
  const target = session.teams.find(t => t.id === teamId);
  const player = session.players.find(p => p.id === playerId);
  const source = session.teams.find(t => t.playerIds.includes(playerId));
  const fail = (error: string) => ({ session, error });
  if (!target || !player) return fail("Choose a valid player and team.");
  if (source?.id === target.id) return { session };
  if (target.playerIds.length >= target.capacity) return fail("That team is full.");
  if (elephant) {
    if (!draft.order.length) return fail("Pick the draft order before drafting or stealing.");
    if (draft.complete) return fail("This draft is finished. Reset the pool to start another.");
    if (pickingTeam(draft) !== teamId) return fail("Drop onto the team currently picking.");
    if (session.teams.some(t => t.captainId === playerId) || draft.selectedCaptainIds.includes(playerId))
      return fail("Captains cannot be drafted or stolen.");
    if (source && (draft.steals[playerId] || 0) >= draft.stealLimit)
      return fail("That player is locked: the steal limit has been reached.");
    if (source && (draft.captainSteals?.[teamId] || 0) >= (draft.captainStealLimit ?? 1))
      return fail("This captain has used all their steals. Draft an available player instead.");
  }
  const teams = session.teams.map(t => ({
    ...t,
    playerIds: t.id === teamId ? [...t.playerIds, playerId] : t.playerIds.filter(id => id !== playerId),
    captainId: t.id !== teamId && t.captainId === playerId ? undefined : t.captainId
  }));
  const nextDraft = { ...draft, steals: { ...draft.steals },
    captainSteals: { ...draft.captainSteals },
    replacementTeamId: undefined as string | undefined,
    message: source ? `${target.name} stole ${player.name} from ${source.name}.` : `${target.name} drafted ${player.name}.` };
  if (elephant && source) {
    nextDraft.steals[playerId] = (nextDraft.steals[playerId] || 0) + 1;
    nextDraft.captainSteals[teamId] = (nextDraft.captainSteals[teamId] || 0) + 1;
  }
  if (draft.order.length && (!source || elephant)) {
    const freePlayers = session.players.filter(p =>
      !draft.selectedCaptainIds.includes(p.id) && !teams.some(t => t.playerIds.includes(p.id)));
    const canPick = (id: string) => {
      const team = teams.find(t => t.id === id);
      return team && team.playerIds.length < team.capacity && (freePlayers.length > 0 ||
        (elephant && (nextDraft.captainSteals[id] || 0) < (draft.captainStealLimit ?? 1) && teams.some(other => other.id !== id && other.playerIds.some(pid =>
          pid !== other.captainId && !draft.selectedCaptainIds.includes(pid) &&
          (nextDraft.steals[pid] || 0) < draft.stealLimit))));
    };
    let found = false;
    if (elephant && source && canPick(source.id)) {
      // Hold the normal turn until the displaced captain replaces their player.
      // Another steal passes the replacement turn to the newly displaced team.
      nextDraft.replacementTeamId = source.id;
      nextDraft.message += ` ${source.name} gets an immediate replacement pick.`;
      found = true;
    }
    // Two complete traversals cover snake endpoints even when all other teams are full.
    for (let offset = 1; !found && offset <= draft.order.length * 2; offset++) {
      const index = draft.pickIndex + offset;
      if (draft.style === "random" && index % draft.order.length === 0) {
        nextDraft.order = [...nextDraft.order];
        for (let i = nextDraft.order.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [nextDraft.order[i], nextDraft.order[j]] = [nextDraft.order[j], nextDraft.order[i]];
        }
      }
      if (canPick(orderAt(nextDraft, index)[index % draft.order.length])) {
        nextDraft.pickIndex = index; found = true; break;
      }
    }
    nextDraft.complete = !found;
  }
  return { session: {
    ...session, teams,
    players: session.players.map(p => p.id === playerId ? { ...p, status: "assigned" } : p),
    assignments: session.assignments.filter(a => a.playerId !== playerId),
    drafts: { ...session.drafts, [mode]: nextDraft }
  } };
}
