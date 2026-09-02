import { useEffect, useMemo, useState } from "react";
import {
  abbreviateTeam, addPlayer, addTeam, availablePlayers, eligibleTeams, nextPlayers,
  playerName, resetAssignments, rollNext, sampleSession, teamStatus, undoLast
} from "./core/session";
import { SIMPLE_POSITIONS, SPECIFIC_POSITIONS, TEAM_HUES } from "./core/session";
import type { Session } from "./types";
import DraftWorkspace from "./DraftWorkspace";
import StandingsWorkspace from "./StandingsWorkspace";
import CollapsiblePanel from "./CollapsiblePanel";
import { TEST_TOOLS_ENABLED } from "./testTools";

const STORAGE_KEY = "uwu.session.v1";
const assetUrl = (name: string) => `${import.meta.env.BASE_URL}assets/${name}`;

const loadSession = (): Session => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return sampleSession();
    const parsed = JSON.parse(saved) as Session;
    return {
      ...parsed,
      positionMode: parsed.positionMode || "none",
      positionLimitsEnabled: parsed.positionLimitsEnabled ?? false,
      positionLimits: {
        Any: parsed.positionLimits?.Any ?? 6,
        Attacker: parsed.positionLimits?.Attacker ?? 2,
        Midfield: parsed.positionLimits?.Midfield ?? 2,
        Defense: parsed.positionLimits?.Defense ?? 2
      },
      customWheels: parsed.customWheels || [],
      players: parsed.players.map((player) => ({ ...player, rating: player.rating ?? 5, role: player.role ?? "Any" })),
      teams: parsed.teams.map((team, index) => ({ ...team, abbreviation: team.abbreviation || abbreviateTeam(team.name), colorHue: team.colorHue ?? TEAM_HUES[index % TEAM_HUES.length], budget: team.budget ?? 45 }))
    };
  } catch {
    return sampleSession();
  }
};

export default function App() {
  const [session, setSession] = useState<Session>(loadSession);
  const [playerInput, setPlayerInput] = useState("");
  const [teamInput, setTeamInput] = useState("");
  const [spinning, setSpinning] = useState(false);
  const [autoDrafting, setAutoDrafting] = useState(false);
  const [autoDraftDelay, setAutoDraftDelay] = useState(1000);
  const [spinDuration, setSpinDuration] = useState(850);
  const [playerRotation, setPlayerRotation] = useState(0);
  const [teamRotation, setTeamRotation] = useState(0);
  const [displayPlayerIds, setDisplayPlayerIds] = useState<string[] | null>(null);
  const [message, setMessage] = useState("Ready for the draw.");
  const [activeTab, setActiveTab] = useState<"cup" | "captain" | "fantasy" | "standings">("cup");

  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(session)), [session]);

  const available = availablePlayers(session);
  const waiting = nextPlayers(session);
  const normalTeams = eligibleTeams(session);
  const last = session.assignments.at(-1);
  const positionEntries = session.positionMode === "simple" ? [...SIMPLE_POSITIONS, "Any"] : session.positionMode === "specific" ? [...SPECIFIC_POSITIONS, "Any"] : [];
  const assignedCount = session.players.filter((player) => player.status === "assigned").length;
  const totalCapacity = session.teams.reduce((sum, team) => sum + team.capacity, 0);
  const allNormallyFull = normalTeams.length === 0;

  const wheelSegments = useMemo(() => {
    const displayed = displayPlayerIds
      ? displayPlayerIds.map((id) => session.players.find((player) => player.id === id)).filter((player): player is Session["players"][number] => Boolean(player))
      : available;
    return displayed.length ? displayed : [{ id: "empty", name: "?", status: "available" as const, rating: 0 }];
  }, [available, displayPlayerIds, session.players]);

  const wheelBackground = useMemo(() => {
    const colors = ["#ffca16", "#ff315f", "#e6007e", "#7c3cff", "#4941c9", "#08bfea", "#05bda7", "#ff6900"];
    const size = 100 / wheelSegments.length;
    return `conic-gradient(${wheelSegments.map((_, index) => `${colors[index % colors.length]} ${index * size}% ${(index + 1) * size}%`).join(",")})`;
  }, [wheelSegments]);

  const teamWheelBackground = useMemo(() => {
    const size = 100 / Math.max(1, session.teams.length);
    return `conic-gradient(${session.teams.map((team, index) => `hsl(${team.colorHue} 82% 55%) ${index * size}% ${(index + 1) * size}%`).join(",")})`;
  }, [session.teams]);

  const rotationForIndex = (current: number, index: number, count: number) => {
    if (index < 0 || count < 1) return current + 1080;
    const desired = (360 - ((index + 0.5) * (360 / count)) % 360) % 360;
    const currentMod = ((current % 360) + 360) % 360;
    return current + 1080 + ((desired - currentMod + 360) % 360);
  };

  const startAnimatedRoll = (base: Session, includeOverflow: boolean, duration: number) => {
    const beforePlayers = availablePlayers(base);
    const next = rollNext(base, includeOverflow);
    const result = next.assignments.at(-1);
    if (!result || next.assignments.length === base.assignments.length) return false;
    const playerIndex = beforePlayers.findIndex((player) => player.id === result.playerId);
    const teamIndex = base.teams.findIndex((team) => team.id === result.teamId);
    const visualDuration = Math.max(300, Math.round(duration * 0.8));
    setDisplayPlayerIds(beforePlayers.map((player) => player.id));
    setSpinDuration(visualDuration);
    setPlayerRotation((current) => rotationForIndex(current, playerIndex, beforePlayers.length));
    setTeamRotation((current) => rotationForIndex(current, teamIndex, base.teams.length));
    setSpinning(true);
    window.setTimeout(() => {
      setSession(next);
      setSpinning(false);
    }, duration);
    return true;
  };

  useEffect(() => {
    if (!autoDrafting || spinning) return;
    if (!available.length) {
      setAutoDrafting(false);
      setMessage("Auto Draft complete. Every ready player has been assigned.");
      return;
    }

    const hasNormalTeam = normalTeams.length > 0;
    if (!hasNormalTeam && session.overflowMode === "prompt") {
      setAutoDrafting(false);
      setMessage("Auto Draft paused: every team is full. Choose an overflow option or adjust team sizes.");
      return;
    }
    if (!hasNormalTeam && session.overflowMode === "strict") {
      setSession((current) => ({
        ...current,
        players: current.players.map((player) => player.status === "available" ? { ...player, status: "next" } : player)
      }));
      setAutoDrafting(false);
      setMessage("Auto Draft complete. Remaining players were moved to Next.");
      return;
    }

    setMessage("Auto Draft is rolling…");
    if (!startAnimatedRoll(session, !hasNormalTeam && session.overflowMode === "balanced", autoDraftDelay)) {
      setAutoDrafting(false);
    }
  }, [autoDrafting, spinning, available.length, normalTeams.length, session.overflowMode, autoDraftDelay]);

  const handleRoll = () => {
    if (!available.length) return setMessage("No players are waiting to be drawn.");
    let includeOverflow = false;
    if (allNormallyFull) {
      if (session.overflowMode === "strict") {
        const nextPlayer = available[0];
        setSession((current) => ({
          ...current,
          players: current.players.map((player) => player.id === nextPlayer.id ? { ...player, status: "next" } : player)
        }));
        return setMessage(`${nextPlayer.name} moved to Next because every team is full.`);
      }
      if (session.overflowMode === "prompt" && !window.confirm("Every team is at its preferred size. Include overflow-enabled teams for this roll?")) {
        return setMessage("Roll paused. Adjust a team or move the player to Next.");
      }
      includeOverflow = true;
    }
    setMessage("Wheels are turning…");
    startAnimatedRoll(session, includeOverflow, 850);
  };

  const toggleAutoDraft = () => {
    if (autoDrafting) {
      setAutoDrafting(false);
      setMessage("Auto Draft stopped.");
      return;
    }
    if (!available.length || !session.teams.length) {
      setMessage("Add an available player and team before starting Auto Draft.");
      return;
    }
    if (autoDraftDelay === 0) {
      setSession((current) => {
        let next = current;
        let guard = Math.max(1, current.players.length * 2);
        while (availablePlayers(next).length > 0 && guard-- > 0) {
          const normal = eligibleTeams(next);
          if (!normal.length && next.overflowMode === "prompt") break;
          if (!normal.length && next.overflowMode === "strict") {
            next = { ...next, players: next.players.map((player) => player.status === "available" ? { ...player, status: "next" } : player) };
            break;
          }
          const rolled = rollNext(next, !normal.length && next.overflowMode === "balanced");
          if (rolled.assignments.length === next.assignments.length) break;
          next = rolled;
        }
        return next;
      });
      setMessage("Instant draft complete.");
      return;
    }
    setAutoDrafting(true);
  };

  const updateTeam = (teamId: string, patch: Partial<Session["teams"][number]>) =>
    setSession((current) => ({
      ...current,
      teams: current.teams.map((team) => team.id === teamId ? { ...team, ...patch } : team)
    }));

  const updatePlayer = (playerId: string, name: string) =>
    setSession((current) => ({
      ...current,
      players: current.players.map((player) => player.id === playerId ? { ...player, name } : player)
    }));

  const addNames = (status: "available" | "next") => {
    const names = playerInput.split(/\r?\n|,/).map((name) => name.trim()).filter(Boolean);
    if (!names.length) return;
    setSession((current) => names.reduce((next, name) => addPlayer(next, name, status), current));
    setPlayerInput("");
    setMessage(`${names.length} player${names.length === 1 ? "" : "s"} added${status === "next" ? " to Next" : ""}.`);
  };

  const loadCupTestData = () => {
    setAutoDrafting(false);
    setSpinning(false);
    setDisplayPlayerIds(null);
    setPlayerRotation(0);
    setTeamRotation(0);
    setSession(sampleSession());
    setMessage("Fresh test players and teams loaded.");
  };

  const addTestLateArrivals = () => {
    setSession((current) => ({
      ...current,
      players: current.players.map((player, index) => index >= current.players.length - 2 && player.status !== "assigned" ? { ...player, status: "next" } : player)
    }));
    setMessage("Two available players moved to Next for late-arrival testing.");
  };

  const completeTestDraw = () => {
    setAutoDrafting(false);
    setSession((current) => {
      let next: Session = { ...current, overflowMode: "balanced", positionLimitsEnabled: false };
      let guard = Math.max(1, next.players.length * 2);
      while (availablePlayers(next).length > 0 && guard-- > 0) {
        const rolled = rollNext(next, true, () => 0);
        if (rolled.assignments.length === next.assignments.length) break;
        next = rolled;
      }
      return next;
    });
    setMessage("Test draw completed with every eligible player assigned.");
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark"><img src={assetUrl("uwu-wheel-logo.png")} alt="UWU wheel logo" /></div>
        <div>
          <p className="eyebrow">UNC WHEEL UTILITY</p>
          <h1>Cup Night Draw</h1>
        </div>
        <div className="progress-block">
          <strong>{assignedCount}</strong><span>assigned</span>
          <strong>{available.length}</strong><span>ready</span>
        </div>
        <label className="add-wheel-control">Add Wheel
          <select value="" onChange={(event) => {
            const value = event.target.value;
            if (value === "simple" || value === "specific") setSession({ ...session, positionMode: value });
          }}>
            <option value="">Choose a preset…</option>
            <option value="simple">Simple Positions</option>
            <option value="specific">Specific Positions</option>
          </select>
        </label>
      </header>

      <nav className="workspace-tabs">
        <button className={activeTab === "cup" ? "active" : ""} onClick={() => setActiveTab("cup")}>Cup Night</button>
        <button className={activeTab === "captain" ? "active" : ""} onClick={() => setActiveTab("captain")}>Captain Draft</button>
        <button className={activeTab === "fantasy" ? "active" : ""} onClick={() => setActiveTab("fantasy")}>Fantasy Value Draft</button>
        <button className={activeTab === "standings" ? "active" : ""} onClick={() => setActiveTab("standings")}>Standings</button>
      </nav>

      <div className={activeTab === "cup" ? "cup-workspace" : "cup-workspace hidden"}>

      <section className="draw-stage">
        <div className={`wheel-card ${spinning ? "is-spinning" : ""}`}>
          <p className="eyebrow">PLAYER WHEEL</p>
          <div className="wheel" aria-label="Available player wheel">
            <div className="wheel-pointer" />
            <div className="wheel-rotor" style={{ background: wheelBackground, transform: `rotate(${playerRotation}deg)`, transitionDuration: `${spinDuration}ms` }}>
              {wheelSegments.map((player, index) => {
                const angle = (360 / wheelSegments.length) * index + (180 / wheelSegments.length);
                return <span className="segment-label player-segment" key={player.id} data-name={player.name} title={player.name} aria-label={player.name} style={{ transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(calc(var(--wheel-size) * -.41)) rotate(${-angle}deg)` }}>{player.name.trim().charAt(0).toUpperCase() || "?"}</span>;
              })}
            </div>
            <div className="wheel-center">{available.length}</div>
          </div>
          <h2>{last ? playerName(session.players, last.playerId) : "Who’s next?"}</h2>
          <p>{available.length} players remain available</p>
        </div>

        <div className="draw-controls">
          <div className="connector">PLAYER <span>→</span> TEAM</div>
          <button className="roll-button" onClick={handleRoll} disabled={spinning || autoDrafting || !session.teams.length}><img src={assetUrl("uwu-wheel-logo.png")} alt="" /><span>Roll next</span></button>
          <button className={`auto-button ${autoDrafting ? "active" : ""}`} onClick={toggleAutoDraft}>{autoDrafting ? "Stop auto draft" : "Auto draft"}</button>
          <label className="auto-speed">Auto speed
            <select value={autoDraftDelay} disabled={autoDrafting} onChange={(event) => setAutoDraftDelay(Number(event.target.value))}>
              <option value={0}>Instant</option>
              <option value={1000}>1 second</option>
              <option value={2000}>2 seconds</option>
              <option value={3000}>3 seconds</option>
              <option value={5000}>5 seconds</option>
            </select>
          </label>
          <div className="secondary-actions">
            <button onClick={() => setSession(undoLast(session))} disabled={!last || autoDrafting}>Undo</button>
            <button onClick={() => { setAutoDrafting(false); if (window.confirm("Reset every assignment?")) { setDisplayPlayerIds(null); setPlayerRotation(0); setTeamRotation(0); setSession(resetAssignments(session)); } }}>Reset draw</button>
          </div>
        </div>

        <div className={`wheel-card team-wheel ${spinning ? "is-spinning" : ""}`}>
          <p className="eyebrow">TEAM WHEEL</p>
          <div className="wheel compact"><div className="wheel-pointer" />
            <div className="wheel-rotor" style={{ background: teamWheelBackground, transform: `rotate(${teamRotation}deg)`, transitionDuration: `${spinDuration}ms` }}>
              {session.teams.map((team, index) => {
                const angle = (360 / session.teams.length) * index + (180 / session.teams.length);
                return <span className="segment-label team-label" key={team.id} title={team.name} style={{ transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(calc(var(--wheel-size) * -.41)) rotate(${-angle}deg)` }}>{team.abbreviation || abbreviateTeam(team.name)}</span>;
              })}
            </div>
            <div className="wheel-center">{normalTeams.length || session.teams.length}</div>
          </div>
          <h2>{last ? session.teams.find((team) => team.id === last.teamId)?.name : "Which team?"}</h2>
          <p>{normalTeams.length} teams below preferred size</p>
        </div>
      </section>

      {TEST_TOOLS_ENABLED && <aside className="test-tools-panel"><div><strong>Cup Night test tools</strong><span>Temporary viability-testing controls</span></div><button onClick={loadCupTestData}>Load sample setup</button><button onClick={addTestLateArrivals}>Add late arrivals</button><button onClick={completeTestDraw}>Complete draw</button></aside>}

      {session.positionMode !== "none" && <CollapsiblePanel title="Position wheel settings" eyebrow="OPTIONAL WHEEL" meta={session.positionMode === "simple" ? "Simple positions" : "Specific positions"} className="cup-collapsible">
      <section className="position-panel">
        <div>
          <p className="eyebrow">{session.positionMode === "simple" ? "SIMPLE POSITION WHEEL" : "SPECIFIC POSITION WHEEL"}</p>
          <h2>{last?.position || "Position awaits"}</h2>
          <p>{session.positionMode === "simple" ? "Broad squad roles" : "Detailed on-pitch positions"}</p>
        </div>
        <div className="position-chips">
          {positionEntries.map((position) => <span className={last?.position === position ? "selected" : ""} key={position}>{position}</span>)}
        </div>
        <div className="position-limits">
          <label className="limit-toggle"><input type="checkbox" checked={session.positionLimitsEnabled} onChange={(event) => setSession({ ...session, positionLimitsEnabled: event.target.checked })} /> Limit each team</label>
          {(["Any", "Attacker", "Midfield", "Defense"] as const).map((category) => <label key={category}>{category} {category === "Any" ? "(flexible role)" : category === "Attacker" ? "(ST, W, CAM)" : category === "Midfield" ? "(CM, CDM, WM)" : "(FB, CB)"}
            <select disabled={!session.positionLimitsEnabled} value={session.positionLimits[category]} onChange={(event) => setSession({ ...session, positionLimits: { ...session.positionLimits, [category]: Number(event.target.value) } })}>
              {[0,1,2,3,4,5,6].map((limit) => <option key={limit} value={limit}>{limit}</option>)}
            </select>
          </label>)}
          <span>{session.positionLimitsEnabled ? "Quotas apply per team" : "Fully random event night"}</span>
        </div>
        <button onClick={() => setSession({ ...session, positionMode: "none" })}>Remove wheel</button>
      </section>
      </CollapsiblePanel>}

      <section className="toolbar-panel">
        <div><span>Preferred spaces</span><strong>{totalCapacity}</strong></div>
        <label>When teams are full
          <select value={session.overflowMode} onChange={(event) => setSession({ ...session, overflowMode: event.target.value as Session["overflowMode"] })}>
            <option value="prompt">Prompt me</option>
            <option value="strict">Send player to Next</option>
            <option value="balanced">Balanced overflow</option>
          </select>
        </label>
      </section>

      <CollapsiblePanel title="Team cards" eyebrow="LIVE BOARD" meta={<><label className="bulk-team-size" onClick={(event) => event.stopPropagation()}>All teams<select aria-label="Set all team sizes" value="" onClick={(event) => event.stopPropagation()} onChange={(event) => { const capacity = Number(event.target.value); if (capacity) setSession((current) => ({ ...current, teams: current.teams.map((team) => ({ ...team, capacity })) })); }}><option value="">Set size…</option>{Array.from({ length: 12 }, (_, index) => index + 1).map((size) => <option value={size} key={size}>{size} players</option>)}</select></label><span>{session.teams.length} teams</span></>} className="section-block cup-collapsible">
        <div className="team-grid">
          {session.teams.map((team, index) => (
            <article className={`team-card team-${index % 4}`} key={team.id} style={{ borderTopColor: `hsl(${team.colorHue} 82% 55%)` }}>
              <div className="team-card-head">
                <input value={team.name} onChange={(event) => updateTeam(team.id, { name: event.target.value })} aria-label="Team name" />
                <span className={team.playerIds.length > team.capacity ? "over" : ""}>{teamStatus(team)}</span>
              </div>
              <div className="team-settings">
                <label>Abbreviation
                  <input className="abbr-input" value={team.abbreviation} maxLength={3} onChange={(event) => updateTeam(team.id, { abbreviation: event.target.value.toUpperCase() })} aria-label={`${team.name} abbreviation`} />
                </label>
                <label>Team size
                  <select value={team.capacity} onChange={(event) => updateTeam(team.id, { capacity: Number(event.target.value) })}>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((size) => <option key={size}>{size}</option>)}
                  </select>
                </label>
                <label className="team-color-control">Team color
                  <span><input className="team-color-slider" type="range" min="0" max="359" value={team.colorHue} onChange={(event) => updateTeam(team.id, { colorHue: Number(event.target.value) })} aria-label={`${team.name} color hue`} /><i style={{ background: `hsl(${team.colorHue} 82% 55%)` }} /></span>
                </label>
                <label className="toggle"><input type="checkbox" checked={team.allowOverflow} onChange={(event) => updateTeam(team.id, { allowOverflow: event.target.checked })} /> overflow</label>
              </div>
              <ol className="roster">
                {team.playerIds.map((playerId) => {
                  const position = session.assignments.find((assignment) => assignment.playerId === playerId)?.position;
                  return <li key={playerId}><span>{playerName(session.players, playerId)}</span>{position && <strong>{position}</strong>}</li>;
                })}
                {Array.from({ length: Math.max(0, team.capacity - team.playerIds.length) }, (_, i) => <li className="empty" key={`empty-${i}`}>Open spot</li>)}
              </ol>
              <button className="danger-link" onClick={() => setSession({ ...session, teams: session.teams.filter((item) => item.id !== team.id) })} disabled={team.playerIds.length > 0}>Delete team</button>
            </article>
          ))}
          <article className="add-card">
            <input placeholder="New team name" value={teamInput} onChange={(event) => setTeamInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && teamInput.trim()) { setSession(addTeam(session, teamInput)); setTeamInput(""); } }} />
            <button onClick={() => { if (teamInput.trim()) { setSession(addTeam(session, teamInput)); setTeamInput(""); } }}>+ Add custom team</button>
          </article>
        </div>
      </CollapsiblePanel>

      <section className="people-layout">
        <CollapsiblePanel title="Player wheel entries" eyebrow="PLAYER PRESET" meta={`${session.players.length} total`} className="section-block player-editor">
          <div className="player-heading-actions">{session.positionMode !== "none" && <button onClick={() => setSession({ ...session, players: session.players.map((player) => ({ ...player, role: "Any" })) })}>Reset roles to Any</button>}<button onClick={() => { if (window.confirm("Clear every player and assignment?")) { setDisplayPlayerIds(null); setPlayerRotation(0); setTeamRotation(0); setSession({ ...session, players: [], assignments: [], teams: session.teams.map((team) => ({ ...team, playerIds: [], captainId: undefined })) }); } }}>Clear all players</button></div>
          <div className="entry-list">
            {session.players.map((player) => (
              <div className={`entry-row ${player.status}`} key={player.id}>
                <span className="status-dot" />
                <input value={player.name} onChange={(event) => updatePlayer(player.id, event.target.value)} />
                {session.positionMode !== "none" && <select aria-label={`${player.name} positional role`} value={player.role} onChange={(event) => setSession({ ...session, players: session.players.map((item) => item.id === player.id ? { ...item, role: event.target.value as typeof player.role } : item) })}>
                  <option value="Any">Any</option>
                  <option value="Attacker">Attacker</option>
                  <option value="Midfield">Midfield</option>
                  <option value="Defense">Defense</option>
                </select>}
                <span>{player.status}</span>
                <button aria-label={`Delete ${player.name}`} disabled={player.status === "assigned"} title={player.status === "assigned" ? "Undo or reset this assignment before deleting" : "Delete player"} onClick={() => setSession({ ...session, players: session.players.filter((item) => item.id !== player.id) })}>×</button>
              </div>
            ))}
          </div>
          <textarea value={playerInput} onChange={(event) => setPlayerInput(event.target.value)} placeholder="Add one player per line…" />
          <div className="input-actions"><button onClick={() => addNames("available")}>Add to wheel</button><button onClick={() => addNames("next")}>Add late player to Next</button></div>
        </CollapsiblePanel>

        <CollapsiblePanel title="Next" eyebrow="LATE ARRIVALS" meta={`${waiting.length} waiting`} className="section-block next-panel">
          <p>Players can wait here without restarting the original draw.</p>
          {waiting.length ? waiting.map((player) => (
            <div className="waiting-row" key={player.id}><span>{player.name}</span><button onClick={() => setSession({ ...session, players: session.players.map((item) => item.id === player.id ? { ...item, status: "available" } : item) })}>Make ready</button></div>
          )) : <div className="empty-next">No one waiting</div>}
        </CollapsiblePanel>
      </section>
      </div>

      {(activeTab === "captain" || activeTab === "fantasy") && <DraftWorkspace mode={activeTab} session={session} setSession={setSession} testToolsEnabled={TEST_TOOLS_ENABLED} />}
      {activeTab === "standings" && <StandingsWorkspace />}
    </main>
  );
}
