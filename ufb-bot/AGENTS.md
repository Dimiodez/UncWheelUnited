# Canonical live bot source

This tracked directory on Dimiodez/UncWheelUnited main is the authoritative source for the live unc-futbol-bot Worker. Do not deploy local backups, recovered bundles, or untracked older copies.

Preserve existing features and production resources. Install both locked dependency sets, run check/test/test:unit/build, commit and push, verify GitHub CI, then deploy that committed build with --keep-vars. Never apply production migrations or register Discord commands without reviewing their impact. Keep credentials, .dev.vars, logs, and private recovery material out of Git.

League fixtures are EA friendlyMatch games. Keep friendly coverage in /matches, /gamestats and automode. A failed friendly fetch must not silently look like successful league-only coverage.
