import {message} from './responses';
import {statSheetSvg} from './stat-sheet';
import {consumeCooldown} from './cooldowns';
import type {DiscordInteraction,Env,InteractionResponse} from './types';
import {leagueStaff} from './permissions';
import {backgrounds,randomBackground} from './backgrounds';
import {managesTeam} from './team-selectors';

export {backgrounds,matchBackground,randomBackground} from './backgrounds';
const AUTO_FEED_LOOKBACK_MS=15*60*1000;
export const humanRows=(club:ClubMatch['clubs'][number])=>club.players.filter(p=>p.human).map(p=>[p.motm?`★ ${p.name}`:p.name,p.stats[0],p.stats[1],p.stats[2],p.stats[3],p.stats[4],p.stats[9],p.stats[10],p.stats[11],p.stats[13]]);
export type LinkedTeam={id:number;name:string;manager_discord_id:string;ea_club_id:string|null;ea_platform:string|null;ea_crest_url:string|null};
type Watch={id:number;guild_id:string;channel_id:string;created_by:string;kind:string;team_a:number;team_b:number|null;started_at:number;deadline:number;last_match_at:number;background:string;selected_match:string|null;idle_ms:number};
export type ClubMatch={id:string;playedAt:number;clubs:Array<{id:string;name:string;score:number;players:Array<{id:string;name:string;human:boolean;motm?:boolean;stats:string[]}>}>};
export type MatchFeed=(team:LinkedTeam)=>Promise<ClubMatch[]>;
type RelayRecord=Record<string,unknown>;
const options=(i:DiscordInteraction)=>i.data?.name==='automode'?i.data.options?.[0]?.options:i.data?.options;
const val=(i:DiscordInteraction,n:string)=>String(options(i)?.find(o=>o.name===n)?.value??'');
const actor=(i:DiscordInteraction)=>(i.member?.user??i.user)?.id??'';
const staff=(e:Env,i:DiscordInteraction)=>leagueStaff(e,i);
const team=(e:Env,id:string|number,guild:string)=>e.DB.prepare('SELECT t.id,t.name,t.manager_discord_id,t.ea_club_id,t.ea_platform,t.ea_crest_url FROM teams t JOIN leagues l ON l.id=t.league_id WHERE l.guild_id=? AND t.id=? AND t.dissolved_at IS NULL').bind(guild,id).first<LinkedTeam>();
export async function statsTeamAutocomplete(e:Env,i:DiscordInteraction):Promise<InteractionResponse>{
 const opts=options(i)??[],focus=opts.find(o=>o.focused);if(!focus||!['team','team_a','team_b'].includes(focus.name))return {type:8,data:{choices:[]}};
 const league=String(opts.find(o=>o.name==='league')?.value??''),automode=i.data?.name==='automode';
 const rows=await e.DB.prepare(`SELECT t.id,t.name,t.unassigned,CASE WHEN t.unassigned=1 THEN NULL ELSE l.name END AS league_name FROM teams t JOIN leagues l ON l.id=t.league_id WHERE l.guild_id=? AND t.dissolved_at IS NULL AND t.name LIKE ? AND (?='' OR (t.unassigned=0 AND (l.slug=? OR l.name=?))) AND (?=0 OR t.ea_club_id IS NOT NULL) ORDER BY t.unassigned DESC,l.name,t.name LIMIT 25`).bind(i.guild_id??'',`%${focus.value??''}%`,league,league,league,automode?1:0).all<LinkedTeam&{league_name:string|null;unassigned:number}>();
 return {type:8,data:{choices:rows.results.map(t=>({name:`${t.name} — ${t.league_name??'Unassigned'}`.slice(0,100),value:String(t.id)}))}};
}
export async function matchAutocomplete(e:Env,i:DiscordInteraction):Promise<InteractionResponse>{
 const opts=options(i)??[],guild=i.guild_id??'',a=await team(e,String(opts.find(o=>o.name==='team_a')?.value??''),guild),b=await team(e,String(opts.find(o=>o.name==='team_b')?.value??''),guild);
 if(!a?.ea_club_id||!b?.ea_club_id)return {type:8,data:{choices:[]}};
 try{const matches=(await liveFeed(e)(a)).filter(m=>m.clubs.some(c=>c.id===a.ea_club_id)&&m.clubs.some(c=>c.id===b.ea_club_id)).slice(0,25);return {type:8,data:{choices:matches.map(m=>({name:`${m.clubs.map(c=>`${c.name} ${c.score}`).join(' — ')} · ${new Date(m.playedAt).toLocaleDateString('en-US',{month:'short',day:'numeric'})}`.slice(0,100),value:m.id}))}};}catch{return {type:8,data:{choices:[]}};}
}
const recentParts=(i:DiscordInteraction)=>i.data?.custom_id?.split(':')??[];
async function recentTeam(e:Env,i:DiscordInteraction,prefix:string){const [kind,teamId,matchId,owner,background]=recentParts(i),user=actor(i);if(kind!==prefix||!teamId||!matchId||user!==owner||!i.guild_id)return null;const selected=await team(e,teamId,i.guild_id);if(!selected?.ea_club_id||!staff(e,i)&&!await managesTeam(e,selected.id,user))return null;return {selected,matchId,user,owner,background:backgrounds.includes(background as typeof backgrounds[number])?background:undefined};}
export async function publishRecentPreview(e:Env,i:DiscordInteraction){
 const endpoint=`https://discord.com/api/v10/webhooks/${i.application_id}/${i.token}/messages/@original`,chosen=await recentTeam(e,i,'recent-sheet');
 try{
  if(!chosen)throw new Error('This private match control is invalid or you no longer manage the team.');
  const wait=await consumeCooldown(e,i,`recent-sheet:${chosen.selected.id}`,30);if(wait)throw new Error(`Please wait ${wait} seconds before generating another match sheet.`);
  const match=(await liveFeed(e)(chosen.selected)).find(m=>m.id===chosen.matchId);if(!match)throw new Error('That match is no longer available from the recent FC27 feed.');
  const club=match.clubs.find(c=>c.id===chosen.selected.ea_club_id),opponent=match.clubs.find(c=>c.id!==chosen.selected.ea_club_id);if(!club||!opponent)throw new Error('The selected FC27 match does not include this club.');
  const background=randomBackground(),image=await png(e,background,club,opponent,false,chosen.selected.ea_crest_url),form=new FormData(),filename=`ufb-${chosen.selected.id}-${match.id}.png`;
  form.set('payload_json',JSON.stringify({content:`Private preview · **${club.name} ${club.score}–${opponent.score} ${opponent.name}**\nChoose where to publish it. Nothing is public until you select a channel.`,flags:64,allowed_mentions:{parse:[]},attachments:[{id:0,filename}],components:[{type:1,components:[{type:8,custom_id:`recent-publish:${chosen.selected.id}:${match.id}:${chosen.owner}:${background}`,placeholder:'Publish to a Discord channel',channel_types:[0,5],min_values:1,max_values:1}]}]}));
  form.set('files[0]',new Blob([image.buffer as ArrayBuffer],{type:'image/png'}),filename);
  const response=await fetch(endpoint,{method:'PATCH',body:form,signal:AbortSignal.timeout(20000)});if(!response.ok)throw new Error(`Discord preview returned ${response.status}`);
 }catch(error){console.error('Recent sheet preview failed',error);await fetch(endpoint,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({content:error instanceof Error?error.message:'The private preview could not be generated.',flags:64,components:[],allowed_mentions:{parse:[]}}),signal:AbortSignal.timeout(10000)}).catch(()=>console.error('Recent preview error reply failed'));}
}
export async function recentPublishComponent(e:Env,i:DiscordInteraction):Promise<InteractionResponse>{
 const chosen=await recentTeam(e,i,'recent-publish'),channel=i.data?.values?.[0];if(!chosen||!i.guild_id||!channel)return message('This private publishing control is invalid or expired.',true);
 const now=Date.now();await e.DB.prepare('INSERT INTO match_watchers(guild_id,channel_id,created_by,kind,team_a,team_b,started_at,deadline,last_match_at,background,selected_match,idle_ms) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').bind(i.guild_id,channel,chosen.user,'game',chosen.selected.id,null,0,now+10*60000,now,chosen.background??randomBackground(),chosen.matchId,0).run();
 return {type:7,data:{content:`Publishing queued for <#${channel}>. The finished sheet will appear there on the next background check, usually within a minute.`,flags:64,components:[]}};
}
export async function watcherCommand(e:Env,i:DiscordInteraction):Promise<InteractionResponse>{
 if(!i.guild_id||!i.channel_id||!actor(i))return message('Use this command inside a Discord server.',true);
 const action=i.data?.options?.[0]?.name,name=i.data?.name;
 if(name==='automode'&&action==='status'){const rows=await e.DB.prepare("SELECT w.id,t.name,w.deadline,w.last_error FROM match_watchers w JOIN teams t ON t.id=w.team_a WHERE guild_id=? AND channel_id=? AND kind='auto' AND status='pending'").bind(i.guild_id,i.channel_id).all<{id:number;name:string;deadline:number;last_error:string|null}>();return message(rows.results.map(w=>`#${w.id} **${w.name}** · stops <t:${Math.floor(w.deadline/1000)}:R>${w.last_error?' · API/rendering check unavailable':''}`).join('\n')||'No active automatic match watchers in this channel.',true);}
 const a=await team(e,val(i,name==='automode'?'team':'team_a'),i.guild_id);if(!a)return message('Choose a registered team from the suggestion list.',true);
 if(!staff(e,i)&&!await managesTeam(e,a.id,actor(i)))return message('Only the selected team’s manager or a member with the Manager role can start or stop match monitoring.',true);
 if(name==='automode'&&action==='stop'){const stopped=await e.DB.prepare("UPDATE match_watchers SET status='stopped' WHERE guild_id=? AND channel_id=? AND team_a=? AND kind='auto' AND status='pending'").bind(i.guild_id,i.channel_id,a.id).run();return message(stopped.meta.changes?'Automatic match posts stopped.':'No active watcher for that team in this channel.',true);}
 const b=name==='gamestats'?await team(e,val(i,'team_b'),i.guild_id):null;if(name==='gamestats'&&(!b||b.id===a.id))return message('Choose two different registered teams.',true);
 const demo=val(i,'demo')==='true';if(demo&&!staff(e,i))return message('Only the Manager role can generate fictional demo sheets.',true);
 if(!demo&&(!a.ea_club_id||(b&&!b.ea_club_id)))return message('Each selected team must be linked to its EA FC 27 club. Use `/gamestats` with demo:true only when you want fictional image tests without linking or recording results.',true);
 if(!demo&&b&&a.ea_platform!==b.ea_platform)return message('Both EA clubs must use the same platform group.',true);
 const now=Date.now(),minutes=Math.min(60,Math.max(5,Number(val(i,'timeout'))||15)),idle=Math.min(240,Math.max(15,Number(val(i,'idle_minutes'))||60)),background='random';
 const wait=await consumeCooldown(e,i,`${name}:${a.id}`,name==='gamestats'?30:15);if(wait)return message(`Please wait ${wait} seconds before starting this again.`,true);
 try{await e.DB.prepare('INSERT INTO match_watchers(guild_id,channel_id,created_by,kind,team_a,team_b,started_at,deadline,last_match_at,background,selected_match,idle_ms) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').bind(i.guild_id,i.channel_id,actor(i),demo?'demo':name==='automode'?'auto':'game',a.id,b?.id??null,now,now+(name==='automode'?idle:minutes)*60000,now,background,val(i,'match_id')||null,idle*60000).run();}catch(err){if(String(err).includes('UNIQUE'))return message('Automatic monitoring is already active for this team in this channel.',true);throw err;}
 return message(demo?'Demo queued. Two fictional PNG stat sheets will be posted here on the next background check (about a minute). No live results or player records will be changed.':name==='gamestats'?`Searching recent FC27 history first. If exactly one match is found, both team sheets will post on the next check (usually within a minute). If no match is available yet, UFB will keep checking for ${minutes} minutes for EA’s delayed update. If several matches are found, choose the specific match with the optional match picker. ${e.EA_MATCHES_ENABLED!=='true'?'EA detection is currently unavailable; no real stats will be fabricated.':''}`:`Monitoring started in this channel. Checks run about once a minute; the first scan includes the previous 15 minutes to absorb EA reporting delays, and monitoring stops after ${idle} minutes without a newly posted match. ${e.EA_MATCHES_ENABLED!=='true'?'EA detection is currently unavailable; no real stats will be fabricated.':''}`);
}

// Accept only the versioned, verified feed contract. Do not guess FC27's payload.
export function validateFeed(raw:unknown):ClubMatch[]{
 if(!Array.isArray(raw))throw new Error('Unsupported EA feed response');
 return raw.map(value=>{const m=value as ClubMatch;if(!m||typeof m.id!=='string'||!Number.isFinite(m.playedAt)||!Array.isArray(m.clubs)||m.clubs.length!==2)throw new Error('Invalid match identity');for(const c of m.clubs){if(typeof c.id!=='string'||typeof c.name!=='string'||!Number.isInteger(c.score)||c.score<0||!Array.isArray(c.players))throw new Error('Invalid club match');for(const p of c.players){if(typeof p.id!=='string'||typeof p.name!=='string'||typeof p.human!=='boolean'||p.motm!==undefined&&typeof p.motm!=='boolean'||!Array.isArray(p.stats)||p.stats.length!==14||p.stats.some(s=>typeof s!=='string'))throw new Error('Invalid human-player stat record');}}return m;});
}

const record=(value:unknown):RelayRecord|null=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as RelayRecord:null;
const scalar=(value:unknown)=>typeof value==='string'||typeof value==='number'?String(value):'';
const numeric=(value:unknown)=>{const parsed=Number(value);return Number.isFinite(parsed)?parsed:0;};
const integer=(value:unknown)=>Math.max(0,Math.trunc(numeric(value)));
const position=(value:unknown)=>{const raw=scalar(value).toLowerCase();if(raw.includes('goal'))return 'GK';if(raw.includes('def'))return 'DEF';if(raw.includes('mid'))return 'MID';if(raw.includes('for')||raw.includes('att'))return 'FWD';return scalar(value)||'—';};
const ratio=(made:number,attempted:number)=>attempted?`${made} / ${attempted} (${Math.round(made/attempted*100)}%)`:`${made} / ${attempted} (0%)`;
const unavailable='—';

function relayPlayers(value:unknown,clubId:string){
 const players=record(value);if(!players)return [];
 const flattened:Array<{key:string;player:RelayRecord;clubId:string}>=[];
 for(const [key,candidate] of Object.entries(players)){
  const direct=record(candidate);if(!direct)continue;
  if('name' in direct||'playername' in direct||'vProName' in direct)flattened.push({key,player:direct,clubId:scalar(direct.clubId)});
  else for(const [playerId,nested] of Object.entries(direct)){const player=record(nested);if(player)flattened.push({key:playerId,player,clubId:key});}
 }
 return flattened.filter(item=>item.clubId===clubId).map(({key,player})=>{
  const passAttempts=integer(player.passes??player.passattempts),passesMade=integer(player.passesCompleted??player.passesmade);
  const tackleAttempts=integer(player.tackles??player.tackleattempts),tacklesMade=integer(player.tacklesWon??player.tacklesmade);
  const rating=numeric(player.rating);
  return {id:scalar(player.playerId)||key,name:scalar(player.name??player.playername??player.vProName)||'Unknown player',human:true,motm:integer(player.manOfTheMatch)===1,stats:[position(player.position??player.pos??player.vProPosition),rating?rating.toFixed(1):unavailable,String(integer(player.goals)),String(integer(player.shots)),String(integer(player.assists)),unavailable,unavailable,unavailable,unavailable,ratio(passesMade,passAttempts),ratio(tacklesMade,tackleAttempts),String(integer(player.interceptions)),unavailable,String(integer(player.saves))]};
 });
}

export function normalizeFc27Matches(raw:unknown):ClubMatch[]{
 if(!Array.isArray(raw))throw new Error('Unsupported FC27 relay response');
 return validateFeed(raw.map(value=>{
  const match=record(value);if(!match)throw new Error('Invalid FC27 match');
  const clubs=record(match.clubs);if(!clubs||Object.keys(clubs).length!==2)throw new Error('Invalid FC27 clubs');
  const played=numeric(match.timestamp??match.playedAt);
  return {id:scalar(match.matchId??match.id),playedAt:played<1_000_000_000_000?played*1000:played,clubs:Object.entries(clubs).map(([key,value])=>{const club=record(value);if(!club)throw new Error('Invalid FC27 club');const id=scalar(club.clubId)||key;return {id,name:scalar(club.clubName??club.name??record(club.details)?.name)||'Unknown club',score:integer(club.score??club.goals),players:relayPlayers(match.players,id)};})};
 }));
}

async function relayFeed(e:Env,t:LinkedTeam){
 if(!e.EA_API_BASE_URL)throw new Error('FC27 API relay unavailable');
 const base=new URL(e.EA_API_BASE_URL);if(base.protocol!=='https:')throw new Error('FC27 API relay must use HTTPS');
 const root=base.toString().replace(/\/$/,'');
 const responses=await Promise.allSettled(['leagueMatch','playoffMatch'].map(async type=>{const url=new URL(`${root}/clubs/${encodeURIComponent(t.ea_club_id??'')}/matches`);url.searchParams.set('platform',t.ea_platform??'common-gen5');url.searchParams.set('type',type);const response=await fetch(url,{headers:{accept:'application/json'},signal:AbortSignal.timeout(20000)});if(!response.ok)throw new Error(`FC27 ${type} feed returned ${response.status}`);return normalizeFc27Matches(await response.json());}));
 const available=responses.filter((result):result is PromiseFulfilledResult<ClubMatch[]>=>result.status==='fulfilled');
 if(!available.length)throw responses[0].status==='rejected'?responses[0].reason:new Error('FC27 match feed unavailable');
 const unique=new Map<string,ClubMatch>();available.flatMap(result=>result.value).forEach(match=>unique.set(match.id,match));return [...unique.values()].sort((a,b)=>b.playedAt-a.playedAt);
}
export const liveFeed=(e:Env):MatchFeed=>async t=>{
 if(e.EA_MATCHES_ENABLED!=='true')throw new Error('EA match feed unavailable');
 if(e.EA_MATCH_FEED_URL){const url=new URL(e.EA_MATCH_FEED_URL);if(url.protocol!=='https:')throw new Error('Match feed must use HTTPS');url.searchParams.set('clubId',t.ea_club_id??'');url.searchParams.set('platform',t.ea_platform??'');const response=await fetch(url,{signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error(`EA match feed returned ${response.status}`);return validateFeed(await response.json());}
 return relayFeed(e,t);
};
export function matchingGames(matches:ClubMatch[],w:Pick<Watch,'started_at'|'kind'|'selected_match'>,a:string,b?:string){
 // `/gamestats` is a historical lookup first: the selected clubs may have
 // finished before the command was run. Automode alone is forward-looking and
 // keeps its bounded backfill window so it does not publish an old session.
 const earliest=w.kind==='game'||w.selected_match?0:w.started_at-(w.kind==='auto'?AUTO_FEED_LOOKBACK_MS:0);
 return matches.filter(m=>m.playedAt>=earliest&&m.playedAt<=Date.now()+60000&&m.clubs.some(c=>c.id===a)&&(!b||m.clubs.some(c=>c.id===b))).sort((x,y)=>x.playedAt-y.playedAt);
}
async function send(e:Env,channel:string,content:string,files:Array<{name:string;bytes:Uint8Array}>=[],nonce?:string){
 const payload={content,allowed_mentions:{parse:[]},...(nonce?{nonce,enforce_nonce:true}:{}),attachments:files.map((f,id)=>({id,filename:f.name}))};const form=new FormData();form.set('payload_json',JSON.stringify(payload));files.forEach((f,id)=>form.set(`files[${id}]`,new Blob([new Uint8Array(f.bytes).buffer],{type:'image/png'}),f.name));
 const response=await fetch(`https://discord.com/api/v10/channels/${channel}/messages`,{method:'POST',headers:{authorization:`Bot ${e.DISCORD_BOT_TOKEN}`},body:form,signal:AbortSignal.timeout(20000)});if(!response.ok)throw new Error(`Discord post returned ${response.status}`);return (await response.json() as {id:string}).id;
}
async function crestData(url?:string|null){if(!url)return undefined;try{const parsed=new URL(url);if(parsed.protocol!=='https:'||!['eafc24.content.easports.com','www.uncfutbolleague.com','uncfutbolleague.com'].includes(parsed.hostname))return undefined;const response=await fetch(parsed,{signal:AbortSignal.timeout(5000)});const mime=response.headers.get('content-type')?.split(';')[0]??'';if(!response.ok||!['image/png','image/jpeg','image/webp'].includes(mime))return undefined;const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.length>1000000)return undefined;let binary='';for(let n=0;n<bytes.length;n+=8192)binary+=String.fromCharCode(...bytes.subarray(n,n+8192));return `data:${mime};base64,${btoa(binary)}`;}catch{return undefined;}}
export async function png(e:Env,background:string,club:ClubMatch['clubs'][number],opponent:ClubMatch['clubs'][number],demo:boolean,crestUrl?:string|null){
 const response=await e.ASSETS.fetch(`https://assets.local/${background}.png`);if(!response.ok)throw new Error('Stat background unavailable');const bytes=new Uint8Array(await response.arrayBuffer());let binary='';for(let n=0;n<bytes.length;n+=8192)binary+=String.fromCharCode(...bytes.subarray(n,n+8192));
 const players=humanRows(club);if(!players.length)throw new Error('No verified human-player stats available');if(players.length>11)throw new Error('Unexpected number of human players');
 const {default:puppeteer}=await import('../runtime/node_modules/@cloudflare/puppeteer/lib/esm/puppeteer/puppeteer-cloudflare.js');const browser=await puppeteer.launch(e.BROWSER);
 try{const page=await browser.newPage();await page.setViewport({width:1920,height:1080,deviceScaleFactor:1});const svg=statSheetSvg(club.name,opponent.name,`${club.score} — ${opponent.score}`,players,demo,'data:image/png;base64,'+btoa(binary),await crestData(crestUrl),club.players.find(player=>player.motm)?.name);await page.setContent(`<html><body style="margin:0">${svg}</body></html>`,{waitUntil:'load'});return new Uint8Array(await page.screenshot({type:'png'}));}finally{await browser.close();}
}
const demoMatch=(w:Watch,a:LinkedTeam,b:LinkedTeam|null):ClubMatch=>({id:`demo-${w.id}`,playedAt:Date.now(),clubs:[a,b??{...a,id:-1,name:'Demo opponent'}].map((t,n)=>({id:`demo-${t.id}`,name:t.name,score:n===0?3:1,players:Array.from({length:6},(_,j)=>({id:`demo-${t.id}-${j}`,name:`Demo Player ${j+1}`,human:true,motm:j===2&&n===0,stats:[['CAM','CM','ST','CDM','CB','GK'][j],j===2&&n===0?'9.4':'8.0',String(j===2?2:j===0?1:0),'3','1','0','2','5','3 / 2','24 / 30 (80%)','2 / 4 (50%)','2','1',j===5?'5':'—']}))}))});
export async function pollWatchers(e:Env,feed:MatchFeed=liveFeed(e),post=send,render=png,now=Date.now()){
 const pending=await e.DB.prepare("SELECT * FROM match_watchers WHERE status='pending' AND lease_until<? ORDER BY id LIMIT 10").bind(now).all<Watch>();
 for(const w of pending.results){const lease=await e.DB.prepare("UPDATE match_watchers SET lease_until=? WHERE id=? AND status='pending' AND lease_until<?").bind(now+300000,w.id,now).run();if(!lease.meta.changes)continue;
 try{
  if(now>=w.deadline){const changed=await e.DB.prepare("UPDATE match_watchers SET status='expired' WHERE id=? AND status='pending'").bind(w.id).run();if(changed.meta.changes)await post(e,w.channel_id,w.kind==='auto'?'Automatic match monitoring ended after inactivity.':e.EA_MATCHES_ENABLED!=='true'?'No game detected: EA match detection is still unavailable.':'No matching game detected before the request timed out.');continue;}
  const a=await team(e,w.team_a,w.guild_id),b=w.team_b?await team(e,w.team_b,w.guild_id):null;if(!a||(w.team_b&&!b))throw new Error('Selected team unavailable');
  const matches=(w.kind==='demo'?[demoMatch(w,a,b)]:matchingGames(await feed(a),w,a.ea_club_id??'',b?.ea_club_id??undefined)).filter(m=>!w.selected_match||m.id===w.selected_match);
  if(w.kind==='game'&&matches.length>1){await e.DB.prepare("UPDATE match_watchers SET status='ambiguous' WHERE id=?").bind(w.id).run();await post(e,w.channel_id,`Multiple recent games were found. No game was guessed. Run \`/gamestats\` with match_id to choose one:\n${matches.slice(-8).map(m=>`${m.id} · ${m.clubs.map(c=>`${c.name} ${c.score}`).join(' vs ')} · <t:${Math.floor(m.playedAt/1000)}:f>`).join('\n')}`);continue;}
  // Match IDs in stat_deliveries are the source of truth for deduplication. EA can
  // publish a newly discovered result with a timestamp slightly before watcher
  // startup (or before the previously discovered match), so timestamp gating here
  // would silently drop valid games.
  for(const m of matches){const ids=w.kind==='demo'?[`demo-${a.id}`,...(b?[`demo-${b.id}`]:[])]:[a.ea_club_id,...(b?[b.ea_club_id]:[])],selectedBackground=randomBackground();let delivered=false;
   for(let n=0;n<ids.length;n++){const club=m.clubs.find(c=>c.id===ids[n]),opponent=m.clubs.find(c=>c.id!==ids[n]);if(!club||!opponent)throw new Error('Match club mismatch');const teamId=n===0?a.id:b!.id;
    // Reserve before sending; ambiguous network failures are never blindly reposted.
    const exists=await e.DB.prepare('SELECT status FROM stat_deliveries WHERE guild_id=? AND channel_id=? AND match_id=? AND team_id=?').bind(w.guild_id,w.channel_id,m.id,teamId).first<{status:string}>();if(exists)continue;
    const linked=n===0?a:b!;const image=await render(e,selectedBackground,club,opponent,w.kind==='demo',linked.ea_crest_url);const reserved=await e.DB.prepare('INSERT OR IGNORE INTO stat_deliveries(guild_id,channel_id,match_id,team_id) VALUES (?,?,?,?)').bind(w.guild_id,w.channel_id,m.id,teamId).run();if(!reserved.meta.changes)continue;
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${w.guild_id}:${w.channel_id}:${m.id}:${teamId}`));const nonce=Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('').slice(0,24);
    const msg=await post(e,w.channel_id,`${w.kind==='demo'?'DEMO · Fictional statistics · ':''}${club.name} ${club.score}–${opponent.score} ${opponent.name} · ${club.name} human-player stats`,[{name:`ufb-${teamId}.png`,bytes:image}],nonce);await e.DB.prepare("UPDATE stat_deliveries SET status='sent',message_id=? WHERE guild_id=? AND channel_id=? AND match_id=? AND team_id=?").bind(msg,w.guild_id,w.channel_id,m.id,teamId).run();delivered=true;
   }
   if(delivered&&w.kind==='auto')await e.DB.prepare('UPDATE match_watchers SET last_match_at=?,deadline=?,last_error=NULL WHERE id=?').bind(m.playedAt,now+w.idle_ms,w.id).run();
   if(w.kind!=='auto'){const sent=await e.DB.prepare("SELECT COUNT(*) AS n FROM stat_deliveries WHERE guild_id=? AND channel_id=? AND match_id=? AND team_id IN (?,?) AND status='sent'").bind(w.guild_id,w.channel_id,m.id,a.id,b?.id??a.id).first<{n:number}>();if(sent?.n===ids.length)await e.DB.prepare("UPDATE match_watchers SET status='completed',last_error=NULL WHERE id=?").bind(w.id).run();}
  }
 }catch(error){console.error('Match watcher failed',w.id,error);await e.DB.prepare('UPDATE match_watchers SET last_error=? WHERE id=?').bind(String(error).slice(0,250),w.id).run();}
 finally{await e.DB.prepare('UPDATE match_watchers SET lease_until=0 WHERE id=?').bind(w.id).run();}
 }
}
