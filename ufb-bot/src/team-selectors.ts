import type {DiscordInteraction,Env,InteractionResponse} from './types';
import {botOwner} from './permissions';
export type SelectedTeam={id:number;name:string;league_name:string|null;league_id:number;unassigned:number;manager_discord_id:string;ea_club_id:string|null;ea_club_name:string|null;ea_platform:string|null;ea_crest_url:string|null};
export const selectionOptions=(i:DiscordInteraction)=>i.data?.options?.find(o=>o.type===1)?.options??i.data?.options??[];
export async function selectedTeam(e:Env,value:string,guild:string,owner?:string,league?:string):Promise<SelectedTeam|null>{
 const selected=value.trim(),displayName=selected.split(/\s+—\s+/u)[0].trim();
 const selectedLeague=(league??'').trim(),leagueName=selectedLeague.split(/\s+—\s+/u)[0].trim();
 const rows=await e.DB.prepare(`SELECT t.*,CASE WHEN t.unassigned=1 THEN NULL ELSE l.name END AS league_name FROM teams t JOIN leagues l ON l.id=t.league_id WHERE l.guild_id=? AND t.dissolved_at IS NULL AND (CAST(t.id AS TEXT)=? OR t.name=? OR t.name=?) AND (?='' OR t.manager_discord_id=? OR EXISTS(SELECT 1 FROM team_managers mgr WHERE mgr.team_id=t.id AND mgr.discord_id=?)) AND (?='' OR (t.unassigned=0 AND (l.slug=? OR l.name=?))) LIMIT 2`).bind(guild,selected,selected,displayName,owner??'',owner??'',owner??'',selectedLeague,selectedLeague,leagueName).all<SelectedTeam>();
 // Never silently select the first of two clubs with the same name.
 return rows.results.length===1?rows.results[0]:null;
}
export async function managesTeam(e:Env,teamId:number,discordId:string):Promise<boolean>{
 return Boolean(await e.DB.prepare('SELECT 1 FROM team_managers WHERE team_id=? AND discord_id=? UNION SELECT 1 FROM teams WHERE id=? AND manager_discord_id=? LIMIT 1').bind(teamId,discordId,teamId,discordId).first());
}
export async function teamAutocomplete(e:Env,i:DiscordInteraction):Promise<InteractionResponse|null>{
 const options=selectionOptions(i),focus=options.find(o=>o.focused);
 if(!focus||!['team','team_a','team_b','entry'].includes(focus.name)||i.data?.name==='register')return null;
 const assigning=i.data?.name==='team'&&i.data.options?.[0]?.name==='assign';
 const league=assigning?'':String(options.find(o=>o.name==='league')?.value??'');
 const query=String(focus.value??'');
 const owned=!botOwner(e)&&(['sign','release','linkclub','reportmatch','matchnight'].includes(i.data?.name??'')||['recruit','recruiting'].includes(i.data?.name??'')||focus.name==='entry');
 const actor=(i.member?.user??i.user)?.id??'';
 const rows=await e.DB.prepare(`SELECT t.id,t.name,t.league_id,t.unassigned,CASE WHEN t.unassigned=1 THEN NULL ELSE l.name END AS league_name FROM teams t JOIN leagues l ON l.id=t.league_id WHERE l.guild_id=? AND t.dissolved_at IS NULL AND t.name LIKE ? AND (?='' OR (t.unassigned=0 AND l.slug=?)) AND (?=0 OR t.manager_discord_id=? OR EXISTS(SELECT 1 FROM team_managers mgr WHERE mgr.team_id=t.id AND mgr.discord_id=?)) ORDER BY t.unassigned DESC,l.name,t.name LIMIT 25`).bind(i.guild_id??'',`%${query}%`,league,league,owned?1:0,actor,actor).all<SelectedTeam>();
 return {type:8,data:{choices:rows.results.map(t=>({name:`${t.name} — ${t.league_name??'Unassigned'}`.slice(0,100),value:String(t.id)}))}};
}
