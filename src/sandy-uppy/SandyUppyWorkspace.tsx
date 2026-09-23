import { useEffect, useRef, useState } from "react";
import { createSandyUppyGame } from "./createGame";
import { InputController, type SandyAction } from "./input/InputController";
import type { SandySnapshot } from "./simulation/GameModel";
import "./sandy-uppy.css";

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

export default function SandyUppyWorkspace() {
  const gameRoot = useRef<HTMLDivElement>(null);
  const controls = useRef(new InputController());
  const game = useRef<ReturnType<typeof createSandyUppyGame> | null>(null);
  const [snapshot, setSnapshot] = useState(initialSnapshot);

  useEffect(() => {
    if (!gameRoot.current) return;
    game.current = createSandyUppyGame(gameRoot.current, controls.current, setSnapshot);
    return () => {
      controls.current.detach();
      game.current?.game.destroy(true);
      game.current = null;
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
    <section className="sandy-uppy-workspace" aria-label="Sandy Uppy test game">
      <header className="sandy-game-heading">
        <div><p className="eyebrow">TEST REALM · SANDY BUMS FC</p><h2>Sandy Uppy</h2></div>
        <span>First playable · local high score only</span>
      </header>

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
          <div className="sandy-final-score"><span>Score <b>{snapshot.score.toLocaleString()}</b></span><span>High <b>{snapshot.highScore.toLocaleString()}</b></span><span>Best combo <b>{snapshot.bestCombo}</b></span></div>
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

      <footer className="sandy-test-strip"><strong>Test build</strong><span>Double-tap ←/→ to slide · obstacle misses receive one sand save</span><span>{Math.floor(snapshot.secondsSurvived)}s · {snapshot.lastContact}</span></footer>
    </section>
  );
}
