import {embed,message} from './responses';
import {leaderGroups,type LeaderFeed} from './league-leaders';
import type {DiscordInteraction,Env,InteractionResponse} from './types';

export type Season={syncedAt:string;statsSource?:string;teams:Record<string,string[]>;standings:Array<[string,number,number,number,number,number,number,number,number]>;weeks:Array<{week:number;date:string;matches:Array<[number,string,string,number|null,number|null]>}>};
export type LeagueSource={name:string;url:string};

export function validateSourceUrl(value:string){
 const url=new URL(value);
 if(url.protocol!=='https:'||!['uncfutbolleague.com','www.uncfutbolleague.com'].includes(url.hostname)||url.username||url.password||url.port||url.hash||!url.pathname.endsWith('.json'))throw new Error('Use a public HTTPS season-data JSON URL on uncfutbolleague.com.');
 return url.toString();
}
export function validateSeason(s:Season):Season{
 if(!s||!s.teams||!Array.isArray(s.standings)||!Array.isArray(s.weeks)||!Number.isFinite(Date.parse(s.syncedAt)))throw new Error('Invalid website league data');
 if(s.standings.some(r=>!Array.isArray(r)||r.length!==9||!s.teams[r[0]]||r.slice(1).some(n=>typeof n!=='number'||!Number.isFinite(n))))throw new Error('Invalid website standings');
 if(s.weeks.some(w=>!Number.isInteger(w.week)||!Array.isArray(w.matches)||w.matches.some(m=>m.length!==5||!s.teams[m[1]]||!s.teams[m[2]])))throw new Error('Invalid website fixtures');
 return s;
}
export async function fetchLeagueSeason(source:LeagueSource,fetcher:typeof fetch=fetch){
 // Cloudflare Workers does not implement redirect:"error". Manual mode keeps
 // cross-origin redirects from being followed; non-2xx responses fail below.
 const response=await fetcher(source.url,{cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(5000)});
 if(!response.ok)throw new Error(`Website returned ${response.status}`);
 const size=Number(response.headers.get('content-length')||0);
 if(size>1_000_000)throw new Error('Website feed is too large');
 const body=await response.text();if(body.length>1_000_000)throw new Error('Website feed is too large');
 return validateSeason(JSON.parse(body) as Season);
}
export async function resolveLeagueSource(e:Env,i:DiscordInteraction):Promise<LeagueSource|null>{
 const guild=i.guild_id??'',slug=String(i.data?.options?.find(o=>o.name==='league')?.value??'');
 if(!guild||!slug)return null;
 const league=await e.DB.prepare('SELECT name,source_url FROM leagues WHERE guild_id=? AND slug=? AND archived_at IS NULL AND is_system=0').bind(guild,slug).first<{name:string;source_url:string|null}>();
 if(!league?.source_url)return null;
 return {name:league.name,url:validateSourceUrl(league.source_url)};
}
const safe=(s:string)=>s.replace(/[@*_`~|]/g,'').slice(0,80);
export async function siteLeagueCommand(i:DiscordInteraction,source:LeagueSource,fetcher:typeof fetch=fetch):Promise<InteractionResponse>{
 try{
  const s=await fetchLeagueSeason(source,fetcher),name=i.data?.name;
  const page=`https://${new URL(source.url).hostname}`;
  const note=`[Website](${page}) · source updated <t:${Math.floor(Date.parse(s.syncedAt)/1000)}:f>\nLatest published website data.`;
  const team=(key:string)=>safe(s.teams[key]?.[0]??key);
  if(name==='standings')return embed(`${safe(source.name)} standings`,`${s.standings.map((r,n)=>`${n+1}. **${team(r[0])}** · ${r[8]} pts · P${r[1]} W${r[2]} D${r[3]} L${r[4]} · GD ${r[7]}`).join('\n')}\n\n${note}`);
  if(name==='leaguestats'){
   const players=(s as Season & LeaderFeed).leaderboards?.players;
   if(!players?.goals?.records?.length||!players?.assists?.records?.length||!players?.average_match_rating?.records?.length)return message(`**${safe(source.name)}** has no official player leaders published yet. Virtual Arena will populate them after matches are reported.`,true);
   const officialStats=s.statsSource&&/^https:\/\/ufl\.virtualarena\.app\/competitions\/\d+\/seasons\/\d+\/stats$/.test(s.statsSource)?s.statsSource:page;
   return embed(`${safe(source.name)} player leaders`,`[Official statistics](${officialStats})`,leaderGroups(s as Season & LeaderFeed).map(g=>({name:g.title,value:g.rows.map((r,n)=>`${n+1}. **${safe(r.data.name)}** · ${safe(String(r.stat))} · ${safe(r.team?.name||'')}`).join('\n'),inline:true})));
  }
  if(name==='schedule'){
   const requested=Number(i.data?.options?.find(o=>o.name==='week')?.value);
   const week=s.weeks.find(w=>w.week===requested)||(requested?undefined:s.weeks.find(w=>w.matches.some(m=>m[3]===null||m[4]===null))??s.weeks.at(-1));
   if(!week)return message('That matchweek is not published on the website.',true);
   return embed(`${safe(source.name)} — Week ${week.week}`,`${safe(week.date)}\n${week.matches.map(m=>`**${team(m[1])}** vs **${team(m[2])}** · ${m[3]===null||m[4]===null?'Not played':`${m[3]}–${m[4]}`}`).join('\n')}\n\n${note}`);
  }
  return message('Unsupported website league command.',true);
 }catch{return message('The linked website league feed is unavailable or incomplete. Please ask an administrator to check /setup leaguesource.',true);}
}
