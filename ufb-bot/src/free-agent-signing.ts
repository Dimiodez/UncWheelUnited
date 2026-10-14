import type {Env} from './types';

export const competitionLabel=(values:string[],excluded:string[],choices:Array<{label:string;value:string}>)=>{
 const label=(v:string)=>choices.find(c=>c.value===v)?.label||v;
 return values.includes('all')?`All competitions${excluded.length?' except '+excluded.map(label).join(', '):''}`:values.filter(v=>!excluded.includes(v)).map(label).join(', ');
};

export async function rosteredCompetitions(e:Env,user:string,guild:string){
 const rows=await e.DB.prepare('SELECT DISTINCT l.squad_size FROM team_members tm JOIN teams t ON t.id=tm.team_id JOIN leagues l ON l.id=t.league_id WHERE l.guild_id=? AND tm.discord_id=? AND t.unassigned=0 AND l.is_system=0').bind(guild,user).all<{squad_size:number}>();
 return rows.results.map(r=>`${r.squad_size}v${r.squad_size}`);
}

export function competitionSigningUpdates(e:Env,user:string,guild:string|undefined,competition:string){
 return [
  e.DB.prepare("UPDATE recruitment_posts SET excluded_competitions=json_insert(excluded_competitions,'$[#]',?),revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE kind='free_agent' AND author_discord_id=? AND (guild_id=? OR guild_id IS NULL) AND active=1 AND NOT EXISTS(SELECT 1 FROM json_each(excluded_competitions) WHERE value=?)").bind(competition,user,guild||null,competition),
  e.DB.prepare("UPDATE recruitment_posts SET active=0 WHERE kind='free_agent' AND author_discord_id=? AND (guild_id=? OR guild_id IS NULL) AND active=1 AND NOT EXISTS(SELECT 1 FROM json_each(competitions) c WHERE c.value='all' OR NOT EXISTS(SELECT 1 FROM json_each(excluded_competitions) x WHERE x.value=c.value))").bind(user,guild||null),
  e.DB.prepare("UPDATE free_agent_deliveries SET status='pending',attempts=0,next_attempt=0 WHERE status='failed' AND post_id IN(SELECT id FROM recruitment_posts WHERE kind='free_agent' AND author_discord_id=? AND (guild_id=? OR guild_id IS NULL) AND revision>post_revision)").bind(user,guild||null)
 ];
}

// Included in the same transaction as the roster insertion: a failed signing
// cannot remove availability. All retains future cups while excluding this league.
export function signingUpdates(e:Env,user:string,guild:string|undefined,team:number){
 const key="(SELECT CAST(l.squad_size AS TEXT)||'v'||CAST(l.squad_size AS TEXT) FROM teams t JOIN leagues l ON l.id=t.league_id WHERE t.id=? AND t.unassigned=0 AND l.is_system=0)";
 return [
  e.DB.prepare(`UPDATE recruitment_posts SET excluded_competitions=json_insert(excluded_competitions,'$[#]',${key}),revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE kind='free_agent' AND author_discord_id=? AND (guild_id=? OR guild_id IS NULL) AND active=1 AND ${key} IS NOT NULL AND NOT EXISTS(SELECT 1 FROM json_each(excluded_competitions) WHERE value=${key})`).bind(team,user,guild||null,team,team),
  e.DB.prepare("UPDATE recruitment_posts SET active=0 WHERE kind='free_agent' AND author_discord_id=? AND (guild_id=? OR guild_id IS NULL) AND active=1 AND NOT EXISTS(SELECT 1 FROM json_each(competitions) c WHERE c.value='all' OR NOT EXISTS(SELECT 1 FROM json_each(excluded_competitions) x WHERE x.value=c.value))").bind(user,guild||null),
  e.DB.prepare("UPDATE free_agent_deliveries SET status='pending',attempts=0,next_attempt=0 WHERE status='failed' AND post_id IN(SELECT id FROM recruitment_posts WHERE kind='free_agent' AND author_discord_id=? AND (guild_id=? OR guild_id IS NULL) AND revision>post_revision)").bind(user,guild||null)
 ];
}
