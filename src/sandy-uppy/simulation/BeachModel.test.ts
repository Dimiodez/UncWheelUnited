import {it,expect} from 'vitest';
import {BeachModel} from './BeachModel';
import {SandyGameModel} from './GameModel';
it('every fresh run begins with a castle that still needs two separate slides',()=>{
 const b=new BeachModel();expect(b.castles).toHaveLength(1);
 const x=b.castles[0].x;expect(b.tackle(x,1)).toBe(0);expect(b.tackle(x,1)).toBe(0);
 expect(b.tackle(x,2)).toBe(250);expect(b.castles).toHaveLength(0);
 b.reset();expect(b.castles).toEqual([{id:0,x:520,hp:2,lastSlide:-1}]);
});
it('losing a life waits for a new launch without erasing run progress',()=>{
 const g=new SandyGameModel();g.start();g.tick(130);g.registerTouch('Header');g.registerDrop();
 const before=g.snapshot();g.registerDrop();g.tick(30);expect(g.snapshot()).toEqual(before);
 g.start();expect(g.snapshot()).toMatchObject({score:100,dropsRemaining:2,secondsSurvived:130});expect(g.difficulty).toBeGreaterThan(2.5);
 expect(g.extraLife()).toBe(true);expect(g.extraLife()).toBe(false);
});
it('builders can be stopped and castles require two distinct tackles',()=>{
 const b=new BeachModel();b.builders=[{id:1,x:300,target:300,progress:.5,lastSlide:-1}];
 expect(b.tackle(300,1)).toBe(150);expect(b.builders).toHaveLength(0);expect(b.tackle(300,1)).toBe(0);
 b.castles=[{id:2,x:300,hp:2,lastSlide:-1}];expect(b.tackle(300,2)).toBe(0);b.tackle(300,2);expect(b.castles[0].hp).toBe(1);
 expect(b.tackle(300,3)).toBe(250);expect(b.castles).toHaveLength(0);
});
it('builders finish castles faster as beach pressure grows',()=>{
 const early=new BeachModel(),late=new BeachModel();late.elapsed=300;
 for(const b of [early,late]){b.castles=[];b.nextBuilder=999;b.builders=[{id:1,x:300,target:300,progress:0,lastSlide:-1}];}
 for(let i=0;i<240;i++){early.tick(1/120);late.tick(1/120);}
 expect(early.castles).toHaveLength(0);expect(late.castles).toHaveLength(1);
});
it('rare goose drops a catchable can, missed cans expire and reset clears hazards',()=>{
 const b=new BeachModel();b.nextBuilder=999;
 for(let i=0;i<89*60;i++)b.tick(1/60,()=>.5);expect(b.goose).toBeNull();
 for(let i=0;i<6*60;i++)b.tick(1/60,()=>.5);expect(b.can).not.toBeNull();
 expect(b.catchCan(10,450)).toBe(false);expect(b.catchCan(b.can!.x,b.can!.y)).toBe(true);expect(b.catchCan(480,450)).toBe(false);
 b.can={x:200,y:509};b.tick(.1);expect(b.can).toBeNull();b.reset();expect(b.elapsed).toBe(0);expect(b.nextGoose).toBe(90);
});

