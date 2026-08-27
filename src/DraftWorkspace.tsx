import { useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Session } from "./types";
import { playerName } from "./core/session";

const assetUrl = (name: string) => `${import.meta.env.BASE_URL}assets/${name}`;

type Props = {
  mode: "captain" | "fantasy";
  session: Session;
  setSession: Dispatch<SetStateAction<Session>>;
};

const shuffle = <T,>(items: T[]) => [...items].sort(() => Math.random() - 0.5);

export default function DraftWorkspace({ mode, session, setSession }: Props) {
  const [draftStyle, setDraftStyle] = useState<"snake" | "standard" | "random">("snake");
  const [draftOrder, setDraftOrder] = useState<string[]>([]);
  const [selectedCaptainIds, setSelectedCaptainIds] = useState<string[]>([]);

  const unassigned = session.players.filter((player) => !selectedCaptainIds.includes(player.id) && !session.teams.some((team) => team.playerIds.includes(player.id)));
  const roundedCost = (rating: number) => Math.round(rating);
  const orderLabels = useMemo(() => draftOrder.map((teamId, index) => `${index + 1}. ${session.teams.find((team) => team.id === teamId)?.name ?? "Team"}`), [draftOrder, session.teams]);

  const movePlayer = (playerId: string, teamId: string) => {
    const target = session.teams.find((team) => team.id === teamId);
    if (!playerId || !target) return;
    const alreadyOnTarget = target.playerIds.includes(playerId);
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
    const base = draftStyle === "standard" ? session.teams.map((team) => team.id) : shuffle(session.teams.map((team) => team.id));
    setDraftOrder(base);
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
    setSelectedCaptainIds([]);
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
          <select value={draftStyle} onChange={(event) => setDraftStyle(event.target.value as typeof draftStyle)}>
            <option value="snake">Snake draft</option>
            <option value="standard">Standard order</option>
            <option value="random">Random order</option>
          </select>
        </label>
        <button className="secondary" onClick={createOrder}>Pick draft order</button>
        <button className="quiet" onClick={resetDraft}>Reset draft pool</button>
      </div>
    </div>

    {selectedCaptainIds.length > 0 && <div className="captain-pool"><strong>Selected captains</strong>{selectedCaptainIds.map((id) => <span draggable onDragStart={(event) => event.dataTransfer.setData("text/player-id", id)} key={id}>{playerName(session.players, id)}</span>)}<em>Click the wheel for random teams, or drag a captain onto a captain slot.</em></div>}

    {orderLabels.length > 0 && <div className="draft-order"><strong>{draftStyle === "snake" ? "Snake draft order" : "Draft order"}</strong>{orderLabels.map((label) => <span key={label}>{label}</span>)}{draftStyle === "snake" && <em>Order reverses every round.</em>}</div>}

    <div className="draft-layout">
      <aside className="draft-player-pool" onDragOver={(event) => event.preventDefault()} onDrop={(event) => returnPlayer(event.dataTransfer.getData("text/player-id"))}>
        <div className="section-heading"><div><p className="eyebrow">DRAG FROM HERE</p><h2>Available players</h2></div><span>{unassigned.length}</span></div>
        {unassigned.map((player) => <div className="draft-player" draggable onDragStart={(event) => event.dataTransfer.setData("text/player-id", player.id)} key={player.id}>
          <span>{player.name}</span>
          {mode === "fantasy" && <label>Rating <input type="number" min="0" max="10" step="0.1" value={player.rating} onChange={(event) => setSession({ ...session, players: session.players.map((item) => item.id === player.id ? { ...item, rating: Number(event.target.value) } : item) })} /></label>}
          {mode === "fantasy" && <strong>${roundedCost(player.rating)}</strong>}
        </div>)}
      </aside>

      <div className="draft-team-grid">
        {session.teams.map((team) => {
          const captain = team.captainId ? session.players.find((player) => player.id === team.captainId) : undefined;
          const spent = team.playerIds.filter((id) => id !== team.captainId).reduce((sum, id) => sum + roundedCost(session.players.find((player) => player.id === id)?.rating ?? 0), 0);
          const balance = team.budget - spent;
          return <article className="draft-team" key={team.id} onDragOver={(event) => event.preventDefault()} onDrop={(event) => movePlayer(event.dataTransfer.getData("text/player-id"), team.id)}>
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
    </div>
  </section>;
}
