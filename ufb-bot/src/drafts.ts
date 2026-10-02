import {embed,message} from './responses';
import type {DiscordInteraction,DiscordOption,Env,InteractionResponse} from './types';
import {botOwner,teamManager} from './permissions';

type Draft={id:number;name:string;guild_id:string;created_by:string;status:string;pick_mode:string;rules:string;next_pick:number};
type Side={id:number;name:string;captain_discord_id:string};
const value=(opts:DiscordOption[]|undefined,key:string)=>String(opts?.find(o=>o.name===key)?.value??'').trim();
const user=(i:DiscordInteraction)=>i.member?.user??i.user;
const host=(env:Env,d:Draft,i:DiscordInteraction)=>botOwner(env)||d.created_by===user(i)?.id;
const turn=(d:Draft,sides:Side[])=>{const round=Math.floor(d.next_pick/sides.length),offset=d.next_pick%sides.length;return sides[d.pick_mode==='snake'&&round%2===1?sides.length-1-offset:offset];};
async function find(env:Env,i:DiscordInteraction,id:string){return env.DB.prepare('SELECT * FROM drafts WHERE id = ? AND guild_id = ?').bind(id,i.guild_id??'').first<Draft>();}
async function sidesFor(env:Env,id:number){return (await env.DB.prepare('SELECT * FROM draft_sides WHERE draft_id = ? ORDER BY id').bind(id).all<Side>()).results;}
async function pool(env:Env,d:Draft,page=1){return (await env.DB.prepare('SELECT p.discord_id,m.display_name FROM draft_players p JOIN members m ON m.discord_id=p.discord_id WHERE p.draft_id=? AND p.side_id IS NULL ORDER BY m.display_name,p.discord_id LIMIT 25 OFFSET ?').bind(d.id,(page-1)*25).all<{discord_id:string;display_name:string}>()).results;}
async function pickCard(env:Env,i:DiscordInteraction,d:Draft,requestedSide='',page=1):Promise<InteractionResponse>{
  const sides=await sidesFor(env,d.id); if(d.status!=='drafting'||!sides.length)return message('The organizer must start the draft before captain picks open.',true);
  const current=turn(d,sides);const chosen=requestedSide?sides.find(s=>String(s.id)===requestedSide):sides.find(s=>s.captain_discord_id===user(i)?.id);
  if(!chosen||(!host(env,d,i)&&chosen.captain_discord_id!==user(i)?.id))return message('Only that side’s captain or this draft’s organizer can select players.',true);
  if(chosen.id!==current.id)return message(`It is **${current.name}**’s turn to pick.`,true);
  const available=await pool(env,d,page); if(!available.length)return message('No available players on this page.',true);
  return {type:4,data:{flags:64,embeds:[{title:`${d.name} — Captain pick`,description:`Pick #${d.next_pick+1} · **${chosen.name}**\nChoose an available player. Every selection is checked against the live pool.`,color:0x08bfea}],components:[{type:1,components:[{type:3,custom_id:`draft:pick:${d.id}:${chosen.id}:${d.next_pick}:${page}`,placeholder:'Select an undrafted player',options:available.map(p=>({label:p.display_name.slice(0,100),value:p.discord_id}))}]}]}};
}

export async function draftComponent(env:Env,i:DiscordInteraction):Promise<InteractionResponse>{
  if(!i.data?.custom_id?.startsWith('draft:pick:')){
    const [,action,id]=i.data?.custom_id?.split(':')??[];
    if(!['join','leave','pool','squads','recap','select','start'].includes(action))return message('Unknown draft action.',true);
    const result=await draftCommand(env,{...i,type:2,data:{name:'draft',options:[{name:action==='select'?'pick':action,type:1,options:[{name:'draft',value:id}]}]}});
    if(result.data)result.data.flags=64;return result;
  }
  const parts=i.data?.custom_id?.split(':')??[];const d=await find(env,i,parts[2]);if(!d)return message('That draft was not found in this server.',true);
  const side=(await sidesFor(env,d.id)).find(s=>String(s.id)===parts[3]);const version=Number(parts[4]);const player=i.data?.values?.[0];
  if(!side||!player||(!host(env,d,i)&&side.captain_discord_id!==user(i)?.id))return message('You cannot pick for this side.',true);
  const sides=await sidesFor(env,d.id);if(d.status!=='drafting'||d.next_pick!==version||turn(d,sides).id!==side.id)return message('The draft moved on. Run `/draft pick` again for the live pool.',true);
  const result=await env.DB.batch([
    env.DB.prepare(`UPDATE draft_players SET side_id=?,pick_number=? WHERE draft_id=? AND discord_id=? AND side_id IS NULL AND EXISTS(SELECT 1 FROM drafts WHERE id=? AND status='drafting' AND next_pick=?)`).bind(side.id,version+1,d.id,player,d.id,version),
    env.DB.prepare(`UPDATE drafts SET next_pick=next_pick+1 WHERE id=? AND next_pick=? AND EXISTS(SELECT 1 FROM draft_players WHERE draft_id=? AND discord_id=? AND side_id=? AND pick_number=?)`).bind(d.id,version,d.id,player,side.id,version+1)
  ]);
  if(!result[0].meta.changes)return message('That player was already picked. Refresh with `/draft pick`.',true);
  await env.DB.prepare(`UPDATE drafts SET status='complete' WHERE id=? AND NOT EXISTS(SELECT 1 FROM draft_players WHERE draft_id=? AND side_id IS NULL)`).bind(d.id,d.id).run();
  return {type:7,data:{content:`Pick #${version+1}: <@${player}> joins **${side.name}**. This player is now unavailable to every other side.`,embeds:[],components:[]}};
}

export async function draftCommand(env:Env,i:DiscordInteraction):Promise<InteractionResponse>{
  const sub=i.data?.options?.[0];const opts=sub?.options;const actor=user(i);if(!actor||!i.guild_id)return message('Use draft commands inside your Discord server.',true);
  await env.DB.prepare('INSERT INTO members(discord_id,display_name) VALUES (?,?) ON CONFLICT(discord_id) DO UPDATE SET display_name=excluded.display_name').bind(actor.id,actor.global_name||actor.username).run();
  if(sub?.name==='create'){
    if(!teamManager(env,i))return message('The Discord Manager role is required to create a draft.',true);
    const name=value(opts,'name');if(!name||name.length>80)return message('Use a draft name of 1–80 characters.',true);
    try{const r=await env.DB.prepare('INSERT INTO drafts(guild_id,name,created_by,pick_mode,rules) VALUES (?,?,?,?,?)').bind(i.guild_id,name,actor.id,value(opts,'mode')||'snake',value(opts,'rules')||'Captains pick in order. Each player joins one side only.').run();return embed('Draft created',`**${name}** · ID ${r.meta.last_row_id}\nPlayers can use \`/draft join\`. Add sides with \`/draft captain\`, then run \`/draft start\`.`);}catch(e){if(String(e).includes('UNIQUE'))return message('That draft name is already used in this server.',true);throw e;}
  }
  const d=await find(env,i,value(opts,'draft'));if(!d)return message('Choose a draft from the selection list.',true);
  if(sub?.name==='join'){
    if(d.status!=='open')return message('This draft’s pool is closed.',true);
    const r=await env.DB.prepare(`INSERT INTO draft_players(draft_id,discord_id) SELECT ?,? WHERE EXISTS(SELECT 1 FROM drafts WHERE id=? AND status='open') ON CONFLICT(draft_id,discord_id) DO NOTHING`).bind(d.id,actor.id,d.id).run();return message(r.meta.changes?`You joined **${d.name}**.`:'You are already in this draft, or its pool just closed.',true);
  }
  if(sub?.name==='leave'){const r=await env.DB.prepare(`DELETE FROM draft_players WHERE draft_id=? AND discord_id=? AND side_id IS NULL AND EXISTS(SELECT 1 FROM drafts WHERE id=? AND status='open') AND NOT EXISTS(SELECT 1 FROM draft_sides WHERE draft_id=? AND captain_discord_id=?)`).bind(d.id,actor.id,d.id,d.id,actor.id).run();return message(r.meta.changes?'You left the draft pool.':'Only non-captains can leave while registration is open.',true);}
  if(sub?.name==='captain'){
    if(!host(env,d,i)||d.status!=='open')return message('Only this draft’s organizer can add captains while the pool is open.',true);
    const captain=value(opts,'member'),name=value(opts,'side');if(!captain||!name||name.length>80||(await sidesFor(env,d.id)).length>=25)return message('Use a side name of 1–80 characters and a captain. A draft supports up to 25 sides.',true);await env.DB.prepare('INSERT INTO members(discord_id,display_name) VALUES (?,?) ON CONFLICT(discord_id) DO NOTHING').bind(captain,`Discord member ${captain}`).run();
    try{await env.DB.batch([env.DB.prepare('INSERT INTO draft_sides(draft_id,name,captain_discord_id) VALUES (?,?,?)').bind(d.id,name,captain),env.DB.prepare('INSERT INTO draft_players(draft_id,discord_id) VALUES (?,?) ON CONFLICT(draft_id,discord_id) DO NOTHING').bind(d.id,captain)]);return message(`**${name}** added with captain <@${captain}>. Captains will occupy their own squad when the draft starts.`);}catch(e){if(String(e).includes('UNIQUE'))return message('That side or captain already belongs to this draft.',true);throw e;}
  }
  const sides=await sidesFor(env,d.id);
  if(sub?.name==='start'){
    if(!host(env,d,i)||d.status!=='open')return message('Only the organizer can start an open draft.',true);
    if(sides.length<2)return message('Add at least two sides and captains first.',true);
    const count=await env.DB.prepare('SELECT COUNT(*) AS total FROM draft_players WHERE draft_id=?').bind(d.id).first<{total:number}>();if((count?.total??0)<=sides.length)return message('At least one player besides the captains must join the pool.',true);
    await env.DB.batch([env.DB.prepare(`UPDATE drafts SET status='drafting' WHERE id=? AND status='open'`).bind(d.id),...sides.map(s=>env.DB.prepare('UPDATE draft_players SET side_id=? WHERE draft_id=? AND discord_id=? AND side_id IS NULL').bind(s.id,d.id,s.captain_discord_id))]);
    return message(`**${d.name}** has started. **${sides[0].name}** picks first. Captains use \`/draft pick\`.`);
  }
  const page=Math.max(1,Number(value(opts,'page'))||1);
  if(sub?.name==='pick')return pickCard(env,i,d,value(opts,'side'),page);
  if(sub?.name==='pool'){const available=await pool(env,d,page);return embed(`${d.name} — Available pool`,available.map(p=>`• ${p.display_name}`).join('\n')||'No undrafted players.',[{name:'Page',value:String(page)}]);}
  if(sub?.name==='squads'||sub?.name==='recap'){
    const roster=(await env.DB.prepare('SELECT p.side_id,p.pick_number,m.display_name FROM draft_players p JOIN members m ON m.discord_id=p.discord_id WHERE p.draft_id=? AND p.side_id IS NOT NULL ORDER BY p.pick_number,m.display_name').bind(d.id).all<{side_id:number;pick_number:number|null;display_name:string}>()).results;
    return embed(`${d.name} — ${sub.name==='recap'?'Draft recap':'Squads'}`,`Status: ${d.status}`,sides.map(s=>({name:s.name,value:roster.filter(p=>p.side_id===s.id).map(p=>`${p.pick_number===null?'👑':`#${p.pick_number}`} ${p.display_name}`).join('\n').slice(0,1024)||'No picks yet'})));
  }
  const buttons=[...(d.status==='open'?[['join','Join pool'],['leave','Leave pool']]:[]),['pool','View pool'],['squads','Squads'],['recap','Recap'],...(d.status==='drafting'?[['select','Captain pick']]:[]),...(host(env,d,i)&&d.status==='open'?[['start','Start draft']]:[])];
  return {type:4,data:{flags:64,embeds:[{title:`${d.name} — Draft panel`,description:`**${d.status}** · ${d.pick_mode==='snake'?'Snake':'Round robin'}\n${d.rules}\n\nPool: \`/draft join\` · \`/draft leave\` · \`/draft pool\`\nCaptain: \`/draft pick\`\nViews: \`/draft squads\` · \`/draft recap\`\n${host(env,d,i)?'Organizer: `/draft captain` · `/draft start`':''}`,color:0x08bfea}],components:[0,5].filter(n=>buttons.slice(n,n+5).length).map(n=>({type:1,components:buttons.slice(n,n+5).map(([action,label])=>({type:2,style:2,label,custom_id:`draft:${action}:${d.id}`}))}))}};
}

export async function draftAutocomplete(env:Env,i:DiscordInteraction):Promise<InteractionResponse>{
 const opts=i.data?.options?.[0]?.options;const focus=opts?.find(o=>o.focused);const id=value(opts,'draft');
 if(focus?.name==='side'){const rows=await env.DB.prepare('SELECT s.id,s.name FROM draft_sides s JOIN drafts d ON d.id=s.draft_id WHERE d.id=? AND d.guild_id=? AND s.name LIKE ? LIMIT 25').bind(id,i.guild_id??'',`%${focus.value??''}%`).all<{id:number;name:string}>();return {type:8,data:{choices:rows.results.map(s=>({name:s.name,value:String(s.id)}))}};}
 const rows=await env.DB.prepare('SELECT id,name,status FROM drafts WHERE guild_id=? AND name LIKE ? ORDER BY id DESC LIMIT 25').bind(i.guild_id??'',`%${focus?.value??''}%`).all<Draft>();return {type:8,data:{choices:rows.results.map(d=>({name:`${d.name} — ${d.status}`,value:String(d.id)}))}};
}
