export const backgrounds=['beach-sunset','mountain-pitch','touchline','mountain-stadium','coastal-stadium','unc-stadium'] as const;

export function randomBackground(){
 const value=new Uint32Array(1);crypto.getRandomValues(value);return backgrounds[value[0]%backgrounds.length];
}

export function matchBackground(choice:string,_matchId:string){return choice==='random'?randomBackground():choice;}
