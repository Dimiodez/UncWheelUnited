import { build } from 'esbuild';
import { strict as assert } from 'node:assert';
import { pathToFileURL } from 'node:url';

const base = (process.env.EA_API_BASE_URL || 'https://proclubs-api.onrender.com/api').replace(/\/$/, '');
const platform = 'common-gen5';
const expectedClubs = [
  { id: '43521', name: 'FC Sandy Bums' },
  { id: '96510', name: 'FC Mountains' },
  { id: '64234', name: 'UFL Gladbach' },
];

async function json(url) {
  const response = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(30_000) });
  assert.equal(response.ok, true, `${url} returned ${response.status}`);
  return response.json();
}

const output = '.tmp-fc27-normalizer.mjs';
await build({ entryPoints: ['src/match-watchers.ts'], outfile: output, bundle: true, format: 'esm', platform: 'node', external: ['cloudflare:*'] });
try {
  const { normalizeFc27Matches } = await import(`${pathToFileURL(`${process.cwd()}/${output}`).href}?t=${Date.now()}`);
  for (const expectedClub of expectedClubs) {
    const searchUrl = new URL(`${base}/clubs/search`);
    searchUrl.searchParams.set('platform', platform);
    searchUrl.searchParams.set('name', expectedClub.name);
    const search = await json(searchUrl);
    assert.ok(Array.isArray(search), `${expectedClub.name} search did not return an array`);
    assert.ok(search.some((club) => String(club.clubId ?? club.id) === expectedClub.id), `${expectedClub.name} (${expectedClub.id}) was not found`);

    const byType = [];
    for (const type of ['leagueMatch', 'playoffMatch']) {
      const matchUrl = new URL(`${base}/clubs/${expectedClub.id}/matches`);
      matchUrl.searchParams.set('platform', platform);
      matchUrl.searchParams.set('type', type);
      const rawMatches = await json(matchUrl);
      assert.ok(Array.isArray(rawMatches), `${expectedClub.name} ${type} did not return an array`);
      byType.push([type, normalizeFc27Matches(rawMatches)]);
    }
    const matches = [...new Map(byType.flatMap(([, rows]) => rows).map((match) => [match.id, match])).values()];
    assert.ok(matches.length > 0, `No FC27 matches were returned for ${expectedClub.name}`);
    const clubMatches = matches.filter((match) => match.clubs.some((club) => club.id === expectedClub.id));
    assert.ok(clubMatches.length > 0, `No normalized matches contain ${expectedClub.name}`);
    const playerRows = clubMatches.flatMap((match) => match.clubs.find((club) => club.id === expectedClub.id)?.players ?? []);
    assert.ok(playerRows.length > 0, `No human player rows were found for ${expectedClub.name}`);
    assert.ok(playerRows.every((player) => player.human && typeof player.motm === 'boolean' && player.stats.length === 14), `${expectedClub.name} failed the stat-sheet contract`);
    assert.ok(clubMatches.some((match) => match.clubs.flatMap((club) => club.players).some((player) => player.motm)), `${expectedClub.name} matches did not expose EA's man-of-the-match flag`);
    assert.ok(playerRows.some((player) => player.stats[11] !== '—'), `${expectedClub.name} did not expose verified interceptions`);
    const latest = clubMatches.sort((a, b) => b.playedAt - a.playedAt)[0];
    console.log(`PASS ${expectedClub.name} (${expectedClub.id}): ${matches.length} unique matches, ${playerRows.length} human-player rows; league/playoff routes valid (${byType.map(([type, rows]) => `${type}=${rows.length}`).join(', ')})`);
    console.log(`Latest: ${latest.clubs.map((club) => `${club.name} ${club.score}`).join(' - ')} at ${new Date(latest.playedAt).toISOString()}`);
  }
} finally {
  const { rm } = await import('node:fs/promises');
  await rm(output, { force: true });
}
