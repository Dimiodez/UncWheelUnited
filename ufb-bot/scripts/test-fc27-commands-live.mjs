import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {build} from 'esbuild';

const built=await build({entryPoints:[new URL('../src/commands.ts',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1')],bundle:true,platform:'node',format:'esm',write:false});
const {handleCommand}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
const eaBuilt=await build({entryPoints:[new URL('../src/ea.ts',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1')],bundle:true,platform:'node',format:'esm',write:false});
const {EaClubsAdapter}=await import('data:text/javascript;base64,'+Buffer.from(eaBuilt.outputFiles[0].text).toString('base64'));
const watcherBuilt=await build({entryPoints:[new URL('../src/match-watchers.ts',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1')],bundle:true,platform:'node',format:'esm',write:false});
const {liveFeed,pollWatchers}=await import('data:text/javascript;base64,'+Buffer.from(watcherBuilt.outputFiles[0].text).toString('base64'));

const db=new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys=ON');
for(const file of readdirSync(new URL('../migrations/',import.meta.url)).filter(file=>file.endsWith('.sql')).sort())db.exec(readFileSync(new URL(`../migrations/${file}`,import.meta.url),'utf8'));
class Statement{
 constructor(sql){this.sql=sql;this.args=[];}
 bind(...args){this.args=args;return this;}
 async first(){return db.prepare(this.sql).get(...this.args)??null;}
 async all(){return {results:db.prepare(this.sql).all(...this.args)};}
 async run(){const result=db.prepare(this.sql).run(...this.args);return {meta:{changes:Number(result.changes),last_row_id:Number(result.lastInsertRowid)}};}
}
const env={ENVIRONMENT:'live-test',EA_MATCHES_ENABLED:'true',EA_API_BASE_URL:(process.env.EA_API_BASE_URL||'https://proclubs-api.onrender.com/api').replace(/\/$/,''),MANAGER_ROLE_ID:'manager',DB:{prepare:sql=>new Statement(sql),batch:async statements=>Promise.all(statements.map(statement=>statement.run()))}};
const ea=new EaClubsAdapter(env);
db.prepare("INSERT INTO members(discord_id,display_name) VALUES('manager','Manager')").run();
db.prepare("INSERT INTO leagues(slug,name,squad_size,guild_id) VALUES('house-teams','House Teams',11,'guild')").run();
const clubs=[['FC Sandy Bums','43521'],['FC Mountains','96510'],['UFL Gladbach','64234']];
for(const [name] of clubs)db.prepare('INSERT INTO teams(league_id,name,manager_discord_id) VALUES(1,?,?)').run(name,'manager');

const root=(name,options=[],admin=false)=>({type:2,id:`live-${name}`,token:'test',application_id:'test',guild_id:'guild',channel_id:'channel',member:{user:{id:admin?'administrator':'manager',username:admin?'administrator':'manager'},roles:['manager'],permissions:admin?'8':'0'},data:{name,options:Object.entries(options).map(([key,value])=>({name:key,value}))}});
const setup=(action,team)=>({...root('setup',{},true),data:{name:'setup',options:[{name:action,type:1,options:team?[{name:'team',value:String(team)}]:[]}]}});

for(const [name,id] of clubs){
 const team=db.prepare('SELECT id FROM teams WHERE name=?').get(name).id;
 const linked=await handleCommand(env,root('linkclub',{league:'house-teams',team:String(team),club:name,platform:'common-gen5'}),ea);
 assert.equal(linked.data?.embeds?.[0]?.title,'EA FC 27 club linked',`${name} did not link through live club search`);
 assert.equal(db.prepare('SELECT ea_club_id FROM teams WHERE id=?').get(team).ea_club_id,id,`${name} saved the wrong EA club ID`);

 const recent=await handleCommand(env,root('matches',{league:'house-teams',team:String(team)}),ea);
 assert.match(recent.data?.embeds?.[0]?.title??'',/Recent matches/,`${name} /matches did not return the live EA match card`);
 assert.ok((recent.data?.embeds?.[0]?.fields?.length??0)>0,`${name} /matches returned no live matches`);
 assert.ok((recent.data?.components?.length??0)>0,`${name} /matches returned no stat-sheet preview control`);

 const feed=await handleCommand(env,setup('checkfeed',team),ea);
 assert.equal(feed.data?.embeds?.[0]?.title,'FC27 feed ready',`${name} /setup checkfeed failed`);
 assert.match(feed.data?.embeds?.[0]?.fields?.[0]?.value??'',/human-player rows/,`${name} checkfeed did not verify player rows`);
 console.log(`PASS commands: ${name} linked as ${id}; /matches and /setup checkfeed returned live FC27 data.`);
}

const health=await handleCommand(env,setup('health'),ea);
assert.equal(health.data?.embeds?.[0]?.title,'UFB — System health');
const links=health.data?.embeds?.[0]?.fields?.find(field=>field.name==='EA FC27 links')?.value??'';
assert.match(links,/3\/3 teams linked/);
assert.equal((links.match(/✅/g)||[]).length,3,'System health did not pass all three live EA links');
console.log('PASS commands: /setup health verified all 3/3 linked clubs against the live FC27 relay.');

db.prepare("INSERT INTO guild_player_claims(guild_id,discord_id,ea_player_name) VALUES('guild','manager','Odez')").run();
const playerStats=await handleCommand(env,root('playerstats'),ea);
assert.match(playerStats.data?.embeds?.[0]?.title??'',/FC27 Pro Clubs Stats/,'/playerstats did not return EA Pro Clubs totals');
assert.match(playerStats.data?.embeds?.[0]?.description??'',/Odez/,'/playerstats did not use the claimed EA player');
const playerFields=playerStats.data?.embeds?.[0]?.fields??[];
assert.ok(Number(playerFields.find(field=>field.name==='Games played')?.value)>0,'/playerstats returned no EA games');
assert.ok(Number(playerFields.find(field=>field.name==='Goals')?.value)>0,'/playerstats returned no EA goals');
assert.match(playerFields.find(field=>field.name.startsWith('Linked Pro Clubs'))?.value??'',/FC Mountains|UFL Gladbach/,'/playerstats did not identify linked clubs containing the player');
console.log('PASS commands: /playerstats combined the claimed player’s live FC27 totals across linked Pro Clubs.');

// Prove the two-team /gamestats workflow with a real recent FC27 match while keeping
// Discord posting and Browser Rendering mocked. This writes only to the in-memory DB.
const sandy=db.prepare("SELECT * FROM teams WHERE ea_club_id='43521'").get();
const latest=(await liveFeed(env)(sandy))[0];
assert.ok(latest,'FC Sandy Bums returned no match for /gamestats verification');
const opponent=latest.clubs.find(club=>club.id!=='43521');
assert.ok(opponent,'The live match did not contain an opponent');
const opponentResult=db.prepare('INSERT INTO teams(league_id,name,manager_discord_id,ea_club_id,ea_club_name,ea_platform) VALUES(1,?,?,?,?,?)').run(`${opponent.name} — live test`,'manager',opponent.id,opponent.name,'common-gen5');
const game=await handleCommand(env,root('gamestats',{league:'house-teams',team_a:String(sandy.id),team_b:String(opponentResult.lastInsertRowid),match_id:latest.id}),ea);
assert.match(game.data?.content??'',/Searching recent FC27 history first/,'/gamestats did not queue the real selected match');
const posts=[];
await pollWatchers(env,liveFeed(env),async(_env,_channel,content,files)=>{posts.push({content,files});return `message-${posts.length}`;},async()=>new Uint8Array([137,80,78,71]));
assert.equal(posts.length,2,'/gamestats did not produce one separate sheet per team');
assert.ok(posts.every(post=>post.files.length===1&&post.content.includes('human-player stats')),'/gamestats posts were missing their team image attachment');
assert.equal(db.prepare("SELECT status FROM match_watchers ORDER BY id DESC LIMIT 1").get().status,'completed');
console.log(`PASS commands: /gamestats matched live game ${latest.id} and produced two separate team-sheet posts (${latest.clubs.map(club=>`${club.name} ${club.score}`).join(' — ')}).`);
