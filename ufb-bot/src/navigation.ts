import {embed,message} from './responses';
import {competitionOptions} from './free-agent-competitions';
import {freeAgentChannelCommand} from './free-agent-channels';
import {liveFeed,type LinkedTeam} from './match-watchers';
import {selectedTeam} from './team-selectors';
import {publishHelpCenter} from './help-center';
import {setupPatchChannel} from './patch-notes';
import {botOwner,discordAdministrator,ufbAdministrator,ufbModerator} from './permissions';
import {roleIds,withStaffRoles,type StaffRoleSettings} from './staff-roles';
import type {DiscordInteraction,Env,InteractionResponse} from './types';
import {availableSlug,scopedSlug} from './guild-scope';
import {fetchLeagueSeason,validateSourceUrl} from './site-league';
import {leaderGroups} from './league-leaders';
type Dispatch=(i:DiscordInteraction)=>Promise<InteractionResponse>;
const actor=(i:DiscordInteraction)=>(i.member?.user??i.user)?.id??'';
const button=(label:string,id:string)=>({type:2,style:2,label,custom_id:id});
const row=(components:unknown[])=>({type:1,components});
const privateResult=(r:InteractionResponse)=>({...r,type:4,data:{...r.data,flags:64}});
const synthetic=(i:DiscordInteraction,name:string,action?:string,values:Record<string,string|number|boolean>={})=>({...i,type:2,data:{name,resolved:i.data?.resolved,options:action?[{name:action,type:1,options:Object.entries(values).map(([name,value])=>({name,value}))}]:Object.entries(values).map(([name,value])=>({name,value}))}});
export async function navigation(e:Env,i:DiscordInteraction,dispatch:Dispatch):Promise<InteractionResponse|null>{
 const id=i.data?.custom_id??'',name=i.data?.name;
 if(name==='setup'||id.startsWith('setup:'))return setup(e,i);
 if(name!=='ufb'&&!id.startsWith('hub:'))return null;
 const owner=actor(i);
 if(id&&id.split(':')[1]!==owner)return message('Open your own private panel with /ufb.',true);
 const [, ,action='home',arg='0']=id.split(':');
 if(action==='home'||!id){const r=embed('UFB — Your control panel','Choose a section. All controls here are private. Official league statistics and FC27 player statistics are separate.');r.data!.flags=64;r.data!.components=[row([button('My Team',`hub:${owner}:teams:0`),button('Stats',`hub:${owner}:stats:0`)])];return r;}
 if(['cups','drafts','cup','draft'].includes(action))return message('Cups, BYOT competitions and draft nights are in the workshop and are not currently published.',true);
 if(action==='renew')return privateResult(await dispatch(synthetic(i,'recruit','renew')));
 if(action==='edit'){
  const post=await e.DB.prepare("SELECT primary_positions,backup_positions,avoid_positions,contact,pitch FROM recruitment_posts WHERE author_discord_id=? AND kind='free_agent' AND guild_id=? AND awaiting_competitions=0 ORDER BY id DESC LIMIT 1").bind(owner,i.guild_id??'').first<Record<string,string>>();
  if(!post)return message('Create your first listing with /recruit freeagent.',true);
  return {type:9,data:{custom_id:`hub:${owner}:edit-save`,title:'Edit pitch and availability',components:[['primary','Top positions','primary_positions'],['backup','Backup positions','backup_positions'],['avoid','Do not want to play','avoid_positions'],['contact','Contact','contact'],['pitch_availability','Pitch and availability','pitch']].map(([key,label,field])=>row([{type:4,custom_id:key,label,style:key==='pitch_availability'?2:1,required:true,max_length:key==='pitch_availability'?2000:512,value:post[field].slice(0,key==='pitch_availability'?2000:512)}]))}};
 }
 if(action==='edit-save'){
  if(i.type!==5)return message('Submit the edit form to update your listing.',true);
  const fields=i.data?.components?.flatMap(r=>r.components)??[];
  return privateResult(await dispatch(synthetic(i,'recruit','edit',Object.fromEntries(fields.filter(f=>['primary','backup','avoid','contact','pitch_availability'].includes(f.custom_id)).map(f=>[f.custom_id,f.value])))));
 }
 if(action==='roster')return privateResult(await dispatch(synthetic(i,'roster',undefined,{team:arg})));
 if(['sign','release'].includes(action)){
  const team=await selectedTeam(e,arg,i.guild_id??'',botOwner(e)?undefined:owner);if(!team)return message('Only the registered manager can change this roster.',true);
  const member=i.data?.values?.[0];
  if(member)return privateResult(await dispatch(synthetic(i,action,undefined,{team:arg,member})));
  const r=message(`Choose a player to ${action} for ${team.name} — ${team.league_name}.`,true);r.data!.components=[row([{type:5,custom_id:`hub:${owner}:${action}:${arg}`,min_values:1,max_values:1}])];return r;
 }
 if(action==='browse')return privateResult(await dispatch(synthetic(i,'recruit','browse',{type:'free_agent'})));
 if(action==='profile')return privateResult(await dispatch(synthetic(i,'profile')));
 if(action==='agents'){const r=embed('Free agents','Listings last seven days. Renew creates a fresh bump. Edit changes your positions, contact and availability and restarts the timer. To change competitions, use `/recruit edit league_1:...`.\n\nCreate: `/recruit freeagent`');r.data!.flags=64;r.data!.components=[row([button('Browse listings',`hub:${owner}:browse`),button('Edit my listing',`hub:${owner}:edit`),button('Renew my listing',`hub:${owner}:renew`),button('Back',`hub:${owner}:home`)])];return r;}
 if(action==='stats'){
  const leagues=await e.DB.prepare('SELECT slug,name FROM leagues WHERE guild_id=? AND archived_at IS NULL AND is_system=0 ORDER BY name LIMIT 25').bind(i.guild_id??'').all<{slug:string;name:string}>();
  const r=embed('Statistics','**Official league:** goals, assists and average match rating from a source linked to this server’s league.\n**FC27 player:** overall Pro Clubs totals for a claimed EA player across linked clubs.\n**EA game sheets:** /gamestats and /automode require a verified live feed.');r.data!.flags=64;r.data!.components=[...(leagues.results.length?[row([{type:3,custom_id:`hub:${owner}:league`,options:leagues.results.map(x=>({label:x.name.slice(0,100),value:x.slug}))}])]:[]),row([button('My FC27 player totals',`hub:${owner}:manual`),button('Back',`hub:${owner}:home`)])];return r;}
 if(action==='league')return privateResult(await dispatch(synthetic(i,'leaguestats',undefined,{league:i.data?.values?.[0]??''})));
 if(action==='manual')return privateResult(await dispatch(synthetic(i,'playerstats')));
 if(['team','cup','draft'].includes(action)){
  const value=i.data?.values?.[0]??'';
  const result=privateResult(await dispatch(synthetic(i,action,action==='team'?undefined:'panel',{[action==='team'?'team':action]:value})));
  if(action==='team'&&result.data?.embeds?.length)result.data.components=[row([button('Roster',`hub:${owner}:roster:${value}`),button('Back',`hub:${owner}:home`)])];
  return result;
 }
 const page=Math.max(0,Number(arg)||0);
 let choices:Array<{label:string;value:string}>=[];
 if(action==='teams'){const rows=await e.DB.prepare('SELECT t.id,t.name,CASE WHEN t.unassigned=1 THEN NULL ELSE l.name END AS league_name FROM teams t JOIN leagues l ON l.id=t.league_id WHERE l.guild_id=? AND t.dissolved_at IS NULL AND (EXISTS(SELECT 1 FROM team_members m WHERE m.team_id=t.id AND m.discord_id=?) OR EXISTS(SELECT 1 FROM team_managers mgr WHERE mgr.team_id=t.id AND mgr.discord_id=?) OR t.manager_discord_id=?) ORDER BY t.unassigned DESC,l.name,t.name LIMIT 26 OFFSET ?').bind(i.guild_id??'',owner,owner,owner,page*25).all<{id:number;name:string;league_name:string|null}>();choices=rows.results.map(t=>({label:`${t.name} — ${t.league_name??'Unassigned'}`.slice(0,100),value:String(t.id)}));}
 if(action==='cups'){const rows=await e.DB.prepare('SELECT slug,name FROM cups WHERE guild_id=? ORDER BY id DESC LIMIT 26 OFFSET ?').bind(i.guild_id??'',page*25).all<{slug:string;name:string}>();choices=rows.results.map(c=>({label:c.name.slice(0,100),value:c.slug}));}
 if(action==='drafts'){const rows=await e.DB.prepare('SELECT id,name FROM drafts WHERE guild_id=? ORDER BY id DESC LIMIT 26 OFFSET ?').bind(i.guild_id??'',page*25).all<{id:number;name:string}>();choices=rows.results.map(c=>({label:c.name.slice(0,100),value:String(c.id)}));}
 const r=embed(action==='teams'?'My teams':action==='cups'?'Cups':'Drafts',choices.length?'Choose a competition or team below.':action==='teams'?'No roster memberships yet. Managers can register a club with /register; player-signing tools are in the workspace.':'No events on this page. Managers can create one with /cup create or /draft create.');r.data!.flags=64;r.data!.components=[...(choices.length?[row([{type:3,custom_id:`hub:${owner}:${action==='teams'?'team':action==='cups'?'cup':'draft'}`,options:choices.slice(0,25)}])]:[]),row([button('Back',`hub:${owner}:home`),...(page?[button('Previous',`hub:${owner}:${action}:${page-1}`)]:[]),...(choices.length>25?[button('Next',`hub:${owner}:${action}:${page+1}`)]:[])])];return r;
}
const competitionSlug=(name:string)=>name.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60);
async function setup(e:Env,i:DiscordInteraction):Promise<InteractionResponse>{
 if(!i.guild_id)return message('Run setup inside a Discord server.',true);
 const roleSettings=await e.DB.prepare('SELECT admin_role_id,moderator_role_id,manager_role_id,moderator_role_ids,manager_role_ids FROM server_settings WHERE guild_id=?').bind(i.guild_id).first<StaffRoleSettings>();
 e=withStaffRoles(e,roleSettings);
 const id=i.data?.custom_id??'',opts=i.data?.options?.[0]?.options??[],action=id?id.split(':')[1]:i.data?.options?.[0]?.name??'panel';
 if(!ufbAdministrator(e,i)&&!(action==='helpcenter'&&ufbModerator(e,i)))return message(action==='helpcenter'?'Only Discord administrators, configured UFB Administrators or Moderators, and the bot creator can refresh the Help Center.':'Only Discord server administrators and the configured UFB Administrator role can use setup.',true);
 const val=(key:string)=>String(opts.find(o=>o.name===key)?.value??'');
 const value=i.data?.values?.[0]??'';
 const moderators=roleIds(roleSettings?.moderator_role_ids,roleSettings?.moderator_role_id);
 const managers=roleIds(roleSettings?.manager_role_ids,roleSettings?.manager_role_id);
 const mentions=(ids:string[])=>ids.length?ids.map(id=>`<@&${id}>`).join(', '):'Not configured';
 const rolePanel=()=>{
  const r=embed('UFB — Staff roles',`Select every role that should count for each staff level. Each selection replaces that level’s current list; it does not change Discord permissions.\n\n**UFB Administrator:** ${mentions(roleSettings?.admin_role_id?[roleSettings.admin_role_id]:[])} — only a Discord Administrator or the bot owner can change this mapping.\n**Moderators:** ${mentions(moderators)}\n**Team Managers:** ${mentions(managers)}\n\nA role can belong to only one staff level.`);
  r.data!.flags=64;
  const defaults=(ids:string[])=>ids.length?{default_values:ids.map(id=>({id,type:'role'}))}:{};
  r.data!.components=[
   row([{type:6,custom_id:'setup:admin-role',placeholder:'UFB Administrator role',min_values:1,max_values:1,disabled:!discordAdministrator(i)&&!botOwner(e),...defaults(roleSettings?.admin_role_id?[roleSettings.admin_role_id]:[])}]),
   row([{type:6,custom_id:'setup:moderator-role',placeholder:'Select up to 4 Moderator roles',min_values:1,max_values:4,...defaults(moderators)}]),
   row([{type:6,custom_id:'setup:manager-role',placeholder:'Select up to 3 Team Manager roles',min_values:1,max_values:3,...defaults(managers)}]),
   row([button('Clear Moderator roles','setup:moderator-clear'),button('Clear Team Manager roles','setup:manager-clear')])
  ];
  return r;
 };
 if(action==='roles')return rolePanel();
 if(action==='moderator-clear'||action==='manager-clear'){
  const field=action==='moderator-clear'?'moderator':'manager';
  await e.DB.prepare(`INSERT INTO server_settings(guild_id,${field}_role_id,${field}_role_ids) VALUES(?,'','[]') ON CONFLICT(guild_id) DO UPDATE SET ${field}_role_id='',${field}_role_ids='[]'`).bind(i.guild_id).run();
  return message(`${field==='moderator'?'Moderator':'Team Manager'} role mappings cleared. Reopen \`/setup roles\` to review.`,true);
 }
 if(['role','admin-role','moderator-role','manager-role'].includes(action)&&i.data?.values?.length){
  const normalized=action==='role'?'manager-role':action;
  if(normalized==='admin-role'&&!discordAdministrator(i)&&!botOwner(e))return message('Only a Discord server Administrator or the bot owner can change the UFB Administrator role.',true);
  const selected=[...new Set(i.data.values)];
  const limit=normalized==='admin-role'?1:normalized==='moderator-role'?4:3;
  if(selected.length>limit||selected.includes(i.guild_id))return message(`Choose up to ${limit} named server role${limit===1?'':'s'}, not @everyone.`,true);
  if(normalized==='admin-role'&&selected.length!==1)return message('Choose exactly one UFB Administrator role.',true);
  const field=normalized==='admin-role'?'admin_role_id':normalized==='moderator-role'?'moderator_role_id':'manager_role_id';
  const labels:Record<string,string>={admin_role_id:'UFB Administrator',moderator_role_id:'Moderator',manager_role_id:'Team Manager'};
  const otherRoles=field==='admin_role_id'?[...moderators,...managers]:field==='moderator_role_id'?[roleSettings?.admin_role_id,...managers]:[roleSettings?.admin_role_id,...moderators];
  if(selected.some(id=>otherRoles.includes(id)))return message('A selected role already belongs to another staff level. Choose a different role for each level.',true);
  if(field==='admin_role_id')await e.DB.prepare('INSERT INTO server_settings(guild_id,admin_role_id) VALUES(?,?) ON CONFLICT(guild_id) DO UPDATE SET admin_role_id=excluded.admin_role_id').bind(i.guild_id,selected[0]).run();
  else{
   const kind=field==='moderator_role_id'?'moderator':'manager';
   await e.DB.prepare(`INSERT INTO server_settings(guild_id,${kind}_role_id,${kind}_role_ids) VALUES(?,?,?) ON CONFLICT(guild_id) DO UPDATE SET ${kind}_role_id=excluded.${kind}_role_id,${kind}_role_ids=excluded.${kind}_role_ids`).bind(i.guild_id,selected[0],JSON.stringify(selected)).run();
  }
  return message(`UFB now recognizes ${mentions(selected)} as **${labels[field]}**. This replaces that level’s previous selection.`,true);
 }
 if(action==='create'){
  const kind=val('type'),name=val('name').trim(),format=val('format'),rules=val('rules').trim(),baseSlug=competitionSlug(name),owner=actor(i);
  if(!owner||!name||name.length>80||!baseSlug)return message('Choose a competition type and a name of 1–80 characters.',true);
  await e.DB.prepare('INSERT INTO members(discord_id,display_name) VALUES (?,?) ON CONFLICT(discord_id) DO UPDATE SET display_name=excluded.display_name').bind(owner,(i.member?.user.global_name||i.member?.user.username||owner)).run();
  try{
   if(kind==='league_6v6'||kind==='league_10v10'||kind==='league_custom'){
    const requestedSize=Number(val('team_size')),size=kind==='league_6v6'?6:kind==='league_10v10'?10:requestedSize;
    if(!Number.isInteger(size)||size<1||size>11)return message('Custom leagues require a team_size from 1 through 11.',true);
    const slug=await availableSlug(e.DB,'leagues',i.guild_id,baseSlug,name);
    await e.DB.prepare('INSERT INTO leagues(slug,name,squad_size,registration_open,guild_id) VALUES(?,?,?,1,?)').bind(slug,name,size,i.guild_id).run();
    return embed('Official league created',`**${name}** is open for team registration.`,[{name:'Division',value:`${size}v${size}`,inline:true},{name:'League key',value:slug,inline:true},{name:'Next',value:`Managers use \`/register league:${slug} team:Their Team\`. Use \`/setup registration\` whenever registration should close.`}]);
   }
   if(kind==='cup_team'||kind==='cup_byot'){
    const mode=format||'knockout';if(!['knockout','draw','league','league_knockout'].includes(mode))return message('Choose a cup format: knockout, random draw, league table, or league then knockout.',true);
    const slug=await availableSlug(e.DB,'cups',i.guild_id,baseSlug,name);
    await e.DB.prepare('INSERT INTO cups(slug,name,entry_type,format,competition_mode,created_by,guild_id) VALUES(?,?,?,?,?,?,?)').bind(slug,name,kind==='cup_byot'?'byot':'team',mode==='draw'?'draw':'knockout',mode,owner,i.guild_id).run();
    return embed('Cup created',`**${name}** is open for registration.`,[{name:'Entries',value:kind==='cup_byot'?'BYOT teams':'Registered UFB teams',inline:true},{name:'Format',value:mode.replaceAll('_',' + '),inline:true},{name:'Next',value:`Managers use \`/cup register cup:${slug}\`. Manage it with \`/cup panel cup:${slug}\`.`}]);
   }
   if(kind==='draft'){
    const mode=format||'snake';if(!['snake','round_robin'].includes(mode))return message('Choose Snake draft or Round-robin draft order.',true);
    await e.DB.prepare('INSERT INTO drafts(guild_id,name,created_by,pick_mode,rules) VALUES(?,?,?,?,?)').bind(i.guild_id,name,owner,mode,rules||'Captains pick in order. Each player can join one side only.').run();
    return embed('Draft created',`**${name}** is open.`,[{name:'Pick order',value:mode==='snake'?'Snake':'Round robin',inline:true},{name:'Next',value:'Players use `/draft join`. Add captains with `/draft captain`, then use `/draft start`.'}]);
   }
   return message('Choose one of the supported competition types.',true);
  }catch(error){if(String(error).includes('UNIQUE')||String(error).includes('GUILD_NAME_EXISTS'))return message('A competition with that name already exists. Choose a different name.',true);throw error;}
 }
 if(action==='competitions'){
  const leagues=await e.DB.prepare('SELECT l.name,l.squad_size,l.registration_open,l.source_url,s.closes_at,s.channel_id FROM leagues l LEFT JOIN league_registration_schedules s ON s.league_id=l.id WHERE l.guild_id=? AND l.archived_at IS NULL AND l.is_system=0 ORDER BY l.id DESC LIMIT 20').bind(i.guild_id).all<{name:string;squad_size:number;registration_open:number;source_url:string|null;closes_at:number|null;channel_id:string|null}>();
  return embed('UFB — Configured leagues','Create another with `/setup create`.',[
   {name:'Official leagues',value:leagues.results.map(x=>`• **${x.name}** · ${x.squad_size}v${x.squad_size} · ${x.registration_open?'open':'closed'} · website ${x.source_url?'linked':'unlinked'}${x.closes_at?` · closes <t:${Math.floor(x.closes_at/1000)}:R> in <#${x.channel_id}>`:''}`).join('\n').slice(0,1024)||'_None_'}
  ]);
 }
 if(action==='leaguesource'){
  const slug=val('league'),raw=val('url').trim(),clear=val('clear')==='true';
  const league=await e.DB.prepare('SELECT id,name,source_url FROM leagues WHERE guild_id=? AND slug=? AND archived_at IS NULL AND is_system=0').bind(i.guild_id,slug).first<{id:number;name:string;source_url:string|null}>();
  if(!league)return message('Choose a league configured in this Discord server.',true);
  if(clear&&raw)return message('Choose a URL to link or clear:true, not both.',true);
  if(clear){await e.DB.prepare('UPDATE leagues SET source_url=NULL WHERE id=? AND guild_id=?').bind(league.id,i.guild_id).run();return message(`Website source removed from **${league.name}**.`,true);}
  if(!raw)return message(league.source_url?`**${league.name}** currently reads ${league.source_url}`:`**${league.name}** has no website source. Add a compatible season-data JSON URL with /setup leaguesource.`,true);
  try{
   const url=validateSourceUrl(raw),feed=await fetchLeagueSeason({name:league.name,url});
   leaderGroups(feed as Parameters<typeof leaderGroups>[0]);
   await e.DB.prepare('UPDATE leagues SET source_url=? WHERE id=? AND guild_id=?').bind(url,league.id,i.guild_id).run();
   return message(`**${league.name}** is linked to ${url}. Verified ${feed.standings.length} standings rows, ${feed.weeks.length} matchweeks and player leader categories.`,true);
  }catch(error){return message(`Website source was not saved: ${error instanceof Error?error.message:'invalid feed'}. Provide a public UFL website JSON feed with standings, schedule and player leaders.`,true);}
 }
 if(action==='team'){
  const slug=val('league'),name=val('name').trim(),owner=actor(i);
  if(!owner||!name||name.length>80)return message('Enter a team name of 1–80 characters.',true);
  const league=slug?await e.DB.prepare('SELECT id,name FROM leagues WHERE guild_id=? AND slug=? AND archived_at IS NULL AND is_system=0').bind(i.guild_id,slug).first<{id:number;name:string}>():null;if(slug&&!league)return message('Choose an active league from the suggestions.',true);
  await e.DB.prepare('INSERT INTO members(discord_id,display_name) VALUES (?,?) ON CONFLICT(discord_id) DO UPDATE SET display_name=excluded.display_name').bind(owner,(i.member?.user.global_name||i.member?.user.username||owner)).run();
  if(!league&&await e.DB.prepare('SELECT 1 FROM teams t JOIN leagues l ON l.id=t.league_id WHERE l.guild_id=? AND t.unassigned=1 AND t.manager_discord_id=? AND t.name=? AND t.dissolved_at IS NULL').bind(i.guild_id,owner,name).first())return message(`You already manage an unassigned team named **${name}**.`,true);
  const holdingSlug=scopedSlug(i.guild_id,`unassigned-${crypto.randomUUID()}`);
  try{if(league)await e.DB.prepare('INSERT INTO teams(league_id,name,manager_discord_id) VALUES(?,?,?)').bind(league.id,name,owner).run();else await e.DB.batch([e.DB.prepare("INSERT INTO leagues(slug,name,squad_size,registration_open,is_system,guild_id) VALUES(?,'Unassigned club',1,0,1,?)").bind(holdingSlug,i.guild_id),e.DB.prepare('INSERT INTO teams(league_id,name,manager_discord_id,unassigned) SELECT id,?,?,1 FROM leagues WHERE guild_id=? AND slug=?').bind(name,owner,i.guild_id,holdingSlug)]);}
  catch(error){if(String(error).includes('UNIQUE'))return message(`That team is already registered${league?' in this league':' without a league'}.`,true);throw error;}
  return embed('House/test team registered',league?`**${name}** is registered in **${league.name}** and managed by you.`:`**${name}** is registered without a league and managed by you.`,[{name:'Roster',value:'You were not added as a player, so you can administer multiple house teams without bypassing player roster protection.'},{name:'Next',value:league?'Use `/linkclub` to connect its EA club. Player-signing tools are in the workspace.':'Use `/linkclub` to connect its EA club, then `/team assign` when it should enter a league.'}]);
 }
 if(action==='removeleague'){
  const slug=val('league'),confirmed=val('confirm')==='true';
  const league=await e.DB.prepare('SELECT id,slug,name FROM leagues WHERE guild_id=? AND slug=? AND archived_at IS NULL AND is_system=0').bind(i.guild_id,slug).first<{id:number;slug:string;name:string}>();if(!league)return message('Choose an active league from the suggestions.',true);
  const count=await e.DB.prepare('SELECT COUNT(*) AS n FROM teams WHERE league_id=? AND unassigned=0 AND dissolved_at IS NULL').bind(league.id).first<{n:number}>();
  if(!confirmed)return message(`Nothing changed. Run \`/setup removeleague\` again with **confirm:true** to archive **${league.name}** and unassign its ${count?.n??0} active team(s).`,true);
  await e.DB.batch([
   e.DB.prepare('UPDATE teams SET unassigned=1 WHERE league_id=? AND dissolved_at IS NULL').bind(league.id),
   e.DB.prepare('UPDATE server_settings SET default_league=NULL WHERE default_league=?').bind(league.slug),
   e.DB.prepare('DELETE FROM league_registration_schedules WHERE league_id=?').bind(league.id),
   e.DB.prepare("UPDATE leagues SET slug=?,name=name||' (Archived)',registration_open=0,archived_at=CURRENT_TIMESTAMP WHERE id=?").bind(`archived-${league.id}-${league.slug}`,league.id)
  ]);
  return message(`**${league.name}** was removed from active setup. ${count?.n??0} active team(s) are now unassigned with their managers, rosters, EA links and history preserved. The original league key can be created again for fresh testing.`,true);
 }
 if(action==='registration'){
  const slug=val('league'),open=val('state')==='open',days=Number(val('closes_in_days')||0),interval=Number(val('reminder_every_days')||1),channel=val('channel')||i.channel_id||'',now=Date.now();
  const league=await e.DB.prepare('SELECT id,name FROM leagues WHERE guild_id=? AND slug=? AND archived_at IS NULL AND is_system=0').bind(i.guild_id,slug).first<{id:number;name:string}>();
  if(!league)return message('Choose an official league from the suggestions.',true);
  if(!open){
   await e.DB.batch([e.DB.prepare('UPDATE leagues SET registration_open=0 WHERE id=?').bind(league.id),e.DB.prepare('DELETE FROM league_registration_schedules WHERE league_id=?').bind(league.id)]);
   return message(`Registration for **${league.name}** is now **closed**. Any scheduled reminders were cancelled.`,true);
  }
  if(val('reminder_every_days')&&!days)return message('Add **closes_in_days** before choosing a reminder interval.',true);
  if(days&&(!Number.isInteger(days)||days<1||days>365))return message('Choose **closes_in_days** from 1 through 365.',true);
  if(days&&(!Number.isInteger(interval)||interval<1||interval>3))return message('Choose reminders every 1, 2 or 3 days.',true);
  if(days&&!channel)return message('Choose a reminder channel or run the command in a server channel.',true);
  if(!days){
   await e.DB.batch([e.DB.prepare('UPDATE leagues SET registration_open=1 WHERE id=?').bind(league.id),e.DB.prepare('DELETE FROM league_registration_schedules WHERE league_id=?').bind(league.id)]);
   return message(`Registration for **${league.name}** is now **open** with no automatic closing date.`,true);
  }
  const closesAt=now+days*86_400_000,nextReminder=Math.min(now+interval*86_400_000,closesAt);
  await e.DB.batch([
   e.DB.prepare('UPDATE leagues SET registration_open=1 WHERE id=?').bind(league.id),
   e.DB.prepare(`INSERT INTO league_registration_schedules(league_id,guild_id,channel_id,closes_at,reminder_interval_days,next_reminder_at,created_by,lease_until,closed_at)
    VALUES(?,?,?,?,?,?,?,0,NULL) ON CONFLICT(league_id) DO UPDATE SET guild_id=excluded.guild_id,channel_id=excluded.channel_id,closes_at=excluded.closes_at,reminder_interval_days=excluded.reminder_interval_days,next_reminder_at=excluded.next_reminder_at,created_by=excluded.created_by,lease_until=0,closed_at=NULL`).bind(league.id,i.guild_id,channel,closesAt,interval,nextReminder,actor(i))
  ]);
  return message(`Registration for **${league.name}** is **open** and will close <t:${Math.floor(closesAt/1000)}:R> (<t:${Math.floor(closesAt/1000)}:f>). Reminders will post every ${interval} day${interval===1?'':'s'} in <#${channel}>.`,true);
 }
 if(action==='helpcenter')return publishHelpCenter(e,i);
 if(action==='patches')return setupPatchChannel(e,i);
 if(action==='channel')return freeAgentChannelCommand(e,synthetic(i,'recruit','channel',Object.fromEntries(opts.map(o=>[o.name,o.value??'']))));
 if(action==='checkfeed'){
  const team=await selectedTeam(e,val('team'),i.guild_id);
  if(!team?.ea_club_id)return message('Select a linked team to verify the match feed.',true);
  try{
   const matches=await liveFeed(e)(team),clubMatches=matches.filter(m=>m.clubs.some(c=>c.id===team.ea_club_id)),latest=clubMatches[0],club=latest?.clubs.find(c=>c.id===team.ea_club_id);
   return embed('FC27 feed ready',`**${team.name}** is connected to **${team.ea_club_name||team.name}** on **${team.ea_platform||'common-gen5'}**.`,[
    {name:'Validated data',value:`${matches.length} recent matches · ${clubMatches.length} include this club · ${club?.players.length??0} human-player rows in the latest match`},
    {name:'Latest match',value:latest?`${latest.clubs.map(c=>`${c.name} ${c.score}`).join(' — ')} · <t:${Math.floor(latest.playedAt/1000)}:R>`:'No recent match returned'},
    {name:'Available for match sheets',value:'Score, players, positions, rating, goals, shots, assists, passes, tackles, interceptions and saves.'},
    {name:'Not supplied by the current EA feed',value:'Secondary assists, key passes, dribbles, possession won/lost and blocks remain visibly unavailable and are never fabricated.'},
    {name:'Ready commands',value:'`/matches` is ready now. Start `/automode` before a session. Use `/gamestats` when two linked registered clubs play each other.'}
   ]);
  }catch(error){
   console.error('FC27 feed check failed',error);
   return message('Live FC27 match feed is disabled, unconfigured or failed validation. No automatic stats were enabled. Configure a verified HTTPS EA_API_BASE_URL (or normalized EA_MATCH_FEED_URL) and enable EA_MATCHES_ENABLED only after this check passes.',true);
  }
 }
 if(action==='health'){
  const [teams,watchers,failed]=await Promise.all([
   e.DB.prepare('SELECT t.id,t.name,t.manager_discord_id,t.ea_club_id,t.ea_platform,t.ea_crest_url FROM teams t JOIN leagues l ON l.id=t.league_id WHERE l.guild_id=? AND t.dissolved_at IS NULL ORDER BY t.name').bind(i.guild_id).all<LinkedTeam>(),
   e.DB.prepare("SELECT COUNT(*) AS n FROM match_watchers WHERE guild_id=? AND status='pending'").bind(i.guild_id).first<{n:number}>(),
   e.DB.prepare("SELECT COUNT(*) AS n FROM stat_deliveries WHERE guild_id=? AND status!='sent'").bind(i.guild_id).first<{n:number}>()
  ]);
  const linked=teams.results.filter(t=>t.ea_club_id),feedConfigured=e.EA_MATCHES_ENABLED==='true'&&!!(e.EA_MATCH_FEED_URL||e.EA_API_BASE_URL),checks=feedConfigured?await Promise.allSettled(linked.slice(0,10).map(async t=>({team:t,matches:await liveFeed(e)(t)}))):[];
  const feedLines=checks.map((result,index)=>result.status==='fulfilled'?`✅ **${result.value.team.name}** · ${result.value.matches.length} recent matches`:`❌ **${linked[index].name}** · feed unavailable`).join('\n');
  return embed('UFB — System health',feedConfigured?'Production readiness snapshot. Discord channel permissions still require a real command/post test.':'The FC27 feed is disabled or unconfigured.',[
   {name:'EA FC27 links',value:`${linked.length}/${teams.results.length} teams linked\n${feedLines||'_No linked teams to test_'}`.slice(0,1024)},
   {name:'Background jobs',value:`${watchers?.n??0} active match watcher(s) · ${failed?.n??0} unsent/failed stat delivery record(s)`},
   {name:'Configuration',value:`UFB Administrator: ${e.ADMIN_ROLE_ID?`<@&${e.ADMIN_ROLE_ID}>`:'not configured'}\nModerator: ${e.MODERATOR_ROLE_ID?`<@&${e.MODERATOR_ROLE_ID}>`:'not configured'}\nTeam Manager: ${e.MANAGER_ROLE_ID?`<@&${e.MANAGER_ROLE_ID}>`:'not configured'}\nFC27 feed: ${feedConfigured?'enabled':'disabled'}\nImage renderer: configured`}
  ]);
 }
 if(['league','cup'].includes(action)&&value){
  if(action==='league'&&!await e.DB.prepare('SELECT 1 FROM leagues WHERE guild_id=? AND slug=?').bind(i.guild_id,value).first())return message('Choose a valid league.',true);
  if(action==='cup'&&!await e.DB.prepare('SELECT 1 FROM cups WHERE guild_id=? AND slug=?').bind(i.guild_id,value).first())return message('Choose a valid cup.',true);
  const field=action==='league'?'default_league':'default_cup';
  await e.DB.prepare(`INSERT INTO server_settings(guild_id,${field}) VALUES(?,?) ON CONFLICT(guild_id) DO UPDATE SET ${field}=excluded.${field}`).bind(i.guild_id,value).run();return message('Server setting saved. Reopen /setup panel to review.',true);
 }
 if(action==='fa'&&value){const r=message('Choose the text or announcement channel for this competition.',true);r.data!.components=[row([{type:8,custom_id:`setup:assign:${value}`,channel_types:[0,5],min_values:1,max_values:1}])];return r;}
 if(action==='assign'&&value){const competition=id.slice('setup:assign:'.length);return freeAgentChannelCommand(e,synthetic({...i,data:{resolved:i.data?.resolved}},'recruit','channel',{competition,channel:value}));}
 const settings=await e.DB.prepare('SELECT * FROM server_settings WHERE guild_id=?').bind(i.guild_id).first<StaffRoleSettings&{default_league:string|null;default_cup:string|null}>();
  const leagues=await e.DB.prepare('SELECT name,slug FROM leagues WHERE guild_id=? AND archived_at IS NULL AND is_system=0 ORDER BY name LIMIT 25').bind(i.guild_id).all<{name:string;slug:string}>();
 const r=embed('UFB — Administrator setup',`**Start here:** use \`/setup roles\` to map UFB Administrator, Moderator and Team Manager roles. \`/setup create\` makes a 6v6, 10v10 or custom league. \`/setup leaguesource\` links each league’s matching website feed. Use \`/setup helpcenter\` to create or refresh the Discord command guide.\n\nUFB Administrator: ${settings?.admin_role_id?`<@&${settings.admin_role_id}>`:'Not configured'}\nModerators: ${mentions(roleIds(settings?.moderator_role_ids,settings?.moderator_role_id))}\nTeam Managers: ${mentions(roleIds(settings?.manager_role_ids,settings?.manager_role_id))}\nDefault league: ${settings?.default_league??'Not set'}\n\nChannel permissions needed: View Channel, Send Messages, Embed Links; Attach Files for stat sheets. Help Center setup also needs Manage Channels, Create Public Threads, Manage Threads and Send Messages in Threads.\nFC27 feed: ${e.EA_MATCHES_ENABLED==='true'&&(e.EA_MATCH_FEED_URL||e.EA_API_BASE_URL)?'Configured; verify with /setup checkfeed':'Disabled/unconfigured'}`);r.data!.flags=64;
 r.data!.components=[row([button('Configure staff roles','setup:roles')]),...(leagues.results.length?[row([{type:3,custom_id:'setup:league',placeholder:'Default registered league',options:leagues.results.map(c=>({label:c.name.slice(0,100),value:c.slug}))}])]:[])];return r;
}
