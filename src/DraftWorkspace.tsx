import { useMemo, useState } from "react";
import type { CSSProperties, Dispatch, SetStateAction } from "react";
import type { Session } from "./types";
import { playerName, sampleSession } from "./core/session";
import CollapsiblePanel from "./CollapsiblePanel";

const assetUrl = (name: string) => `${import.meta.env.BASE_URL}assets/${name}`;

type Props = {
  mode: "captain" | "fantasy";
  session: Session;
  setSession: Dispatch<SetStateAction<Session>>;
  testToolsEnabled?: boolean;
};

const shuffle = <T,>(items: T[]) => [...items].sort(() => Math.random() - 0.5);

export default function DraftWorkspace({ mode, session, setSession, testToolsEnabled = false }: Props) {
  const [draftStyle, setDraftStyle] = useState<"snake" | "standard" | "random">("snake");
  const [draftOrder, setDraftOrder] = useState<string[]>([]);
  const [draftPickIndex, setDraftPickIndex] = useState(0);
  const [selectedCaptainIds, setSelectedCaptainIds] = useState<string[]>([]);

  const unassigned = session.players.filter((player) => !selectedCaptainIds.includes(player.id) && !session.teams.some((team) => team.playerIds.includes(player.id)));
  const roundedCost = (rating: number) => Math.round(rating);
  const draftRound = draftOrder.length ? Math.floor(draftPickIndex / draftOrder.length) : 0;
  const roundOrder = useMemo(() => draftStyle === "snake" && draftRound % 2 === 1 ? [...draftOrder].reverse() : draftOrder, [draftOrder, draftRound, draftStyle]);
  const currentTeamId = roundOrder.length ? roundOrder[draftPickIndex % roundOrder.length] : undefined;

  const advanceDraftTurn = (targetTeamId: string, playerWasAdded: boolean) => {
    if (!playerWasAdded || !draftOrder.length) return;
    setDraftPickIndex((current) => {
      let randomRoundOrder = draftOrder;
      let preparedRandomRound = Math.floor(current / draftOrder.length);
      for (let offset = 1; offset <= draftOrder.length; offset += 1) {
        const candidateIndex = current + offset;
        const round = Math.floor(candidateIndex / draftOrder.length);
        if (draftStyle === "random" && round > preparedRandomRound) {
          randomRoundOrder = shuffle(randomRoundOrder);
          preparedRandomRound = round;
          setDraftOrder(randomRoundOrder);
        }
        const order = draftStyle === "snake" && round % 2 === 1 ? [...draftOrder].reverse() : draftStyle === "random" ? randomRoundOrder : draftOrder;
        const candidateId = order[candidateIndex % order.length];
        const candidate = session.teams.find((team) => team.id === candidateId);
        const projectedSize = candidate ? candidate.playerIds.length + (candidate.id === targetTeamId ? 1 : 0) : 0;
        if (candidate && projectedSize < candidate.capacity) return candidateIndex;
      }
      return current + 1;
    });
  };

  const movePlayer = (playerId: string, teamId: string) => {
    const target = session.teams.find((team) => team.id === teamId);
    if (!playerId || !target) return;
    const alreadyOnTarget = target.playerIds.includes(playerId);
    const playerWasUnassigned = !session.teams.some((team) => team.playerIds.includes(playerId));
    if (!alreadyOnTarget && target.playerIds.length >= target.capacity) return;
    setSession((current) => ({
      ...current,
      players: current.players.map((player) => player.id === playerId ? { ...player, status: "assigned" } : player),
      teams: current.teams.map((team) => ({
        ...team,
        playerIds: team.id === teamId
          ? [...team.playerIds.filter((id) => id !== playerId), playerId]
          : team.playerIds.filter((id) => id !== playerId),
        captainId: team.id !== teamId && team.captainId === playerId ? undefined : team.captainId
      })),
      assignments: current.assignments.filter((assignment) => assignment.playerId !== playerId)
    }));
    advanceDraftTurn(teamId, playerWasUnassigned && !alreadyOnTarget);
  };

  const returnPlayer = (playerId: string) => {
    if (!playerId) return;
    setSession((current) => ({
      ...current,
      players: current.players.map((player) => player.id === playerId ? { ...player, status: "available" } : player),
      teams: current.teams.map((team) => ({ ...team, playerIds: team.playerIds.filter((id) => id !== playerId), captainId: team.captainId === playerId ? undefined : team.captainId })),
      assignments: current.assignments.filter((assignment) => assignment.playerId !== playerId)
    }));
  };

  const setCaptain = (playerId: string, teamId: string) => {
    if (!playerId) return;
    const target = session.teams.find((team) => team.id === teamId);
    if (!target) return;
    const existingWithoutCaptain = target.playerIds.filter((id) => id !== target.captainId);
    if (!target.playerIds.includes(playerId) && existingWithoutCaptain.length >= target.capacity) return;
    setSession((current) => ({
      ...current,
      players: current.players.map((player) => player.id === playerId ? { ...player, status: "assigned" } : player),
      teams: current.teams.map((team) => ({
        ...team,
        captainId: team.id === teamId ? playerId : team.captainId === playerId ? undefined : team.captainId,
        playerIds: team.id === teamId ? [playerId, ...team.playerIds.filter((id) => id !== playerId && id !== team.captainId)] : team.playerIds.filter((id) => id !== playerId)
      }))
    }));
  };

  const pickCaptains = () => {
    const candidates = shuffle(session.players);
    if (candidates.length < session.teams.length) return;
    const selected = candidates.slice(0, session.teams.length).map((player) => player.id);
    setSelectedCaptainIds(selected);
    setSession((current) => ({
      ...current,
      assignments: [],
      players: current.players.map((player) => ({ ...player, status: "available" })),
      teams: current.teams.map((team) => ({ ...team, captainId: undefined, playerIds: [] }))
    }));
  };

  const drawCaptainsToTeams = () => {
    if (selectedCaptainIds.length < session.teams.length) return;
    const captains = shuffle(selectedCaptainIds);
    setSession((current) => ({
      ...current,
      players: current.players.map((player) => captains.includes(player.id) ? { ...player, status: "assigned" } : player),
      teams: current.teams.map((team, index) => ({ ...team, captainId: captains[index], playerIds: [captains[index]] }))
    }));
  };

  const createOrder = () => {
    const base = shuffle(session.teams.map((team) => team.id));
    setDraftOrder(base);
    setDraftPickIndex(0);
  };

  const resetDraft = () => {
    if (!window.confirm("Return every player to the draft pool and clear captains?")) return;
    setSession((current) => ({
      ...current,
      assignments: [],
      players: current.players.map((player) => ({ ...player, status: "available" })),
      teams: current.teams.map((team) => ({ ...team, playerIds: [], captainId: undefined }))
    }));
    setDraftOrder([]);
    setDraftPickIndex(0);
    setSelectedCaptainIds([]);
  };

  const loadTestDraft = () => {
    setSession(sampleSession());
    setDraftOrder([]);
    setDraftPickIndex(0);
    setSelectedCaptainIds([]);
  };

  const setUpTestDraft = () => {
    if (!session.teams.length || session.players.length < session.teams.length) return;
    const captainIds = session.players.slice(0, session.teams.length).map((player) => player.id);
    setSelectedCaptainIds(captainIds);
    setDraftOrder(session.teams.map((team) => team.id));
    setDraftPickIndex(0);
    setSession((current) => ({
      ...current,
      assignments: [],
      players: current.players.map((player) => ({ ...player, status: captainIds.includes(player.id) ? "assigned" : "available" })),
      teams: current.teams.map((team, index) => ({ ...team, captainId: captainIds[index], playerIds: [captainIds[index]] }))
    }));
  };

  const fillTestRosters = () => {
    if (!session.teams.length || session.players.length < session.teams.length) return;
    const captainIds = session.players.slice(0, session.teams.length).map((player) => player.id);
    const rosterIds = session.teams.map((_, index) => [captainIds[index]]);
    session.players.slice(session.teams.length).forEach((player, playerIndex) => {
      for (let offset = 0; offset < session.teams.length; offset += 1) {
        const teamIndex = (playerIndex + offset) % session.teams.length;
        if (rosterIds[teamIndex].length < session.teams[teamIndex].capacity) {
          rosterIds[teamIndex].push(player.id);
          break;
        }
      }
    });
    const assignedIds = new Set(rosterIds.flat());
    setSelectedCaptainIds(captainIds);
    setDraftOrder(session.teams.map((team) => team.id));
    setDraftPickIndex(Math.max(0, assignedIds.size - captainIds.length));
    setSession((current) => ({
      ...current,
      assignments: [],
      players: current.players.map((player) => ({ ...player, status: assignedIds.has(player.id) ? "assigned" : "available" })),
      teams: current.teams.map((team, index) => ({ ...team, captainId: captainIds[index], playerIds: rosterIds[index] }))
    }));
  };

  return <section className="draft-workspace">
    <div className="draft-hero">
      <div>
        <p className="eyebrow">{mode === "captain" ? "CAPTAIN + DRAFT ORDER" : "ASSIGNED VALUE EVENT"}</p>
        <h2>{mode === "captain" ? "Captain Draft Night" : "Fantasy Value Draft"}</h2>
        <p>{mode === "captain" ? "Pick one captain per team, choose the draft style, then drag players onto teams." : "Edit season ratings, use rounded costs, and keep every captain inside their budget."}</p>
      </div>
      <button className="captain-wheel-button" disabled={selectedCaptainIds.length < session.teams.length} onClick={drawCaptainsToTeams} title={selectedCaptainIds.length < session.teams.length ? "Pick captains first" : "Draw captains onto random teams"}><img src={assetUrl("uwu-wheel-logo.png")} alt="Draw captains onto teams" /><span>{selectedCaptainIds.length < session.teams.length ? "Pick captains first" : "Click to draw teams"}</span></button>
      <div className="draft-actions">
        <button onClick={pickCaptains}>Randomly pick captains</button>
        <label>Draft style
          <select value={draftStyle} onChange={(event) => { setDraftStyle(event.target.value as typeof draftStyle); setDraftOrder([]); setDraftPickIndex(0); }}>
            <option value="snake">Snake draft</option>
            <option value="standard">Standard order</option>
            <option value="random">Random order</option>
          </select>
        </label>
        <button className="secondary" onClick={createOrder}>Pick draft order</button>
        <button className="quiet" onClick={resetDraft}>Reset draft pool</button>
      </div>
    </div>

    {testToolsEnabled && <aside className="test-tools-panel"><div><strong>{mode === "captain" ? "Captain Draft" : "Fantasy Draft"} test tools</strong><span>Temporary viability-testing controls</span></div><button onClick={loadTestDraft}>Load sample setup</button><button onClick={setUpTestDraft}>Set up captains</button><button onClick={fillTestRosters}>Fill team rosters</button></aside>}

    {selectedCaptainIds.length > 0 && <div className="captain-pool"><strong>Selected captains</strong>{selectedCaptainIds.map((id) => <span draggable onDragStart={(event) => event.dataTransfer.setData("text/player-id", id)} key={id}>{playerName(session.players, id)}</span>)}<em>Click the wheel for random teams, or drag a captain onto a captain slot.</em></div>}

    {roundOrder.length > 0 && <div className="draft-order"><strong>{draftStyle === "snake" ? "Snake draft" : draftStyle === "random" ? "Random draft" : "Standard draft"} · Round {draftRound + 1}</strong>{roundOrder.map((teamId, index) => {
      const team = session.teams.find((item) => item.id === teamId);
      const active = teamId === currentTeamId;
      return <span className={active ? "current" : ""} key={teamId} style={{ borderColor: `hsl(${team?.colorHue ?? 0} 82% 55%)`, background: active ? `hsl(${team?.colorHue ?? 0} 82% 55% / .2)` : undefined }}>{index + 1}. {team?.name ?? "Team"}{active ? " · PICKING" : ""}</span>;
    })}{draftStyle === "snake" && <em>Order reverses every round.</em>}{draftStyle === "standard" && <em>Same order every round.</em>}{draftStyle === "random" && <em>Fresh random order every round.</em>}</div>}

    <div className="draft-layout">
      <CollapsiblePanel title="Available players" eyebrow="DRAG FROM HERE" meta={unassigned.length} className="draft-player-pool">
        <div className="draft-player-drop-area" onDragOver={(event) => event.preventDefault()} onDrop={(event) => returnPlayer(event.dataTransfer.getData("text/player-id"))}>
        {unassigned.map((player) => <div className="draft-player" draggable onDragStart={(event) => event.dataTransfer.setData("text/player-id", player.id)} key={player.id}>
          <span>{player.name}</span>
          {mode === "fantasy" && <label>Rating <input type="number" min="0" max="10" step="0.1" value={player.rating} onChange={(event) => setSession({ ...session, players: session.players.map((item) => item.id === player.id ? { ...item, rating: Number(event.target.value) } : item) })} /></label>}
          {mode === "fantasy" && <strong>${roundedCost(player.rating)}</strong>}
        </div>)}
        </div>
      </CollapsiblePanel>

      <CollapsiblePanel title="Team rosters" eyebrow="DRAFT BOARD" meta={`${session.teams.length} teams`} className="draft-rosters-panel">
      <div className="draft-team-grid">
        {session.teams.map((team) => {
          const captain = team.captainId ? session.players.find((player) => player.id === team.captainId) : undefined;
          const spent = team.playerIds.filter((id) => id !== team.captainId).reduce((sum, id) => sum + roundedCost(session.players.find((player) => player.id === id)?.rating ?? 0), 0);
          const balance = team.budget - spent;
          const teamColor = `hsl(${team.colorHue} 82% 55%)`;
          return <article className={`draft-team ${team.id === currentTeamId ? "current-pick" : ""}`} key={team.id} style={{ borderTopColor: teamColor, "--team-color": teamColor } as CSSProperties} onDragOver={(event) => event.preventDefault()} onDrop={(event) => movePlayer(event.dataTransfer.getData("text/player-id"), team.id)}>
            <div className="draft-team-head"><h3>{team.name}</h3><label>Team size <select value={team.capacity} onChange={(event) => setSession({ ...session, teams: session.teams.map((item) => item.id === team.id ? { ...item, capacity: Number(event.target.value) } : item) })}>{[1,2,3,4,5,6,7,8,9,10,11,12].map((size) => <option key={size}>{size}</option>)}</select></label><span>{team.playerIds.length} / {team.capacity}</span></div>
            <div className="captain-row captain-drop" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.stopPropagation(); setCaptain(event.dataTransfer.getData("text/player-id"), team.id); }}><span>Captain - drop here</span><strong draggable={Boolean(captain)} onDragStart={(event) => captain && event.dataTransfer.setData("text/player-id", captain.id)}>{captain?.name ?? "Not selected"}</strong></div>
            {mode === "fantasy" && <div className="budget-row">
              <label>Starting budget $<input type="number" min="0" value={team.budget} onChange={(event) => setSession({ ...session, teams: session.teams.map((item) => item.id === team.id ? { ...item, budget: Number(event.target.value) } : item) })} /></label>
              <strong className={balance < 0 ? "negative" : ""}>${balance} left</strong>
            </div>}
            <div className="drop-roster">
              {team.playerIds.map((playerId) => {
                const player = session.players.find((item) => item.id === playerId)!;
                return <div key={playerId} draggable onDragStart={(event) => event.dataTransfer.setData("text/player-id", playerId)}><span>{playerName(session.players, playerId)}{playerId === team.captainId ? " ★" : ""}</span>{mode === "fantasy" && playerId !== team.captainId && <strong>-${roundedCost(player.rating)}</strong>}</div>;
              })}
              <p>Drop players here</p>
            </div>
          </article>;
        })}
      </div>
      </CollapsiblePanel>
    </div>
  </section>;
}
