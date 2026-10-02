import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {build} from 'esbuild';

const built=await build({entryPoints:[new URL('../src/commands.ts',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1')],bundle:true,platform:'node',format:'esm',write:false});
const {handleCommand}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
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
const env={ENVIRONMENT:'test',MANAGER_ROLE_ID:'manager',EA_MATCHES_ENABLED:'false',DB:{prepare:sql=>new Statement(sql),batch:async statements=>{db.exec('BEGIN');try{const results=[];for(const statement of statements)results.push(await statement.run());db.exec('COMMIT');return results;}catch(error){db.exec('ROLLBACK');throw error;}}}};
const ea={searchClubs:async()=>[],recentMatches:async()=>[],matchStats:async()=>[]};
const fixture=JSON.parse(readFileSync(new URL('../../.official-site/pickems-app/season-data.json',import.meta.url),'utf8'));
globalThis.fetch=async()=>Response.json(fixture);

function interaction(name,options=[]){
 return {type:2,id:`test-${name}`,token:'test',application_id:'test',guild_id:'guild',channel_id:'channel',member:{user:{id:'administrator',username:'administrator'},roles:['manager'],permissions:'8'},data:{name,options}};
}
function paths(command){
 const nested=(command.options??[]).filter(option=>option.type===1||option.type===2);
 if(!nested.length)return [{label:`/${command.name}`,options:[]}];
 return nested.flatMap(option=>option.type===2?(option.options??[]).filter(child=>child.type===1).map(child=>({label:`/${command.name} ${option.name} ${child.name}`,options:[{name:option.name,type:2,options:[{name:child.name,type:1,options:[]}]}]})):[{label:`/${command.name} ${option.name}`,options:[{name:option.name,type:1,options:[]}]}]);
}

const workshopNames=new Set(['recruit','sign','release']);
const schema=JSON.parse(readFileSync(new URL('../assets/stat-backgrounds/commands.json',import.meta.url),'utf8'))
 .filter(command=>!workshopNames.has(command.name))
 .map(command=>command.name==='setup'?{...command,options:command.options.filter(option=>option.name!=='channel')}:command);
const commandPaths=schema.flatMap(command=>paths(command).map(path=>({...path,name:command.name})));
for(const command of commandPaths){
 const response=await handleCommand(env,interaction(command.name,command.options),ea);
 assert.ok(response&&Number.isInteger(response.type),`${command.label} did not return a Discord interaction response`);
 assert.ok(response.data,`${command.label} returned no response data`);
}
for(const name of workshopNames){
 const response=await handleCommand(env,interaction(name));
 assert.match(response.data?.content??'',/workspace/,'Workshop command should be unavailable');
}
assert.equal(schema.length,17,'Unexpected published root-command count');
assert.equal(commandPaths.length,35,'Unexpected published command-path count');
console.log(`PASS: all ${schema.length} published root commands and ${commandPaths.length} root/subcommand paths dispatch without an unhandled error.`);
