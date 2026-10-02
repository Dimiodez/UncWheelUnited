# Approved UFB stat-sheet format

Approved by the owner on September 15, 2026 after reviewing the sunset beach and mountain previews. Preserve this format when adding backgrounds; do not redesign it without approval.

Canonical renderer: `scripts/render-stat-sheet.mjs`. Approved examples: `stat-sheet-demo.png` and `stat-sheet-mountains-demo.png`.

- Output: 1920 × 1080 PNG, background scaled to cover.
- Exact muted overlay: vertical #041326 gradient, opacity .78 at top, .48 at 55%, .72 at bottom. Keep background artwork unchanged.
- Table: #04101e at .81 opacity, navy #071b36 header at .96 opacity, alternating white row tint at .035 opacity.
- White stat text, #efbc61 gold score/rating accents and separator, existing Arial layout, column spacing and footer.
- Columns: Player, Position, MR, GLS, SHT, AST, secondary AST, KPS, DRI, possession W/L, PAS, TKL, INT, BLK, SVS. Keep the abbreviation legend.
- Render only the linked EA club's human match participants as identified by the EA match response. UFB roster membership and `/claim` are NOT prerequisites. Exclude AI, opponents and players who did not play. Never fabricate missing statistics; show an em dash.
- Future ingestion must verify the response's human-player representation against an actual working API payload. Discord identity linking is optional enrichment, never a gate for inclusion. Preserve historical match participants after transfers. Do not assume an unmatched Discord identity means an AI player.
- Demo generation is isolated from the database and prominently marked fictional. Production sheets must not use demo data or demo labels.

The current renderer is a visual demo, not yet wired to real match ingestion or Discord image attachments. Adding backgrounds must reuse the same overlay and template.
