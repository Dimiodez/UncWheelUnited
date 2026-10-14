# Canonical live bot source

This tracked directory on Dimiodez/UncWheelUnited main is the authoritative source for the live unc-futbol-bot Worker. Do not deploy local backups, recovered bundles, or untracked older copies.

Preserve existing features and production resources. Install both locked dependency sets, run check/test/test:unit/build, commit and push, verify GitHub CI, then deploy that committed build with --keep-vars. Never apply production migrations or register Discord commands without reviewing their impact. Keep credentials, .dev.vars, logs, and private recovery material out of Git.

League fixtures are EA friendlyMatch games. Keep friendly coverage in /matches, /gamestats and automode. A failed friendly fetch must not silently look like successful league-only coverage.

## GitHub-only changes (owner instruction, 2026-10-14)

Do not edit bot source in local PC copies. Make source, deployment configuration, and non-secret connection changes directly in the canonical GitHub repository. Use GitHub CI to verify committed versions and deploy only artifacts built from those versions. Local backups/checkouts are not authoritative and must never supply independent edits or replacement bundles.

Track non-secret Worker names, bindings, schedules, dependency locks and connection configuration in Git. Keep Discord tokens, Cloudflare credentials and other secrets in secure platform secret storage, never in Git. GitHub CI currently verifies builds; automatic production deployment has not yet been configured. Do not claim that a Git commit automatically deploys or that production is Git-connected without verifying that integration. Until that integration is added, deployment must use the verified GitHub artifact without local source edits.