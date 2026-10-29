// @ts-expect-error Node types are supplied by the test runtime, not the Worker build.
import {readFileSync} from 'node:fs';
// @ts-expect-error Node types are supplied by the test runtime, not the Worker build.
import {DatabaseSync} from 'node:sqlite';
import {describe,expect,it} from 'vitest';
import {FC27_POSITIONS,positionCommand,positionComponent} from '../src/position-signups';
import type {DiscordInteraction,Env} from '../src/types';

function testEnv(){
 const sqlite=new DatabaseSync(':memory:');
 sqlite.exec('PRAGMA foreign_keys=ON');
 for(const migration of ['0036_position_signups.sql','0037_position_signup_order.sql'])sqlite.exec(readFileSync(new URL(`../migrations/${migration}`,(import.meta as unknown as {url:string}).url),'utf8'));
 const prepare=(sql:string)=>(
  {bind(...values:unknown[]){const statement=sqlite.prepare(sql);return {
   run:async()=>{const result=statement.run(...values as []);return {meta:{changes:Number(result.changes),last_row_id:Number(result.lastInsertRowid)}};},
   all:async()=>({results:statement.all(...values as [])}),
   first:async()=>statement.get(...values as [])??null
  };}}
 );
 const DB={prepare,batch:async(statements:Array<{run:()=>Promise<unknown>}>)=>{sqlite.exec('BEGIN');try{const results=[];for(const statement of statements)results.push(await statement.run());sqlite.exec('COMMIT');return results;}catch(error){sqlite.exec('ROLLBACK');throw error;}}} as unknown as D1Database;
 return {env:{DB,ENVIRONMENT:'test',BOT_OWNER_AUTHORIZED:true} as Env,sqlite};
}

const interaction=(user:string,type=2):DiscordInteraction=>({type,id:`i-${user}`,token:'token',application_id:'app',guild_id:'guild',channel_id:'channel',member:{user:{id:user,username:user,global_name:user},roles:[],permissions:'0'},data:{name:'position'}});

describe('/position signup boards',()=>{
 it('offers every FC 27 position and replaces each player’s multi-selection',async()=>{
  const {env,sqlite}=testEnv();
  const create=interaction('staff');create.data!.options=[{name:'name',value:'Friday Clubs'}];
  const created=await positionCommand(env,create);
  expect(created.type).toBe(4);
  const select=(created.data!.components![0] as {components:Array<{options:Array<{value:string}>;max_values:number}>}).components[0];
  expect(select.options.map(option=>option.value)).toEqual(FC27_POSITIONS.map(position=>position.value));
  expect(select.max_values).toBe(12);
  const board=sqlite.prepare('SELECT id FROM position_signup_boards').get() as {id:number};
  const player=interaction('multi-player',3);player.data={custom_id:`position:select:${board.id}`,values:['GK','CAM','ST']};
  const first=await positionComponent(env,player);expect(first.type).toBe(7);
  expect(sqlite.prepare('SELECT position FROM position_signup_selections WHERE board_id=? ORDER BY position').all(board.id).map((row:any)=>row.position)).toEqual(['CAM','GK','ST']);
  player.data.values=['LB','CB','CM','RW'];await positionComponent(env,player);
  expect(sqlite.prepare('SELECT position FROM position_signup_selections WHERE board_id=? ORDER BY position').all(board.id).map((row:any)=>row.position)).toEqual(['CB','CM','LB','RW']);
  const rendered=await positionComponent(env,{...player,data:{custom_id:`position:select:${board.id}`,values:['LB','CB','CM','RW']}});
  expect(rendered.data!.embeds![0].fields!.some(field=>field.value.includes('multi-player'))).toBe(true);
  sqlite.close();
 });

 it('shows numbered players left-to-right in signup order and preserves retained positions',async()=>{
  const {env,sqlite}=testEnv();
  await positionCommand(env,interaction('creator'));
  const board=sqlite.prepare('SELECT id FROM position_signup_boards').get() as {id:number};
  const choose=async(user:string,values:string[])=>{const input=interaction(user,3);input.data={custom_id:`position:select:${board.id}`,values};return positionComponent(env,input);};
  const remove=async(user:string)=>{const input=interaction(user,3);input.data={custom_id:`position:remove:${board.id}`};return positionComponent(env,input);};
  await choose('zeta',['ST']);await choose('alpha',['ST']);await choose('bravo',['ST']);
  const retained=await choose('alpha',['ST','GK']);
  const retainedLine=retained.data!.embeds![0].fields!.find(field=>field.name==='Forwards')!.value;
  expect(retainedLine).toContain('**ST — 3:** 1. zeta · 2. alpha · 3. bravo');
  await remove('alpha');
  const readded=await choose('alpha',['ST']);
  const readdedLine=readded.data!.embeds![0].fields!.find(field=>field.name==='Forwards')!.value;
  expect(readdedLine).toContain('**ST — 3:** 1. zeta · 2. bravo · 3. alpha');
  expect(sqlite.prepare("SELECT display_name FROM position_signup_selections WHERE position='ST' ORDER BY signup_order,rowid").all().map((row:any)=>row.display_name)).toEqual(['zeta','bravo','alpha']);
  sqlite.close();
 });

 it('removes a signup, rejects invalid positions, and lets only the creator or an admin close',async()=>{
  const {env,sqlite}=testEnv();
  const created=interaction('creator');await positionCommand(env,created);
  const board=sqlite.prepare('SELECT id FROM position_signup_boards').get() as {id:number};
  const player=interaction('player',3);player.data={custom_id:`position:select:${board.id}`,values:['GK','ST']};await positionComponent(env,player);
  player.data={custom_id:`position:select:${board.id}`,values:['GK','INVALID']};expect((await positionComponent(env,player)).data!.content).toMatch(/valid FC 27/);
  expect((sqlite.prepare('SELECT COUNT(*) AS total FROM position_signup_selections').get() as {total:number}).total).toBe(2);
  player.data={custom_id:`position:remove:${board.id}`};await positionComponent(env,player);
  expect((sqlite.prepare('SELECT COUNT(*) AS total FROM position_signup_selections').get() as {total:number}).total).toBe(0);
  const outsider=interaction('outsider',3);outsider.data={custom_id:`position:close:${board.id}`};
  const unprivileged={...env,BOT_OWNER_AUTHORIZED:false};expect((await positionComponent(unprivileged,outsider)).data!.content).toMatch(/creator/);
  const creator=interaction('creator',3);creator.data={custom_id:`position:close:${board.id}`};const closed=await positionComponent(unprivileged,creator);
  expect(closed.type).toBe(7);expect(closed.data!.components).toEqual([]);expect(closed.data!.embeds![0].title).toMatch(/Closed/);
  sqlite.close();
 });
});