import type {Env} from './types';
import {UFB_BOT_PERMISSIONS} from './help-center';

const COMMAND_SCHEMA_VERSION='20260929-team-managers2';
const INSTALL_PERMISSIONS_VERSION='20260927-rsvp-mention-everyone1';
const COMMAND_AUDIT_VERSION='20260929-team-managers-audit1';
const PATCH_PILOT_GUILD_ID='1510828576709148742';

async function syncInstallPermissions(env:Env){
 const saved=await env.DB.prepare('SELECT value FROM bot_metadata WHERE key=?').bind('install_permissions').first<{value:string}>();
 if(saved?.value===INSTALL_PERMISSIONS_VERSION)return;
 const headers={authorization:`Bot ${env.DISCORD_BOT_TOKEN}`,'content-type':'application/json'};
 const currentResponse=await fetch('https://discord.com/api/v10/applications/@me',{headers,signal:AbortSignal.timeout(20000)});
 if(!currentResponse.ok)throw new Error(`Discord application lookup returned ${currentResponse.status}: ${(await currentResponse.text()).slice(0,500)}`);
 const current=await currentResponse.json() as {integration_types_config?:Record<string,{oauth2_install_params?:{scopes:string[];permissions:string}}>};
 const oauth2_install_params={scopes:['applications.commands','bot'],permissions:UFB_BOT_PERMISSIONS};
 // UFB is a server bot. Keep the application install defaults on Guild Install so
 // Discord prompts the installer to choose a server and grants the bot role.
 const integration_types_config={'0':{...(current.integration_types_config?.['0']??{}),oauth2_install_params}};
 const response=await fetch('https://discord.com/api/v10/applications/@me',{method:'PATCH',headers,body:JSON.stringify({install_params:oauth2_install_params,integration_types_config}),signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw new Error(`Discord install-permission update returned ${response.status}: ${(await response.text()).slice(0,500)}`);
 await env.DB.prepare("INSERT INTO bot_metadata(key,value,updated_at) VALUES('install_permissions',?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP").bind(INSTALL_PERMISSIONS_VERSION).run();
 console.log(JSON.stringify({event:'discord_install_permissions_registered',version:INSTALL_PERMISSIONS_VERSION,permissions:UFB_BOT_PERMISSIONS}));
}

export async function syncDiscordCommands(env:Env){
 if(!env.DISCORD_APPLICATION_ID||!env.DISCORD_BOT_TOKEN)return;
 await env.DB.prepare('CREATE TABLE IF NOT EXISTS bot_metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)').run();
 await syncInstallPermissions(env);
 const metadataKey='command_schema:global';
 const saved=await env.DB.prepare('SELECT value FROM bot_metadata WHERE key=?').bind(metadataKey).first<{value:string}>();
 if(saved?.value===COMMAND_SCHEMA_VERSION)return;
 const asset=await env.ASSETS.fetch('https://assets.local/commands.json');
 if(!asset.ok)throw new Error('Discord command schema asset unavailable');
 const commands=await asset.json() as Array<Record<string,unknown>>;
 if(!Array.isArray(commands)||!commands.length)throw new Error('Discord command schema is invalid');
 // Global application commands appear in every guild where the application is
 // installed. Restrict them to Guild Install + guild channels so they never show
 // up as personal/User Install commands or in DMs.
 // Keep the command definitions in the workspace for later development, but do
 // not publish recruiting or player-roster mutation to Discord.
 const workshopNames=new Set(['recruit','sign','release']);
 const globalCommands=commands.filter(command=>!workshopNames.has(String(command.name))).map(command=>{
  if(command.name!=='setup')return {...command,integration_types:[0],contexts:[0]};
  return {...command,options:(command.options as Array<{name:string}>).filter(option=>option.name!=='channel'),integration_types:[0],contexts:[0]};
 });
 const headers={authorization:`Bot ${env.DISCORD_BOT_TOKEN}`,'content-type':'application/json'};
 const response=await fetch(`https://discord.com/api/v10/applications/${env.DISCORD_APPLICATION_ID}/commands`,{method:'PUT',headers,body:JSON.stringify(globalCommands),signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw new Error(`Discord command registration returned ${response.status}: ${(await response.text()).slice(0,500)}`);
 // Remove the pilot /setup override and any older guild command copies. The
 // global schema now contains /setup patches for every Guild Install server.
 const cleanupGuilds=new Set([PATCH_PILOT_GUILD_ID,...(env.DISCORD_GUILD_ID?[env.DISCORD_GUILD_ID]:[])]);
 for(const guildId of cleanupGuilds){
  const cleanup=await fetch(`https://discord.com/api/v10/applications/${env.DISCORD_APPLICATION_ID}/guilds/${guildId}/commands`,{method:'PUT',headers,body:'[]',signal:AbortSignal.timeout(20000)});
  if(!cleanup.ok)throw new Error(`Discord legacy guild-command cleanup returned ${cleanup.status}: ${(await cleanup.text()).slice(0,500)}`);
 }
 await env.DB.prepare('INSERT INTO bot_metadata(key,value,updated_at) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP').bind(metadataKey,COMMAND_SCHEMA_VERSION).run();
 console.log(JSON.stringify({event:'discord_global_commands_registered',version:COMMAND_SCHEMA_VERSION,count:globalCommands.length,cleanedGuilds:[...cleanupGuilds]}));
}

export async function auditDiscordCommands(env:Env){
 if(!env.DISCORD_APPLICATION_ID||!env.DISCORD_BOT_TOKEN)return;
 const saved=await env.DB.prepare('SELECT value FROM bot_metadata WHERE key=?').bind('command_audit_version').first<{value:string}>();
 if(saved?.value===COMMAND_AUDIT_VERSION)return;
 const headers={authorization:`Bot ${env.DISCORD_BOT_TOKEN}`};
 const base=`https://discord.com/api/v10/applications/${env.DISCORD_APPLICATION_ID}`;
 const identityResponse=await fetch('https://discord.com/api/v10/applications/@me',{headers,signal:AbortSignal.timeout(15000)});
 if(!identityResponse.ok)throw new Error(`Discord app identity audit returned ${identityResponse.status}`);
 const identity=await identityResponse.json() as {id:string;name:string;bot?:{id:string;username:string}};
 await env.DB.prepare('INSERT INTO bot_metadata(key,value,updated_at) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP').bind('command_audit:identity',JSON.stringify({application_id:identity.id,name:identity.name,bot_id:identity.bot?.id,bot_username:identity.bot?.username,configured_application_id:env.DISCORD_APPLICATION_ID})).run();
 const scopes:[string,string][]=[['global',`${base}/commands`]];
 const guilds=await env.DB.prepare('SELECT DISTINCT guild_id FROM server_settings UNION SELECT DISTINCT guild_id FROM leagues').all<{guild_id:string}>();
 for(const row of guilds.results)if(/^\d{15,22}$/.test(row.guild_id))scopes.push([row.guild_id,`${base}/guilds/${row.guild_id}/commands`]);
 if(env.DISCORD_GUILD_ID&&!scopes.some(([scope])=>scope===env.DISCORD_GUILD_ID))scopes.push([env.DISCORD_GUILD_ID,`${base}/guilds/${env.DISCORD_GUILD_ID}/commands`]);
 for(const [scope,url] of scopes){
  const response=await fetch(url,{headers,signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error(`Discord ${scope} command audit returned ${response.status}: ${(await response.text()).slice(0,200)}`);
  const commands=await response.json() as Array<{name:string}>;
  const names=commands.map(command=>command.name).sort();
  await env.DB.prepare('INSERT INTO bot_metadata(key,value,updated_at) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP').bind(`command_audit:${scope}`,JSON.stringify(names)).run();
  console.log(JSON.stringify({event:'discord_command_scope_audit',scope,names}));
 }
 await env.DB.prepare('INSERT INTO bot_metadata(key,value,updated_at) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP').bind('command_audit_version',COMMAND_AUDIT_VERSION).run();
}
