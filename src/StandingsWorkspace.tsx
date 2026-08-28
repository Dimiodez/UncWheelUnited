import { useState } from "react";
import { createBracket, roundName, setBracketScore } from "./core/bracket";
import type { BracketRounds } from "./core/bracket";

const SIZES = [4, 6, 8, 10, 12, 14, 16];

export default function StandingsWorkspace() {
  const [entrantCount, setEntrantCount] = useState(4);
  const [names, setNames] = useState<string[]>(Array(4).fill(""));
  const [rounds, setRounds] = useState<BracketRounds>([]);
  const [message, setMessage] = useState("Enter every player, then generate the bracket.");

  const resizeEntrants = (count: number) => {
    setEntrantCount(count);
    setNames((current) => Array.from({ length: count }, (_, index) => current[index] ?? ""));
    setRounds([]);
    setMessage("Enter every player, then generate the bracket.");
  };

  const generate = () => {
    const cleaned = names.map((name) => name.trim());
    if (cleaned.some((name) => !name)) return setMessage(`Add all ${entrantCount} player names first.`);
    if (new Set(cleaned.map((name) => name.toLowerCase())).size !== cleaned.length) return setMessage("Each player needs a unique name.");
    setRounds(createBracket(cleaned));
    setMessage("Bracket ready. Enter both scores to advance a winner.");
  };

  const champion = rounds.at(-1)?.[0]?.winner;
  const playable = rounds.flatMap((round, roundIndex) => round.map((match, matchIndex) => ({ match, roundIndex, matchIndex }))).filter(({ match }) => match.home && match.away && !match.winner);

  return <section className="standings-workspace">
    <div className="standings-hero">
      <div><p className="eyebrow">FC26 1V1 KICKOFF</p><h2>Friendly Standings</h2><p>Create randomized head-to-head matchups and advance winners automatically.</p></div>
      <label>Bracket size<select value={entrantCount} onChange={(event) => resizeEntrants(Number(event.target.value))}>{SIZES.map((size) => <option key={size} value={size}>{size} players</option>)}</select></label>
      <button onClick={generate}>Generate random bracket</button>
    </div>

    <div className="entrant-panel">
      <div className="section-heading"><div><p className="eyebrow">PARTICIPANTS</p><h2>Player names</h2></div><span>{entrantCount} total</span></div>
      <div className="entrant-grid">{names.map((name, index) => <label key={index}><span>{String(index + 1).padStart(2, "0")}</span><input value={name} placeholder={`Player ${index + 1}`} onChange={(event) => setNames(names.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} /></label>)}</div>
      <p className="bracket-message">{message}</p>
    </div>

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
