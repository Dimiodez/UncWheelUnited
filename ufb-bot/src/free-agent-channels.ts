import {message} from './responses';
import {competitionOptions} from './free-agent-competitions';
import {competitionLabel} from './free-agent-signing';
import type {Env,DiscordInteraction} from './types';
import {ufbAdministrator} from './permissions';

export async function freeAgentChannelCommand(e:Env,i:DiscordInteraction){
 if(!i.guild_id || !ufbAdministrator(e,i))return message('Only Discord server administrators and the configured UFB Administrator role can configure free-agent channels.',true);
 const opts=i.data?.options?.[0]?.options||[],competition=String(opts.find(o=>o.name==='competition')?.value||''),channel=String(opts.find(o=>o.name==='channel')?.value||''),clear=opts.find(o=>o.name==='clear')?.value===true;
 const choices=await competitionOptions(e,true,i.guild_id);
 if(competition==='all'||!choices.some(c=>c.value===competition))return message('Select an individual active league, not All active leagues.',true);
 if(clear&&channel)return message('Choose a channel to assign, or clear:true to remove the assignment—not both.',true);
 if(clear){await e.DB.prepare('DELETE FROM free_agent_channels WHERE guild_id=? AND competition=?').bind(i.guild_id,competition).run();return message('Free-agent auto-publishing disabled for this competition. Existing channel posts remain.',true);}
 if(!channel){const setting=await e.DB.prepare('SELECT channel_id FROM free_agent_channels WHERE guild_id=? AND competition=?').bind(i.guild_id,competition).first<{channel_id:string}>();const failed=await e.DB.prepare("SELECT COUNT(*) AS n FROM free_agent_deliveries WHERE guild_id=? AND channel_id=? AND status='failed'").bind(i.guild_id,setting?.channel_id||'').first<{n:number}>();return message(setting?`Free-agent channel: <#${setting.channel_id}>. Failed deliveries: ${failed?.n||0}. After correcting bot permissions, reassign this channel to retry them.`:'No free-agent channel assigned for this competition.',true);}
 const resolved=i.data?.resolved?.channels?.[channel];
 if(!resolved||resolved.id!==channel||![0,5].includes(resolved.type))return message('Choose a text or announcement channel in this Discord server.',true);
 await e.DB.batch([
  e.DB.prepare('INSERT INTO free_agent_channels(guild_id,competition,channel_id) VALUES(?,?,?) ON CONFLICT(guild_id,competition) DO UPDATE SET channel_id=excluded.channel_id').bind(i.guild_id,competition,channel),
  e.DB.prepare("UPDATE free_agent_deliveries SET status='pending',attempts=0,next_attempt=0 WHERE guild_id=? AND channel_id=? AND status='failed'").bind(i.guild_id,channel)
 ]);
 return message(`Free agents for ${choices.find(c=>c.value===competition)!.label} will automatically post in <#${channel}> after selecting leagues. All-active-leagues listings are included. Applies to new listings; existing listings are not bulk-posted. Give UFB View Channel, Send Messages and Embed Links permissions there.`,true);
}

type Delivery={id:number;post_id:number;guild_id:string;channel_id:string;payload:string;nonce:string;message_id:string|null;status:string;attempts:number;active:number;competitions:string;excluded_competitions:string;revision:number};
// A persistent outbox survives restarts. Atomic leases prevent concurrent workers
// from sending the same job; Discord nonce enforcement covers uncertain retries.
export async function publishFreeAgents(e:Env,fetcher:typeof fetch=fetch){
 if(!e.DISCORD_BOT_TOKEN)return;
 const now=Date.now();
 const jobs=await e.DB.prepare("SELECT d.*,p.active,p.competitions,p.excluded_competitions,p.revision FROM free_agent_deliveries d JOIN recruitment_posts p ON p.id=d.post_id WHERE ((d.status IN ('pending','sending') AND d.next_attempt<=?) OR (d.status='sent' AND (p.active=0 OR d.post_revision<p.revision))) ORDER BY d.id LIMIT 20").bind(now).all<Delivery>();
 for(const job of jobs.results){
  const lease=await e.DB.prepare("UPDATE free_agent_deliveries SET status='sending',next_attempt=? WHERE id=? AND ((status IN ('pending','sending') AND next_attempt<=?) OR status='sent')").bind(now+120000,job.id,now).run();
  if(!lease.meta.changes)continue;
  try{
   const selections=JSON.parse(job.competitions) as string[];
   const excluded=JSON.parse(job.excluded_competitions) as string[];
   const targets=await e.DB.prepare('SELECT competition FROM free_agent_channels WHERE guild_id=? AND channel_id=?').bind(job.guild_id,job.channel_id).all<{competition:string}>();
   const relevant=targets.results.some(c=>!excluded.includes(c.competition)&&(selections.includes('all')||selections.includes(c.competition)));
   if(!job.message_id&&(!job.active||!relevant)){await e.DB.prepare("UPDATE free_agent_deliveries SET status='cancelled' WHERE id=?").bind(job.id).run();continue;}
   const retiring=!!job.message_id&&!job.active;
   const removing=!!job.message_id&&!relevant&&targets.results.some(c=>excluded.includes(c.competition));
   const stored=JSON.parse(job.payload);
   if(stored.embeds?.[0]?.fields){const field=stored.embeds[0].fields.find((f:{name:string})=>f.name==='Competitions');if(field)field.value=competitionLabel(selections,excluded,await competitionOptions(e,true,job.guild_id)).slice(0,1024)||'No remaining competitions';}
   const editing=!!job.message_id;
   // Notify managers and @here only for a genuinely new listing. Later edits,
   // signings and expiry updates must never repeat the notification.
   const payload=retiring?{content:'This free-agent listing is closed or has been replaced.',embeds:[],allowed_mentions:{parse:[]}}:{...stored,nonce:job.nonce,enforce_nonce:true,allowed_mentions:editing?{parse:[]}:stored.allowed_mentions??{parse:[]}};
   const response=await fetcher(`https://discord.com/api/v10/channels/${job.channel_id}/messages${editing?'/'+job.message_id:''}`,{method:removing?'DELETE':editing?'PATCH':'POST',headers:{authorization:`Bot ${e.DISCORD_BOT_TOKEN}`,'content-type':'application/json'},...(removing?{}:{body:JSON.stringify(payload)}),signal:AbortSignal.timeout(10000)});
   if((retiring||removing)&&response.status===404){await e.DB.prepare("UPDATE free_agent_deliveries SET status='retired',post_revision=? WHERE id=?").bind(job.revision,job.id).run();continue;}
   if(!response.ok){const error=new Error(`Discord HTTP ${response.status}`);throw error;}
   const result=editing?null:await response.json() as {id?:string};
   if(!editing&&!result?.id)throw new Error('Discord did not return a message ID');
   await e.DB.prepare('UPDATE free_agent_deliveries SET status=?,message_id=?,post_revision=?,last_error=NULL WHERE id=?').bind(retiring||removing?'retired':'sent',result?.id||job.message_id,job.revision,job.id).run();
  }catch(error){const attempts=job.attempts+1;await e.DB.prepare('UPDATE free_agent_deliveries SET status=?,attempts=?,next_attempt=?,last_error=? WHERE id=?').bind(attempts>=5?'failed':'pending',attempts,Date.now()+Math.min(900000,60000*2**job.attempts),error instanceof Error?error.message:'Delivery failed',job.id).run();console.error(JSON.stringify({event:'free_agent_delivery_failed',delivery:job.id,attempts}));}
 }
}
