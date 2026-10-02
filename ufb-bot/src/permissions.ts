import type {DiscordInteraction,Env} from './types';
import {roleIds} from './staff-roles';

const actor=(interaction:DiscordInteraction)=>(interaction.member?.user??interaction.user)?.id??'';
export const botOwner=(env:Env)=>env.BOT_OWNER_AUTHORIZED===true;

async function applicationOwners(env:Env):Promise<string[]>{
 if(!env.DISCORD_BOT_TOKEN)return [];
 const response=await fetch('https://discord.com/api/v10/applications/@me',{headers:{authorization:`Bot ${env.DISCORD_BOT_TOKEN}`},signal:AbortSignal.timeout(2000)});
 if(!response.ok)return [];
 const application=await response.json() as {owner?:{id?:string};team?:{owner_user_id?:string}};
 return [...new Set([application.owner?.id,application.team?.owner_user_id].filter((id):id is string=>Boolean(id)))];
}

export async function refreshBotOwners(env:Env):Promise<void>{
 if(!env.DISCORD_BOT_TOKEN)return;
 try{
  const owners=await applicationOwners(env);
  if(owners.length)await env.DB.prepare("INSERT INTO bot_metadata(key,value,updated_at) VALUES('application_owner_ids',?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP").bind(JSON.stringify(owners)).run();
 }catch(error){console.error(JSON.stringify({event:'bot_owner_refresh_failed',error:String(error)}));}
}

export async function withBotOwner(env:Env,interaction:DiscordInteraction):Promise<Env>{
 const userId=actor(interaction);
 if(!interaction.guild_id||!userId||env.BOT_OWNER_AUTHORIZED)return env;
 if(env.BOT_OWNER_DISCORD_ID===userId)return {...env,BOT_OWNER_AUTHORIZED:true};
 if(!env.DISCORD_BOT_TOKEN)return env;
 try{
  const cached=await env.DB.prepare("SELECT value FROM bot_metadata WHERE key='application_owner_ids'").first<{value:string}>();
  if(cached){const ids=JSON.parse(cached.value) as unknown;if(Array.isArray(ids)&&!ids.includes(userId))return env;}
  const owners=await applicationOwners(env);
  if(!cached&&owners.length)await env.DB.prepare("INSERT INTO bot_metadata(key,value,updated_at) VALUES('application_owner_ids',?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP").bind(JSON.stringify(owners)).run();
  return owners.includes(userId)?{...env,BOT_OWNER_AUTHORIZED:true}:env;
 }catch{return env;}
}

export const discordAdministrator=(interaction:DiscordInteraction)=>{
 const permissions=interaction.member?.permissions;
 return Boolean(permissions&&/^\d+$/.test(permissions)&&(BigInt(permissions)&8n)===8n);
};

const has=(interaction:DiscordInteraction,role?:string,roles?:string)=>roleIds(roles,role).some(id=>interaction.member?.roles.includes(id));

export const ufbAdministrator=(env:Env,interaction:DiscordInteraction)=>botOwner(env)||discordAdministrator(interaction)||has(interaction,env.ADMIN_ROLE_ID);
export const ufbModerator=(env:Env,interaction:DiscordInteraction)=>ufbAdministrator(env,interaction)||has(interaction,env.MODERATOR_ROLE_ID,env.MODERATOR_ROLE_IDS);
export const teamManager=(env:Env,interaction:DiscordInteraction)=>ufbAdministrator(env,interaction)||has(interaction,env.MANAGER_ROLE_ID,env.MANAGER_ROLE_IDS);
export const leagueStaff=(env:Env,interaction:DiscordInteraction)=>ufbModerator(env,interaction)||teamManager(env,interaction);
