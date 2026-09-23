type Event = {kind:string;t:number;id?:number};
let enabled=false, generation=0, events:Event[]=[], token:Promise<string|null>=Promise.resolve(null);
let notify=(message:string)=>{void message;};
async function post(body:object) {
 const response=await fetch('/api/sandy/run',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
 const data=await response.json().catch(()=>{throw Error('Score service unavailable. This run is practice only.');});if(!response.ok)throw Error(data.error||'Unable to save score.');return data;
}
export const rankedRun={
 get published(){return enabled;},
 configure(active:boolean,onStatus:(message:string)=>void){enabled=active;notify=onStatus;},
 reset(){
  const gen=++generation;events=[];if(!enabled)return;
  notify('Connecting your run…');
  token=post({action:'start'}).then(data=>{if(gen===generation)notify('Signed-in run · your personal best will be saved.');return data.id as string;}).catch(error=>{if(gen===generation)notify(error.message);return null;});
 },
 record(kind:string,t:number,id?:number){if(enabled)events.push({kind,t,id});},
 async finish(duration:number){
  if(!enabled)return;
  const gen=generation, log=events.slice(), pending=token;
  const id=await pending;if(!id||gen!==generation)return;
  notify('Saving score…');
  try{await post({action:'finish',id,events:log,duration});if(gen===generation){notify('Run saved · leaderboard keeps your personal best.');window.dispatchEvent(new Event('sandy-score-saved'));}}
  catch(error){if(gen===generation)notify(error instanceof Error?error.message:'Score could not be saved.');}
 }
};
