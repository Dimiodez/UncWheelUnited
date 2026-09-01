import { useMemo, useState } from "react";
import { calculateLeagueTable, createLeagueFixtures, leagueComplete, validGameCounts } from "./core/leaguePhase";
import type { LeagueFixture } from "./core/leaguePhase";
import CollapsiblePanel from "./CollapsiblePanel";

type PlayoffMatch = { id: string; home: string; away: string; homeScore: string; awayScore: string; winner: string | null };

type Props = {
  names: string[];
  onCreateKnockout: (qualifiers: string[]) => void;
  testToolsEnabled?: boolean;
};

export default function LeaguePhasePanel({ names, onCreateKnockout, testToolsEnabled = false }: Props) {
  const gameOptions = validGameCounts(names.length);
  const [gamesPerPlayer, setGamesPerPlayer] = useState(gameOptions[Math.min(3, gameOptions.length - 1)]);
  const [directPlaces, setDirectPlaces] = useState(2);
  const [playoffPlaces, setPlayoffPlaces] = useState(Math.min(4, names.length - 2));
  const [fixtures, setFixtures] = useState<LeagueFixture[]>([]);
  const [playoffs, setPlayoffs] = useState<PlayoffMatch[]>([]);

  const table = useMemo(() => calculateLeagueTable(names, fixtures), [names, fixtures]);
  const placementOptions = [0, 2, 4, 6, 8, 10, 12];
  const eventualKnockoutCount = directPlaces + playoffPlaces / 2;

  const updateScore = (fixtureId: string, side: "home" | "away", value: string) => setFixtures((current) => current.map((fixture) => fixture.id === fixtureId ? { ...fixture, [side === "home" ? "homeScore" : "awayScore"]: value.replace(/\D/g, "") } : fixture));

  const createPlayoffs = () => {
    if (playoffPlaces === 0) {
      onCreateKnockout(table.slice(0, directPlaces).map((row) => row.name));
      return;
    }
    const pool = table.slice(directPlaces, directPlaces + playoffPlaces).map((row) => row.name);
    setPlayoffs(Array.from({ length: pool.length / 2 }, (_, index) => ({ id: `playoff-${index}`, home: pool[index], away: pool[pool.length - 1 - index], homeScore: "", awayScore: "", winner: null })));
  };

  const updatePlayoff = (id: string, side: "home" | "away", value: string) => setPlayoffs((current) => current.map((match) => {
    if (match.id !== id) return match;
    const next = { ...match, [side === "home" ? "homeScore" : "awayScore"]: value.replace(/\D/g, "") };
    if (next.homeScore !== "" && next.awayScore !== "" && Number(next.homeScore) !== Number(next.awayScore)) next.winner = Number(next.homeScore) > Number(next.awayScore) ? next.home : next.away;
    else next.winner = null;
    return next;
  }));

  const knockoutReady = playoffs.length > 0 && playoffs.every((match) => match.winner);

  return <section className="league-phase-board">
    <div className="league-controls"><div><p className="eyebrow">LEAGUE PHASE</p><h2>Combined table setup</h2><p>Every participant plays the same number of unique opponents.</p></div>
      <label>Games each<select value={gamesPerPlayer} onChange={(event) => { setGamesPerPlayer(Number(event.target.value)); setFixtures([]); setPlayoffs([]); }}>{gameOptions.map((count) => <option key={count} value={count}>{count}</option>)}</select></label>
      <label>Direct places<select value={directPlaces} onChange={(event) => { setDirectPlaces(Number(event.target.value)); setPlayoffs([]); }}>{placementOptions.map((count) => <option key={count} value={count} disabled={count + playoffPlaces > names.length}>{count}</option>)}</select></label>
      <label>Playoff places<select value={playoffPlaces} onChange={(event) => { setPlayoffPlaces(Number(event.target.value)); setPlayoffs([]); }}>{placementOptions.map((count) => <option key={count} value={count} disabled={count + directPlaces > names.length}>{count}</option>)}</select></label>
      <button onClick={() => { setFixtures(createLeagueFixtures(names, gamesPerPlayer)); setPlayoffs([]); }}>Generate league schedule</button>
    </div>

    {testToolsEnabled && fixtures.length > 0 && <div className="inline-test-tools"><strong>Test tools</strong><button onClick={() => setFixtures((current) => current.map((fixture, index) => ({ ...fixture, homeScore: index % 3 === 0 ? "1" : "3", awayScore: index % 3 === 0 ? "2" : "1" })))}>Fill league scores</button>{playoffs.length > 0 && <button onClick={() => setPlayoffs((current) => current.map((match) => ({ ...match, homeScore: "2", awayScore: "0", winner: match.home })))}>Fill playoff scores</button>}</div>}

    {fixtures.length > 0 && <CollapsiblePanel title="League standings and matches" eyebrow="LEAGUE RESULTS" meta={`${fixtures.length} fixtures`} className="standings-collapsible">
      <div className="league-phase-layout"><div className="league-table-card"><h3>League standings</h3><div className="league-table"><div className="table-head"><span>#</span><span>Player</span><span>P</span><span>W</span><span>D</span><span>L</span><span>GD</span><span>Pts</span></div>{table.map((row, index) => <div className={index < directPlaces ? "direct" : index < directPlaces + playoffPlaces ? "playoff" : ""} key={row.name}><span>{index + 1}</span><strong>{row.name}</strong><span>{row.played}</span><span>{row.won}</span><span>{row.drawn}</span><span>{row.lost}</span><span>{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</span><b>{row.points}</b></div>)}</div><div className="qualification-key"><span>Direct to knockout</span><span>Qualification playoff</span></div></div>
      <div className="league-fixture-card"><h3>League matches</h3><div className="league-fixtures">{fixtures.map((fixture) => <div key={fixture.id}><span>{fixture.home}</span><input type="text" inputMode="numeric" maxLength={2} value={fixture.homeScore} onChange={(event) => updateScore(fixture.id, "home", event.target.value)} /><em>–</em><input type="text" inputMode="numeric" maxLength={2} value={fixture.awayScore} onChange={(event) => updateScore(fixture.id, "away", event.target.value)} /><span>{fixture.away}</span></div>)}</div><button disabled={!leagueComplete(fixtures) || eventualKnockoutCount < 2} onClick={createPlayoffs}>{!leagueComplete(fixtures) ? "Complete league matches" : eventualKnockoutCount < 2 ? "Choose at least 2 knockout places" : playoffPlaces === 0 ? "Create knockout bracket" : "Create qualification playoffs"}</button></div></div>
    </CollapsiblePanel>}

    {playoffs.length > 0 && <CollapsiblePanel title="Qualification playoffs" eyebrow="PLAYOFF ROUND" meta={`${playoffs.length} matches`} className="standings-collapsible">
      <div className="league-playoffs"><div><p className="eyebrow">QUALIFICATION PLAYOFF</p><h2>One match for a knockout place</h2></div>{playoffs.map((match) => <article key={match.id}><div className={match.winner === match.home ? "winner" : ""}><span>{match.home}</span><input type="text" inputMode="numeric" maxLength={2} value={match.homeScore} onChange={(event) => updatePlayoff(match.id, "home", event.target.value)} /></div><div className={match.winner === match.away ? "winner" : ""}><span>{match.away}</span><input type="text" inputMode="numeric" maxLength={2} value={match.awayScore} onChange={(event) => updatePlayoff(match.id, "away", event.target.value)} /></div></article>)}<button disabled={!knockoutReady} onClick={() => onCreateKnockout([...table.slice(0, directPlaces).map((row) => row.name), ...playoffs.map((match) => match.winner!)])}>Create knockout bracket</button></div>
    </CollapsiblePanel>}
  </section>;
}
