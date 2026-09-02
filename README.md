# Unc Wheel Utility (UWU)

First-draft test environment for the configurable Cup Night player-to-team draw.

## Included

- Editable player and team names
- Per-team preferred capacities
- Player removal after assignment
- Automatic one-by-one drafting with a stop control
- Instant, 1s, 2s, 3s, and 5s Auto Draft speeds
- Player initials rendered on the live wheel segments
- Editable team abbreviations rendered on Team wheel segments
- Supplied UWU logo assets and navy/pink/cyan/gold brand palette
- Add Wheel selector with simple and specific position presets
- Optional per-team position limits with fully random override
- Captain draft workspace with captain selection, draft order, and drag-to-team interaction
- Fantasy value workspace with editable ratings, standard rounding, budgets, and live balances
- Automatic exclusion of full teams during normal rolls
- Prompt, strict/Next, and balanced-overflow behavior
- Live team roster cards
- Late-player Next queue
- Undo, reset, and local browser persistence
- Assignment-engine tests

## Run locally

Use Node.js 20 or newer and pnpm:

```powershell
pnpm install
pnpm dev
```

Then open `http://127.0.0.1:5173/`.

Run verification with:

```powershell
pnpm test
pnpm build
```

## Optional test tools

Every workspace shows test-data controls automatically while running `pnpm dev`. Set `VITE_ENABLE_TEST_TOOLS=true` before building to include them in a shared or public build. The current GitHub Pages workflow enables the flag for public viability testing; remove that environment variable from `.github/workflows/deploy-pages.yml` to hide the controls later.

The current environment does not have the Rust toolchain required by Tauri. The React interface and platform-independent assignment engine are ready to place inside a Tauri shell once Rust is installed.
