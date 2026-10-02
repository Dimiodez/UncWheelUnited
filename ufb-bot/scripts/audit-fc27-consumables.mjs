// Read-only audit of public EA FC27 responses. No bot or database writes.
const clubs=[['43521','FC Sandy Bums'],['96510','FC Mountains'],['64234','UFL Gladbach']];
const headers={
  accept:'application/json','accept-language':'en-US,en;q=0.9',
  'sec-ch-ua':'"Google Chrome";v="141", "Not?A_Brand";v="8", "Chromium";v="141"',
  'sec-fetch-site':'same-origin',
  'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
};
const keyword=/^(?:amps?|.*boost.*|.*consumab.*|.*loadout.*|perks?|.*archetype.*|vpro.*|pro(?:Name|Pos|Style|Height|Nationality|Overall|OverallStr)|.*attribute.*|.*master.*|.*playstyle.*|.*trait.*|.*inventory.*|.*equipped.*|.*expiry.*|.*expire.*|.*facilit.*|.*body.*|.*weight.*|.*level.*|.*skillpoint.*)$/i;
const explicit=/^(?:amps?|.*boost.*|.*consumab.*|.*loadout.*|perks?|.*inventory.*|.*equipped.*|.*expiry.*|.*expire.*|.*facilit.*|.*playstyle.*|.*master.*|.*attribute.*|.*body.*|.*weight.*|.*level.*|.*skillpoint.*)$/i;
const endpoints=[
  ['clubs/info','clubIds'],['clubs/overallStats','clubIds'],
  ['members/stats','clubId'],['members/career/stats','clubId'],
  ['clubs/matches','clubIds','leagueMatch'],
  ['clubs/matches','clubIds','playoffMatch'],
  ['clubs/matches','clubIds','friendlyMatch'],
  ['club/playoffAchievements','clubId'],
];

function inspect(value){
  const keys=new Set(),candidateValues=new Map();
  const visit=(node)=>{
    if(!node||typeof node!=='object')return;
    if(Array.isArray(node)){node.forEach(visit);return;}
    for(const [key,child] of Object.entries(node)){
      if(!/^\d+$/.test(key))keys.add(key);
      if(keyword.test(key)&&child!==undefined&&typeof child!=='object'){
        const values=candidateValues.get(key)||new Map();
        const text=String(child);
        values.set(text,(values.get(text)||0)+1);candidateValues.set(key,values);
      }
      visit(child);
    }
  };
  visit(value);
  return {keys:[...keys].sort(),explicitFields:[...keys].filter(key=>explicit.test(key)),
    candidateFields:Object.fromEntries([...candidateValues].map(([key,values])=>[key,Object.fromEntries(values)]))};
}

async function get(url){
  try{
    const response=await fetch(url,{headers,signal:AbortSignal.timeout(20000)});
    if(!response.ok)return {status:response.status,error:`HTTP ${response.status}`};
    return {status:response.status,data:await response.json()};
  }catch(error){return {status:null,error:String(error)};}
}

const allMatches=new Map();
const report={checkedAt:new Date().toISOString(),platform:'common-gen5',requests:[],summary:{}};
console.log(JSON.stringify({checkedAt:report.checkedAt,platform:report.platform,readOnly:true}));
for(const [clubId,clubName] of clubs){
  for(const [endpoint,param,type] of endpoints){
    const url=new URL(`https://proclubs.ea.com/api/fc/${endpoint}`);
    url.searchParams.set('platform','common-gen5');url.searchParams.set(param,clubId);
    if(type){url.searchParams.set('matchType',type);url.searchParams.set('maxResultCount','100');}
    const result=await get(url);
    const entry={clubId,clubName,endpoint,matchType:type||null,url:String(url),status:result.status,error:result.error};
    if(result.data!==undefined){
      Object.assign(entry,inspect(result.data));
      entry.records=Array.isArray(result.data)?result.data.length:result.data?.members?.length??Object.keys(result.data||{}).length;
      if(endpoint==='clubs/matches'&&Array.isArray(result.data))for(const match of result.data)allMatches.set(String(match.matchId),match);
      if(endpoint.startsWith('members/'))entry.odez=(result.data?.members||[]).filter(player=>String(player.name).toLowerCase()==='odez').map(player=>Object.fromEntries(Object.entries(player).filter(([key])=>keyword.test(key))));
    }
    report.requests.push(entry);
    console.log(JSON.stringify(entry));
  }
}

// Optional bounded follow-up: routes observed in public SDK source, not a
// guessed directory scan. Legacy per-player routes are not assumed to accept
// the modern match personaId; errors are recorded without calling them data.
if(process.argv.includes('--extended')){
  const extraRequests=[];
  const extra=async(endpoint,params,label)=>{
    const url=new URL(`https://proclubs.ea.com/api/fc/${endpoint}`);
    url.searchParams.set('platform','common-gen5');
    for(const [key,value] of Object.entries(params))url.searchParams.set(key,String(value));
    const result=await get(url);
    const entry={extended:true,label,endpoint,status:result.status,error:result.error,
      ...(result.data!==undefined?inspect(result.data):{})};
    if(result.data!==undefined)entry.records=Array.isArray(result.data)?result.data.length:Object.keys(result.data||{}).length;
    if(endpoint==='clubs/matches'&&Array.isArray(result.data))for(const match of result.data)allMatches.set(String(match.matchId),match);
    extraRequests.push(entry);console.log(JSON.stringify(entry));return result.data;
  };
  for(const [clubId,clubName] of clubs){
    for(const endpoint of ['allTimeLeaderboard/search','currentSeasonLeaderboard/search']){
      await extra(endpoint,{clubName},clubName);
    }
  }
  const topClubs=[];
  for(const endpoint of ['allTimeLeaderboard','currentSeasonLeaderboard']){
    const data=await extra(endpoint,{},'Public leaderboard schema');
    if(Array.isArray(data))for(const club of data.slice(0,2)){
      const id=club.clubId??club.clubInfo?.clubId;
      if(id!==undefined&&!topClubs.includes(String(id)))topClubs.push(String(id));
    }
  }
  // A friendly-match example ID comes from the public bot's scratch/test_ea.mjs.
  for(const clubId of ['12339',...topClubs.slice(0,2)]){
    for(const matchType of ['friendlyMatch','playoffMatch']){
      await extra('clubs/matches',{clubIds:clubId,matchType,maxResultCount:10},`Additional ${matchType} sample`);
    }
  }
  let sample;
  for(const match of allMatches.values()){
    for(const [clubId,players] of Object.entries(match.players||{})){
      for(const [playerId,player] of Object.entries(players)){
        if(String(player.playername||player.name).toLowerCase()==='odez')sample??={clubId,playerId};
      }
    }
  }
  if(sample){
    await extra(`members/${sample.playerId}/stats`,{filters:'pretty'},'Legacy player-specific route; personaId may differ from legacy blazeId');
    await extra(`clubs/${sample.clubId}/members/${sample.playerId}/stats`,{filters:'pretty'},'Legacy club-player route; personaId may differ from legacy blazeId');
  }
  const rows=[...allMatches.values()].flatMap(match=>Object.values(match.players||{}).flatMap(players=>Object.values(players)));
  console.log(JSON.stringify({extendedSummary:{requests:extraRequests.length,uniqueMatches:allMatches.size,
    playerRows:rows.length,...inspect(rows)}}));
}
const playerRows=[...allMatches.values()].flatMap(match=>Object.entries(match.players||{}).flatMap(([clubId,players])=>Object.entries(players).map(([playerId,row])=>({matchId:String(match.matchId),clubId,playerId,timestamp:match.timestamp,...row}))));
const odez=playerRows.filter(player=>String(player.playername||player.name).toLowerCase()==='odez');
report.summary={uniqueMatches:allMatches.size,playerRows:playerRows.length,uniquePlayers:new Set(playerRows.map(player=>player.playerId)).size,
  ...inspect(playerRows),odezRows:odez.map(player=>Object.fromEntries(Object.entries(player).filter(([key])=>keyword.test(key)||['matchId','clubId','timestamp'].includes(key))))};
console.log(JSON.stringify({summary:report.summary}));

for(const [clubId,clubName] of clubs){
  const url=`https://proclubs-api.onrender.com/api/clubs/${clubId}/matches?platform=common-gen5&type=leagueMatch`;
  const result=await get(url);
  console.log(JSON.stringify({relay:true,clubId,clubName,status:result.status,error:result.error,
    ...(result.data!==undefined?inspect(result.data):{})}));
}
