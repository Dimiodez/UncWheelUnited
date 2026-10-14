import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
async function loadSource(file){const built=await build({entryPoints:[fileURLToPath(new URL('../src/'+file,import.meta.url))],bundle:true,platform:'node',format:'esm',write:false});return import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));}
const {liveFeed,normalizeFc27Matches,pollWatchers}=await loadSource('match-watchers.ts');
const {handleCommand}=await loadSource('commands.ts');
const {EaClubsAdapter}=await loadSource('ea.ts');
// Synthetic score/player rows: no live API or Discord traffic in tests.
const fixture=[{matchId:'99442561670221',timestamp:1791946501,clubs:{'374656':{goals:'2',details:{name:'Test Maykop'}},'412322':{goals:'1',details:{name:'Test Timbers'}}},players:{'374656':{'test-a':{name:'Test Player A',pos:'forward',rating:'8.0',goals:'2',assists:'0',shots:'3',passattempts:'20',passesmade:'16',tackleattempts:'2',tacklesmade:'1',mom:'1'}},'412322':{'test-b':{name:'Test Player B',pos:'forward',rating:'7.0',goals:'1',shots:'2',assists:'0'}}}}];
test('matches and automode use friendlies, deduplicate and retain required EA headers',async()=>{
  const db=new DatabaseSync(':memory:'),migrations=new URL('../migrations/',import.meta.url);
  for(const file of readdirSync(migrations).filter(f=>f.endsWith('.sql')).sort())db.exec(readFileSync(new URL(file,migrations),'utf8'));
  class Statement{constructor(sql){this.sql=sql;this.args=[];}bind(...a){this.args=a;return this;}async first(){return db.prepare(this.sql).get(...this.args)||null;}async all(){return {results:db.prepare(this.sql).all(...this.args)};}async run(){const r=db.prepare(this.sql).run(...this.args);return {meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}};}}
  const env={ENVIRONMENT:'test',EA_MATCHES_ENABLED:'true',EA_API_BASE_URL:'https://relay.example/api',MANAGER_ROLE_ID:'manager',DB:{prepare:sql=>new Statement(sql),batch:async a=>Promise.all(a.map(s=>s.run()))}};
  db.prepare("INSERT INTO members(discord_id,display_name) VALUES('manager','Manager')").run();
  db.prepare("INSERT INTO leagues(slug,name,squad_size,guild_id) VALUES('test','Test',10,'guild')").run();
  db.prepare("INSERT INTO teams(league_id,name,manager_discord_id,ea_club_id,ea_platform) VALUES(1,'UFL Maykop','manager','374656','common-gen5')").run();
  const team=db.prepare('SELECT * FROM teams LIMIT 1').get(),original=globalThis.fetch;
  let failed=false,duplicate=false;const requested=[];
  globalThis.fetch=async(input,options)=>{
    const url=new URL(input);requested.push(url.toString());
    if(url.hostname==='proclubs.ea.com'){
      assert.equal(url.searchParams.get('matchType'),'friendlyMatch');assert.equal(options.headers['sec-fetch-site'],'same-origin');assert.equal(options.redirect,'manual');
      return failed?new Response('Unavailable',{status:503}):Response.json(fixture);
    }
    if(url.hostname==='relay.example')return Response.json(duplicate?fixture:[]);
    throw Error('Unexpected external request');
  };
  const interaction=(name,options)=>({type:2,id:'test-'+name,token:'test',application_id:'test',guild_id:'guild',channel_id:'channel',member:{user:{id:'manager',username:'Manager'},roles:['manager'],permissions:'0'},data:{name,options}});
  try{
    const feed=await liveFeed(env)(team);assert.equal(feed.length,1);assert.equal(feed[0].id,'99442561670221');
    assert.ok(requested.some(u=>u.includes('type=leagueMatch'))&&requested.some(u=>u.includes('type=playoffMatch')));
    duplicate=true;assert.equal((await liveFeed(env)(team)).length,1);duplicate=false;
    const matches=await handleCommand(env,interaction('matches',[{name:'team',value:String(team.id)}]),new EaClubsAdapter(env));
    assert.match(matches.data?.embeds?.[0]?.title||'',/Recent matches/);assert.match(JSON.stringify(matches),/99442561670221/);
    const auto=await handleCommand(env,interaction('automode',[{name:'start',type:1,options:[{name:'team',value:String(team.id)}]}]),new EaClubsAdapter(env));
    assert.match(auto.data?.content||'',/Monitoring started/);
    const normalized=normalizeFc27Matches(fixture)[0],delivered=[];
    await pollWatchers(env,async()=>[{...normalized,playedAt:Date.now()-30000}],async(_env,_channel,content,files)=>{delivered.push({content,files});return 'test-message';},async()=>new Uint8Array([137,80,78,71]));
    assert.equal(delivered.length,1);
    await pollWatchers(env,async()=>[{...normalized,playedAt:Date.now()-30000}],async()=>{throw Error('Duplicate friendly post');},async()=>new Uint8Array([137,80,78,71]));
    failed=true;await assert.rejects(liveFeed(env)(team),/friendly feed returned 503/);
  }finally{globalThis.fetch=original;db.close();}
});
