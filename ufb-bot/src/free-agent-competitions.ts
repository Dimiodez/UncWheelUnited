import {message,embed} from './responses';
import {competitionLabel,rosteredCompetitions} from './free-agent-signing';
import type {Env,DiscordInteraction} from './types';
const actor=(i:DiscordInteraction)=>(i.member?.user??i.user)?.id;
export async function competitionOptions(e:Env,_includeClosed=false,guild=''){
 if(!guild)return [];
 const leagues=await e.DB.prepare('SELECT DISTINCT squad_size FROM leagues WHERE guild_id=? AND is_system=0 ORDER BY squad_size').bind(guild).all<{squad_size:number}>();
 const choices=leagues.results.map(({squad_size})=>({label:`${squad_size}v${squad_size}`,value:`${squad_size}v${squad_size}`}));
 return choices.length?[...choices,{label:'All active leagues',value:'all'}]:[];
}
export async function freeAgentPicker(e:Env,i:DiscordInteraction,id:number){const choices=await competitionOptions(e,false,i.guild_id);if(!choices.length)return message('No leagues have been created in this server yet. Ask an administrator to use /setup create first.',true);return {type:4,data:{content:'Choose the leagues where you want to be listed. Only the posting player can select. Your new listing is published after selection.',flags:64,components:[{type:1,components:[{type:3,custom_id:`fa-competitions:${id}`,placeholder:'Choose one or more leagues',min_values:1,max_values:Math.min(3,choices.length-1),options:choices}]}]}};}
export async function freeAgentSelection(e:Env,i:DiscordInteraction){const id=Number(i.data?.custom_id?.split(':')[1]);const post=await e.DB.prepare("SELECT * FROM recruitment_posts WHERE id=? AND author_discord_id=? AND kind='free_agent' AND awaiting_competitions=1 AND (guild_id IS NULL OR guild_id=?) AND id=(SELECT MAX(id) FROM recruitment_posts WHERE author_discord_id=? AND kind='free_agent' AND (guild_id IS NULL OR guild_id=?))").bind(id,actor(i),i.guild_id||null,actor(i),i.guild_id||null).first<{title:string;primary_positions:string;backup_positions:string;avoid_positions:string;contact:string;pitch:string}>();if(!post)return message('This listing selection is closed, outdated or belongs to another player.',true);const choices=await competitionOptions(e,false,i.guild_id),values=[...new Set(i.data?.values||[])];if(!values.length||values.length>3||values.some(v=>!choices.some(c=>c.value===v)))return message('Choose valid competitions from the current list.',true);if(values.includes('all')&&values.length>1)return message('Choose All competitions by itself, or select individual competitions.',true);
 const excluded=await rosteredCompetitions(e,actor(i)!,i.guild_id??'');
 if(!values.includes('all')&&values.some(v=>excluded.includes(v)))return message('You are already on a team in one of those leagues. Select only leagues where you are a free agent, or All competitions to include eligible competitions only.',true);
 const labels=competitionLabel(values,excluded,choices);
 const expires=Math.floor(Date.now()/1000)+604800;
 const embeds=[{title:(post.title+' — Free Agent').slice(0,256),color:0x08bfea,description:post.pitch.slice(0,2000),fields:[{name:'Competitions',value:labels.slice(0,1024)},{name:'Primary',value:post.primary_positions.slice(0,512),inline:true},{name:'Backup',value:post.backup_positions.slice(0,512),inline:true},{name:'Will not play',value:post.avoid_positions.slice(0,512),inline:true},{name:'Contact',value:post.contact.slice(0,512)}]}];
 embeds[0].fields.push({name:'Listing expires',value:`<t:${expires}:R> · Renew with /recruit renew`});
 const settings=await e.DB.prepare('SELECT DISTINCT channel_id,competition FROM free_agent_channels WHERE guild_id=?').bind(i.guild_id||'').all<{channel_id:string;competition:string}>();
 const channels=[...new Set(settings.results.filter(c=>!excluded.includes(c.competition)&&choices.some(o=>o.value===c.competition)&&(values.includes('all')||values.includes(c.competition))).map(c=>c.channel_id))];
 const configured=await e.DB.prepare('SELECT manager_role_id FROM server_settings WHERE guild_id=?').bind(i.guild_id||'').first<{manager_role_id:string|null}>();
 const managerRole=configured?.manager_role_id||e.MANAGER_ROLE_ID;
 const notification={content:`${managerRole?`<@&${managerRole}> `:''}@here — a new free agent is available.`,embeds,allowed_mentions:{parse:['everyone'],roles:managerRole?[managerRole]:[]}};
 await e.DB.batch([e.DB.prepare("UPDATE recruitment_posts SET active=0,awaiting_competitions=0 WHERE guild_id=? AND author_discord_id=? AND kind='free_agent' AND id<>?").bind(i.guild_id??'',actor(i),id),e.DB.prepare('UPDATE recruitment_posts SET active=1,awaiting_competitions=0,competitions=?,excluded_competitions=?,guild_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(JSON.stringify(values),JSON.stringify(excluded),i.guild_id||null,id),e.DB.prepare('UPDATE recruitment_posts SET expires_at=? WHERE id=?').bind(expires,id),...channels.map(channel=>e.DB.prepare('INSERT OR IGNORE INTO free_agent_deliveries(post_id,guild_id,channel_id,payload,nonce) VALUES(?,?,?,?,?)').bind(id,i.guild_id,channel,JSON.stringify(notification),crypto.randomUUID().replace(/-/g,'').slice(0,24)))]);
 return {type:7,data:{content:`Free-agent listing published for ${labels}. Expires in seven days; /recruit renew bumps it and restarts the timer. ${channels.length?'Auto-post queued for '+channels.map(c=>`<#${c}>`).join(', ')+'.':'No auto-publishing channels configured for these competitions yet.'}`,flags:64,components:[],embeds}};
}
export async function freeAgentBrowse(e:Env,i:DiscordInteraction){
 const opts=i.data?.options?.[0]?.options||[],filter=String(opts.find(o=>o.name==='competition')?.value||'');const choices=await competitionOptions(e,false,i.guild_id);
 if(filter&&filter!=='all'&&!choices.some(c=>c.value===filter))return message('Choose an available competition.',true);
 const rows=await e.DB.prepare("SELECT title,primary_positions,backup_positions,avoid_positions,contact,pitch,competitions,excluded_competitions FROM recruitment_posts WHERE kind='free_agent' AND active=1 AND (guild_id=? OR guild_id IS NULL) AND (?='' OR ?='all' OR (EXISTS(SELECT 1 FROM json_each(competitions) WHERE value=? OR value='all') AND NOT EXISTS(SELECT 1 FROM json_each(excluded_competitions) WHERE value=?))) ORDER BY updated_at DESC LIMIT 10").bind(i.guild_id||null,filter,filter,filter,filter).all<{title:string;primary_positions:string;backup_positions:string;avoid_positions:string;contact:string;pitch:string;competitions:string;excluded_competitions:string}>();
 return rows.results.length?embed('🟢 Free Agents','Current competition-filtered listings.',rows.results.map(p=>({name:p.title,value:`Competitions: ${competitionLabel(JSON.parse(p.competitions),JSON.parse(p.excluded_competitions),choices)}\nPrimary: ${p.primary_positions} · Backup: ${p.backup_positions}\nAvoid: ${p.avoid_positions}\nPitch and availability: ${p.pitch}\nContact: ${p.contact}`.slice(0,1024)}))):message('No free agents listed for this competition yet.',true);
}

export async function freeAgentManagerReport(e:Env,i:DiscordInteraction){
 const choices=(await competitionOptions(e,false,i.guild_id)).filter(c=>c.value!=='all');
 const rows=await e.DB.prepare("SELECT title,primary_positions,backup_positions,contact,competitions,excluded_competitions FROM recruitment_posts WHERE kind='free_agent' AND active=1 AND (guild_id=? OR guild_id IS NULL) ORDER BY title COLLATE NOCASE").bind(i.guild_id||null).all<{title:string;primary_positions:string;backup_positions:string;contact:string;competitions:string;excluded_competitions:string}>();
 const fields=choices.map(choice=>{
  const players=rows.results.filter(post=>{const selected=JSON.parse(post.competitions) as string[],excluded=JSON.parse(post.excluded_competitions) as string[];return !excluded.includes(choice.value)&&(selected.includes('all')||selected.includes(choice.value));});
  const lines=players.map(post=>`• **${post.title}** — ${post.primary_positions}${post.backup_positions?` · backup: ${post.backup_positions}`:''} · ${post.contact}`);
  let value=lines.join('\n')||'_No active free agents._';
  if(value.length>1024){let used=0,count=0;const kept:string[]=[];for(const line of lines){if(used+line.length+1>940)break;kept.push(line);used+=line.length+1;count++;}value=`${kept.join('\n')}\n_…and ${lines.length-count} more. Use /recruit browse for individual listings._`;}
  return {name:`${choice.label} — ${players.length}`,value};
 });
 const result=embed('Free-agent report','Active players grouped by competition. Multi-competition players appear in each applicable section.',fields.slice(0,25));
 result.data!.flags=64;
 return result;
}
