import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const esbuild=await import(process.env.UFB_ESBUILD_MODULE||'esbuild');const {default:sharp}=await import(process.env.UFB_SHARP_MODULE||'sharp');
const b=await esbuild.build({entryPoints:['ufb-bot/src/league-leaders.ts'],bundle:true,write:false,platform:'node',format:'esm'});const {leadersSvg,leaderGroups}=await import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'));
const s=JSON.parse(await readFile('.official-site/pickems-app/season-data.json','utf8'));assert.equal(leaderGroups(s).length,3);assert.ok(leaderGroups(s).every(g=>g.rows.length===5));assert.throws(()=>leaderGroups({}));
const bg='data:image/png;base64,'+(await readFile('ufb-bot/assets/stat-backgrounds/unc-stadium.png')).toString('base64');const svg=leadersSvg(s,bg);assert.ok(svg.includes('Schweinslap'));assert.ok(!svg.includes('TACKLES'));
await sharp(Buffer.from(svg)).png().toFile('ufb-bot/league-leaders-preview.png');console.log('PASS three categories, five players each, missing-data rejection and image preview.');
