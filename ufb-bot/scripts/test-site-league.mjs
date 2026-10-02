import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const esbuild=await import(process.env.UFB_ESBUILD_MODULE||'esbuild');
const build=await esbuild.build({entryPoints:['ufb-bot/src/site-league.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const {siteLeagueCommand,validateSeason,fetchLeagueSeason}=await import('data:text/javascript;base64,'+Buffer.from(build.outputFiles[0].text).toString('base64'));
const fixture=JSON.parse(await readFile('.official-site/pickems-app/season-data.json','utf8'));
const source={name:'UNC 6v6 — Season 1',url:'https://www.uncfutbolleague.com/pickems-app/season-data.json'};
validateSeason(fixture);
await fetchLeagueSeason(source,async(_url,options)=>{assert.equal(options.redirect,'manual');return Response.json(fixture);});
await assert.rejects(()=>fetchLeagueSeason(source,async()=>new Response(null,{status:302,headers:{location:'https://example.com'}})),/302/);
for(const name of ['standings','schedule','leaguestats']){
 const result=await siteLeagueCommand({type:2,data:{name,options:[{name:'league',value:'6v6'}]}},source,async()=>Response.json(fixture));
 if(name==='leaguestats'){assert.equal(result.data.embeds?.[0].fields.length,3);assert.equal(result.data.embeds?.[0].fields[0].value.split('\n').length,5);}else assert.ok(result.data.embeds?.[0].description.includes('source updated'));
}
const invalid=await siteLeagueCommand({type:2,data:{name:'standings'}},source,async()=>Response.json({}));
assert.ok(invalid.data.content.includes('unavailable'));
const missing=await siteLeagueCommand({type:2,data:{name:'schedule',options:[{name:'week',value:999}]}},source,async()=>Response.json(fixture));
assert.ok(missing.data.content.includes('not published'));
console.log('PASS website standings, schedule, team totals, source timestamps, redirect rejection, invalid payload and missing matchweek.');
