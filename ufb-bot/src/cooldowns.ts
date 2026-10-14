import type {DiscordInteraction,Env} from './types';

const actor=(i:DiscordInteraction)=>(i.member?.user??i.user)?.id??'';

export async function consumeCooldown(env:Env,interaction:DiscordInteraction,key:string,seconds:number):Promise<number>{
 const guild=interaction.guild_id??'',user=actor(interaction),now=Date.now(),expires=now+seconds*1000;
 if(!guild||!user)return 0;
 const result=await env.DB.prepare(`INSERT INTO command_cooldowns(guild_id,actor_id,command_key,expires_at) VALUES(?,?,?,?)
  ON CONFLICT(guild_id,actor_id,command_key) DO UPDATE SET expires_at=excluded.expires_at
  WHERE command_cooldowns.expires_at<=?`).bind(guild,user,key,expires,now).run();
 if(result.meta.changes)return 0;
 const row=await env.DB.prepare('SELECT expires_at FROM command_cooldowns WHERE guild_id=? AND actor_id=? AND command_key=?').bind(guild,user,key).first<{expires_at:number}>();
 return Math.max(1,Math.ceil(((row?.expires_at??now)-now)/1000));
}
