import {leadersSvg,type LeaderFeed} from './league-leaders';
import {fetchLeagueSeason,siteLeagueCommand,type LeagueSource} from './site-league';
import type {Env,DiscordInteraction} from './types';
import {randomBackground} from './backgrounds';
export async function publishLeagueLeaders(e:Env,i:DiscordInteraction,source:LeagueSource){
 const endpoint=`https://discord.com/api/v10/webhooks/${i.application_id}/${i.token}/messages/@original`;
 try{
  const s=await fetchLeagueSeason(source) as LeaderFeed;
  const bg=await e.ASSETS.fetch(`https://assets.local/${randomBackground()}.png`);if(!bg.ok)throw Error('Background unavailable');const bytes=new Uint8Array(await bg.arrayBuffer());let binary='';for(let n=0;n<bytes.length;n+=8192)binary+=String.fromCharCode(...bytes.subarray(n,n+8192));const svg=leadersSvg(s,'data:image/png;base64,'+btoa(binary),source.name,new URL(source.url).hostname);
  const {default:puppeteer}=await import('../runtime/node_modules/@cloudflare/puppeteer/lib/esm/puppeteer/puppeteer-cloudflare.js');const browser=await puppeteer.launch(e.BROWSER);let png:Uint8Array;
  try{const page=await browser.newPage();await page.setViewport({width:1680,height:960,deviceScaleFactor:1});await page.setContent(`<html><body style="margin:0">${svg}</body></html>`);png=new Uint8Array(await page.screenshot({type:'png'}));}finally{await browser.close();}
  const form=new FormData();form.set('payload_json',JSON.stringify({content:`**${source.name}** · Top five: goals, assists and average match rating.`,allowed_mentions:{parse:[]},attachments:[{id:0,filename:'ufb-league-leaders.png'}]}));form.set('files[0]',new Blob([png.buffer as ArrayBuffer],{type:'image/png'}),'ufb-league-leaders.png');const posted=await fetch(endpoint,{method:'PATCH',body:form,signal:AbortSignal.timeout(10000)});if(!posted.ok)throw Error(`Discord image upload ${posted.status}`);
 }catch(error){console.error('League leaders image unavailable',error instanceof Error?error.message:'unknown');const fallback=await siteLeagueCommand(i,source);await fetch(endpoint,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({...fallback.data,allowed_mentions:{parse:[]}}),signal:AbortSignal.timeout(10000)}).catch(()=>console.error('League leaders fallback failed'));}
}
