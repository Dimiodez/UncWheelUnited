import {message} from './responses';
import type {DiscordInteraction,Env,InteractionResponse} from './types';

const API='https://discord.com/api/v10';
const MARKER='UFB_HELP_CENTER_V1';
const CONTENT_VERSION='20260929-team-managers-v2';
const EVERYONE_DENY=(2048n|34359738368n|274877906944n).toString();
const BOT_ALLOW=(1024n|2048n|16384n|32768n|65536n|17179869184n|34359738368n|274877906944n).toString();
export const UFB_BOT_PERMISSIONS=(16n|1024n|2048n|16384n|32768n|65536n|131072n|17179869184n|34359738368n|274877906944n|2147483648n).toString();

type DiscordChannel={id:string;name?:string;type?:number;topic?:string|null;parent_id?:string;owner_id?:string};
type DiscordMessage={id:string;embeds?:{title?:string}[]};
type ThreadList={threads:DiscordChannel[];has_more?:boolean};
type ThreadState={threadId:string;messageId:string};
type HelpState={channelId:string;indexMessageId?:string;sections:Record<string,ThreadState>};
type HelpSection={key:string;name:string;summary:string;lines:string[]};

const sections:HelpSection[]=[
 {key:'start',name:'1 · Start Here',summary:'The shortest path from installing UFB to using it.',lines:[
  '**Players:** use `/ufb` for your private menu and `/profile` for your UFB identity.',
  '**Team managers:** register your team with `/register` (league optional), then connect its real EA club with `/linkclub`. Admins can register teams for appointed managers.',
  '**Administrators:** use `/setup panel` for server settings and `/setup create` to add a league.',
  'Full guide: https://www.uncfutbolleague.com/ufb'
 ]},
 {key:'teams',name:'2 · Teams & Rosters',summary:'Register teams, link EA clubs and maintain league-safe rosters.',lines:[
  '`/register team:UFL Roma league:6v6 manager_1:@Manager manager_2:@CoManager` — admins must pick a first manager and may appoint up to three; they are not added unless selected. Team Managers may leave managers blank to self-register. Appointed managers are not automatically added as players.',
  '`/linkclub` — connect that team to its real EA FC 27 club.',
  '`/roster` — view a team roster. Players may join one team per league, but may play on different teams in 6v6 and 10v10.',
  '`/team view` — view a registered team. `/team assign` adds it to a league; `/team unassign` removes it while preserving the club. `/team dissolve` fully closes it. Changes require confirmation.'
 ]},
 {key:'matches',name:'3 · FC27 Matches & Images',summary:'Read verified EA match data and publish stat-sheet images.',lines:[
  '`/matches` — view 3, 6 or 9 recent FC27 games (as many as EA returns), then privately preview and publish one match image.',
  '`/gamestats` — select a league and two linked teams. UFB searches their recent FC27 history first and prints one sheet per team. It waits for an EA update only when no prior match is found; use the optional match picker when several are available.',
  '`/automode start` — watch a linked team and automatically publish each newly detected match.',
  '`/setup checkfeed` — administrator test for a linked club’s live EA feed.',
  'Sheets show only verified EA fields, including MotM when supplied. Disconnected human players are included when EA returns their player row.'
 ]},
 {key:'league',name:'4 · Official League',summary:'Website-fed standings, schedules and player leaders.',lines:[
  '`/standings` — print the selected league table.',
  '`/schedule` — show the official website schedule.',
  '`/rsvp create` — the selected team’s manager or a UFB Moderator/Administrator creates one event or a recurring series. Example: `name:Practice Nights team:Roma FC day:Wednesday time:7pm timezone:Central repeat:Weekly occurrences:10 reminders:24 hours and 1 hour before thread:True`.',
  'The next Wednesday at 7 PM Central is used; Discord displays it in each member’s timezone. The event post and each later occurrence ping @everyone. Members use Yes, Tentative or No; changing an answer never pings again.',
  'With reminders and a thread, full 24-hour/1-hour reminders go inside the event thread. A short @everyone link in the main channel ensures everyone is notified. If the thread is unavailable, the full reminder appears in the channel. The bot needs Mention Everyone permission there.',
  '`/rsvp list` and `/rsvp cancel` — review upcoming events or stop your own recurring event.',
  '`/leaguestats` — print the top five for goals, assists and average match rating.',
  'Choose a league created in this server. Administrators link its website feed with `/setup leaguesource`; EA match sheets use the live FC27 feed.'
 ]},
 {key:'admin',name:'5 · Administrator Setup',summary:'Configure leagues, roles and diagnostics.',lines:[
  '`/setup roles` — a server administrator or the bot owner selects one UFB Administrator role, up to four Moderator roles and up to three Team Manager roles. Re-selecting a group replaces its list; the panel can also clear either multi-role list.',
  '`/setup panel` — private settings overview.',
  '`/setup create` — create a 6v6, 10v10 or custom 1v1–11v11 league.',
  '`/setup leaguesource` — validate and link a UFL website season-data URL to one league in this server.',
  '`/setup team` — add an administrator-managed house/test team, with or without a league.',
  '`/setup removeleague` — archive a league and safely unassign its active teams after confirmation.',
  '`/setup registration` — open or close a league. Add closing days, a 1/2/3-day reminder interval and a channel to close it automatically.',
  '`/setup health` — inspect links, feeds, publishing and background jobs.',
  '`/setup helpcenter` — a Discord administrator, configured UFB Administrator or Moderator, or the bot owner can create or refresh this guide without making duplicate threads. The bot owner can use all published commands in any server where UFB is installed, regardless of their server roles.',
  '`/setup patches` — create or refresh a read-only FC 27 patch-notes channel. UFB checks official EA patch notes, title updates, hotfixes and bug fixes automatically; it does not post community updates or FUT spotlights.',
  '`/info reset` — server owner or bot owner only. Shows two private warnings, then deletes only data tagged with this Discord server ID; other servers and commands remain untouched.'
 ]}
];

class DiscordApiError extends Error{constructor(public status:number,public detail:string){super(`Discord API ${status}: ${detail}`)}}
async function api<T>(env:Env,path:string,init:RequestInit={}):Promise<T>{
 const response=await fetch(`${API}${path}`,{...init,headers:{authorization:`Bot ${env.DISCORD_BOT_TOKEN}`,'content-type':'application/json',...(init.headers||{})},signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new DiscordApiError(response.status,(await response.text()).slice(0,500));
 return response.status===204?undefined as T:response.json<T>();
}
const body=(value:unknown):RequestInit=>({method:'POST',body:JSON.stringify(value)});
const edit=(value:unknown):RequestInit=>({method:'PATCH',body:JSON.stringify(value)});
const sectionEmbed=(section:HelpSection)=>({embeds:[{title:section.name,description:`${section.summary}\n\n${section.lines.join('\n\n')}`,color:0x08bfea}],allowed_mentions:{parse:[]}});

async function save(env:Env,guildId:string,state:HelpState){
 await env.DB.prepare(`INSERT INTO help_centers(guild_id,channel_id,state_json,updated_at) VALUES(?,?,?,CURRENT_TIMESTAMP)
  ON CONFLICT(guild_id) DO UPDATE SET channel_id=excluded.channel_id,state_json=excluded.state_json,updated_at=CURRENT_TIMESTAMP`).bind(guildId,state.channelId,JSON.stringify(state)).run();
}

async function existingThreads(env:Env,guildId:string,channelId:string):Promise<DiscordChannel[]>{
 const active=await api<ThreadList>(env,`/guilds/${guildId}/threads/active`);
 const archived=await api<ThreadList>(env,`/channels/${channelId}/threads/archived/public?limit=100`);
 // Only adopt an unambiguous category thread. If there are multiple old copies,
 // prefer the oldest one rather than publishing yet another copy.
 return [...active.threads,...archived.threads].filter(thread=>thread.parent_id===channelId&&thread.type===11);
}

async function upsertGuide(env:Env,section:HelpSection,threadId:string,messageId?:string):Promise<string>{
 if(messageId){
  try{await api(env,`/channels/${threadId}/messages/${messageId}`,edit(sectionEmbed(section)));return messageId;}
  catch(error){if(!(error instanceof DiscordApiError)||error.status!==404)throw error;}
 }
 const messages=await api<DiscordMessage[]>(env,`/channels/${threadId}/messages?limit=100`);
 const guide=messages.find(item=>item.embeds?.some(embed=>embed.title===section.name));
 if(guide){await api(env,`/channels/${threadId}/messages/${guide.id}`,edit(sectionEmbed(section)));return guide.id;}
 const posted=await api<DiscordMessage>(env,`/channels/${threadId}/messages`,body(sectionEmbed(section)));
 return posted.id;
}

async function acquireRefresh(env:Env,guildId:string):Promise<string|null>{
 const token=crypto.randomUUID(),key=`help_center_lock:${guildId}`;
 const result=await env.DB.prepare(`INSERT INTO bot_metadata(key,value,updated_at) VALUES(?,?,CURRENT_TIMESTAMP)
  ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP
  WHERE updated_at<datetime('now','-5 minutes')`).bind(key,token).run();
 return result.meta.changes?token:null;
}

async function releaseRefresh(env:Env,guildId:string,token:string):Promise<void>{
 await env.DB.prepare('DELETE FROM bot_metadata WHERE key=? AND value=?').bind(`help_center_lock:${guildId}`,token).run();
}

export function botInvite(applicationId:string){
 return `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(applicationId)}&scope=bot%20applications.commands&permissions=${UFB_BOT_PERMISSIONS}`;
}

export async function publishHelpCenter(env:Env,interaction:DiscordInteraction):Promise<InteractionResponse>{
 const guildId=interaction.guild_id,applicationId=interaction.application_id||env.DISCORD_APPLICATION_ID;
 if(!guildId||!applicationId)return message('Run this command inside a Discord server.',true);
 if(!env.DISCORD_BOT_TOKEN)return message('The bot token is not configured, so UFB cannot create its help channel.',true);
 const lock=await acquireRefresh(env,guildId);
 if(!lock)return message('A Help Center refresh is already running. Please try again shortly.',true);
 try{
  const stored=await env.DB.prepare('SELECT state_json FROM help_centers WHERE guild_id=?').bind(guildId).first<{state_json:string}>();
  let state:HelpState=stored?JSON.parse(stored.state_json):{channelId:'',sections:{}};
  let channel:DiscordChannel|null=null;
  if(state.channelId){try{channel=await api<DiscordChannel>(env,`/channels/${state.channelId}`)}catch(error){if(!(error instanceof DiscordApiError)||error.status!==404)throw error;}}
  if(!channel){
   const channels=await api<DiscordChannel[]>(env,`/guilds/${guildId}/channels`);
   channel=channels.find(item=>item.type===0&&item.topic?.includes(MARKER))??null;
  }
  if(!channel){
   channel=await api<DiscordChannel>(env,`/guilds/${guildId}/channels`,body({name:'ufb-help',type:0,topic:`Official UFB command help · managed by the bot · ${MARKER}`,permission_overwrites:[{id:guildId,type:0,deny:EVERYONE_DENY,allow:'1024'},{id:applicationId,type:1,allow:BOT_ALLOW,deny:'0'}]}));
  }
  if(state.channelId!==channel.id){state={channelId:channel.id,sections:{}};await save(env,guildId,state);}
  const indexPayload={embeds:[{title:'UNC Fútbol Bot · Help Center',description:'Choose a thread below for short, plain-language command help. UFB refreshes these guides when commands change; run `/setup helpcenter` if you need to rebuild the channel.\n\nFull examples and image previews: https://www.uncfutbolleague.com/ufb',color:0xe7b94f}],allowed_mentions:{parse:[]}};
  if(state.indexMessageId){
   try{await api(env,`/channels/${channel.id}/messages/${state.indexMessageId}`,edit(indexPayload));}
   catch(error){if(!(error instanceof DiscordApiError)||error.status!==404)throw error;state.indexMessageId=undefined;}
  }
  if(!state.indexMessageId){
   const messages=await api<DiscordMessage[]>(env,`/channels/${channel.id}/messages?limit=100`);
   const index=messages.find(item=>item.embeds?.some(embed=>embed.title==='UNC Fútbol Bot · Help Center'));
   if(index){await api(env,`/channels/${channel.id}/messages/${index.id}`,edit(indexPayload));state.indexMessageId=index.id;}
   else{const posted=await api<DiscordMessage>(env,`/channels/${channel.id}/messages`,body(indexPayload));state.indexMessageId=posted.id;}
   await save(env,guildId,state);
  }
  // Retire the old free-agent guide without deleting its development history.
  const retired=state.sections.agents;
  if(retired){
   try{
    await api(env,`/channels/${retired.threadId}/messages/${retired.messageId}`,edit({embeds:[{title:'Free Agents · Workshop',description:'Free-agent and player-signing commands are not published in the live bot.',color:0x687383}],allowed_mentions:{parse:[]}}));
    await api(env,`/channels/${retired.threadId}`,edit({name:'Free Agents · Workshop',archived:true,locked:true}));
   }catch(error){if(!(error instanceof DiscordApiError)||error.status!==404)throw error;}
   delete state.sections.agents;await save(env,guildId,state);
  }
  const knownThreads=await existingThreads(env,guildId,channel.id);
  for(const section of sections){
   const matching=knownThreads.filter(thread=>thread.name===section.name&&thread.owner_id===applicationId).sort((a,b)=>a.id.length-b.id.length||a.id.localeCompare(b.id));
   const saved=state.sections[section.key];
   const current=matching[0]&&matching[0].id!==saved?.threadId?{threadId:matching[0].id,messageId:''}:saved;
   if(current){
    try{
     await api(env,`/channels/${current.threadId}`,edit({name:section.name,archived:false,locked:false}));
     const messageId=await upsertGuide(env,section,current.threadId,current.messageId);
     if(messageId!==current.messageId||current.threadId!==saved?.threadId){state.sections[section.key]={threadId:current.threadId,messageId};await save(env,guildId,state);}
     for(const duplicate of matching.slice(1)){
      if(duplicate.id===current.threadId)continue;
      try{await api(env,`/channels/${duplicate.id}`,edit({name:`${section.name} · Previous copy`,archived:true,locked:true}));}
      catch(error){console.warn(JSON.stringify({event:'help_center_duplicate_archive_failed',guildId,threadId:duplicate.id,error:String(error)}));}
     }
     continue;
    }
    catch(error){
     if(!(error instanceof DiscordApiError)||error.status!==404)throw error;
     delete state.sections[section.key];
     const missing=matching.findIndex(thread=>thread.id===current.threadId);
     if(missing>=0)matching.splice(missing,1);
    }
   }
   const oldThread=matching[0];
   if(oldThread){
    await api(env,`/channels/${oldThread.id}`,edit({name:section.name,archived:false,locked:false}));
    const messageId=await upsertGuide(env,section,oldThread.id);
    state.sections[section.key]={threadId:oldThread.id,messageId};await save(env,guildId,state);
    continue;
   }
   const starter=await api<DiscordMessage>(env,`/channels/${channel.id}/messages`,body({content:`**${section.name}** — ${section.summary}`,allowed_mentions:{parse:[]}}));
   let thread:DiscordChannel;
   try{thread=await api<DiscordChannel>(env,`/channels/${channel.id}/messages/${starter.id}/threads`,body({name:section.name,auto_archive_duration:10080}));}
   catch(error){if(!(error instanceof DiscordApiError)||error.status!==400)throw error;thread=await api<DiscordChannel>(env,`/channels/${channel.id}/messages/${starter.id}/threads`,body({name:section.name,auto_archive_duration:1440}));}
   const guide=await api<DiscordMessage>(env,`/channels/${thread.id}/messages`,body(sectionEmbed(section)));
   state.sections[section.key]={threadId:thread.id,messageId:guide.id};await save(env,guildId,state);
  }
  return message(`UFB Help Center is ready in <#${channel.id}>. ${sections.length} category threads were created or refreshed without duplicates.`,true);
 }catch(error){
  console.error('UFB help center failed',error);
  if(error instanceof DiscordApiError&&error.status===403)return message(`Discord blocked the Help Center setup. Re-authorize UFB with **Manage Channels, View Channel, Send Messages, Embed Links, Read Message History, Create Public Threads, Manage Threads, and Send Messages in Threads**, then run \`/setup helpcenter\` again.\n${botInvite(applicationId)}`,true);
  return message('UFB could not create or refresh its Help Center. Check the bot role is above channel restrictions, then run `/setup helpcenter` again.',true);
 }finally{await releaseRefresh(env,guildId,lock);}
}

export async function refreshExistingHelpCenters(env:Env):Promise<void>{
 if(!env.DISCORD_BOT_TOKEN||!env.DISCORD_APPLICATION_ID)return;
 const due=await env.DB.prepare(`SELECT h.guild_id FROM help_centers h
  WHERE NOT EXISTS (SELECT 1 FROM bot_metadata m WHERE m.key='help_center_content:'||h.guild_id AND m.value=?)
  ORDER BY h.guild_id LIMIT 5`).bind(CONTENT_VERSION).all<{guild_id:string}>();
 for(const {guild_id} of due.results){
  const result=await publishHelpCenter(env,{type:2,id:'',token:'',application_id:env.DISCORD_APPLICATION_ID,guild_id});
  if(!result.data?.content?.startsWith('UFB Help Center is ready')){
   console.error(JSON.stringify({event:'help_center_refresh_failed',guildId:guild_id,detail:result.data?.content?.slice(0,200)}));
   continue;
  }
  await env.DB.prepare(`INSERT INTO bot_metadata(key,value,updated_at) VALUES(?,?,CURRENT_TIMESTAMP)
   ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP`).bind(`help_center_content:${guild_id}`,CONTENT_VERSION).run();
  console.log(JSON.stringify({event:'help_center_refreshed',guildId:guild_id,version:CONTENT_VERSION}));
 }
}
