import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('./register-commands.mjs',import.meta.url),'utf8');
const context={process:{env:{DISCORD_APPLICATION_ID:'mock',DISCORD_BOT_TOKEN:'mock',DISCORD_GUILD_ID:'mock'}}};
vm.runInNewContext(source.slice(0,source.indexOf('const response ='))+'\nglobalThis.schema=commands;',context);
const target=new URL('../assets/stat-backgrounds/commands.json',import.meta.url);
const previous=fs.existsSync(target)?fs.readFileSync(target,'utf8'):null;
const updated=JSON.stringify(context.schema,null,2)+'\n';
const patch=previous===null?'*** Begin Patch\n*** Add File: ufb-bot/assets/stat-backgrounds/commands.json\n'+updated.trimEnd().split(/\r?\n/).map(line=>'+'+line).join('\n')+'\n*** End Patch':
  '*** Begin Patch\n*** Update File: ufb-bot/assets/stat-backgrounds/commands.json\n@@\n'+previous.trimEnd().split(/\r?\n/).map(line=>'-'+line).join('\n')+'\n'+updated.trimEnd().split(/\r?\n/).map(line=>'+'+line).join('\n')+'\n*** End Patch';
console.log(JSON.stringify(patch));
