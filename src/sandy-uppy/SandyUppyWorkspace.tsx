import { useEffect, useRef, useState } from "react";
import { createSandyUppyGame } from "./createGame";
import { InputController, type SandyAction } from "./input/InputController";
import type { SandySnapshot } from "./simulation/GameModel";
import "./sandy-uppy.css";
import { rankedRun } from "./save/RankedRun";
import Leaderboard from "./Leaderboard";

const initialSnapshot: SandySnapshot = {
  phase: "start",
  score: 0,
  combo: 0,
  multiplier: 1,
  dropsRemaining: 3,
  bestCombo: 0,
  highScore: 0,
  difficulty: 1,
  secondsSurvived: 0,
  lastContact: "Ready"
};

export default function SandyUppyWorkspace({ published = false }: { published?: boolean }) {
  const gameRoot = useRef<HTMLDivElement>(null);
  const controls = useRef(new InputController());
  const game = useRef<ReturnType<typeof createSandyUppyGame> | null>(null);
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [scoreStatus,setScoreStatus] = useState('');

  useEffect(() => {
    if (!gameRoot.current) return;
    rankedRun.configure(published,setScoreStatus);
    game.current = createSandyUppyGame(gameRoot.current, controls.current, setSnapshot);
    return () => {
      controls.current.detach();
      game.current?.game.destroy(true);
      game.current = null;
      rankedRun.configure(false,()=>{});
    };
  }, []);

  const command = (name: "start" | "pause" | "resume" | "restart") => game.current?.command(name);

  const setMovement = (action: SandyAction, held: boolean) => controls.current.setHeld(action, held);
  const updateMovementFromPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const action: SandyAction = event.clientX - rect.left < rect.width / 2 ? "left" : "right";
    controls.current.setHeld("left", action === "left");
    controls.current.setHeld("right", action === "right");
  };
  const releaseMovement = () => controls.current.clearMovement();

  return (
    <section className="sandy-uppy-workspace" aria-label={published ? "Sandy Uppy game" : "Sandy Uppy test game"}>
      <header className="sandy-game-heading">
        <div><p className="eyebrow">{published ? "SANDY BUMS FC · BEACH KEEP-UPS" : "TEST REALM · SANDY BUMS FC"}</p><h2>Sandy Uppy</h2></div>
        <span>{published ? "Endless beach · Members leaderboard" : "First playable · local high score only"}</span>
      </header>

      {snapshot.phase === "start" && snapshot.secondsSurvived === 0 && <aside className="sandy-start-guide" aria-label="How to play">
        <strong>Before you hit the beach</strong>
        <p><b>Move:</b> ← / → or A / D. <b>Jump / start:</b> ↑, W or Space. <b>Slide tackle:</b> double-tap a direction. <b>Pause:</b> P, Esc or the Pause button.</p>
        <p><b>On touch:</b> hold the arrow pads to move, tap Jump to start or jump, and double-tap an arrow to slide.</p>
        <p>Keep the ball off the sand! Beachgoers build castles that slow you down. Slide into a builder to stop them (+150), or tackle a finished castle twice to clear it (+250). They arrive and build faster as you survive.</p>
        <p>A drop costs a life; jump to restart with the ball. Catch a rare Goose Mode can dropped by a flying goose for +1 life (maximum 3).</p>
      </aside>}

      <div className="sandy-game-shell">
        <div className="sandy-game-canvas" ref={gameRoot} />

        <div className="sandy-hud" aria-live="polite">
          <div><small>Score</small><strong>{snapshot.score.toLocaleString()}</strong></div>
          <div><small>Combo</small><strong>{snapshot.combo} <i>×{snapshot.multiplier}</i></strong></div>
          <div className="sandy-drops"><small>Drops</small><strong aria-label={`${snapshot.dropsRemaining} drops remaining`}>{[0, 1, 2].map((drop) => <i className={drop < snapshot.dropsRemaining ? "live" : "lost"} key={drop}>⚽</i>)}</strong></div>
          <button type="button" onClick={() => command("pause")} disabled={snapshot.phase !== "playing"}>Pause</button>
        </div>

        {snapshot.phase === "start" && <div className="sandy-start-prompt">
          <strong>Ball attached</strong>
          <span>Move into position · Jump to knock it up · Double-tap a direction to slide</span>
        </div>}

        {snapshot.phase === "paused" && <div className="sandy-overlay compact">
          <span className="sandy-overline">HALF-TIME BREATHER</span><h3>Paused</h3>
          <button type="button" onClick={() => command("resume")}>Back to the beach</button>
        </div>}

        {snapshot.phase === "gameover" && <div className="sandy-overlay compact">
          <span className="sandy-overline">THE BALL HIT THE SAND</span><h3>Full time</h3>
          <div className="sandy-final-score"><span>Score <b>{snapshot.score.toLocaleString()}</b></span>{!published&&<span>High <b>{snapshot.highScore.toLocaleString()}</b></span>}<span>Best combo <b>{snapshot.bestCombo}</b></span></div>
          <button type="button" onClick={() => command("restart")}>Play again</button>
        </div>}

        <div className="sandy-touch-controls" aria-label="Touch controls">
          <div className="sandy-movement-pads" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); updateMovementFromPointer(event); }} onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) updateMovementFromPointer(event); }} onPointerUp={releaseMovement} onPointerCancel={releaseMovement} onLostPointerCapture={releaseMovement}>
            <button type="button" data-action="left" aria-label="Move left" onPointerDown={() => setMovement("left", true)}>←</button>
            <button type="button" data-action="right" aria-label="Move right" onPointerDown={() => setMovement("right", true)}>→</button>
          </div>
          <button className="sandy-jump-button" type="button" aria-label="Jump" onPointerDown={(event) => { event.preventDefault(); controls.current.queueJump(); }}>↑<span>Jump</span></button>
        </div>
      </div>

      <footer className="sandy-test-strip"><strong>{published ? "Beach rules" : "Test build"}</strong><span>Slide into builders: +150 · Castles: two slides, +250 · Catch rare Goose Mode cans for +1 life</span><span>{Math.floor(snapshot.secondsSurvived)}s · {snapshot.lastContact}</span></footer>
      {published&&<><p className="sandy-score-status" role="status">{scoreStatus}</p><Leaderboard/></>}
    </section>
  );
}
