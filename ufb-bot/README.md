# UFL bot — canonical source

The tracked TypeScript in this directory is the source of truth for the live `unc-futbol-bot` Cloudflare Worker. Local recovery folders are backups, not deployment sources.

## Verify and build

Requires Node 24 and pnpm 11.25.0. From this directory:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm --dir runtime install --ignore-workspace --frozen-lockfile --ignore-scripts
pnpm run check
pnpm test
pnpm run test:unit
pnpm run build
```

GitHub CI repeats these checks and saves the bundle plus its SHA-256 manifest, tagged with the source commit. The runtime dependency lock is separate because Cloudflare Puppeteer is bundled from that package.

## Production deployment

Commit and push reviewed changes to Git first; verify CI. Deploy only the committed source using `pnpm run deploy` with authorized Cloudflare credentials. This preserves remotely managed variables and secrets. CI currently verifies builds; it does not automatically deploy. Production database migrations are deliberately separate and are not run by deployment.

The Worker uses the existing D1 database, browser binding, stat-background assets, and minute cron in wrangler.jsonc. Never replace production secrets with local values. Do not commit credentials or live database exports.

## Match coverage

UFL league matches are friendlies. Friendly matches are fetched from EA's public Clubs endpoint with its required request headers; league/playoff matches are also merged from the existing relay, deduplicated by match ID, and sorted by timestamp. Friendly failures surface as errors instead of silent partial success. The upstream recent-match window remains limited; automode polling must capture matches while available.

Read-only probes: `/health` and `/health?check=friendly` (fixed Maykop test club). Regression tests cover friendlies, match lookup, automode, deduplication and upstream failures without live Discord traffic.

Source recovery on 2026-10-14 was verified against the pre-fix live Worker: the original TypeScript backup produced a byte-identical normalized bundle. Existing event, image-upload, RSVP, help-center and house-team functionality is retained; friendlies and health diagnostics are the intentional application changes.
