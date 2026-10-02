import {describe,expect,it} from 'vitest';
import {normalizeFc27Matches,validateFeed} from '../src/match-watchers';

const raw=[{
  matchId:'6308517710036',timestamp:1789761232,
  clubs:{
    '43521':{clubId:43521,clubName:'FC Sandy Bums',score:2},
    '139023':{clubId:139023,clubName:'Plvtomanians',score:1},
  },
  players:{
    '213325369':{playerId:'213325369',name:'Schweinslap',position:'midfielder',goals:1,assists:0,shots:2,passes:42,passesCompleted:31,tackles:4,tacklesWon:2,interceptions:3,rating:9.4,saves:0,clubId:'43521'},
    '1985209162':{playerId:'1985209162',name:'DxmmySnags',position:'midfielder',goals:1,assists:0,shots:1,passes:21,passesCompleted:15,tackles:3,tacklesWon:1,rating:8.1,saves:0,clubId:'139023'},
  },
}];

describe('FC27 relay normalization',()=>{
  it('maps the verified EA club, score, time and human player columns',()=>{
    const matches=normalizeFc27Matches(raw);
    expect(validateFeed(matches)).toEqual(matches);
    expect(matches[0].id).toBe('6308517710036');
    expect(matches[0].playedAt).toBe(1789761232000);
    expect(matches[0].clubs.map(c=>[c.id,c.name,c.score])).toEqual([
      ['43521','FC Sandy Bums',2],['139023','Plvtomanians',1],
    ]);
    expect(matches[0].clubs[0].players[0]).toMatchObject({id:'213325369',name:'Schweinslap',human:true});
    expect(matches[0].clubs[0].players[0].stats).toEqual(['MID','9.4','1','2','0','—','—','—','—','31 / 42 (74%)','2 / 4 (50%)','3','—','0']);
  });

  it('rejects malformed responses instead of inventing match data',()=>{
    expect(()=>normalizeFc27Matches([{matchId:'bad',timestamp:1,clubs:{}}])).toThrow('Invalid FC27 clubs');
  });
});
