import {freeAgentSelection,competitionOptions} from './free-agent-competitions';
import {rosteredCompetitions} from './free-agent-signing';
import {message} from './responses';
import type {DiscordInteraction,Env,InteractionResponse} from './types';
export async function expireFreeAgents(e:Env,now=Math.floor(Date.now()/1000)){
 for(const size of [6,10]){
  const competition=`${size}v${size}`;
  await e.DB.prepare("UPDATE recruitment_posts SET excluded_competitions=json_insert(excluded_competitions,'$[#]',?),revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE kind='free_agent' AND active=1 AND NOT EXISTS(SELECT 1 FROM json_each(excluded_competitions) WHERE value=?) AND EXISTS(SELECT 1 FROM team_members tm JOIN teams t ON t.id=tm.team_id JOIN leagues l ON l.id=t.league_id WHERE l.guild_id=recruitment_posts.guild_id AND tm.discord_id=recruitment_posts.author_discord_id AND t.unassigned=0 AND l.squad_size=?)").bind(competition,competition,size).run();
 }
 await e.DB.prepare("UPDATE recruitment_posts SET active=0 WHERE kind='free_agent' AND active=1 AND NOT EXISTS(SELECT 1 FROM json_each(competitions) c WHERE c.value='all' OR NOT EXISTS(SELECT 1 FROM json_each(excluded_competitions) x WHERE x.value=c.value))").run();
 await e.DB.prepare("UPDATE recruitment_posts SET active=0,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE kind='free_agent' AND active=1 AND expires_at IS NOT NULL AND expires_at<=?").bind(now).run();
}
export async function maintainFreeAgent(e:Env,i:DiscordInteraction):Promise<InteractionResponse>{
 const user=(i.member?.user??i.user)?.id,action=i.data?.options?.[0]?.name,opts=i.data?.options?.[0]?.options??[];
 if(!user||!i.guild_id)return message('Use this command in your Discord server.',true);
 const post=await e.DB.prepare("SELECT * FROM recruitment_posts WHERE author_discord_id=? AND kind='free_agent' AND (guild_id=? OR guild_id IS NULL) AND awaiting_competitions=0 ORDER BY id DESC LIMIT 1").bind(user,i.guild_id).first<{id:number;title:string;primary_positions:string;backup_positions:string;avoid_positions:string;contact:string;pitch:string;competitions:string}>();
 if(!post)return message('Create your first listing with /recruit freeagent.',true);
 const value=(key:string,fallback:string)=>String(opts.find(o=>o.name===key)?.value??fallback).trim();
 const exclusions=await rosteredCompetitions(e,user,i.guild_id),available=await competitionOptions(e,false,i.guild_id);
 const supplied=['league_1','league_2','league_3'].map(k=>value(k,'')).filter(Boolean);
 const selections=supplied.length?supplied:JSON.parse(post.competitions) as string[];
 const eligible=selections.filter(v=>available.some(c=>c.value===v)&&(v==='all'||!exclusions.includes(v)));
 if(!eligible.length){const rostered=selections.filter(v=>exclusions.includes(v));return message(rostered.length?`You are already rostered in ${rostered.join(', ')}, so that free-agent listing cannot be renewed. Use /recruit edit to select another competition, or have your manager release you first.`:'Those competitions are no longer available. Select a new competition with /recruit edit.',true);}
 if(supplied.some(v=>!available.some(c=>c.value===v)||exclusions.includes(v))||eligible.includes('all')&&eligible.length>1)return message('Choose eligible competitions, or All competitions alone.',true);
 const primary=value('primary',post.primary_positions),backup=value('backup',post.backup_positions),avoid=value('avoid',post.avoid_positions),contact=value('contact',post.contact),pitch=value('pitch_availability',post.pitch);
 if([primary,backup,avoid,contact,pitch].some(v=>!v||v.length>2000))return message('Keep listing fields non-empty and under 2,000 characters.',true);
 // Renewing creates a fresh post: a genuine bump, with durable deduplicated delivery.
 const created=await e.DB.prepare("INSERT INTO recruitment_posts(kind,author_discord_id,title,primary_positions,backup_positions,avoid_positions,contact,pitch,active,awaiting_competitions,guild_id) VALUES('free_agent',?,?,?,?,?,?,?,0,1,?)").bind(user,post.title,primary,backup,avoid,contact,pitch,i.guild_id).run();
 const result=await freeAgentSelection(e,{...i,type:3,data:{custom_id:`fa-competitions:${created.meta.last_row_id}`,values:eligible}});
 return {...result,type:4,data:{...result.data,content:`${action==='renew'?'Renewed':'Updated'} listing. Your seven-day window restarts. ${result.data?.content??''}`}};
}
