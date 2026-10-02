import {embed,message} from './responses';
import type {DiscordInteraction,Env,InteractionResponse} from './types';
import {botOwner} from './permissions';

type Cup={id:number;name:string;slug:string;created_by:string;registration_open:number;competition_mode:string;format:string;playoff_size:number|null;lifecycle:string};
type Entry={id:number;entry_name:string;manager_discord_id:string};
type Game={id:number;round_number:number;match_number:number;stage:string;status:string;home_entry_id:number|null;away_entry_id:number|null;home_score:number|null;away_score:number|null;winner_entry_id:number|null;result_state:string|null;submitted_by:string|null;home:string|null;away:string|null;home_manager:string|null;away_manager:string|null};
type Standing=Entry&{played:number;points:number;gd:number;gf:number};
const opts=(i:DiscordInteraction)=>i.data?.options?.[0]?.options;
const val=(i:DiscordInteraction,key:string)=>String(opts(i)?.find(o=>o.name===key)?.value??'').trim();
const actor=(i:DiscordInteraction)=>(i.member?.user??i.user)?.id;
export const serverAdmin=(i:DiscordInteraction)=>/^\d+$/.test(i.member?.permissions??'')&&(BigInt(i.member!.permissions!)&8n)!==0n;
export async function canManageCup(e:Env,c:{id:number;created_by:string},i:DiscordInteraction){return botOwner(e)||actor(i)===c.created_by||serverAdmin(i)||!!await e.DB.prepare('SELECT 1 FROM cup_organizers WHERE cup_id=? AND discord_id=?').bind(c.id,actor(i)??'').first();}
async function entries(env:Env,id:number){return (await env.DB.prepare('SELECT * FROM cup_entries WHERE cup_id=? ORDER BY id').bind(id).all<Entry>()).results;}
async function games(env:Env,id:number){return (await env.DB.prepare(`SELECT m.*,h.entry_name AS home,a.entry_name AS away,h.manager_discord_id AS home_manager,a.manager_discord_id AS away_manager FROM cup_matches m LEFT JOIN cup_entries h ON h.id=m.home_entry_id LEFT JOIN cup_entries a ON a.id=m.away_entry_id WHERE m.cup_id=? ORDER BY m.round_number,m.match_number`).bind(id).all<Game>()).results;}
function table(teams:Entry[],matches:Game[]):Standing[]{return teams.map(e=>{let played=0,points=0,gd=0,gf=0;for(const m of matches){if(m.stage!=='league'||m.result_state!=='confirmed'||(m.home_entry_id!==e.id&&m.away_entry_id!==e.id))continue;const home=m.home_entry_id===e.id;const scored=(home?m.home_score:m.away_score)??0,conceded=(home?m.away_score:m.home_score)??0;played++;points+=scored>conceded?3:scored===conceded?1:0;gd+=scored-conceded;gf+=scored;}return {...e,played,points,gd,gf};}).sort((a,b)=>b.points-a.points||b.gd-a.gd||b.gf-a.gf||a.id-b.id);}

// Put each bye against a real entrant. Padding adjacent empty slots would create
// empty games for non-power-of-two fields, such as 5, 6, or 10 qualifiers.
export function knockoutPairs(ids:number[]):Array<[number,number|null]>{let size=2;while(size<ids.length)size*=2;const byes=size-ids.length;const pairs:Array<[number,number|null]>=ids.slice(0,byes).map(id=>[id,null]);for(let n=byes;n<ids.length;n+=2)pairs.push([ids[n],ids[n+1]]);return pairs;}
async function insertRound(env:Env,c:Cup,ids:number[],round:number){const statements=knockoutPairs(ids).map(([h,a],index)=>env.DB.prepare(`INSERT INTO cup_matches(cup_id,round_number,match_number,stage,home_entry_id,away_entry_id,status,result_state,winner_entry_id) VALUES (?,?,?,'knockout',?,?,?,?,?)`).bind(c.id,round,index+1,h,a,a===null?'bye':'scheduled',a===null?'confirmed':null,a===null?h:null));await env.DB.batch([...statements,env.DB.prepare(`UPDATE cups SET lifecycle='knockout',registration_open=0 WHERE id=?`).bind(c.id)]);}

async function advance(env:Env,c:Cup,seeds=''):Promise<string>{
  const matches=await games(env,c.id);const knockout=matches.filter(m=>m.stage==='knockout');
  if(knockout.length){const round=Math.max(...knockout.map(m=>m.round_number));const current=knockout.filter(m=>m.round_number===round);if(current.some(m=>m.result_state!=='confirmed'))return 'Waiting for all current-round results to be confirmed.';const winners=current.map(m=>m.winner_entry_id).filter((id):id is number=>id!==null);if(winners.length===1){await env.DB.prepare(`UPDATE cups SET lifecycle='completed' WHERE id=?`).bind(c.id).run();return `Champion: **${(await entries(env,c.id)).find(e=>e.id===winners[0])?.entry_name}**.`;}if(winners.length>=2){await insertRound(env,c,winners,round+1);return `Round ${round+1} generated.`;}return 'This round needs organizer review.';}
  if(!matches.length||matches.some(m=>m.result_state!=='confirmed'))return 'Waiting for league results to be confirmed.';
  const teams=await entries(env,c.id);const ranked=table(teams,matches);
  if(c.competition_mode==='league'){await env.DB.prepare(`UPDATE cups SET lifecycle='completed' WHERE id=?`).bind(c.id).run();return 'League completed. See `/cup panel` for the final table.';}
  const count=c.playoff_size??2;let qualified=ranked.slice(0,count).map(e=>e.id);
  if(seeds){qualified=seeds.split(',').map(s=>Number(s.trim()));if(qualified.length!==count||new Set(qualified).size!==count||qualified.some(id=>!teams.some(e=>e.id===id)))return `Supply exactly ${count} distinct entrant IDs from the table.`;}
  else if(ranked[count]&&ranked[count-1].points===ranked[count].points&&ranked[count-1].gd===ranked[count].gd&&ranked[count-1].gf===ranked[count].gf)return 'There is a tie at the qualification cutoff. The organizer must settle it, then use `/cup advance seeds` with the qualifying entrant IDs in order.';
  await insertRound(env,c,qualified,Math.max(...matches.map(m=>m.round_number))+1);return `${count} teams qualified. Knockout fixtures generated.`;
}

async function view(env:Env,c:Cup,i:DiscordInteraction,fixtures=false):Promise<InteractionResponse>{
 const teams=await entries(env,c.id),matches=await games(env,c.id);const ranked=table(teams,matches);const page=Math.max(1,Number(val(i,'page'))||1);
 if(fixtures)return embed(`${c.name} — Fixtures`,matches.slice((page-1)*10,page*10).map(m=>`**#${m.id} · ${m.stage} R${m.round_number}**\n${m.home??'BYE'} ${m.home_score??'—'}–${m.away_score??'—'} ${m.away??'BYE'} · ${m.result_state??m.status}`).join('\n\n')||'No fixtures on this page.',[{name:'Page',value:`${page} · ${matches.length} total fixtures`}]);
 const manage=await canManageCup(env,c,i); const title=c.lifecycle==='cancelled'?'Cancelled':c.registration_open?'Registration open':c.lifecycle==='completed'?'Completed':matches.some(m=>m.stage==='knockout')?'Knockout stage':'League stage';
 const fields=[{name:'Entrants',value:teams.map(e=>`#${e.id} **${e.entry_name}**`).join('\n').slice(0,1024)||'None yet'}];
 if(matches.some(m=>m.stage==='league'))fields.push({name:'League table · points / GD / played',value:ranked.map((e,n)=>`${n+1}. **${e.entry_name}** · ${e.points} PTS / ${e.gd} GD / ${e.played} GP`).join('\n').slice(0,1024)});
 return {type:4,data:{flags:64,embeds:[{title:`${c.name} — Cup panel`,description:`**${title}** · ${teams.length} entries\n${c.competition_mode.replaceAll('_',' + ')}${c.playoff_size?` · Top ${c.playoff_size} qualify`:''}\n\nViews: \`/cup fixtures\` · \`/cup bracket\`\nResults: \`/cup submit\` · \`/cup confirm\`\n${manage?'Organizer: `/cup close` · `/cup resolve` · `/cup advance`':''}`,color:0x08bfea,fields}],components:[{type:1,components:[['fixtures','Fixtures'],['panel','Refresh table'],...(manage&&c.lifecycle!=='cancelled'?c.registration_open?[['pause','Pause registration']]:!matches.length?[['reopen','Reopen registration']]:c.lifecycle!=='completed'?[['advance','Advance stage']]:[]:[]),...(!matches.length&&c.lifecycle!=='cancelled'?[['withdraw','Withdraw entry']]:[])].map(([action,label])=>({type:2,style:2,label,custom_id:`cup:${action}:${c.slug}`}))}]}};
}

export async function cupControls(env:Env,i:DiscordInteraction):Promise<InteractionResponse|null>{
 const action=i.data?.options?.[0]?.name;if(!['list','panel','fixtures','bracket','close','submit','confirm','resolve','advance','withdraw','cancel','reopen','organizer','pause'].includes(action??''))return null;
 if(action==='list'){const rows=await env.DB.prepare('SELECT name,slug,registration_open FROM cups WHERE guild_id=? ORDER BY id DESC LIMIT 20').bind(i.guild_id??'').all<Cup>();return embed('UFB Cups',rows.results.map(c=>`**${c.name}** · ${c.registration_open?'Registration open':'In progress'}`).join('\n')||'No cups yet.');}
 const c=await env.DB.prepare('SELECT * FROM cups WHERE guild_id=? AND slug=?').bind(i.guild_id??'',val(i,'cup')).first<Cup>();if(!c)return message('Choose a cup from the selection list.',true);
 const manage=await canManageCup(env,c,i);
 if(action==='organizer'){
  if(actor(i)!==c.created_by&&!serverAdmin(i)&&!botOwner(env))return message('Only the creator, a server administrator or the bot owner can change organizers.',true);
  const member=val(i,'member');if(!member)return message('Choose a Discord member.',true);
  if(val(i,'remove')==='true')await env.DB.prepare('DELETE FROM cup_organizers WHERE cup_id=? AND discord_id=?').bind(c.id,member).run();
  else await env.DB.prepare('INSERT OR IGNORE INTO cup_organizers(cup_id,discord_id) VALUES(?,?)').bind(c.id,member).run();
  return message(val(i,'remove')==='true'?'Organizer access removed.':'Organizer access granted for this cup.',true);
 }
 if(action==='cancel'){
  if(!manage)return message('Only an authorized organizer or administrator can cancel.',true);
  if(val(i,'confirm')!=='true')return message('Use confirm:true to cancel. Entries and results will be preserved.',true);
  await env.DB.prepare("UPDATE cups SET lifecycle='cancelled',registration_open=0 WHERE id=?").bind(c.id).run();return message('Cup cancelled. Entries and results were preserved.',true);
 }
 if(c.lifecycle==='cancelled'&&!['panel','fixtures','bracket'].includes(action??''))return message('This cancelled cup is read-only.',true);
 if(action==='withdraw'||action==='reopen'||action==='pause'){
  if(await env.DB.prepare('SELECT 1 FROM cup_matches WHERE cup_id=? LIMIT 1').bind(c.id).first())return message('Fixtures already exist. Entrants and registration are locked to protect the bracket.',true);
  if(action==='withdraw'){const removed=await env.DB.prepare('DELETE FROM cup_entries WHERE cup_id=? AND manager_discord_id=?').bind(c.id,actor(i)??'').run();return message(removed.meta.changes?'Your entry was withdrawn.':'You do not have an entry in this cup.',true);}
  if(!manage)return message('Only an authorized organizer can change registration.',true);
  await env.DB.prepare('UPDATE cups SET registration_open=? WHERE id=?').bind(action==='reopen'?1:0,c.id).run();return message(action==='reopen'?'Registration reopened.':'Registration paused without generating fixtures. Use /cup reopen to resume.',true);
 }
 if(action==='panel'||action==='bracket')return view(env,c,i);if(action==='fixtures')return view(env,c,i,true);
 if(action==='close'){
  if(!manage||!c.registration_open)return message('Only an authorized organizer can close open registration.',true);
  const teams=await entries(env,c.id);if(teams.length<2)return message('At least two teams must register first.',true);if((await games(env,c.id)).length)return message('Fixtures already exist for this cup.',true);
  if(c.competition_mode==='league'||c.competition_mode==='league_knockout'){
   const q=Number(val(i,'qualifiers'));if(c.competition_mode==='league_knockout'&&(!val(i,'qualifiers')||!Number.isInteger(q)||q<2||q>teams.length||q%2))return message(`Manually choose an even qualifier count from 2 to ${teams.length} with the qualifiers option.`,true);
   const pairs:Array<[number,number]>=[];for(let h=0;h<teams.length;h++)for(let a=h+1;a<teams.length;a++)pairs.push([teams[h].id,teams[a].id]);
   const inserts=[];for(let n=0;n<pairs.length;n+=15){const chunk=pairs.slice(n,n+15);inserts.push(env.DB.prepare(`INSERT INTO cup_matches(cup_id,round_number,match_number,home_entry_id,away_entry_id,stage) VALUES ${chunk.map(()=>`(?,1,?,?,?,'league')`).join(',')}`).bind(...chunk.flatMap(([h,a],idx)=>[c.id,n+idx+1,h,a])));}
   await env.DB.batch([...inserts,env.DB.prepare(`UPDATE cups SET registration_open=0,lifecycle='league',playoff_size=? WHERE id=?`).bind(c.competition_mode==='league_knockout'?q:null,c.id)]);
  }else{const ids=teams.map(t=>t.id);if(c.format==='draw')for(let n=ids.length-1;n>0;n--){const j=crypto.getRandomValues(new Uint32Array(1))[0]%(n+1);[ids[n],ids[j]]=[ids[j],ids[n]];}await insertRound(env,c,ids,1);}
  return message(`**${c.name}** registration closed. View \`/cup fixtures\` and \`/cup panel\`.`);
 }
 if(action==='advance'){if(!manage)return message('Only an authorized organizer can advance or seed.',true);return message(await advance(env,c,val(i,'seeds')),true);}
 const match=(await games(env,c.id)).find(m=>m.id===Number(val(i,'match_id')));if(!match||match.status==='bye')return message('Choose a real fixture ID from `/cup fixtures`.',true);
 if(match.result_state==='confirmed')return message('This result is already confirmed.',true);
 const manager=botOwner(env)||actor(i)===match.home_manager||actor(i)===match.away_manager;
 if(action==='submit'||action==='resolve'){
  if(action==='resolve'?!manage:!manager)return message('Only a fixture’s manager can submit; only an authorized organizer can resolve.',true);
  const hs=Number(val(i,'home_score')),as=Number(val(i,'away_score'));if(!val(i,'home_score')||!val(i,'away_score')||!Number.isInteger(hs)||!Number.isInteger(as)||hs<0||as<0||(match.stage==='knockout'&&hs===as))return message('Enter non-negative whole-number scores. Knockout games must have a winner.',true);
  if(action==='submit'&&match.result_state==='pending')return message('A result is awaiting opponent confirmation. Confirm or dispute it first.',true);
  const saved=await env.DB.prepare('UPDATE cup_matches SET home_score=?,away_score=?,submitted_by=?,result_state=?,winner_entry_id=? WHERE id=? AND result_state IS ?').bind(hs,as,actor(i)??'',action==='resolve'?'confirmed':'pending',hs===as?null:hs>as?match.home_entry_id:match.away_entry_id,match.id,match.result_state).run();
  if(!saved.meta.changes)return message('The report changed while you were submitting. Refresh the fixture first.',true);
  return message(action==='resolve'?`Result resolved. ${await advance(env,c)}`:`Submitted **${match.home} ${hs}–${as} ${match.away}**. The opposing manager can use \`/cup confirm match_id:${match.id}\`.`);
 }
 if(!manager||actor(i)===match.submitted_by||match.result_state!=='pending')return message('Only the opposing manager can confirm or dispute a pending report.',true);
 const disputed=val(i,'decision')==='dispute';const saved=await env.DB.prepare('UPDATE cup_matches SET result_state=? WHERE id=? AND result_state=\'pending\' AND submitted_by=? AND home_score=? AND away_score=?').bind(disputed?'disputed':'confirmed',match.id,match.submitted_by,match.home_score,match.away_score).run();
 if(!saved.meta.changes)return message('The report changed. Refresh the fixture before confirming.',true);
 return message(disputed?'Result disputed. The organizer must review and use `/cup resolve`.':`Result confirmed. ${await advance(env,c)}`);
}
