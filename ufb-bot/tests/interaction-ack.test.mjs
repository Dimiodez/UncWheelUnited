import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';

test('signed /matches acknowledges before any database or EA work completes',async()=>{
 const built=await build({entryPoints:[fileURLToPath(new URL('../src/index.ts',import.meta.url))],bundle:true,format:'esm',platform:'browser',target:'es2022',external:['node:*','tty','util'],write:false});
 const {default:worker}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
 const keys=await crypto.subtle.generateKey({name:'Ed25519'},true,['sign','verify']);
 const publicKey=Buffer.from(await crypto.subtle.exportKey('raw',keys.publicKey)).toString('hex');
 const body=JSON.stringify({type:2,id:'synthetic-test',token:'synthetic-token',application_id:'synthetic-app',guild_id:'synthetic-guild',member:{user:{id:'synthetic-user',username:'Test'},roles:[],permissions:'0'},data:{name:'matches',options:[{name:'team',type:3,value:'1'}]}});
 const timestamp=String(Math.floor(Date.now()/1000));
 const signature=Buffer.from(await crypto.subtle.sign('Ed25519',keys.privateKey,new TextEncoder().encode(timestamp+body))).toString('hex');
 let release;const stalled=new Promise(resolve=>release=resolve);
 const stmt={bind(){return this;},async first(){await stalled;return null;},async all(){await stalled;return {results:[]};},async run(){await stalled;return {meta:{changes:0}};}};
 const env={DISCORD_PUBLIC_KEY:publicKey,DB:{prepare(){return stmt;}},ENVIRONMENT:'test'};
 const pending=[];let replies=0,timer;const original=globalThis.fetch;
 globalThis.fetch=async(url,options)=>{assert.equal(new URL(url).hostname,'discord.com');assert.equal(options.method,'PATCH');replies++;return new Response('{}');};
 try{
  const reply=await Promise.race([worker.fetch(new Request('https://test.invalid/interactions',{method:'POST',headers:{'x-signature-ed25519':signature,'x-signature-timestamp':timestamp},body}),env,{waitUntil(p){pending.push(p);}}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Acknowledgment missed Discord deadline')),2500);})]);
  assert.deepEqual(await reply.json(),{type:5,data:{flags:64}});
  assert.equal(replies,0);
  release();await Promise.all(pending);assert.equal(replies,1);
 }finally{clearTimeout(timer);release();await Promise.allSettled(pending);globalThis.fetch=original;}
});
