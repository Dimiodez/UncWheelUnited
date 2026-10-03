import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {basename,join,resolve,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';

const mountains=process.argv.includes('--mountains');
const clubId=mountains?'96510':'43521';
const clubName=mountains?'FC Mountains':'FC Sandy Bums';
const apply=process.argv.includes('--apply');
const headers={
 accept:'application/json','accept-language':'en-US,en;q=0.9',
 'sec-ch-ua':'"Google Chrome";v="141", "Not?A_Brand";v="8", "Chromium";v="141"',
 'sec-fetch-site':'same-origin',
 'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
};
const sleep=ms=>new Promise(done=>setTimeout(done,ms));

async function fetchMatches(id,type){
 const url=new URL('https://proclubs.ea.com/api/fc/clubs/matches');
 for(const [key,value] of Object.entries({platform:'common-gen5',clubIds:id,matchType:type,maxResultCount:'100'}))url.searchParams.set(key,value);
 const response=await fetch(url,{headers,signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw new Error(`EA ${type} feed returned ${response.status} for club ${id}`);
 const matches=await response.json();
 if(!Array.isArray(matches))throw new Error(`EA ${type} feed has an invalid shape for club ${id}`);
 return matches;
}

const sqlValue=value=>value===null||value===undefined?'NULL':typeof value==='number'
 ? Number.isFinite(value)?String(value):'NULL'
 : `'${String(value).replaceAll('\0','').replaceAll("'","''")}'`;
function sqlFor(statement){
 let index=0;
 const sql=statement.sql.replace(/\?/g,()=>sqlValue(statement.values[index++]));
 if(index!==statement.values.length)throw new Error('SQL placeholder mismatch');
 return `${sql};`;
}

const tempRoot=resolve(tmpdir());
const temp=await mkdtemp(join(tempRoot,'ufb-sandy-backfill-'));
try{
 const bundled=join(temp,'history.mjs');
 await build({entryPoints:['src/house-club-history.ts'],outfile:bundled,bundle:true,format:'esm',platform:'node',external:['cloudflare:*']});
 const {normalizeFc27Matches,houseClubStatements}=await import(pathToFileURL(bundled).href);
 const byId=new Map();
 for(const type of ['leagueMatch','playoffMatch','friendlyMatch']){
  const rows=await fetchMatches(clubId,type);
  console.log(`${type}: ${rows.length} EA matches`);
  rows.forEach(row=>{if(row?.clubs?.[clubId])byId.set(String(row.matchId),row);});
  await sleep(750);
 }
 const opponents=[...new Set([...byId.values()].map(row=>Object.keys(row.clubs).find(id=>id!==clubId)).filter(Boolean))];
 for(const opponentId of opponents){
  try{
   const rows=await fetchMatches(opponentId,'leagueMatch');
   rows.forEach(row=>{if(row?.clubs?.[clubId])byId.set(String(row.matchId),row);});
  }catch(error){console.warn(`Opponent ${opponentId}: ${String(error)}`);}
  await sleep(750);
 }
 const normalized=normalizeFc27Matches([...byId.values()]);
 const capture={prepare:sql=>({bind:(...values)=>({sql,values})})};
 const sql=normalized.flatMap(match=>houseClubStatements(capture,match,clubId).map(sqlFor)).join('\n');
 const sqlite=new DatabaseSync(':memory:');
 sqlite.exec(await readFile('migrations/0028_sandy_bums_history.sql','utf8'));
 sqlite.exec(await readFile('migrations/0031_house_match_details.sql','utf8'));
 sqlite.exec(sql);
 const count=sqlite.prepare('SELECT COUNT(*) AS n FROM house_club_matches').get().n;
 const players=sqlite.prepare('SELECT COUNT(*) AS n FROM house_club_players').get().n;
 const months=sqlite.prepare('SELECT local_month,COUNT(*) AS n FROM house_club_matches GROUP BY local_month ORDER BY local_month').all();
 const invalid=sqlite.prepare('SELECT COUNT(*) AS n FROM house_club_appearances WHERE rating=3.0').get().n;
 if(count!==normalized.length||invalid)throw new Error('Backfill validation failed');
 console.log(`Verified ${count} unique ${clubName} games, ${players} players, months ${months.map(row=>`${row.local_month}:${row.n}`).join(', ')}; no 3.0 ratings saved.`);
 if(!apply)console.log('Dry run only. Pass --apply to add these verified games to live D1.');
 else{
  const sqlFile=join(temp,'backfill.sql');
  await writeFile(sqlFile,sql,'utf8');
  const wrangler=resolve('node_modules/wrangler/bin/wrangler.js');
  // Query batches avoid the separate D1 import permission and Windows argument limits.
  const statements=normalized.flatMap(match=>houseClubStatements(capture,match,clubId).map(sqlFor));
  for(let index=0;index<statements.length;index+=4){
   const result=spawnSync(process.execPath,[wrangler,'d1','execute','unc-futbol-bot','--remote','--command',statements.slice(index,index+4).join('\n')],{stdio:'inherit',cwd:process.cwd(),timeout:120000});
   if(result.error)throw result.error;
   if(result.status!==0)throw new Error(`Wrangler exited ${result.status}`);
  }
  console.log(`Backfilled ${count} verified ${clubName} matches into live D1.`);
 }
}finally{
 const target=resolve(temp);
 if(!target.startsWith(tempRoot+sep)||!basename(target).startsWith('ufb-sandy-backfill-'))throw new Error('Unsafe temporary cleanup target');
 await rm(target,{recursive:true,force:true});
}
