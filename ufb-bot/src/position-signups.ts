import type {DiscordInteraction,Env,InteractionResponse} from './types';
import {message} from './responses';
import {leagueStaff,ufbAdministrator} from './permissions';

export const FC27_POSITIONS=[
 {value:'GK',label:'GK — Goalkeeper'},
 {value:'LB',label:'LB — Left Back'},
 {value:'CB',label:'CB — Center Back'},
 {value:'RB',label:'RB — Right Back'},
 {value:'CDM',label:'CDM — Center Defensive Midfielder'},
 {value:'CM',label:'CM — Center Midfielder'},
 {value:'CAM',label:'CAM — Center Attacking Midfielder'},
 {value:'LM',label:'LM — Left Midfielder'},
 {value:'RM',label:'RM — Right Midfielder'},
 {value:'LW',label:'LW — Left Wing'},
 {value:'RW',label:'RW — Right Wing'},
 {value:'ST',label:'ST — Striker'}
] as const;

type Position=typeof FC27_POSITIONS[number]['value'];
type Board={id:number;guild_id:string;channel_id:string;creator_id:string;title:string;active:number};
type Selection={position:Position;display_name:string;signup_order:number};

const positionSet=new Set<string>(FC27_POSITIONS.map(position=>position.value));
const groups=[
 {name:'Goalkeeper',positions:['GK'] as Position[]},
 {name:'Defenders',positions:['LB','CB','RB'] as Position[]},
 {name:'Midfielders',positions:['CDM','CM','CAM','LM','RM'] as Position[]},
 {name:'Forwards',positions:['LW','RW','ST'] as Position[]}
];
const actor=(interaction:DiscordInteraction)=>interaction.member?.user??interaction.user;
const clean=(value:string,max:number)=>value.replace(/[<@*_`~|]/g,'').replace(/\s+/g,' ').trim().slice(0,max);
const titleOption=(interaction:DiscordInteraction)=>String(interaction.data?.options?.find(option=>option.name==='name')?.value??'').trim();

function positionLine(position:Position,rows:Selection[]):string{
 const names=rows.filter(row=>row.position===position).map(row=>clean(row.display_name,32));
 const shown=names.slice(0,8).map((name,index)=>`${index+1}. ${name}`).join(' · '),more=names.length>8?` … +${names.length-8} more`:'';
 return `**${position} — ${names.length}:** ${shown||'_Open_'}${more}`;
}

export function renderPositionBoard(board:Board,rows:Selection[]):NonNullable<InteractionResponse['data']>{
 const components=board.active?[{type:1,components:[{type:3,custom_id:`position:select:${board.id}`,placeholder:'Select every FC 27 position you can play',min_values:1,max_values:FC27_POSITIONS.length,options:FC27_POSITIONS.map(position=>({label:position.label,value:position.value}))}]},{type:1,components:[{type:2,style:2,label:'Remove my signup',custom_id:`position:remove:${board.id}`},{type:2,style:4,label:'Close signups',custom_id:`position:close:${board.id}`}]}]:[];
 return {allowed_mentions:{parse:[]},embeds:[{title:`⚽ ${clean(board.title,100)}${board.active?'':' — Closed'}`,description:'Choose every position you can play. Players are numbered left-to-right in signup order for each position. Selecting again replaces your previous choices, so include the full set you want saved.',color:board.active?0x08bfea:0x777777,fields:groups.map(group=>({name:group.name,value:group.positions.map(position=>positionLine(position,rows)).join('\n'),inline:false}))}],components};
}

async function loadBoard(env:Env,guild:string,id:number):Promise<{board:Board;rows:Selection[]}|null>{
 const board=await env.DB.prepare('SELECT id,guild_id,channel_id,creator_id,title,active FROM position_signup_boards WHERE id=? AND guild_id=?').bind(id,guild).first<Board>();
 if(!board)return null;
 const rows=await env.DB.prepare('SELECT position,display_name,signup_order FROM position_signup_selections WHERE board_id=? ORDER BY position,signup_order,rowid').bind(id).all<Selection>();
 return {board,rows:rows.results};
}

export async function positionCommand(env:Env,interaction:DiscordInteraction):Promise<InteractionResponse>{
 const user=actor(interaction),guild=interaction.guild_id,channel=interaction.channel_id;
 if(!user||!guild||!channel)return message('Use this command inside a Discord server channel.',true);
 if(!leagueStaff(env,interaction))return message('Only UFB Administrators, Moderators, and Team Managers can create a position signup.',true);
 const requested=clean(titleOption(interaction),100),title=requested||'FC 27 position signup';
 if(requested&&requested.length<3)return message('Give the position signup a name of at least three characters.',true);
 const created=await env.DB.prepare('INSERT INTO position_signup_boards (guild_id,channel_id,creator_id,title) VALUES (?,?,?,?)').bind(guild,channel,user.id,title).run();
 const loaded=await loadBoard(env,guild,Number(created.meta.last_row_id));
 return loaded?{type:4,data:renderPositionBoard(loaded.board,loaded.rows)}:message('The position signup was saved but could not be displayed.',true);
}

export async function positionComponent(env:Env,interaction:DiscordInteraction):Promise<InteractionResponse>{
 const [prefix,action,idText]=interaction.data?.custom_id?.split(':')??[],id=Number(idText),user=actor(interaction),guild=interaction.guild_id;
 if(prefix!=='position'||!['select','remove','close'].includes(action)||!Number.isSafeInteger(id)||id<1||!user||!guild)return message('This position signup control is invalid.',true);
 const loaded=await loadBoard(env,guild,id);
 if(!loaded)return message('That position signup is not in this Discord server.',true);
 if(action==='close'){
  if(loaded.board.creator_id!==user.id&&!ufbAdministrator(env,interaction))return message('Only the signup creator or a UFB Administrator can close it.',true);
  if(!loaded.board.active)return message('This position signup is already closed.',true);
  await env.DB.prepare('UPDATE position_signup_boards SET active=0,closed_at=CURRENT_TIMESTAMP WHERE id=? AND guild_id=?').bind(id,guild).run();
 }else{
  if(!loaded.board.active)return message('This position signup is closed.',true);
  if(action==='remove')await env.DB.prepare('DELETE FROM position_signup_selections WHERE board_id=? AND discord_id=?').bind(id,user.id).run();
  else{
   const values=[...new Set(interaction.data?.values??[])];
   if(!values.length||values.length>FC27_POSITIONS.length||values.some(value=>!positionSet.has(value)))return message('Choose one or more valid FC 27 positions.',true);
   const positions=values as Position[],name=clean(user.global_name||user.username,48);
   const existing=await env.DB.prepare('SELECT position,signup_order FROM position_signup_selections WHERE board_id=? AND discord_id=?').bind(id,user.id).all<{position:Position;signup_order:number}>();
   const maxima=await env.DB.prepare('SELECT position,MAX(signup_order) AS signup_order FROM position_signup_selections WHERE board_id=? GROUP BY position').bind(id).all<{position:Position;signup_order:number}>();
   const previous=new Map(existing.results.map(row=>[row.position,row.signup_order])),latest=new Map(maxima.results.map(row=>[row.position,row.signup_order]));
   const signupOrder=(position:Position)=>{const retained=previous.get(position);if(retained!==undefined)return retained;const next=(latest.get(position)??0)+1;latest.set(position,next);return next;};
   await env.DB.batch([
    env.DB.prepare('DELETE FROM position_signup_selections WHERE board_id=? AND discord_id=?').bind(id,user.id),
    ...positions.map(position=>env.DB.prepare('INSERT INTO position_signup_selections (board_id,discord_id,display_name,position,signup_order) VALUES (?,?,?,?,?)').bind(id,user.id,name,position,signupOrder(position)))
   ]);
  }
 }
 const updated=await loadBoard(env,guild,id);
 return updated?{type:7,data:renderPositionBoard(updated.board,updated.rows)}:message('The position signup could not be refreshed.',true);
}