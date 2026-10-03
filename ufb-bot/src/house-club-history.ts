import {liveFeed, type ClubMatch, type LinkedTeam} from './match-watchers';
import type {Env} from './types';
export {normalizeFc27Matches} from './match-watchers';

export const SANDY_BUMS_ID='43521';
export const MOUNTAINS_ID='96510';
const SYNC_INTERVAL_MS=30*60*1000;
const LEASE_MS=3*60*1000;
const monthFormatter=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit'});

export function centralMonth(playedAt:number){
 const parts=monthFormatter.formatToParts(new Date(playedAt));
 return `${parts.find(part=>part.type==='year')?.value}-${parts.find(part=>part.type==='month')?.value}`;
}

function nonnegativeStat(value:string){const n=Number(value);return Number.isFinite(n)?Math.max(0,Math.trunc(n)):0;}
// EA uses 3.0 for a disconnected player. Keep their match row, but not that rating.
function validRating(value:string){const n=Number(value);return value==='—'||!Number.isFinite(n)||n<0||n>10||n===3?null:n;}

export function houseClubStatements(db:D1Database,match:ClubMatch,clubId:string){
 const club=match.clubs.find(item=>item.id===clubId);
 const opponent=match.clubs.find(item=>item.id!==clubId);
 if(!club||!opponent||!match.id||!Number.isFinite(match.playedAt))return [];
 const statements=[db.prepare(`INSERT INTO house_club_matches (club_id,match_id,played_at,local_month,opponent_name,goals_for,goals_against)
  VALUES (?,?,?,?,?,?,?) ON CONFLICT(club_id,match_id) DO UPDATE SET
  played_at=excluded.played_at,local_month=excluded.local_month,opponent_name=excluded.opponent_name,
  goals_for=excluded.goals_for,goals_against=excluded.goals_against`)
  .bind(clubId,match.id,match.playedAt,centralMonth(match.playedAt),opponent.name,club.score,opponent.score)];
 for(const player of club.players.filter(item=>item.human&&item.id)){
  statements.push(db.prepare(`INSERT INTO house_club_players (club_id,player_id,latest_name,first_seen_at,last_seen_at)
   VALUES (?,?,?,?,?) ON CONFLICT(club_id,player_id) DO UPDATE SET
   latest_name=CASE WHEN excluded.last_seen_at>=last_seen_at THEN excluded.latest_name ELSE latest_name END,
   first_seen_at=MIN(first_seen_at,excluded.first_seen_at),last_seen_at=MAX(last_seen_at,excluded.last_seen_at)`)
   .bind(clubId,player.id,player.name,match.playedAt,match.playedAt));
  statements.push(db.prepare(`INSERT INTO house_club_appearances (club_id,match_id,player_id,player_name,goals,assists,rating)
   VALUES (?,?,?,?,?,?,?) ON CONFLICT(club_id,match_id,player_id) DO UPDATE SET
   player_name=excluded.player_name,goals=excluded.goals,assists=excluded.assists,
   rating=excluded.rating`)
   .bind(clubId,match.id,player.id,player.name,nonnegativeStat(player.stats[2]),nonnegativeStat(player.stats[4]),validRating(player.stats[1])));
 }
 statements.push(db.prepare(`INSERT INTO house_club_match_details (club_id,match_id,details_json) VALUES (?,?,?)
  ON CONFLICT(club_id,match_id) DO UPDATE SET details_json=excluded.details_json`)
  .bind(clubId,match.id,JSON.stringify({...match,clubs:match.clubs.map(team=>({...team,players:team.players.filter(player=>player.human)}))})));
 return statements;
}
export const sandyBumsStatements=(db:D1Database,match:ClubMatch)=>houseClubStatements(db,match,SANDY_BUMS_ID);

export async function syncHouseClub(env:Env,clubId:string,clubName:string,now=Date.now(),feed=liveFeed(env)){
 const lease=await env.DB.prepare(`UPDATE house_club_sync SET lease_until=?,last_attempt_at=?
  WHERE club_id=? AND lease_until<? AND (last_success_at IS NULL OR last_success_at<=?)`)
  .bind(now+LEASE_MS,now,clubId,now,now-SYNC_INTERVAL_MS).run();
 if(!lease.meta.changes)return {skipped:true};
 try{
  const team:LinkedTeam={id:0,name:clubName,manager_discord_id:'',ea_club_id:clubId,ea_platform:'common-gen5',ea_crest_url:null};
  const matches=await feed(team);
  for(const match of matches){const statements=houseClubStatements(env.DB,match,clubId);if(statements.length)await env.DB.batch(statements);}
  await env.DB.prepare('UPDATE house_club_sync SET last_success_at=?,lease_until=0,last_error=NULL WHERE club_id=?').bind(now,clubId).run();
  return {skipped:false,matches:matches.length};
 }catch(error){
  await env.DB.prepare('UPDATE house_club_sync SET lease_until=0,last_error=? WHERE club_id=?').bind(String(error).slice(0,300),clubId).run();
  throw error;
 }
}
export const syncSandyBums=(env:Env,now=Date.now(),feed=liveFeed(env))=>syncHouseClub(env,SANDY_BUMS_ID,'FC Sandy Bums',now,feed);
export const syncMountains=(env:Env,now=Date.now(),feed=liveFeed(env))=>syncHouseClub(env,MOUNTAINS_ID,'FC Mountains',now,feed);

type MatchRow={match_id:string;played_at:number;opponent_name:string;goals_for:number;goals_against:number};
type PlayerRow={player_id:string;latest_name:string;appearances:number;goals:number;assists:number;average_rating:number|null};

export async function houseClubArchive(env:Env,clubId:string,clubName:string,month:string,matchId=''){
 const valid=month==='all'||/^\d{4}-(0[1-9]|1[0-2])$/.test(month);
 if(!valid)return new Response(JSON.stringify({error:'Invalid month.'}),{status:400,headers:{'content-type':'application/json'}});
 if(matchId&&!/^[a-zA-Z0-9_-]{1,64}$/.test(matchId))return Response.json({error:'Invalid match.'},{status:400});
 const filter=matchId?'AND match_id=?':month==='all'?'':'AND local_month=?';
 const matchesQuery=env.DB.prepare(`SELECT match_id,played_at,opponent_name,goals_for,goals_against FROM house_club_matches WHERE club_id=? ${filter} ORDER BY played_at DESC LIMIT 1000`);
 const matches=await (matchId?matchesQuery.bind(clubId,matchId):month==='all'?matchesQuery.bind(clubId):matchesQuery.bind(clubId,month)).all<MatchRow>();
 const playersQuery=env.DB.prepare(`SELECT p.player_id,p.latest_name,COUNT(a.match_id) AS appearances,
  COALESCE(SUM(a.goals),0) AS goals,COALESCE(SUM(a.assists),0) AS assists,
  ROUND(AVG(a.rating),2) AS average_rating FROM house_club_players p
  LEFT JOIN house_club_appearances a ON a.club_id=p.club_id AND a.player_id=p.player_id
  ${month==='all'?'':`AND a.match_id IN (SELECT match_id FROM house_club_matches WHERE club_id=? AND local_month=?)`}
  WHERE p.club_id=? GROUP BY p.player_id ORDER BY appearances DESC,goals DESC,assists DESC,p.latest_name COLLATE NOCASE`);
 const players=await (month==='all'?playersQuery.bind(clubId):playersQuery.bind(clubId,month,clubId)).all<PlayerRow>();
 const months=await env.DB.prepare('SELECT DISTINCT local_month FROM house_club_matches WHERE club_id=? ORDER BY local_month DESC').bind(clubId).all<{local_month:string}>();
 const sync=await env.DB.prepare('SELECT last_success_at,last_error FROM house_club_sync WHERE club_id=?').bind(clubId).first<{last_success_at:number|null;last_error:string|null}>();
 // Only send detailed sheets for the five visible results, not the entire archive.
 const recent=matches.results.slice(0,5);
 const detailed=await Promise.all(recent.map(async match=>{
  const saved=await env.DB.prepare('SELECT details_json FROM house_club_match_details WHERE club_id=? AND match_id=?').bind(clubId,match.match_id).first<{details_json:string}>();
  if(saved)return {...match,details:JSON.parse(saved.details_json)};
  const rows=await env.DB.prepare('SELECT player_id,player_name,goals,assists,rating FROM house_club_appearances WHERE club_id=? AND match_id=?').bind(clubId,match.match_id).all<{player_id:string;player_name:string;goals:number;assists:number;rating:number|null}>();
  return {...match,details:{partial:true,clubs:[{id:clubId,name:clubName,players:rows.results.map(player=>({id:player.player_id,name:player.player_name,stats:['—',player.rating===null?'—':player.rating.toFixed(1),String(player.goals),'—',String(player.assists),'—','—','—','—','—','—','—','—','—']}))}]}};
 }));
 return new Response(JSON.stringify({clubId,clubName,timeZone:'America/Chicago',month,months:months.results.map(row=>row.local_month),lastSyncedAt:sync?.last_success_at??null,syncDelayed:!!sync?.last_error,matches:matches.results.map((match,index)=>index<5?detailed[index]:match),players:players.results}),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=60'}});
}
export const sandyBumsArchive=(env:Env,month:string,matchId='')=>houseClubArchive(env,SANDY_BUMS_ID,'FC Sandy Bums',month,matchId);
export const mountainsArchive=(env:Env,month:string,matchId='')=>houseClubArchive(env,MOUNTAINS_ID,'FC Mountains',month,matchId);
