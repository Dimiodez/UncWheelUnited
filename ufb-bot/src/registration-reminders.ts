import type {Env} from './types';

type Schedule={
 league_id:number;league_name:string;channel_id:string;closes_at:number;
 reminder_interval_days:number;next_reminder_at:number;closed_at:number|null;
};
type DiscordPost=(url:string,init:RequestInit)=>Promise<Response>;

const DISCORD='https://discord.com/api/v10';
const DAY=86_400_000;
const nonce=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).slice(0,12).map(byte=>byte.toString(16).padStart(2,'0')).join('');

async function publish(env:Env,post:DiscordPost,row:Schedule,kind:'reminder'|'closed'){
 const unix=Math.floor(row.closes_at/1000);
 const content=kind==='closed'
  ?`🔒 Registration for **${row.league_name}** is now closed.`
  :`📣 Registration reminder: **${row.league_name}** closes <t:${unix}:R> (<t:${unix}:f>).`;
 const response=await post(`${DISCORD}/channels/${row.channel_id}/messages`,{
  method:'POST',headers:{authorization:`Bot ${env.DISCORD_BOT_TOKEN}`,'content-type':'application/json'},
  body:JSON.stringify({content,allowed_mentions:{parse:[]},nonce:await nonce(`registration:${kind}:${row.league_id}:${kind==='closed'?row.closes_at:row.next_reminder_at}`),enforce_nonce:true}),
  signal:AbortSignal.timeout(15000)
 });
 if(!response.ok)throw new Error(`Discord registration ${kind} returned ${response.status}: ${(await response.text()).slice(0,300)}`);
}

export async function processRegistrationSchedules(env:Env,post:DiscordPost=fetch,now=Date.now()){
 if(!env.DISCORD_BOT_TOKEN)return;
 const due=await env.DB.prepare(`SELECT s.league_id,l.name AS league_name,s.channel_id,s.closes_at,s.reminder_interval_days,s.next_reminder_at,s.closed_at
  FROM league_registration_schedules s JOIN leagues l ON l.id=s.league_id
  WHERE s.lease_until<? AND (s.closes_at<=? OR s.next_reminder_at<=?)
  ORDER BY MIN(s.closes_at,s.next_reminder_at) LIMIT 25`).bind(now,now,now).all<Schedule>();
 for(const row of due.results){
  const leased=await env.DB.prepare('UPDATE league_registration_schedules SET lease_until=? WHERE league_id=? AND lease_until<?').bind(now+300_000,row.league_id,now).run();
  if(!leased.meta.changes)continue;
  try{
   if(row.closes_at<=now){
    await env.DB.batch([
     env.DB.prepare('UPDATE leagues SET registration_open=0 WHERE id=?').bind(row.league_id),
     env.DB.prepare('UPDATE league_registration_schedules SET closed_at=COALESCE(closed_at,?),lease_until=? WHERE league_id=?').bind(now,now+300_000,row.league_id)
    ]);
    await publish(env,post,row,'closed');
    await env.DB.prepare('DELETE FROM league_registration_schedules WHERE league_id=?').bind(row.league_id).run();
   }else{
    await publish(env,post,row,'reminder');
    const next=Math.min(row.next_reminder_at+row.reminder_interval_days*DAY,row.closes_at);
    await env.DB.prepare('UPDATE league_registration_schedules SET next_reminder_at=?,lease_until=0 WHERE league_id=?').bind(next,row.league_id).run();
   }
  }catch(error){
   await env.DB.prepare('UPDATE league_registration_schedules SET lease_until=0 WHERE league_id=?').bind(row.league_id).run();
   console.error(JSON.stringify({event:'registration_schedule_delivery_failed',leagueId:row.league_id,error:String(error)}));
  }
 }
}
