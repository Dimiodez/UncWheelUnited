import {afterEach,describe,expect,it,vi} from 'vitest';
import {houseClubFeed} from '../src/house-club-history';
import type {Env} from '../src/types';
import type {LinkedTeam} from '../src/match-watchers';
const env={EA_MATCHES_ENABLED:'true',EA_API_BASE_URL:'https://relay.example/api'} as Env;
const team={ea_club_id:'43521',ea_platform:'common-gen5'} as LinkedTeam;
const fixture=(id='regular')=>({matchId:id,timestamp:1793567521,clubs:{'43521':{goals:'2',details:{name:'FC Sandy Bums'}},'999':{goals:'1',details:{name:'Opponent'}}},players:{}});
afterEach(()=>vi.unstubAllGlobals());
describe('house regular-game feed isolation',()=>{
 it('never requests friendlies or EA directly; deduplicates regular games',async()=>{
  const calls:string[]=[];
  vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL)=>{
   const url=new URL(String(input));calls.push(String(url));
   if(url.hostname!=='relay.example'||url.searchParams.get('type')!=='leagueMatch')return new Response('Forbidden',{status:403});
   return Response.json([fixture(),fixture()]);
  }));
  const result=await houseClubFeed(env)(team);
  expect(result.map(match=>match.id)).toEqual(['regular']);
  expect(calls).toHaveLength(1);
  expect(calls[0]).toContain('/api/clubs/43521/matches?');
  expect(calls[0]).not.toContain('friendlyMatch');
 });
 it('supports Mountains through the same regular-game path',async()=>{
  const game=fixture();game.clubs={'96510':{goals:'2',details:{name:'FC Mountains'}},'999':{goals:'1',details:{name:'Opponent'}}} as unknown as typeof game.clubs;
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json([game])));
  expect(await houseClubFeed(env)({...team,ea_club_id:'96510'})).toHaveLength(1);
 });
 it('fails explicitly on a regular-feed outage or unrelated club',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>new Response('Unavailable',{status:503})));
  await expect(houseClubFeed(env)(team)).rejects.toThrow('regular match feed returned 503');
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json([fixture()])));
  await expect(houseClubFeed(env)({...team,ea_club_id:'123'})).rejects.toThrow('Unrelated house match');
 });
 it('honors the disable switch and rejects insecure relay configuration',async()=>{
  await expect(houseClubFeed({...env,EA_MATCHES_ENABLED:'false'})(team)).rejects.toThrow('unavailable');
  await expect(houseClubFeed({...env,EA_API_BASE_URL:'http://relay.example'})(team)).rejects.toThrow('HTTPS');
 });
});
