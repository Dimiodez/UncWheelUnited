import {message} from './responses';
import type {DiscordInteraction,Env,InteractionResponse} from './types';

const DISCORD='https://discord.com/api/v10';
const TRACKER='https://api.trello.com/1/boards/keigLn6R/cards?filter=open&fields=id,name,desc,shortUrl&limit=500';
const STEAM='https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4080220&count=30&maxlength=500&feeds=steam_community_announcements';
const CHANNEL_MARKER='UFB_FC27_PATCHES_V1';
const POLL_INTERVAL_MS=15*60_000;
const EVERYONE_DENY=(2048n|34359738368n|274877906944n).toString();
const BOT_ALLOW=(1024n|2048n|16384n|32768n).toString();

type Channel={id:string;type?:number;topic?:string|null};
type PatchCard={id:string;name:string;desc:string;shortUrl:string};
type SteamNews={title:string;contents:string};
type Delivery={message_id:string|null;fingerprint:string;status:string};

async function limitedJson<T>(response:Response,maxBytes:number):Promise<T>{
 if(!response.ok)throw new Error(`Source returned HTTP ${response.status}`);
 const reader=response.body?.getReader();if(!reader)throw new Error('Source returned no body');
 const parts:Uint8Array[]=[];let length=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>maxBytes)throw new Error('Source response exceeded the size limit');parts.push(value);}}
 finally{await reader.cancel().catch(()=>{});}
 const merged=new Uint8Array(length);let offset=0;for(const part of parts){merged.set(part,offset);offset+=part.byteLength;}
 return JSON.parse(new TextDecoder().decode(merged)) as T;
}

export function parseEaPatchCards(input:unknown):PatchCard[]{
 if(!Array.isArray(input))throw new Error('EA Tracker returned an invalid card list');
 return input.filter((item):item is PatchCard=>{
  if(!item||typeof item!=='object')return false;
  const card=item as Partial<PatchCard>;
  return typeof card.id==='string'&&/^[\da-f]{24}$/i.test(card.id)&&typeof card.name==='string'&&typeof card.desc==='string'
   &&typeof card.shortUrl==='string'&&/^https:\/\/trello\.com\/c\/[\w-]+$/.test(card.shortUrl)
   &&/\bFC(?:™|®)?\s*27\b/i.test(card.name)
   &&!/(?:community\s+update|spotlight|rewards?|feedback|deep\s+dive|livestream|developer\s+update)/i.test(card.name)
   &&/(?:\b(?:version|v)\s*\d+\.\d+(?:\.\d+)?\b|\btitle\s+update\b|\bpatch(?:\s+notes?)?\b|\bhot\s*fix\b|\bbug[\s-]?fix\b|\bupdate\s+notes\b|\bgame\s+update\s*#?\d+\b)/i.test(card.name);
 }).sort((a,b)=>b.id.localeCompare(a.id));
}

function version(text:string){return /(?:\bversion\s*|\bv\s*)(\d+\.\d+(?:\.\d+)?)/i.exec(text)?.[1]??null;}
function liveText(text:string){return /\b(?:is now live|now live|is live|live now|is now available|now available|available now|has been released|has gone live|out now)\b/i.test(text);}
function cardStatus(card:PatchCard,steam:SteamNews[]):'live'|'announced'{
 if(liveText(card.desc))return 'live';
 const number=version(card.name);
 if(number&&steam.some(item=>version(item.title)===number&&/\bFC\s*27\b/i.test(item.title)&&liveText(item.contents)))return 'live';
 return 'announced';
}
function summary(desc:string):string{
 const lines=desc.split(/\r?\n/).map(line=>line.trim());
 const highlights=lines.filter(line=>/^[-*] /.test(line)).slice(0,3)
  .map(line=>line.replace(/^[-*] /,'').replace(/\[([^\]]+)\]\([^)]+\)/g,'$1').replace(/[*_~`]/g,'').replace(/<[^>]+>/g,'').slice(0,150));
 return highlights.length?highlights.map(line=>`• ${line}`).join('\n'):'Read EA’s full notes for the changes and affected modes.';
}
export function patchEmbed(card:PatchCard,status:'live'|'announced'){
 const number=version(card.name);
 return {title:`EA SPORTS FC 27${number?` · Update v${number}`:' · Patch notes'}`,
  url:card.shortUrl,
  description:`**Status:** ${status==='live'?'Live':'Announced — EA has not confirmed it live in the monitored sources'}\n\n**Highlights from EA**\n${summary(card.desc)}\n\n[Read the full update on EA’s FC Tracker](${card.shortUrl})`,
  color:status==='live'?0x37b86a:0xe7b94f,
  footer:{text:'Official EA SPORTS FC Tracker · automatically checked by UFB'}};
}
function payload(card:PatchCard,status:'live'|'announced'){
 return {embeds:[patchEmbed(card,status)],allowed_mentions:{parse:[]}};
}
async function discord<T>(env:Env,path:string,init:RequestInit={}):Promise<T>{
 const response=await fetch(`${DISCORD}${path}`,{...init,headers:{authorization:`Bot ${env.DISCORD_BOT_TOKEN}`,'content-type':'application/json',...(init.headers||{})},signal:AbortSignal.timeout(15_000)});
 if(!response.ok)throw new Error(`Discord ${response.status}: ${(await response.text()).slice(0,300)}`);
 return response.status===204?undefined as T:response.json<T>();
}
const post=(body:unknown):RequestInit=>({method:'POST',body:JSON.stringify(body)});
const edit=(body:unknown):RequestInit=>({method:'PATCH',body:JSON.stringify(body)});
async function sourceCards():Promise<PatchCard[]>{
 const response=await fetch(TRACKER,{headers:{accept:'application/json'},signal:AbortSignal.timeout(15_000)});
 return parseEaPatchCards(await limitedJson<unknown>(response,1_000_000));
}
async function steamNews():Promise<SteamNews[]>{
 try{
  const response=await fetch(STEAM,{headers:{accept:'application/json'},signal:AbortSignal.timeout(12_000)});
  const data=await limitedJson<{appnews?:{newsitems?:Array<{title?:string;contents?:string}>}}>(response,350_000);
  return (data.appnews?.newsitems??[]).filter(item=>typeof item.title==='string'&&typeof item.contents==='string').map(item=>({title:item.title!,contents:item.contents!}));
 }catch(error){console.warn(JSON.stringify({event:'patch_steam_status_unavailable',error:String(error)}));return [];}
}
async function syncCard(env:Env,guildId:string,channelId:string,card:PatchCard,news:SteamNews[]):Promise<void>{
 const status=cardStatus(card,news);
 const fingerprint=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${card.name}\n${card.desc}\n${status}`))
  .then(bytes=>Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,'0')).join(''));
 const saved=await env.DB.prepare('SELECT message_id,fingerprint,status FROM patch_deliveries WHERE guild_id=? AND card_id=?').bind(guildId,card.id).first<Delivery>();
 if(saved?.status==='skipped'||saved?.message_id&&saved.fingerprint===fingerprint)return;
 if(saved?.message_id){
  await discord(env,`/channels/${channelId}/messages/${saved.message_id}`,edit(payload(card,status)));
  await env.DB.prepare("UPDATE patch_deliveries SET fingerprint=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE guild_id=? AND card_id=?")
   .bind(fingerprint,status,guildId,card.id).run();
  console.log(JSON.stringify({event:'ea_patch_updated',guildId,cardId:card.id,status}));return;
 }
 const posted=await discord<{id:string}>(env,`/channels/${channelId}/messages`,post(payload(card,status)));
 await env.DB.prepare(`INSERT INTO patch_deliveries(guild_id,card_id,channel_id,message_id,fingerprint,status)
  VALUES(?,?,?,?,?,?) ON CONFLICT(guild_id,card_id) DO UPDATE SET channel_id=excluded.channel_id,message_id=excluded.message_id,fingerprint=excluded.fingerprint,status=excluded.status,updated_at=CURRENT_TIMESTAMP`)
  .bind(guildId,card.id,channelId,posted.id,fingerprint,status).run();
 console.log(JSON.stringify({event:'ea_patch_published',guildId,cardId:card.id,status}));
}
async function syncGuild(env:Env,guildId:string,channelId:string,initial:boolean,cards:PatchCard[],news:SteamNews[]):Promise<number>{
 if(!cards.length)throw new Error('EA Tracker returned no FC 27 patch cards');
 if(initial){
  for(const card of cards.slice(1))await env.DB.prepare(`INSERT OR IGNORE INTO patch_deliveries(guild_id,card_id,channel_id,fingerprint,status) VALUES(?,?,?,'','skipped')`).bind(guildId,card.id,channelId).run();
  await syncCard(env,guildId,channelId,cards[0],news);return 1;
 }
 for(const card of cards.slice().reverse())await syncCard(env,guildId,channelId,card,news);
 return cards.length;
}
export async function pollPatchUpdates(env:Env,now=Date.now()):Promise<void>{
 if(!env.DISCORD_BOT_TOKEN)return;
 const due=await env.DB.prepare('SELECT guild_id,channel_id FROM patch_channels WHERE last_checked_at<=? ORDER BY last_checked_at,guild_id LIMIT 10')
  .bind(now-POLL_INTERVAL_MS).all<{guild_id:string;channel_id:string}>();
 const claimed:typeof due.results=[];
 for(const row of due.results){
  const claim=await env.DB.prepare('UPDATE patch_channels SET last_checked_at=? WHERE guild_id=? AND last_checked_at<=?')
   .bind(now,row.guild_id,now-POLL_INTERVAL_MS).run();
  if(claim.meta.changes)claimed.push(row);
 }
 if(!claimed.length)return;
 let cards:PatchCard[],news:SteamNews[];
 try{[cards,news]=await Promise.all([sourceCards(),steamNews()]);}
 catch(error){console.error(JSON.stringify({event:'ea_patch_source_failed',guilds:claimed.length,error:String(error)}));return;}
 for(const row of claimed){
  try{await syncGuild(env,row.guild_id,row.channel_id,false,cards,news);}
  catch(error){console.error(JSON.stringify({event:'ea_patch_poll_failed',guildId:row.guild_id,error:String(error)}));}
 }
}
export async function setupPatchChannel(env:Env,interaction:DiscordInteraction):Promise<InteractionResponse>{
 const guildId=interaction.guild_id;
 if(!guildId)return message('Run this command in the Discord server where you want patch updates.',true);
 if(!env.DISCORD_BOT_TOKEN)return message('The bot token is not configured.',true);
 try{
  const stored=await env.DB.prepare('SELECT channel_id FROM patch_channels WHERE guild_id=?').bind(guildId).first<{channel_id:string}>();
  let channel:Channel|null=null;
  if(stored?.channel_id){try{channel=await discord<Channel>(env,`/channels/${stored.channel_id}`);}catch{/* Recreate a deleted channel below. */}}
  if(!channel){
   const channels=await discord<Channel[]>(env,`/guilds/${guildId}/channels`);
   channel=channels.find(item=>item.type===0&&item.topic?.includes(CHANNEL_MARKER))??null;
  }
  if(!channel){
   const botId=interaction.application_id||env.DISCORD_APPLICATION_ID;
   if(!botId)throw new Error('Discord application ID is missing');
   channel=await discord<Channel>(env,`/guilds/${guildId}/channels`,post({name:'fc27-patch-notes',type:0,
    topic:`Official EA SPORTS FC 27 patch notes · automatically managed by UFB · ${CHANNEL_MARKER}`,
    permission_overwrites:[{id:guildId,type:0,allow:'1024',deny:EVERYONE_DENY},{id:botId,type:1,allow:BOT_ALLOW,deny:'0'}]}));
  }
  const moved=!!stored&&stored.channel_id!==channel.id;
  if(moved)await env.DB.prepare('DELETE FROM patch_deliveries WHERE guild_id=?').bind(guildId).run();
  const previous=await env.DB.prepare('SELECT COUNT(*) AS count FROM patch_deliveries WHERE guild_id=?').bind(guildId).first<{count:number}>();
  const initial=!previous?.count;
  await env.DB.prepare(`INSERT INTO patch_channels(guild_id,channel_id,last_checked_at) VALUES(?,?,?)
   ON CONFLICT(guild_id) DO UPDATE SET channel_id=excluded.channel_id,last_checked_at=excluded.last_checked_at`).bind(guildId,channel.id,Date.now()).run();
  try{
   const [cards,news]=await Promise.all([sourceCards(),steamNews()]);
   await syncGuild(env,guildId,channel.id,initial,cards,news);
   await env.DB.prepare('UPDATE patch_channels SET last_checked_at=? WHERE guild_id=?').bind(Date.now(),guildId).run();
   return message(`FC 27 patch updates are ready in <#${channel.id}>. I checked EA’s official FC Tracker now; new notes and status changes will be checked automatically about every 15 minutes.`,true);
  }catch(error){
   console.error(JSON.stringify({event:'ea_patch_initial_check_failed',guildId,error:String(error)}));
   await env.DB.prepare('UPDATE patch_channels SET last_checked_at=0 WHERE guild_id=?').bind(guildId).run();
   return message(`Created <#${channel.id}>, but the first EA check failed. Automatic checks will retry; no unverified patch note was posted.`,true);
  }
 }catch(error){
  console.error(JSON.stringify({event:'ea_patch_setup_failed',guildId,error:String(error)}));
  return message('I could not create the FC 27 patch channel. Check Manage Channels, View Channel, Send Messages and Embed Links permissions, then retry `/setup patches`.',true);
 }
}
