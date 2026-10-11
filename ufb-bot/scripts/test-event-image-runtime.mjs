import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const {build}=await import(process.env.UFB_ESBUILD_MODULE||'esbuild');
const require=createRequire(import.meta.url);
const runtimeModule=process.env.UFB_MINIFLARE_MODULE||createRequire(require.resolve('wrangler/package.json')).resolve('miniflare');
const {Miniflare,convertV4MiniflareOptions}=await import(runtimeModule.startsWith('file:')?runtimeModule:pathToFileURL(runtimeModule).href);
const built=await build({stdin:{resolveDir:fileURLToPath(new URL('../',import.meta.url)),contents:`
 import {publishEventSignupImage} from './src/schedule-events.ts';
 export default {async fetch(request){
  if(new URL(request.url).pathname==='/repro'){
   try{new Request('https://cdn.discordapp.com/example',{redirect:'error'});return Response.json({accepted:true});}
   catch(error){return Response.json({name:error.name,message:error.message});}
  }
  let image=null,diagnostic=null,uploaded=false,redirectRejected=false;
  const event={id:1,series_id:1,starts_at:0,status:'open',name:'Runtime Flyer',guild_id:'guild',active:1,event_kind:'event',event_format:'3v3',points_win:3,points_draw:1,points_loss:0,signup_close_minutes:0,interest_only:1};
  const DB={prepare(sql){let args=[];return {bind(...values){args=values;return this;},async first(){return {...event,image_url:image};},async all(){return {results:[]};},async run(){if(sql.startsWith('UPDATE schedule_series SET image_url=NULL'))image=null;else if(sql.startsWith('UPDATE schedule_series SET image_url='))image=args[0];if(sql.startsWith('INSERT INTO bot_metadata'))diagnostic=JSON.parse(args[1]);return {meta:{changes:1}};}};}};
  const i={id:'interaction',application_id:'app',token:'test-token',guild_id:'guild',data:{options:[{name:'create',options:[{name:'image',value:'123'}]}],resolved:{attachments:{'123':{id:'123',filename:'flyer.png',content_type:'image/png',url:'https://cdn.discordapp.com/ephemeral-attachments/456/789/flyer.png?hm=test-signature'}}}}};
  const redirectTest=new URL(request.url).pathname==='/redirect';
  await publishEventSignupImage({DB},i,async(url,init)=>{
   // Exercise real workerd Request/FormData/Blob behavior, not Node's substitutes.
   const outgoing=new Request(url,init);
   if(outgoing.method==='GET'){
    if(outgoing.redirect!=='manual')throw Error('Image fetch must not follow redirects');
    if(redirectTest){redirectRejected=true;return new Response(null,{status:302,headers:{location:'https://untrusted.example/image.png'}});}
    return new Response(new Uint8Array([137,80,78,71,13,10,26,10]));
   }
   if(outgoing.headers.get('content-type').startsWith('multipart/form-data')){
    const form=await outgoing.formData(),payload=JSON.parse(form.get('payload_json'));
    uploaded=payload.embeds[0].image.url==='attachment://event-flyer.png'&&payload.components[0].components.length===4&&form.get('files[0]').size===8;
   }
   return Response.json({id:'message'});
  });
  return Response.json({uploaded,image,diagnostic,redirectRejected});
 }};
`},bundle:true,platform:'browser',format:'esm',write:false});
const options={modules:true,script:built.outputFiles[0].text,compatibilityDate:process.env.UFB_RUNTIME_DATE||'2026-09-19',compatibilityFlags:['nodejs_compat']};
const mf=new Miniflare(convertV4MiniflareOptions?convertV4MiniflareOptions(options):options);
try{
 const repro=await (await mf.dispatchFetch('http://localhost/repro')).json();
 assert.equal(repro.name,'TypeError');assert.match(repro.message,/Invalid redirect value/);
 console.log('Reproduced original Cloudflare failure:',repro.message);
 const uploaded=await (await mf.dispatchFetch('http://localhost/upload')).json();
 assert.equal(uploaded.uploaded,true,JSON.stringify(uploaded));assert.equal(uploaded.image,'attachment://event-flyer.png');assert.equal(uploaded.diagnostic,null);
 const redirect=await (await mf.dispatchFetch('http://localhost/redirect')).json();
 assert.equal(redirect.uploaded,false);assert.equal(redirect.redirectRejected,true);assert.equal(redirect.image,null);assert.equal(redirect.diagnostic.httpStatus,302);
 console.log('PASS: Cloudflare runtime downloads, reads and serializes event flyers; external redirects remain blocked.');
}finally{await mf.dispose();}
