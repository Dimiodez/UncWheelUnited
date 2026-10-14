// Public EA data only. No Discord credentials, users, guilds or sessions.
import fs from 'node:fs/promises';
import path from 'node:path';
const output=path.resolve(process.env.FRIENDLY_OUTPUT||'bot-feed/data');
const config=JSON.parse(await fs.readFile(process.env.FRIENDLY_CONFIG||'bot-feed/clubs.json','utf8'));
let clubs=config.clubs.map(id=>({id,platform:config.platform}));
try {
  const r=await fetch('https://unc-futbol-bot.andrew-dimio.workers.dev/api/ea-clubs',{signal:AbortSignal.timeout(15000)});
  if(r.ok){const d=await r.json();if(Array.isArray(d.clubs)&&d.clubs.length)clubs=d.clubs;}
} catch { /* Initial reviewed list remains usable before the registry deploys. */ }
clubs=[...new Map(clubs.filter(c=>/^\d+$/.test(c.id)&&['common-gen5','nx'].includes(c.platform)).map(c=>[`${c.platform}:${c.id}`,c])).values()];
if(!clubs.length||clubs.length>250)throw Error('Invalid club registry');
await fs.mkdir(output,{recursive:true});
const safePlayer=p=>Object.fromEntries(['name','playername','vProName','pos','position','vProPosition','rating','goals','shots','assists','passesmade','passattempts','tacklesmade','tackleattempts','interceptions','mom','manOfTheMatch','saves'].filter(k=>['string','number'].includes(typeof p?.[k])).map(k=>[k,p[k]]));
function sanitize(m,clubId){
  if(!/^\d+$/.test(String(m.matchId))||!Number.isFinite(Number(m.timestamp))||!m.clubs?.[clubId]||Object.keys(m.clubs).length!==2)throw Error('Invalid EA friendly match');
  return {matchId:String(m.matchId),timestamp:Number(m.timestamp),clubs:Object.fromEntries(Object.entries(m.clubs).map(([id,c])=>[id,{clubId:id,score:c.goals??c.score,details:{name:c.details?.name||c.name||c.clubName||'Unknown club'}}])),players:Object.fromEntries(Object.entries(m.players||{}).map(([id,players])=>[id,Object.fromEntries(Object.entries(players||{}).map(([pid,p])=>[pid,safePlayer(p)]))]))};
}
let success=0,failed=0,next=0;
async function worker(){
  while(next<clubs.length){
    const club=clubs[next++],file=path.join(output,`${club.platform}-${club.id}.json`);
    let prior;try{prior=JSON.parse(await fs.readFile(file,'utf8'));}catch{}
    try {
      const url=new URL('https://proclubs.ea.com/api/fc/clubs/matches');
      for(const [k,v]of Object.entries({platform:club.platform,clubIds:club.id,matchType:'friendlyMatch',maxResultCount:'10'}))url.searchParams.set(k,v);
      let rows;
      for(let attempt=0;attempt<3;attempt++){
        try{const r=await fetch(url,{redirect:'manual',headers:{accept:'application/json','user-agent':'Mozilla/5.0'},signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error(`EA status ${r.status}`);rows=await r.json();if(!Array.isArray(rows))throw Error('Invalid EA result');break;}catch(error){if(attempt===2)throw error;await new Promise(resolve=>setTimeout(resolve,1500*(attempt+1)));}
      }
      const matches=[...new Map([...(prior?.matches||[]),...rows.map(m=>sanitize(m,club.id))].map(m=>[String(m.matchId),m])).values()].sort((a,b)=>Number(b.timestamp)-Number(a.timestamp)).slice(0,100);
      const data={clubId:club.id,platform:club.platform,matchType:'friendlyMatch',successAt:new Date().toISOString(),matches};
      await fs.writeFile(file,JSON.stringify(data));success++;console.log(`OK ${club.id}: ${rows.length} returned, ${matches.length} retained`);
    }catch(error){failed++;console.error(`FAILED ${club.id}: ${error.message}`);}
  }
}
await Promise.all(Array.from({length:3},worker));
console.log(JSON.stringify({success,failed,clubs:clubs.length}));
if(!success)throw Error('No friendly feeds refreshed; prior data preserved');
