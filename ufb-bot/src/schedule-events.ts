import type {DiscordInteraction,DiscordOption,Env,InteractionResponse} from './types';
import {message} from './responses';
import {ufbAdministrator,ufbModerator} from './permissions';
import {selectedTeam,selectionOptions,managesTeam} from './team-selectors';

type Repeat='none'|'daily'|'weekly'|'biweekly';
type ReminderPolicy='none'|'1h'|'24h'|'both';
type Series={id:number;guild_id:string;channel_id:string;creator_id:string;name:string;team_id:number|null;team_name:string|null;timezone:string;recurrence:Repeat;reminder_policy:ReminderPolicy;thread_enabled:number;total_occurrences:number;created_count:number;next_local:string|null;next_post_at:number|null;active:number};
type Occurrence={id:number;series_id:number;starts_at:number;status:string;name:string;team_name:string|null;timezone:string;recurrence:Repeat;reminder_policy:ReminderPolicy;thread_enabled:number;thread_id:string|null;total_occurrences:number;created_count:number;guild_id:string};
const opt=(items:DiscordOption[]|undefined,key:string)=>String(items?.find(item=>item.name===key)?.value??'').trim();
const actor=(i:DiscordInteraction)=>i.member?.user??i.user;
const clean=(value:string,max=80)=>value.replace(/[<@*_`~|]/g,'').replace(/\s+/g,' ').trim().slice(0,max);
const reminderOffsets=(policy:ReminderPolicy)=>policy==='both'?[1440,60]:policy==='24h'?[1440]:policy==='1h'?[60]:[];
const discordHeaders=(env:Env)=>({authorization:`Bot ${env.DISCORD_BOT_TOKEN}`,'content-type':'application/json'});
const discordApi='https://discord.com/api/v10';
const everyoneMention={parse:['everyone' as const]};
const buttons=(id:number)=>[{type:1,components:[
 {type:2,style:3,label:'Yes',emoji:{name:'✅'},custom_id:`schedule-rsvp:${id}:yes`},
 {type:2,style:2,label:'Tentative',emoji:{name:'❔'},custom_id:`schedule-rsvp:${id}:tentative`},
 {type:2,style:4,label:'No',emoji:{name:'❌'},custom_id:`schedule-rsvp:${id}:no`}
]}];
const formatter=(timezone:string)=>new Intl.DateTimeFormat('en-US',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const parts=(format:Intl.DateTimeFormat,time:number)=>Object.fromEntries(format.formatToParts(time).filter(part=>part.type!=='literal').map(part=>[part.type,Number(part.value)]));
const weekdays=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
const commonTimezones=[['Eastern','America/New_York'],['Central','America/Chicago'],['Mountain','America/Denver'],['Pacific','America/Los_Angeles'],['Arizona','America/Phoenix'],['Alaska','America/Anchorage'],['Hawaii','Pacific/Honolulu'],['UTC','UTC'],['United Kingdom','Europe/London'],['Central Europe','Europe/Berlin'],['Australia Eastern','Australia/Sydney']] as const;
const timezoneAliases:Record<string,string>={et:'America/New_York',eastern:'America/New_York',ct:'America/Chicago',central:'America/Chicago',mt:'America/Denver',mountain:'America/Denver',pt:'America/Los_Angeles',pacific:'America/Los_Angeles',arizona:'America/Phoenix',alaska:'America/Anchorage',hawaii:'Pacific/Honolulu',uk:'Europe/London',london:'Europe/London',utc:'UTC'};
export function normalizeTimezone(input:string):string{
 const zone=timezoneAliases[input.trim().toLowerCase()]??input.trim();
 try{formatter(zone).format(Date.now());return zone;}catch{throw new Error('Choose a timezone suggestion, such as Central, or enter a valid IANA timezone.');}
}
export function nextWeekdayLocal(day:string,time:string,timezone:string,now=Date.now()):{local:string;startsAt:number}{
 const target=weekdays.indexOf(day.trim().toLowerCase());
 if(target<0)throw new Error('Choose a day of the week from the list.');
 const match=/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i.exec(time.trim());
 if(!match)throw new Error('Enter a time like 7pm, 7:30pm, or 19:00.');
 let hour=Number(match[1]);const minute=Number(match[2]??0),meridiem=match[3]?.toLowerCase();
 if(minute>59||(meridiem?(hour<1||hour>12):(hour>23)))throw new Error('Enter a valid time like 7pm or 19:00.');
 if(meridiem)hour=hour%12+(meridiem==='pm'?12:0);
 const zone=normalizeTimezone(timezone),p=parts(formatter(zone),now);
 const today=Date.UTC(p.year,p.month-1,p.day),weekday=new Date(today).getUTCDay();
 for(let week=0;week<54;week++){
  const date=new Date(today+((target-weekday+7)%7+week*7)*86_400_000);
  const local=`${date.toISOString().slice(0,10)} ${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
  const startsAt=localToUtc(local,zone);
  if(startsAt>=now+60_000)return {local,startsAt};
 }
 throw new Error('Could not find the next date for this event.');
}
export function rsvpTimezoneAutocomplete(i:DiscordInteraction):InteractionResponse|null{
 if(i.data?.name!=='rsvp'||i.data.options?.[0]?.name!=='create')return null;
 const focus=selectionOptions(i).find(option=>option.focused);
 if(focus?.name!=='timezone')return null;
 const query=String(focus.value??'').toLowerCase();
 const choices:Array<{name:string;value:string}>=commonTimezones.filter(([label,zone])=>`${label} ${zone}`.toLowerCase().includes(query)).map(([label,zone])=>({name:`${label} — ${zone}`,value:zone}));
 if(query&&choices.length<25){try{const custom=normalizeTimezone(query);if(!choices.some(choice=>choice.value===custom))choices.push({name:custom,value:custom});}catch{/* Keep common suggestions while typing. */}}
 return {type:8,data:{choices:choices.slice(0,25)}};
}

export function localToUtc(local:string,timezone:string):number {
 const match=/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/.exec(local);
 if(!match)throw new Error('Enter the start as YYYY-MM-DD HH:mm, for example 2026-10-03 20:30.');
 const [year,month,day,hour,minute]=match.slice(1).map(Number);
 const naive=Date.UTC(year,month-1,day,hour,minute);
 if(!Number.isFinite(naive)||new Date(naive).toISOString().slice(0,16)!==`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}`)throw new Error('That calendar date or time is invalid.');
 let format:Intl.DateTimeFormat;
 try{format=formatter(timezone);}catch{throw new Error('Choose an IANA timezone such as America/Chicago or Europe/London.');}
 const wanted=`${year}-${month}-${day}-${hour}-${minute}`;
 const candidates=new Set<number>();
 for(let hours=-36;hours<=36;hours+=6){
  const sample=naive+hours*3_600_000,p=parts(format,sample);
  const offset=Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute)-sample;
  const candidate=naive-offset,c=parts(format,candidate);
  if(`${c.year}-${c.month}-${c.day}-${c.hour}-${c.minute}`===wanted)candidates.add(candidate);
 }
 if(candidates.size!==1)throw new Error(candidates.size?'That local time occurs twice during a daylight-saving change. Choose an unambiguous time.':'That local time does not exist in the selected timezone.');
 return [...candidates][0];
}
export function nextLocal(local:string,repeat:Repeat):string {
 const date=new Date(`${local.replace(' ','T')}Z`);
 date.setUTCDate(date.getUTCDate()+(repeat==='daily'?1:repeat==='weekly'?7:14));
 return date.toISOString().slice(0,16);
}
const line=(kind:string,rows:Array<{response:string;display_name:string}>)=>{
 const names=rows.filter(row=>row.response===kind).map(row=>clean(row.display_name,48));
 return {name:`${kind==='yes'?'✅ Yes':kind==='tentative'?'❔ Tentative':'❌ No'} — ${names.length}`,value:names.length?names.map(name=>`• ${name}`).join('\n').slice(0,1000):'_None_',inline:true};
};
async function card(env:Env,guild:string,id:number):Promise<InteractionResponse['data']|null>{
 const event=await env.DB.prepare(`SELECT o.id,o.series_id,o.starts_at,o.status,o.thread_id,s.name,s.team_name,s.timezone,s.recurrence,s.reminder_policy,s.thread_enabled,s.total_occurrences,s.created_count,s.guild_id FROM schedule_occurrences o JOIN schedule_series s ON s.id=o.series_id WHERE o.id=? AND s.guild_id=?`).bind(id,guild).first<Occurrence>();
 if(!event)return null;
 const rows=await env.DB.prepare('SELECT response,display_name FROM schedule_responses WHERE occurrence_id=? ORDER BY display_name COLLATE NOCASE').bind(id).all<{response:string;display_name:string}>();
 const unix=Math.floor(event.starts_at/1000),repeat=event.recurrence==='none'?'One-time':`${event.recurrence} · up to ${event.total_occurrences} dates`;
 const reminder=event.reminder_policy==='none'?'Off':event.reminder_policy==='both'?'24 hours and 1 hour before':event.reminder_policy==='24h'?'24 hours before':'1 hour before';
 return {embeds:[{title:`📅 ${clean(event.name,100)}${event.status==='cancelled'?' — Cancelled':''}`,description:`${event.team_name?`Team: **${clean(event.team_name,100)}**\n`:''}<t:${unix}:F> · <t:${unix}:R>\nCreator timezone: **${clean(event.timezone,64)}** · ${repeat}\nReminder: **${reminder}**${event.thread_id?` · [Discussion thread](https://discord.com/channels/${guild}/${event.thread_id})`:''}\nEvent ID: **${event.series_id}**\n\nChoose your availability below. You can change it until kickoff.`,color:event.status==='cancelled'?0x777777:0x08bfea,fields:['yes','tentative','no'].map(kind=>line(kind,rows.results))}],components:event.status==='open'?buttons(id):[]};
}

export async function scheduleEventCommand(env:Env,i:DiscordInteraction):Promise<InteractionResponse>{
 const guild=i.guild_id,channel=i.channel_id,user=actor(i),action=i.data?.options?.find(item=>item.type===1);
 if(!guild||!channel||!user)return message('Use this command inside a Discord server channel.',true);
 if(action?.name==='list'){
  const rows=await env.DB.prepare(`SELECT s.id,s.name,s.recurrence,s.creator_id,MIN(o.starts_at) AS starts_at FROM schedule_series s JOIN schedule_occurrences o ON o.series_id=s.id WHERE s.guild_id=? AND s.active=1 AND o.status='open' AND o.starts_at>? GROUP BY s.id ORDER BY starts_at LIMIT 15`).bind(guild,Date.now()).all<{id:number;name:string;recurrence:Repeat;creator_id:string;starts_at:number}>();
  return message(rows.results.length?rows.results.map(row=>`**#${row.id} ${clean(row.name)}** · <t:${Math.floor(row.starts_at/1000)}:F> · ${row.recurrence}`).join('\n'):'No upcoming RSVP events in this server.',true);
 }
 if(action?.name==='cancel'){
  const id=Number(opt(action.options,'event_id'));
  if(!Number.isSafeInteger(id)||id<1)return message('Choose a valid event ID from `/rsvp list`.',true);
  const series=await env.DB.prepare('SELECT * FROM schedule_series WHERE id=? AND guild_id=?').bind(id,guild).first<Series>();
  if(!series)return message('That event is not in this Discord server.',true);
  if(series.creator_id!==user.id&&!ufbAdministrator(env,i))return message('Only the event creator or a UFB Administrator can cancel it.',true);
  if(!series.active)return message('That event is already cancelled or complete.',true);
  await env.DB.batch([env.DB.prepare('UPDATE schedule_series SET active=0,next_post_at=NULL WHERE id=? AND guild_id=?').bind(id,guild),env.DB.prepare("UPDATE schedule_occurrences SET status='cancelled' WHERE series_id=? AND starts_at>?").bind(id,Date.now())]);
  return message(`Cancelled **${clean(series.name)}** (event #${id}). No further recurrence posts will be made. Existing RSVP posts will no longer accept responses.`,true);
 }
 if(action?.name!=='create')return message('Choose `/rsvp create`, `/rsvp list`, or `/rsvp cancel`.',true);
 if(i.app_permissions&&!(BigInt(i.app_permissions)&(8n|131072n)))return message('I need **Mention Everyone** permission in this channel before I can create an RSVP event with @everyone notifications. Ask a server administrator to enable it for my bot role, then try again.',true);
 const name=clean(opt(action.options,'name'),100),day=opt(action.options,'day'),time=opt(action.options,'time'),recurrence=opt(action.options,'repeat') as Repeat||'none';
 const team=await selectedTeam(env,opt(action.options,'team'),guild);
 if(!team)return message('Choose a registered team from this server’s suggestions.',true);
 if(!await managesTeam(env,team.id,user.id)&&!ufbModerator(env,i))return message('Only this team’s manager or a UFB Moderator/Administrator can create an RSVP event that notifies everyone.',true);
 const reminderPolicy=(opt(action.options,'reminders')||'none') as ReminderPolicy;
 const threadEnabled=opt(action.options,'thread')==='true';
 if(name.length<3)return message('Give the event a name of at least three characters.',true);
 if(!['none','daily','weekly','biweekly'].includes(recurrence))return message('Choose a valid repeat option.',true);
 if(!['none','1h','24h','both'].includes(reminderPolicy))return message('Choose a valid reminder option.',true);
 const countText=opt(action.options,'occurrences'),count=recurrence==='none'?1:countText?Number(countText):8;
 if(!Number.isInteger(count)||count<1||count>52||recurrence!=='none'&&count<2)return message('Recurring events need 2–52 occurrences (default 8).',true);
 let startsAt:number,local:string,timezone:string;
 try{timezone=normalizeTimezone(opt(action.options,'timezone'));({local,startsAt}=nextWeekdayLocal(day,time,timezone));}catch(error){return message(error instanceof Error?error.message:'Invalid event time.',true);}
 if(startsAt<Date.now()+60_000||startsAt>Date.now()+366*86_400_000)return message('Choose a start at least one minute from now and within the next year.',true);
 const active=await env.DB.prepare('SELECT COUNT(*) AS total FROM schedule_series WHERE guild_id=? AND creator_id=? AND active=1 AND (next_post_at IS NOT NULL OR id IN (SELECT series_id FROM schedule_occurrences WHERE starts_at>?))').bind(guild,user.id,Date.now()).first<{total:number}>();
 if((active?.total??0)>=10)return message('You already have ten upcoming events. Cancel or finish one before creating another.',true);
 const next=recurrence==='none'?null:nextLocal(local,recurrence);
 const inserted=await env.DB.prepare('INSERT INTO schedule_series (guild_id,channel_id,creator_id,name,team_id,team_name,timezone,recurrence,reminder_policy,thread_enabled,total_occurrences,next_local,next_post_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(guild,channel,user.id,name,team.id,team.name,timezone,recurrence,reminderPolicy,threadEnabled?1:0,count,next,recurrence==='none'?null:startsAt).run();
 const occurrence=await env.DB.prepare('INSERT INTO schedule_occurrences (series_id,starts_at,creation_interaction_id) VALUES (?,?,?)').bind(inserted.meta.last_row_id,startsAt,i.id||null).run();
 for(const minutes of reminderOffsets(reminderPolicy))await env.DB.prepare('INSERT INTO schedule_reminders (occurrence_id,offset_minutes) VALUES (?,?)').bind(occurrence.meta.last_row_id,minutes).run();
 const eventCard=await card(env,guild,Number(occurrence.meta.last_row_id));
 return {type:4,data:eventCard?{...eventCard,content:'@everyone',allowed_mentions:everyoneMention}:{content:'Event created, but its RSVP card could not be loaded.'}};
}

export async function scheduleRsvp(env:Env,i:DiscordInteraction):Promise<InteractionResponse>{
 const [,idText,response]=i.data?.custom_id?.split(':')??[],id=Number(idText),user=actor(i),guild=i.guild_id;
 if(!guild||!user||!Number.isSafeInteger(id)||!['yes','tentative','no'].includes(response))return message('This RSVP control is invalid.',true);
 const event=await env.DB.prepare(`SELECT o.starts_at,o.status,s.guild_id,s.active FROM schedule_occurrences o JOIN schedule_series s ON s.id=o.series_id WHERE o.id=? AND s.guild_id=?`).bind(id,guild).first<{starts_at:number;status:string;guild_id:string;active:number}>();
 if(!event||event.status!=='open'||!event.active||event.starts_at<=Date.now())return message('This event is closed or has already started.',true);
 const name=clean(user.global_name||user.username,48);
 await env.DB.prepare('INSERT INTO schedule_responses (occurrence_id,discord_id,display_name,response) VALUES (?,?,?,?) ON CONFLICT(occurrence_id,discord_id) DO UPDATE SET display_name=excluded.display_name,response=excluded.response,updated_at=CURRENT_TIMESTAMP').bind(id,user.id,name,response).run();
 const updated=await card(env,guild,id);
 return updated?{type:7,data:updated}:message('The event could not be refreshed.',true);
}

async function createEventThread(env:Env,channel:string,messageId:string,name:string,post:typeof fetch){
 const response=await post(`${discordApi}/channels/${channel}/messages/${messageId}/threads`,{method:'POST',headers:discordHeaders(env),body:JSON.stringify({name:`${clean(name,85)} — discussion`,auto_archive_duration:1440}),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error(`Discord thread creation returned ${response.status}: ${(await response.text()).slice(0,200)}`);
 return (await response.json() as {id:string}).id;
}

export async function captureOriginalRsvpPost(env:Env,i:DiscordInteraction,post:typeof fetch=fetch){
 if(!env.DISCORD_BOT_TOKEN||!i.id||!i.guild_id||!i.channel_id)return;
 const occurrence=await env.DB.prepare(`SELECT o.id,o.message_id,o.thread_id,s.name,s.thread_enabled FROM schedule_occurrences o JOIN schedule_series s ON s.id=o.series_id WHERE o.creation_interaction_id=? AND s.guild_id=?`).bind(i.id,i.guild_id).first<{id:number;message_id:string|null;thread_id:string|null;name:string;thread_enabled:number}>();
 if(!occurrence)return;
 let messageId=occurrence.message_id;
 if(!messageId){
  for(let attempt=0;attempt<6&&!messageId;attempt++){
   const response=await post(`${discordApi}/webhooks/${i.application_id}/${i.token}/messages/@original`,{signal:AbortSignal.timeout(10000)});
   if(response.ok)messageId=(await response.json() as {id:string}).id;
   else if(attempt<5)await new Promise(resolve=>setTimeout(resolve,250*(attempt+1)));
   else throw new Error(`Original RSVP post lookup returned ${response.status}`);
  }
  if(messageId)await env.DB.prepare('UPDATE schedule_occurrences SET message_id=? WHERE id=?').bind(messageId,occurrence.id).run();
 }
 if(occurrence.thread_enabled&&messageId&&!occurrence.thread_id){
  try{
   const threadId=await createEventThread(env,i.channel_id,messageId,occurrence.name,post);
   await env.DB.prepare('UPDATE schedule_occurrences SET thread_id=? WHERE id=?').bind(threadId,occurrence.id).run();
   const updated=await card(env,i.guild_id,occurrence.id);
   if(updated)await post(`${discordApi}/webhooks/${i.application_id}/${i.token}/messages/@original`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({...updated,allowed_mentions:{parse:[]}}),signal:AbortSignal.timeout(10000)});
  }catch(error){console.error(JSON.stringify({event:'rsvp_thread_failed',occurrenceId:occurrence.id,error:String(error)}));}
 }
}

export async function processRsvpReminders(env:Env,post:typeof fetch=fetch,now=Date.now()){
 if(!env.DISCORD_BOT_TOKEN)return;
 const due=await env.DB.prepare(`SELECT r.occurrence_id,r.offset_minutes,o.starts_at,o.message_id,o.thread_id,s.name,s.guild_id,s.channel_id FROM schedule_reminders r JOIN schedule_occurrences o ON o.id=r.occurrence_id JOIN schedule_series s ON s.id=o.series_id WHERE r.sent_at IS NULL AND r.lease_until<? AND o.status='open' AND s.active=1 AND o.starts_at>? AND o.starts_at-r.offset_minutes*60000 BETWEEN ? AND ? ORDER BY o.starts_at LIMIT 20`).bind(now,now,now-1_800_000,now).all<{occurrence_id:number;offset_minutes:number;starts_at:number;message_id:string|null;thread_id:string|null;name:string;guild_id:string;channel_id:string}>();
 for(const row of due.results){
  const lease=await env.DB.prepare('UPDATE schedule_reminders SET lease_until=? WHERE occurrence_id=? AND offset_minutes=? AND sent_at IS NULL AND lease_until<?').bind(now+300_000,row.occurrence_id,row.offset_minutes,now).run();
  if(!lease.meta.changes)continue;
  try{
   const unix=Math.floor(row.starts_at/1000);
   const link=row.message_id?`\n[RSVP to this event](https://discord.com/channels/${row.guild_id}/${row.channel_id}/${row.message_id})`:'';
   const details=`⏰ **${clean(row.name,100)}** starts <t:${unix}:R> (<t:${unix}:F>).${link}`;
   let threadPosted=false;
   if(row.thread_id){
    const threadResponse=await post(`${discordApi}/channels/${row.thread_id}/messages`,{method:'POST',headers:discordHeaders(env),body:JSON.stringify({content:details,allowed_mentions:{parse:[]},nonce:`rsvp-reminder-thread-${row.occurrence_id}-${row.offset_minutes}`,enforce_nonce:true}),signal:AbortSignal.timeout(15000)});
    threadPosted=threadResponse.ok;
    if(!threadPosted)console.error(JSON.stringify({event:'rsvp_thread_reminder_fallback',occurrenceId:row.occurrence_id,status:threadResponse.status}));
   }
   const threadLink=threadPosted?` [Open the reminder thread](https://discord.com/channels/${row.guild_id}/${row.thread_id})`:'';
   const alert=threadPosted?`@everyone ⏰ **${clean(row.name,100)}** starts <t:${unix}:R>.${threadLink}`:`@everyone ${details}`;
   const response=await post(`${discordApi}/channels/${row.channel_id}/messages`,{method:'POST',headers:discordHeaders(env),body:JSON.stringify({content:alert,allowed_mentions:everyoneMention,nonce:`rsvp-reminder-alert-${row.occurrence_id}-${row.offset_minutes}`,enforce_nonce:true}),signal:AbortSignal.timeout(15000)});
   if(!response.ok)throw new Error(`Discord reminder returned ${response.status}: ${(await response.text()).slice(0,200)}`);
   await env.DB.prepare('UPDATE schedule_reminders SET sent_at=?,lease_until=0 WHERE occurrence_id=? AND offset_minutes=?').bind(now,row.occurrence_id,row.offset_minutes).run();
  }catch(error){
   await env.DB.prepare('UPDATE schedule_reminders SET lease_until=0 WHERE occurrence_id=? AND offset_minutes=?').bind(row.occurrence_id,row.offset_minutes).run();
   console.error(JSON.stringify({event:'rsvp_reminder_failed',occurrenceId:row.occurrence_id,offset:row.offset_minutes,error:String(error)}));
  }
 }
}

export async function processRecurringSchedules(env:Env,post:typeof fetch=fetch,now=Date.now()){
 if(!env.DISCORD_BOT_TOKEN)return;
 const due=await env.DB.prepare('SELECT * FROM schedule_series WHERE active=1 AND next_post_at<=? AND lease_until<? AND created_count<total_occurrences ORDER BY next_post_at LIMIT 20').bind(now,now).all<Series>();
 for(const series of due.results){
  const leased=await env.DB.prepare('UPDATE schedule_series SET lease_until=? WHERE id=? AND active=1 AND lease_until<?').bind(now+300_000,series.id,now).run();
  if(!leased.meta.changes)continue;
  try{
   const local=series.next_local!;
   const startsAt=localToUtc(local,series.timezone);
   await env.DB.prepare('INSERT OR IGNORE INTO schedule_occurrences (series_id,starts_at) VALUES (?,?)').bind(series.id,startsAt).run();
   const occurrence=await env.DB.prepare('SELECT id,message_id,thread_id FROM schedule_occurrences WHERE series_id=? AND starts_at=?').bind(series.id,startsAt).first<{id:number;message_id:string|null;thread_id:string|null}>();
   if(!occurrence)throw new Error('Recurring occurrence was not saved.');
   for(const minutes of reminderOffsets(series.reminder_policy))await env.DB.prepare('INSERT OR IGNORE INTO schedule_reminders (occurrence_id,offset_minutes) VALUES (?,?)').bind(occurrence.id,minutes).run();
   let messageId=occurrence.message_id;
   if(!occurrence.message_id){
    const payload=await card(env,series.guild_id,occurrence.id);
    const sent=await post(`${discordApi}/channels/${series.channel_id}/messages`,{method:'POST',headers:discordHeaders(env),body:JSON.stringify({...payload,content:'@everyone',allowed_mentions:everyoneMention,nonce:`schedule-${series.id}-${series.created_count+1}`,enforce_nonce:true}),signal:AbortSignal.timeout(15000)});
    if(!sent.ok)throw new Error(`Discord schedule post returned ${sent.status}: ${(await sent.text()).slice(0,200)}`);
    const created=await sent.json() as {id:string};
    await env.DB.prepare('UPDATE schedule_occurrences SET message_id=? WHERE id=?').bind(created.id,occurrence.id).run();
    messageId=created.id;
   }
   if(series.thread_enabled&&messageId&&!occurrence.thread_id){
    try{
     const threadId=await createEventThread(env,series.channel_id,messageId,series.name,post);
     await env.DB.prepare('UPDATE schedule_occurrences SET thread_id=? WHERE id=?').bind(threadId,occurrence.id).run();
     const updated=await card(env,series.guild_id,occurrence.id);
     if(updated)await post(`${discordApi}/channels/${series.channel_id}/messages/${messageId}`,{method:'PATCH',headers:discordHeaders(env),body:JSON.stringify({...updated,allowed_mentions:{parse:[]}}),signal:AbortSignal.timeout(10000)});
    }catch(error){console.error(JSON.stringify({event:'rsvp_thread_failed',occurrenceId:occurrence.id,error:String(error)}));}
   }
   const createdCount=series.created_count+1,next=createdCount<series.total_occurrences?nextLocal(local,series.recurrence):null;
   await env.DB.prepare('UPDATE schedule_series SET created_count=?,next_local=?,next_post_at=?,lease_until=0 WHERE id=?').bind(createdCount,next,next?startsAt:null,series.id).run();
  }catch(error){
   await env.DB.prepare('UPDATE schedule_series SET lease_until=0 WHERE id=?').bind(series.id).run();
   console.error(JSON.stringify({event:'schedule_recurrence_failed',seriesId:series.id,error:String(error)}));
  }
 }
}
