import {embed,message} from './responses';
import type {DiscordInteraction,Env,InteractionResponse} from './types';
import {botOwner} from './permissions';

const actor=(interaction:DiscordInteraction)=>(interaction.member?.user??interaction.user)?.id??'';
const row=(components:unknown[])=>({type:1,components});
const button=(label:string,id:string,style:number)=>({type:2,style,label,custom_id:id});

export async function resetOwner(env:Env,interaction:DiscordInteraction,request:typeof fetch=fetch){
 const user=actor(interaction);if(!user||!interaction.guild_id)return false;
 if(botOwner(env))return true;
 if(env.BOT_OWNER_DISCORD_ID&&user===env.BOT_OWNER_DISCORD_ID)return true;
 if(!env.DISCORD_BOT_TOKEN)return false;
 const headers={authorization:`Bot ${env.DISCORD_BOT_TOKEN}`};
 const [guildResult,appResult]=await Promise.allSettled([
  request(`https://discord.com/api/v10/guilds/${interaction.guild_id}`,{headers,signal:AbortSignal.timeout(10000)}),
  request('https://discord.com/api/v10/applications/@me',{headers,signal:AbortSignal.timeout(10000)})
 ]);
 const guild=guildResult.status==='fulfilled'&&guildResult.value.ok?await guildResult.value.json() as {owner_id?:string}:{};
 const app=appResult.status==='fulfilled'&&appResult.value.ok?await appResult.value.json() as {owner?:{id?:string};team?:{owner_user_id?:string}}:{};
 return guild.owner_id===user||app.owner?.id===user||app.team?.owner_user_id===user;
}

async function resetCounts(env:Env,guild:string){
 return await env.DB.prepare(`SELECT
  (SELECT COUNT(*) FROM leagues WHERE guild_id=? AND is_system=0) AS leagues,
  (SELECT COUNT(*) FROM teams t JOIN leagues l ON l.id=t.league_id WHERE l.guild_id=?) AS teams,
  (SELECT COUNT(*) FROM (SELECT tm.discord_id FROM team_members tm JOIN teams t ON t.id=tm.team_id JOIN leagues l ON l.id=t.league_id WHERE l.guild_id=? UNION SELECT discord_id FROM guild_player_claims WHERE guild_id=? UNION SELECT author_discord_id FROM recruitment_posts WHERE guild_id=?)) AS players,
  (SELECT COUNT(*) FROM team_members tm JOIN teams t ON t.id=tm.team_id JOIN leagues l ON l.id=t.league_id WHERE l.guild_id=?) AS roster_members,
  (SELECT COUNT(*) FROM guild_player_claims WHERE guild_id=?) AS claims,
  (SELECT COUNT(*) FROM recruitment_posts WHERE guild_id=?) AS recruiting,
  (SELECT COUNT(*) FROM matches m JOIN teams t ON t.id=m.team_id JOIN leagues l ON l.id=t.league_id WHERE l.guild_id=?) AS matches,
  (SELECT COUNT(*) FROM match_watchers WHERE guild_id=?) AS report_jobs`).bind(guild,guild,guild,guild,guild,guild,guild,guild,guild,guild).first<Record<string,number>>()??{};
}

export async function purgeGuild(env:Env,guild:string){
 await env.DB.batch([
  env.DB.prepare('DELETE FROM schedule_reminders WHERE occurrence_id IN (SELECT o.id FROM schedule_occurrences o JOIN schedule_series s ON s.id=o.series_id WHERE s.guild_id=?)').bind(guild),
  env.DB.prepare('DELETE FROM schedule_responses WHERE occurrence_id IN (SELECT o.id FROM schedule_occurrences o JOIN schedule_series s ON s.id=o.series_id WHERE s.guild_id=?)').bind(guild),
  env.DB.prepare('DELETE FROM schedule_occurrences WHERE series_id IN (SELECT id FROM schedule_series WHERE guild_id=?)').bind(guild),
  env.DB.prepare('DELETE FROM schedule_series WHERE guild_id=?').bind(guild),
  env.DB.prepare('DELETE FROM matchnight_responses WHERE matchnight_id IN (SELECT mn.id FROM matchnights mn JOIN teams t ON t.id=mn.team_id JOIN leagues l ON l.id=t.league_id WHERE l.guild_id=?)').bind(guild),
  env.DB.prepare('DELETE FROM matchnights WHERE team_id IN (SELECT t.id FROM teams t JOIN leagues l ON l.id=t.league_id WHERE l.guild_id=?)').bind(guild),
  env.DB.prepare('DELETE FROM match_player_stats WHERE match_id IN (SELECT m.id FROM matches m JOIN teams t ON t.id=m.team_id JOIN leagues l ON l.id=t.league_id WHERE l.guild_id=?)').bind(guild),
  env.DB.prepare('DELETE FROM matches WHERE team_id IN (SELECT t.id FROM teams t JOIN leagues l ON l.id=t.league_id WHERE l.guild_id=?)').bind(guild),
  env.DB.prepare('DELETE FROM stat_deliveries WHERE guild_id=?').bind(guild),env.DB.prepare('DELETE FROM match_watchers WHERE guild_id=?').bind(guild),
  env.DB.prepare('DELETE FROM free_agent_deliveries WHERE guild_id=?').bind(guild),env.DB.prepare('DELETE FROM recruitment_posts WHERE guild_id=?').bind(guild),env.DB.prepare('DELETE FROM free_agent_channels WHERE guild_id=?').bind(guild),
  env.DB.prepare('DELETE FROM cup_matches WHERE cup_id IN (SELECT id FROM cups WHERE guild_id=?)').bind(guild),env.DB.prepare('DELETE FROM cup_organizers WHERE cup_id IN (SELECT id FROM cups WHERE guild_id=?)').bind(guild),env.DB.prepare('DELETE FROM cup_entries WHERE cup_id IN (SELECT id FROM cups WHERE guild_id=?)').bind(guild),env.DB.prepare('DELETE FROM cups WHERE guild_id=?').bind(guild),
  env.DB.prepare('DELETE FROM draft_players WHERE draft_id IN (SELECT id FROM drafts WHERE guild_id=?)').bind(guild),env.DB.prepare('DELETE FROM draft_sides WHERE draft_id IN (SELECT id FROM drafts WHERE guild_id=?)').bind(guild),env.DB.prepare('DELETE FROM drafts WHERE guild_id=?').bind(guild),
  env.DB.prepare('DELETE FROM league_registration_schedules WHERE guild_id=?').bind(guild),
  env.DB.prepare('DELETE FROM team_members WHERE team_id IN (SELECT t.id FROM teams t JOIN leagues l ON l.id=t.league_id WHERE l.guild_id=?)').bind(guild),
  env.DB.prepare('DELETE FROM team_managers WHERE team_id IN (SELECT t.id FROM teams t JOIN leagues l ON l.id=t.league_id WHERE l.guild_id=?)').bind(guild),
  env.DB.prepare('DELETE FROM guild_player_claims WHERE guild_id=?').bind(guild),
  env.DB.prepare('DELETE FROM teams WHERE league_id IN (SELECT id FROM leagues WHERE guild_id=?)').bind(guild),env.DB.prepare('DELETE FROM leagues WHERE guild_id=?').bind(guild),env.DB.prepare('DELETE FROM command_cooldowns WHERE guild_id=?').bind(guild),
  env.DB.prepare('DELETE FROM help_centers WHERE guild_id=?').bind(guild),
  env.DB.prepare('DELETE FROM patch_deliveries WHERE guild_id=?').bind(guild),env.DB.prepare('DELETE FROM patch_channels WHERE guild_id=?').bind(guild),
  env.DB.prepare('DELETE FROM server_settings WHERE guild_id=?').bind(guild)
 ]);
}

export async function infoReset(env:Env,interaction:DiscordInteraction):Promise<InteractionResponse>{
 const user=actor(interaction),id=interaction.data?.custom_id??'',stage=id.split(':')[1]??'preview',owner=id.split(':')[2];
 if(!interaction.guild_id)return message('Run this command inside the Discord server you want to reset.',true);
 if(owner&&owner!==user)return message('Only the owner who opened this reset can continue it.',true);
 if(!await resetOwner(env,interaction))return message('Only the Discord server owner or the bot application owner can reset UFB data.',true);
 const counts=await resetCounts(env,interaction.guild_id);
 if(stage==='preview'){
  const response=embed('UFB data reset — first confirmation','Nothing has been deleted. This resets saved UFB data for this Discord only. Slash commands, bot code, command registration, installation permissions, and background images will remain.',[
   {name:'Competitions and teams',value:`${counts.leagues??0} league(s) · ${counts.teams??0} team(s) · ${counts.roster_members??0} roster membership(s)`},
   {name:'Players and recruiting',value:`${counts.players??0} saved player(s) · ${counts.claims??0} EA claim(s) · ${counts.recruiting??0} recruiting post(s)`},
   {name:'Reporting data',value:`${counts.matches??0} saved match(es) · ${counts.report_jobs??0} report job(s)`},
   {name:'Not deleted',value:'Slash commands and bot functionality. Existing Discord channels and already-posted Discord messages also remain.'}
  ]);response.data!.flags=64;response.data!.components=[row([button('I understand — continue',`info-reset:warning:${user}`,2)])];return response;
 }
 if(stage==='warning'){
  return {type:7,data:{flags:64,embeds:[{title:'Final warning — are you absolutely sure?',description:'**THIS WILL DELETE ALL TEAMS AND PLAYERS REGISTERED IN UFB FOR THIS DISCORD.**\n\nIt also removes leagues, rosters, EA player claims, linked clubs, recruiting listings, saved match data, active automode jobs, channel assignments, role settings, and UFB help-center tracking. This cannot be undone from Discord.\n\nSlash commands and bot functionality will remain installed.',color:0xd83c3e}],components:[row([button('Delete all UFB data',`info-reset:confirm:${user}`,4),button('Cancel',`info-reset:cancel:${user}`,2)])]}};
 }
 if(stage==='cancel')return {type:7,data:{content:'Reset cancelled. No data was deleted.',flags:64,embeds:[],components:[]}};
 if(stage!=='confirm')return message('This reset control is invalid or expired.',true);
 await purgeGuild(env,interaction.guild_id);
 return {type:7,data:{content:'UFB saved data for this Discord has been reset. Slash commands, bot code, command registration, installation permissions, and background images were preserved. Existing Discord channels and previously posted messages were not deleted.',flags:64,embeds:[],components:[]}};
}
