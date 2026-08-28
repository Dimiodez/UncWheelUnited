import { useState } from "react";
import { createBracket, roundName, setBracketScore } from "./core/bracket";
import type { BracketRounds } from "./core/bracket";
import { calculateGroupStandings, createGroupStage, createGroupStageFromGroups, groupQualifiers, groupStageComplete } from "./core/groupStage";
import type { GroupStage } from "./core/groupStage";
import LeaguePhasePanel from "./LeaguePhasePanel";

const KNOCKOUT_SIZES = [4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
const GROUP_SIZES = Array.from({ length: 13 }, (_, index) => index + 4);

export default function StandingsWorkspace() {
  const [format, setFormat] = useState<"knockout" | "groups" | "league">("knockout");
  const [entrantCount, setEntrantCount] = useState(4);
  const [names, setNames] = useState<string[]>(Array(4).fill(""));
  const [rounds, setRounds] = useState<BracketRounds>([]);
  const [groupStage, setGroupStage] = useState<GroupStage | null>(null);
  const [groupCount, setGroupCount] = useState(2);
  const [groupSetup, setGroupSetup] = useState<string[][] | null>(null);
  const [leagueReady, setLeagueReady] = useState(false);
  const [message, setMessage] = useState("Enter every player, then generate the bracket.");

  const resizeEntrants = (count: number) => {
    setEntrantCount(count);
    setNames((current) => Array.from({ length: count }, (_, index) => current[index] ?? ""));
    setRounds([]);
    setGroupStage(null);
    setGroupSetup(null);
    setLeagueReady(false);
    setGroupCount((current) => Math.min(current, Math.floor(count / 2)));
    setMessage("Enter every player, then generate the event.");
  };

  const changeFormat = (nextFormat: "knockout" | "groups" | "league") => {
    setFormat(nextFormat);
    resizeEntrants(nextFormat === "knockout" ? 4 : 8);
  };

  const generate = () => {
    const cleaned = names.map((name) => name.trim());
    if (cleaned.some((name) => !name)) return setMessage(`Add all ${entrantCount} player names first.`);
    if (new Set(cleaned.map((name) => name.toLowerCase())).size !== cleaned.length) return setMessage("Each player needs a unique name.");
    setRounds([]);
    setLeagueReady(false);
    if (format === "groups") {
      setGroupStage(null);
      setGroupSetup(Array.from({ length: groupCount }, () => []));
      setMessage("Groups ready for selection. Randomly draw everyone or drag each name into a group.");
    } else if (format === "league") {
      setGroupStage(null);
      setGroupSetup(null);
      setLeagueReady(true);
      setMessage("League phase ready. Choose the schedule and qualification settings below.");
    } else {
      setGroupStage(null);
      setRounds(createBracket(cleaned));
      setMessage("Bracket ready. Enter both scores to advance a winner.");
    }
  };

  const randomizeGroupSetup = () => {
    const cleaned = names.map((name) => name.trim()).filter(Boolean);
    setGroupSetup(createGroupStage(cleaned, groupCount).groups);
    setMessage("Random group draw complete. You can still drag players between groups before creating fixtures.");
  };

  const moveToGroup = (name: string, targetGroup: number | null) => setGroupSetup((current) => {
    if (!current || !name) return current;
    const next = current.map((group) => group.filter((item) => item !== name));
    if (targetGroup !== null) next[targetGroup] = [...next[targetGroup], name];
    return next;
  });

  const createGroupFixtures = () => {
    if (!groupSetup) return;
    const assigned = groupSetup.flat();
    const currentNames = names.map((name) => name.trim());
    if (assigned.length !== entrantCount || new Set(assigned).size !== entrantCount || currentNames.some((name) => !assigned.includes(name)) || groupSetup.some((group) => group.length < 2)) return setMessage("Assign everyone exactly once and place at least two players in every group.");
    setGroupStage(createGroupStageFromGroups(groupSetup));
    setRounds([]);
    setMessage("Group fixtures ready. Each player faces everyone else in their group once.");
  };

  const updateGroupScore = (fixtureId: string, side: "home" | "away", value: string) => setGroupStage((current) => current ? {
    ...current,
    fixtures: current.fixtures.map((fixture) => fixture.id === fixtureId ? { ...fixture, [side === "home" ? "homeScore" : "awayScore"]: value.replace(/\D/g, "") } : fixture)
  } : current);

  const createKnockoutFromGroups = () => {
    if (!groupStage || !groupStageComplete(groupStage)) return;
    setRounds(createBracket(groupQualifiers(groupStage), () => 0.999999));
    setMessage("The top two from each group have advanced to the knockout bracket.");
  };

  const champion = rounds.at(-1)?.[0]?.winner;
  const playable = rounds.flatMap((round, roundIndex) => round.map((match, matchIndex) => ({ match, roundIndex, matchIndex }))).filter(({ match }) => match.home && match.away && !match.winner);
  const sizeOptions = format === "knockout" ? KNOCKOUT_SIZES : GROUP_SIZES;
  const unassignedGroupNames = groupSetup ? names.map((name) => name.trim()).filter((name) => name && !groupSetup.flat().includes(name)) : [];

  return <section className="standings-workspace">
    <div className="standings-hero">
      <div><p className="eyebrow">FC26 1V1 KICKOFF</p><h2>Friendly Standings</h2><p>Create head-to-head events and advance winners automatically.</p></div>
      <label>Format<select value={format} onChange={(event) => changeFormat(event.target.value as typeof format)}><option value="knockout">Knockout bracket</option><option value="groups">Groups → knockout</option><option value="league">League phase → knockout</option></select></label>
      <label>Players<select value={entrantCount} onChange={(event) => resizeEntrants(Number(event.target.value))}>{sizeOptions.map((size) => <option key={size} value={size}>{size} players</option>)}</select></label>
      {format === "groups" && <label>Group count<select value={groupCount} onChange={(event) => { setGroupCount(Number(event.target.value)); setGroupSetup(null); setGroupStage(null); setRounds([]); }}>{Array.from({ length: Math.max(1, Math.floor(entrantCount / 2) - 1) }, (_, index) => index + 2).map((count) => <option key={count} value={count}>{count} groups</option>)}</select></label>}
      <button onClick={generate}>{format === "groups" ? "Set up groups" : format === "league" ? "Set up league phase" : "Generate random bracket"}</button>
    </div>

    {groupSetup && !groupStage && <section className="group-draw-board">
      <div className="group-stage-heading"><div><p className="eyebrow">GROUP DRAW</p><h2>Assign the participants</h2><p>Use the random draw or drag names manually. Groups may have uneven sizes.</p></div><div className="group-draw-actions"><button onClick={randomizeGroupSetup}>Randomly draw groups</button><button disabled={unassignedGroupNames.length > 0 || groupSetup.some((group) => group.length < 2)} onClick={createGroupFixtures}>Create fixtures</button></div></div>
      <div className="manual-group-layout"><aside className="group-player-pool" onDragOver={(event) => event.preventDefault()} onDrop={(event) => moveToGroup(event.dataTransfer.getData("text/group-name"), null)}><strong>Unassigned</strong><span>{unassignedGroupNames.length}</span>{unassignedGroupNames.map((name) => <div draggable onDragStart={(event) => event.dataTransfer.setData("text/group-name", name)} key={name}>{name}</div>)}{!unassignedGroupNames.length && <em>Everyone assigned</em>}</aside>
        <div className="manual-groups">{groupSetup.map((group, groupIndex) => <article onDragOver={(event) => event.preventDefault()} onDrop={(event) => moveToGroup(event.dataTransfer.getData("text/group-name"), groupIndex)} key={groupIndex}><h3>Group {String.fromCharCode(65 + groupIndex)} <span>{group.length}</span></h3>{group.map((name) => <div draggable onDragStart={(event) => event.dataTransfer.setData("text/group-name", name)} key={name}>{name}</div>)}{!group.length && <em>Drop players here</em>}</article>)}</div>
      </div>
    </section>}

    <div className="entrant-panel">
      <div className="section-heading"><div><p className="eyebrow">PARTICIPANTS</p><h2>Player/Team names</h2></div><span>{entrantCount} total</span></div>
      <div className="entrant-grid">{names.map((name, index) => <label key={index}><span>{String(index + 1).padStart(2, "0")}</span><input value={name} placeholder={`Player or team ${index + 1}`} onChange={(event) => { setNames(names.map((item, itemIndex) => itemIndex === index ? event.target.value : item)); setGroupSetup(null); setGroupStage(null); setLeagueReady(false); setRounds([]); }} /></label>)}</div>
      <p className="bracket-message">{message}</p>
    </div>

    {leagueReady && <LeaguePhasePanel key={names.join("|")} names={names.map((name) => name.trim())} onCreateKnockout={(qualifiers) => { setRounds(createBracket(qualifiers, () => 0.999999)); setMessage("League qualifiers have entered the knockout bracket."); }} />}

    {groupStage && <section className="group-stage-board">
      <div className="group-stage-heading"><div><p className="eyebrow">CLASSIC GROUP STAGE</p><h2>Groups and fixtures</h2><p>3 points for a win · 1 for a draw · ranked by points, goal difference, then goals scored</p></div><button disabled={!groupStageComplete(groupStage)} onClick={createKnockoutFromGroups}>{groupStageComplete(groupStage) ? "Create knockout bracket" : "Complete all group matches"}</button></div>
      <div className="group-grid">{groupStage.groups.map((group, groupIndex) => {
        const fixtures = groupStage.fixtures.filter((fixture) => fixture.groupIndex === groupIndex);
        const table = calculateGroupStandings(group, fixtures);
        return <article className="group-card" key={groupIndex}><h3>Group {String.fromCharCode(65 + groupIndex)}</h3>
          <div className="group-table"><div className="table-head"><span>#</span><span>Player</span><span>P</span><span>GD</span><span>Pts</span></div>{table.map((row, index) => <div className={index < 2 ? "qualifying" : ""} key={row.name}><span>{index + 1}</span><strong>{row.name}</strong><span>{row.played}</span><span>{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</span><b>{row.points}</b></div>)}</div>
          <div className="group-fixtures">{fixtures.map((fixture) => <div key={fixture.id}><span>{fixture.home}</span><input aria-label={`${fixture.home} score`} type="text" inputMode="numeric" pattern="[0-9]*" maxLength={2} value={fixture.homeScore} onChange={(event) => updateGroupScore(fixture.id, "home", event.target.value)} /><em>–</em><input aria-label={`${fixture.away} score`} type="text" inputMode="numeric" pattern="[0-9]*" maxLength={2} value={fixture.awayScore} onChange={(event) => updateGroupScore(fixture.id, "away", event.target.value)} /><span>{fixture.away}</span></div>)}</div>
        </article>;
      })}</div>
    </section>}

    {rounds.length > 0 && <div className="bracket-layout">
      <div className="bracket-board">{rounds.map((round, roundIndex) => <div className="bracket-round" key={roundIndex}>
        <h3>{roundName(roundIndex, rounds.length)}</h3>
        <div className="round-matches">{round.map((match, matchIndex) => <article className={`bracket-match ${match.winner ? "complete" : ""}`} key={match.id}>
          <div className={match.winner === match.home ? "winner" : ""}><span>{match.home ?? "TBD"}</span><input aria-label={`${match.home ?? "Home"} score`} type="text" inputMode="numeric" pattern="[0-9]*" maxLength={2} disabled={!match.home || !match.away} value={match.homeScore} onChange={(event) => setRounds(setBracketScore(rounds, roundIndex, matchIndex, "home", event.target.value.replace(/\D/g, "")))} /></div>
          <div className={match.winner === match.away ? "winner" : ""}><span>{match.away ?? (roundIndex === 0 && match.home ? "BYE" : "TBD")}</span><input aria-label={`${match.away ?? "Away"} score`} type="text" inputMode="numeric" pattern="[0-9]*" maxLength={2} disabled={!match.home || !match.away} value={match.awayScore} onChange={(event) => setRounds(setBracketScore(rounds, roundIndex, matchIndex, "away", event.target.value.replace(/\D/g, "")))} /></div>
          {match.home && match.away && match.homeScore !== "" && match.awayScore !== "" && Number(match.homeScore) === Number(match.awayScore) && <small>Enter a decisive score</small>}
        </article>)}</div>
      </div>)}</div>

      <aside className="match-centre"><p className="eyebrow">MATCH CENTRE</p><h2>{champion ? "Champion" : "Who plays who"}</h2>
        {champion ? <div className="champion-card">🏆 <strong>{champion}</strong></div> : playable.length ? playable.slice(0, 6).map(({ match, roundIndex, matchIndex }) => <div className="upcoming-match" key={match.id}><small>{roundName(roundIndex, rounds.length)} · Match {matchIndex + 1}</small><strong>{match.home}</strong><span>vs</span><strong>{match.away}</strong></div>) : <p>Complete the current scores to reveal the next matchup.</p>}
      </aside>
    </div>}
  </section>;
}
