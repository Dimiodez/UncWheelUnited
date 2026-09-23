export type Builder = { id:number; x:number; target:number; progress:number; lastSlide:number };
export type Castle = { id:number; x:number; hp:number; lastSlide:number };
export class BeachModel {
  lastTackles: {kind:string;id:number}[]=[];
  builders:Builder[]=[];
  castles:Castle[]=[{id:0,x:520,hp:2,lastSlide:-1}];
  elapsed=0;
  nextBuilder=4;
  nextGoose=90;
  goose: {x:number; dropped:boolean}|null=null;
  can: {x:number;y:number}|null=null;
  private id=0;
  reset(){this.builders=[];this.castles=[{id:0,x:520,hp:2,lastSlide:-1}];this.elapsed=0;this.nextBuilder=4;this.nextGoose=90;this.goose=null;this.can=null;this.id=0;}
  get pressure(){return 1+this.elapsed/90;}
  tick(dt:number, random= Math.random){
    this.elapsed+=dt;
    if(this.elapsed>=this.nextBuilder){
      const target=60+random()*840;
      this.builders.push({id:++this.id,x:random()<.5?-20:980,target,progress:0,lastSlide:-1});
      this.nextBuilder=this.elapsed+8/Math.sqrt(this.pressure);
    }
    for(const b of this.builders){const movement=(65+this.elapsed*.6)*dt;if(Math.abs(b.x-b.target)>movement)b.x+=Math.sign(b.target-b.x)*movement;else{b.x=b.target;b.progress+=dt*this.pressure/6;}}
    for(const b of this.builders.filter(b=>b.progress>=1))this.castles.push({id:b.id,x:b.target,hp:2,lastSlide:-1});
    this.builders=this.builders.filter(b=>b.progress<1);
    if(this.elapsed>=this.nextGoose){this.goose={x:-50,dropped:false};this.nextGoose=this.elapsed+90+random()*30;}
    if(this.goose){this.goose.x+=150*dt;if(!this.goose.dropped&&this.goose.x>=480){this.goose.dropped=true;this.can={x:this.goose.x,y:110};}if(this.goose.x>1010)this.goose=null;}
    if(this.can){this.can.y+=100*dt;if(this.can.y>510)this.can=null;}
  }
  tackle(x:number,slide:number){
    this.lastTackles=[];
    let points=0;const removed=new Set<number>();
    for(const b of this.builders)if(Math.abs(b.x-x)<40&&b.lastSlide!==slide){removed.add(b.id);points+=150;this.lastTackles.push({kind:'builder',id:b.id});}
    this.builders=this.builders.filter(b=>!removed.has(b.id));
    for(const c of this.castles)if(Math.abs(c.x-x)<42&&c.lastSlide!==slide){c.lastSlide=slide;c.hp--;if(c.hp===0){points+=250;this.lastTackles.push({kind:'castle',id:c.id});}}
    this.castles=this.castles.filter(c=>c.hp>0);return points;
  }
  catchCan(x:number,y:number){if(this.can&&Math.abs(x-this.can.x)<30&&Math.abs(y-this.can.y)<45){this.can=null;return true;}return false;}
}

