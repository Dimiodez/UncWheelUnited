// @ts-expect-error Node types are supplied by the test runtime, not the Worker build.
import {readFileSync} from 'node:fs';
// @ts-expect-error Node types are supplied by the test runtime, not the Worker build.
import {DatabaseSync} from 'node:sqlite';
import {describe,expect,it} from 'vitest';
import {centralMonth,mountainsArchive,sandyBumsArchive,syncMountains,syncSandyBums} from '../src/house-club-history';
import type {ClubMatch} from '../src/match-watchers';
import type {Env} from '../src/types';

function testDatabase(){
 const sqlite=new DatabaseSync(':memory:');
 sqlite.exec(readFileSync(new URL('../migrations/0028_sandy_bums_history.sql',(import.meta as unknown as {url:string}).url),'utf8'));
 sqlite.exec(readFileSync(new URL('../migrations/0030_mountains_history.sql',(import.meta as unknown as {url:string}).url),'utf8'));
 sqlite.exec(readFileSync(new URL('../migrations/0031_house_match_details.sql',(import.meta as unknown as {url:string}).url),'utf8'));
 const prepare=(sql:string)=>({
  bind(...values:unknown[]){
   const statement=sqlite.prepare(sql);
   return {
    run:async()=>({meta:{changes:Number(statement.run(...values as []).changes)}}),
    all:async()=>({results:statement.all(...values as [])}),
    first:async()=>statement.get(...values as [])??null,
   };
  },
 });
 return {prepare,batch:async(statements:Array<{run:()=>Promise<unknown>}>)=>{for(const statement of statements)await statement.run();}} as unknown as D1Database;
}

const match=(id:string,playedAt:number,players:Array<{id:string;name:string;goals:number;assists:number;rating:string}>,clubId='43521'):ClubMatch=>({
 id,playedAt,clubs:[
  {id:clubId,name:clubId==='96510'?'FC Mountains':'FC Sandy Bums',score:2,players:players.map(player=>({id:player.id,name:player.name,human:true,stats:['MID',player.rating,String(player.goals),'2',String(player.assists),'—','—','—','—','—','—','0','—','0']}))},
  {id:'999',name:'Opponents',score:1,players:[]},
 ],
});

describe('FC Sandy Bums historical archive',()=>{
 it('retains full sheets for both teams, including MotM and disconnected rows',async()=>{
  const env={DB:testDatabase()} as Env;
  const now=Date.parse('2026-10-03T01:00:00Z');
  const game=match('detail',now,[{id:'odez',name:'Odez',goals:1,assists:2,rating:'3.0'}]);
  game.clubs[0].players[0].motm=true;
  game.clubs[0].players[0].stats[9]='20 / 25 (80%)';
  game.clubs[1].players=[{id:'other',name:'Opponent',human:true,stats:['GK','8.0','0','0','0','—','—','—','—','5 / 10 (50%)','0 / 0 (0%)','—','—','4']}];
  await syncSandyBums(env,now,async()=>[game]);
  const data=await (await sandyBumsArchive(env,'all')).json() as {matches:Array<{details:ClubMatch}>};
  expect(data.matches[0].details.clubs).toHaveLength(2);
  expect(data.matches[0].details.clubs[0].players[0]).toMatchObject({motm:true,stats:game.clubs[0].players[0].stats});
  expect(data.matches[0].details.clubs[1].players[0].stats[13]).toBe('4');
 });
 it('assigns late UTC games to the Central-time month',()=>{
  expect(centralMonth(Date.parse('2026-10-01T02:00:00Z'))).toBe('2026-09');
  expect(centralMonth(Date.parse('2026-10-01T06:00:00Z'))).toBe('2026-10');
 });

 it('keeps departed players, deduplicates rechecks, and calculates each month from match rows',async()=>{
  const DB=testDatabase();
  const env={DB} as Env;
  const september=match('match-1',Date.parse('2026-09-30T22:00:00Z'),[{id:'odez',name:'Odez',goals:1,assists:2,rating:'8.0'}]);
  const october=match('match-2',Date.parse('2026-10-02T22:00:00Z'),[{id:'another',name:'Other Player',goals:2,assists:0,rating:'9.0'}]);
  const feed=async()=>[september,october];
  expect(await syncSandyBums(env,Date.parse('2026-10-02T23:00:00Z'),feed)).toMatchObject({matches:2});
  expect(await syncSandyBums(env,Date.parse('2026-10-02T23:01:00Z'),feed)).toMatchObject({skipped:true});
  expect(await syncSandyBums(env,Date.parse('2026-10-02T23:31:00Z'),feed)).toMatchObject({matches:2});
  const octoberData=await (await sandyBumsArchive(env,'2026-10')).json() as {matches:unknown[];players:Array<{latest_name:string;appearances:number;goals:number;average_rating:number|null}>};
  expect(octoberData.matches).toHaveLength(1);
  expect(octoberData.players).toHaveLength(2);
  expect(octoberData.players.find(player=>player.latest_name==='Odez')).toMatchObject({appearances:0,goals:0,average_rating:null});
  const all=await (await sandyBumsArchive(env,'all')).json() as {matches:unknown[];players:Array<{latest_name:string;appearances:number;goals:number;assists:number;average_rating:number}>};
  expect(all.matches).toHaveLength(2);
  expect(all.players.find(player=>player.latest_name==='Odez')).toMatchObject({appearances:1,goals:1,assists:2,average_rating:8});
 });

 it('counts a disconnected player but excludes a 3.0 rating from the average',async()=>{
  const DB=testDatabase();
  const env={DB} as Env;
  const now=Date.parse('2026-10-03T01:00:00Z');
  const played=match('disconnect',now,[{id:'odez',name:'Odez',goals:0,assists:1,rating:'3.0'}]);
  await syncSandyBums(env,now,async()=>[played]);
  const data=await (await sandyBumsArchive(env,'2026-10')).json() as {players:Array<{appearances:number;goals:number;assists:number;average_rating:number|null}>};
  expect(data.players[0]).toMatchObject({appearances:1,goals:0,assists:1,average_rating:null});
 });

 it('archives FC Mountains separately without changing Sandy Bums totals',async()=>{
  const DB=testDatabase();
  const env={DB} as Env;
  const now=Date.parse('2026-10-03T01:00:00Z');
  await syncSandyBums(env,now,async()=>[match('sandy',now,[{id:'odez',name:'Odez',goals:1,assists:0,rating:'8.0'}])]);
  await syncMountains(env,now,async()=>[match('mountain',now,[{id:'climber',name:'Climber',goals:2,assists:1,rating:'9.0'}],'96510')]);
  const sandy=await (await sandyBumsArchive(env,'all')).json() as {clubId:string;matches:unknown[];players:Array<{latest_name:string}>};
  const mountains=await (await mountainsArchive(env,'all')).json() as {clubId:string;matches:unknown[];players:Array<{latest_name:string;goals:number}>};
  expect(sandy).toMatchObject({clubId:'43521'});
  expect(sandy.matches).toHaveLength(1);
  expect(sandy.players.map(player=>player.latest_name)).toEqual(['Odez']);
  expect(mountains).toMatchObject({clubId:'96510'});
  expect(mountains.matches).toHaveLength(1);
  expect(mountains.players).toMatchObject([{latest_name:'Climber',goals:2}]);
 });
});
