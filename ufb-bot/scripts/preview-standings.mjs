import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const esbuild=await import(process.env.UFB_ESBUILD_MODULE||'esbuild');const {default:sharp}=await import(process.env.UFB_SHARP_MODULE||'sharp');
const b=await esbuild.build({entryPoints:['ufb-bot/src/standings-image.ts'],bundle:true,write:false,platform:'node',format:'esm'});const {standingsSvg,wantsStandingsImage}=await import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'));
const s=JSON.parse(await readFile('.official-site/pickems-app/season-data.json','utf8'));const bg='data:image/png;base64,'+(await readFile('ufb-bot/assets/stat-backgrounds/unc-stadium.png')).toString('base64');const logos={};
for(const [key,t] of Object.entries(s.teams)){try{const r=await fetch(t[1]);if(r.ok)logos[key]='data:image/png;base64,'+Buffer.from(await r.arrayBuffer()).toString('base64');}catch{}}
const svg=standingsSvg(s,bg,logos);assert.equal((svg.match(/text-anchor="middle"/g)||[]).length,88);assert.ok(svg.includes('PTS'));assert.ok(wantsStandingsImage({type:2,data:{name:'standings',options:[{name:'league',value:'site:s1-6v6'}]}}));assert.ok(!wantsStandingsImage({type:4,data:{name:'standings'}}));
await sharp(Buffer.from(svg)).png().toFile('ufb-bot/standings-preview.png');console.log(`PASS standings layout and deferred routing; preview rendered with ${Object.keys(logos).length} website crests.`);
