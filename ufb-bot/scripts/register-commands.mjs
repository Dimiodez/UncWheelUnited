const applicationId = process.env.DISCORD_APPLICATION_ID;
const botToken = process.env.DISCORD_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;
if (!applicationId || !botToken) throw new Error('Set DISCORD_APPLICATION_ID and DISCORD_BOT_TOKEN before registering global commands.');

const commands = [
  {"name":"gamestats","description":"Find a league game between two clubs and post both stat sheets","options":[{"name":"league","description":"Choose the competition first","type":3,"required":true,"autocomplete":true},{"name":"team_a","description":"Choose the first registered team","type":3,"required":true,"autocomplete":true},{"name":"team_b","description":"Choose the second registered team","type":3,"required":true,"autocomplete":true},{"name":"timeout","description":"Minutes to wait for EA updates (default 15)","type":4,"min_value":5,"max_value":60},{"name":"match_id","description":"Optional recent head-to-head match","type":3,"autocomplete":true},{"name":"demo","description":"Manager-only: fictional PNG test; no live records changed","type":5}]},
  {"name":"draft","description":"Create drafts, join the pool and pick exclusive squads","options":[{"name":"create","description":"Organizer: create a draft","type":1,"options":[{"name":"name","description":"Draft name","type":3,"required":true,"max_length":80},{"name":"mode","description":"Pick order","type":3,"choices":[{"name":"Snake","value":"snake"},{"name":"Round robin","value":"round_robin"}]},{"name":"rules","description":"Draft rules","type":3,"max_length":1000}]},{"name":"captain","description":"Organizer: add a side and its captain","type":1,"options":[{"name":"draft","description":"Choose a draft in this server","type":3,"required":true,"autocomplete":true},{"name":"side","description":"Side name","type":3,"required":true},{"name":"member","description":"Captain","type":6,"required":true}]},{"name":"start","description":"Organizer: start captain selections","type":1,"options":[{"name":"draft","description":"Choose a draft in this server","type":3,"required":true,"autocomplete":true}]},{"name":"panel","description":"Open your private draft control guide","type":1,"options":[{"name":"draft","description":"Choose a draft in this server","type":3,"required":true,"autocomplete":true}]},{"name":"join","description":"Join the open player pool","type":1,"options":[{"name":"draft","description":"Choose a draft in this server","type":3,"required":true,"autocomplete":true}]},{"name":"leave","description":"Leave the open player pool","type":1,"options":[{"name":"draft","description":"Choose a draft in this server","type":3,"required":true,"autocomplete":true}]},{"name":"pool","description":"View players still available","type":1,"options":[{"name":"draft","description":"Choose a draft in this server","type":3,"required":true,"autocomplete":true},{"name":"page","description":"Available-player page","type":4,"min_value":1}]},{"name":"squads","description":"View drafted squads","type":1,"options":[{"name":"draft","description":"Choose a draft in this server","type":3,"required":true,"autocomplete":true}]},{"name":"recap","description":"View the draft pick recap","type":1,"options":[{"name":"draft","description":"Choose a draft in this server","type":3,"required":true,"autocomplete":true}]},{"name":"pick","description":"Captain: select an available player","type":1,"options":[{"name":"draft","description":"Choose a draft in this server","type":3,"required":true,"autocomplete":true},{"name":"page","description":"Available-player page","type":4,"min_value":1},{"name":"side","description":"Organizer override: choose a side","type":3,"required":false,"autocomplete":true}]}]},
  { name: 'ufb', description: 'Open the Unc Futból Bot command directory' },
  { name: 'cup', description: 'Create, enter, and draw UFB cups', options: [
    {"name":"list","description":"List available competitions","type":1},
    {"name":"panel","description":"View competition controls and standings","type":1,"options":[{"name":"cup","description":"Choose a cup","type":3,"required":true,"autocomplete":true}]},
    {"name":"fixtures","description":"View fixture IDs and result status","type":1,"options":[{"name":"cup","description":"Choose a cup","type":3,"required":true,"autocomplete":true},{"name":"page","description":"Available-player page","type":4,"min_value":1}]},
    {"name":"submit","description":"Manager: submit a score for opponent confirmation","type":1,"options":[{"name":"cup","description":"Choose a cup","type":3,"required":true,"autocomplete":true},{"name":"match_id","description":"Fixture ID from /cup fixtures","type":4,"required":true,"min_value":1},{"name":"home_score","description":"Home team score","type":4,"required":true,"min_value":0},{"name":"away_score","description":"Away team score","type":4,"required":true,"min_value":0}]},
    {"name":"resolve","description":"Organizer: resolve a disputed or missing score","type":1,"options":[{"name":"cup","description":"Choose a cup","type":3,"required":true,"autocomplete":true},{"name":"match_id","description":"Fixture ID from /cup fixtures","type":4,"required":true,"min_value":1},{"name":"home_score","description":"Home team score","type":4,"required":true,"min_value":0},{"name":"away_score","description":"Away team score","type":4,"required":true,"min_value":0}]},
    {"name":"confirm","description":"Opponent: confirm or dispute a score","type":1,"options":[{"name":"cup","description":"Choose a cup","type":3,"required":true,"autocomplete":true},{"name":"match_id","description":"Fixture ID from /cup fixtures","type":4,"required":true,"min_value":1},{"name":"decision","description":"Confirm the score or dispute it","type":3,"required":true,"choices":[{"name":"Confirm","value":"confirm"},{"name":"Dispute","value":"dispute"}]}]},
    {"name":"advance","description":"Organizer: advance a completed stage or seed qualifiers","type":1,"options":[{"name":"cup","description":"Choose a cup","type":3,"required":true,"autocomplete":true},{"name":"seeds","description":"Optional qualifying entry IDs in order, comma-separated","type":3}]},
    { name: 'create', description: 'Create a new cup', type: 1, options: [{ name: 'name', description: 'Cup name', type: 3, required: true }, { name: 'entry_type', description: 'Who can enter', type: 3, required: true, choices: [{ name: 'UFB teams', value: 'team' }, { name: 'BYOT — bring your own team', value: 'byot' }] }, { name: 'format', description: 'Cup format', type: 3, required: true, choices: [{ name: 'Knockout', value: 'knockout' }, { name: 'Random draw knockout', value: 'draw' }, { name: 'League', value: 'league' }, { name: 'League + knockout', value: 'league_knockout' }] }] },
    { name: 'register', description: 'Register a team for a cup', type: 1, options: [{ name: 'cup', description: 'Choose an open cup', type: 3, required: true, autocomplete: true }, { name: 'entry', description: 'Your UFB team or BYOT team name', type: 3, required: true }] },
    { name: 'bracket', description: 'View cup entries or bracket', type: 1, options: [{ name: 'cup', description: 'Choose a cup', type: 3, required: true, autocomplete: true }] },
    { name: 'close', description: 'Close registration and generate competition', type: 1, options: [{ name: 'cup', description: 'Choose your cup', type: 3, required: true, autocomplete: true }, { name: 'qualifiers', description: 'League + knockout only; even number advancing', type: 4, required: false }] }
  ] },
  { name: 'recruit', description: 'Sign players, recruit for clubs, and manage free agents', options: [
    {name:'sign',description:'Manager: choose multiple Discord players for your roster',type:1,options:[{name:'team',description:'Your registered team',type:3,required:true,autocomplete:true}]},
    {name:'channel',description:'Admin: assign, view or clear a league free-agent channel',type:1,options:[{name:'competition',description:'Choose an active league',type:3,required:true,autocomplete:true},{name:'channel',description:'Discord channel for automatic free-agent posts',type:7,channel_types:[0,5]},{name:'clear',description:'Remove the competition channel assignment',type:5}]},
    { name: 'club', description: 'Post a recruitment listing for your team', type: 1, options: [{ name: 'team', description: 'Your UFB team', type: 3, required: true }, { name: 'positions', description: 'Positions needed, e.g. GK, CB, CM', type: 3, required: true }, { name: 'contact', description: 'Discord contact, e.g. @name', type: 3, required: true }, { name: 'pitch', description: 'Short pitch for your club', type: 3, required: true }] },
    { name: 'freeagent', description: 'Post yourself as a free agent in one or more leagues', type: 1, options: [{name:'league_1',description:'Choose a league created in this server or All active leagues',type:3,required:true,autocomplete:true},{ name: 'primary', description: 'Your top three positions', type: 3, required: true }, { name: 'backup', description: 'Backup positions', type: 3, required: true }, { name: 'avoid', description: 'Positions you do not want to play', type: 3, required: true }, { name: 'contact', description: 'Discord contact, e.g. @name', type: 3, required: true }, { name: 'pitch_availability', description: 'Pitch and availability: about you, days/times and timezone', type: 3, required: true },{name:'league_2',description:'Optional second active league',type:3,autocomplete:true},{name:'league_3',description:'Optional third active league',type:3,autocomplete:true}] },
    { name: 'browse', description: 'View active recruiting posts', type: 1, options: [{ name: 'type', description: 'What to browse', type: 3, required: true, choices: [{ name: 'Clubs recruiting', value: 'club' }, { name: 'Free agents', value: 'free_agent' }] }, {name:'competition',description:'Filter free agents by active league',type:3,autocomplete:true}] },
    { name: 'close', description: 'Remove your active recruiting post', type: 1, options: [{ name: 'type', description: 'Post to remove', type: 3, required: true, choices: [{ name: 'Club post', value: 'club' }, { name: 'Free-agent post', value: 'free_agent' }] }] },
    {name:'fa',description:'Manager free-agent reports',type:2,options:[{name:'list',description:'List active free agents grouped by competition',type:1}]}
  ] },
  { name: 'claim', description: 'Claim your EA player identity', options: [{ name: 'player', description: 'EA player name', type: 3, required: true }] },
  { name: 'profile', description: 'View your UFB player profile' },
  { name: 'register', description: 'Register a team and appoint up to three managers', options: [{ name: 'team', description: 'Team name', type: 3, required: true }, { name: 'league', description: 'Optional open league; assign one later with /team assign', type: 3, autocomplete: true }, { name: 'manager_1', description: 'Admin: required; team managers may leave blank to self-register', type: 6 }, { name: 'manager_2', description: 'Second manager; administrator only', type: 6 }, { name: 'manager_3', description: 'Third manager; administrator only', type: 6 }] },
  { name: 'sign', description: 'Sign a player to your team', options: [{ name: 'team', description: 'Your team name', type: 3, required: true }, { name: 'member', description: 'Discord player', type: 6, required: true }] },
  { name: 'release', description: 'Release a player from your team', options: [{ name: 'team', description: 'Your team name', type: 3, required: true }, { name: 'member', description: 'Discord player', type: 6, required: true }] },
  { name: 'roster', description: 'View a UFB roster', options: [{ name: 'team', description: 'Team name', type: 3, required: true }] },
  { name: 'team', description: 'View or dissolve a registered UFB team', options: [
    {name:'view',description:'View league, manager, roster and EA link details',type:1,options:[{name:'team',description:'Team name',type:3,required:true}]},
    {name:'dissolve',description:'Manager or UFB Admin: permanently close a team',type:1,options:[{name:'team',description:'Team to dissolve',type:3,required:true},{name:'confirm',description:'Required confirmation that this team should be dissolved',type:5,required:true}]}
  ] },
  { name: 'linkclub', description: 'Find and link your team’s real EA club', options: [{ name: 'team', description: 'Your UFB team name', type: 3, required: true }, { name: 'club', description: 'Exact EA club name', type: 3, required: true }, { name: 'platform', description: 'EA platform group', type: 3, required: true, choices: [{ name: 'PS5 / Xbox Series / PC', value: 'common-gen5' }, { name: 'PS4 / Xbox One', value: 'common-gen4' }] }] },
  { name: 'matches', description: 'View recent EA club matches', options: [{ name: 'team', description: 'Team name', type: 3, required: true }] },
  { name: 'reportmatch', description: 'Report a manual friendly result', options: [{ name: 'team', description: 'Your team', type: 3, required: true }, { name: 'opponent', description: 'Opponent name', type: 3, required: true }, { name: 'team_score', description: 'Your score', type: 4, required: true }, { name: 'opponent_score', description: 'Opponent score', type: 4, required: true }] },
  { name: 'reportstat', description: 'Add a player line to a reported match', options: [{ name: 'match_id', description: 'Match ID from /reportmatch', type: 4, required: true }, { name: 'member', description: 'Player', type: 6, required: true }, { name: 'goals', description: 'Goals', type: 4, required: true }, { name: 'assists', description: 'Assists', type: 4, required: true }, { name: 'rating', description: 'Rating from 0 to 10', type: 10, required: false }] },
  { name: 'stats', description: 'Choose a recent UFB match and view player stats', options: [{ name: 'team', description: 'Team name', type: 3, required: true }] },
  { name: 'playerstats', description: 'View a claimed player’s overall FC27 Pro Clubs stats', options: [{ name: 'member', description: 'Discord player (defaults to you)', type: 6, required: false }] },
  {"name":"automode","description":"Manage automatic per-game club stat sheets","options":[{"name":"start","type":1,"description":"Watch a linked club and post each new game in this channel","options":[{"name":"team","description":"Choose a linked team (competition shown in suggestions)","type":3,"required":true,"autocomplete":true},{"name":"idle_minutes","description":"Stop after this many minutes without a new match (default 60)","type":4,"min_value":15,"max_value":240}]},{"name":"stop","type":1,"description":"Stop watching this team in this channel","options":[{"name":"team","description":"Choose a linked team (competition shown in suggestions)","type":3,"required":true,"autocomplete":true}]},{"name":"status","type":1,"description":"Show active watchers in this channel"}]},
  { name: 'matchnight', description: 'Create a Yes / Tentative / No RSVP', options: [{ name: 'team', description: 'Your team name', type: 3, required: true }, { name: 'starts_at', description: 'Example: Tonight 8:30 PM CT', type: 3, required: true }] },
  { name: 'standings', description: 'View league standings', options: [{ name: 'league', description: 'Choose an official UNC league', type: 3, required: true, autocomplete: true }] },
  { name: 'schedule', description: 'View the official website league schedule', options:[{name:'week',description:'Matchweek; defaults to the next unplayed week',type:4,min_value:1}] },
  { name: 'leaguestats', description: 'Top five league players: goals, assists and average match rating', options:[{name:'league',description:'Choose a league configured in this Discord server',type:3,required:true,autocomplete:true}] },
  {name:'info',description:'Owner-only UFB system information and data controls',options:[{name:'reset',description:'Owner only: preview and reset saved UFB data for this Discord',type:1}]}
];

// Consistent competition-first selectors; stored values are team IDs, not names.
const registeredLeague={name:'league',description:'Choose the registered competition before selecting a team',type:3,required:true,autocomplete:true};
const cupOption={name:'cup',description:'Choose a cup',type:3,required:true,autocomplete:true};
const officialLeague=commands.find(c=>c.name==='leaguestats').options[0];
for(const command of commands){
 if(['sign','release','roster','linkclub','matches','reportmatch','stats','matchnight','gamestats'].includes(command.name)){
  if(!command.options.some(option=>option.name==='league'))command.options.unshift({...registeredLeague});
  for(const option of command.options)if(['team','team_a','team_b'].includes(option.name)){option.autocomplete=true;option.description='Select the team and competition from suggestions';}
 }
 if(command.name==='team')for(const sub of command.options){sub.options.unshift({...registeredLeague});sub.options.find(o=>o.name==='team').autocomplete=true;sub.options.find(o=>o.name==='team').description='Select the team and competition from suggestions';}
 if(command.name==='recruit'){
  const sign=command.options.find(s=>s.name==='sign');sign.options.unshift({...registeredLeague});
  const club=command.options.find(s=>s.name==='club');club.options.unshift({...registeredLeague});club.options.find(o=>o.name==='team').autocomplete=true;
  const fa=command.options.find(s=>s.name==='freeagent');
  command.options.push({name:'renew',description:'Bump your last free-agent listing and restart its seven days',type:1});
  command.options.push({name:'edit',description:'Change your listing and restart its seven-day window',type:1,options:fa.options.map(o=>({...o,required:false}))});
 }
}
commands.find(c=>c.name==='schedule').options.unshift({...officialLeague});
commands.find(c=>c.name==='cup').options.find(s=>s.name==='panel').options[0].required=false;
commands.find(c=>c.name==='cup').options.push(
 ...[['withdraw','Withdraw your entry before fixtures exist'],['pause','Organizer: pause registration without generating fixtures'],['reopen','Organizer: reopen registration before fixtures exist']].map(([name,description])=>({name,description,type:1,options:[{...cupOption}]})),
 {name:'cancel',description:'Organizer: cancel a cup while preserving its history',type:1,options:[{...cupOption},{name:'confirm',description:'Confirm cancellation; entries and results are preserved',type:5,required:true}]},
 {name:'organizer',description:'Creator/admin: grant or remove organizer access for this cup',type:1,options:[{...cupOption},{name:'member',description:'Organizer',type:6,required:true},{name:'remove',description:'Remove instead of grant access',type:5}]}
);
commands.push({name:'setup',description:'UFB staff setup, defaults, channels and feed diagnostics',options:[
 {name:'create',description:'Create any supported UFB competition',type:1,options:[
  {name:'type',description:'Competition type',type:3,required:true,choices:[{name:'Official 6v6 league',value:'league_6v6'},{name:'Official 10v10 league',value:'league_10v10'},{name:'Custom league',value:'league_custom'},{name:'UFB team cup',value:'cup_team'},{name:'BYOT cup',value:'cup_byot'},{name:'Player draft',value:'draft'}]},
  {name:'name',description:'Competition name, for example UNC 6v6 Season 2',type:3,required:true,max_length:80},
  {name:'team_size',description:'Custom league only: players per side, such as 1 or 3',type:4,min_value:1,max_value:11},
  {name:'format',description:'Cup or draft format; sensible default when omitted',type:3,choices:[{name:'Knockout',value:'knockout'},{name:'Random draw knockout',value:'draw'},{name:'League table',value:'league'},{name:'League then knockout',value:'league_knockout'},{name:'Snake draft',value:'snake'},{name:'Round-robin draft order',value:'round_robin'}]},
  {name:'rules',description:'Optional draft rules',type:3,max_length:1000}
 ]},
 {name:'competitions',description:'List leagues, cups and drafts configured in this server',type:1},
 {name:'leaguesource',description:"Link, inspect or clear this league's website statistics feed",type:1,options:[{name:'league',description:'League in this Discord server',type:3,required:true,autocomplete:true},{name:'url',description:'Public UFL website season-data JSON URL',type:3},{name:'clear',description:'Remove the linked website source',type:5}]},
 {name:'team',description:'Create an admin-managed house or test team without joining its roster',type:1,options:[{...registeredLeague},{name:'name',description:'Team name',type:3,required:true,max_length:80}]},
 {name:'registration',description:'Open or close registration for an official league',type:1,options:[{...registeredLeague},{name:'state',description:'Registration state',type:3,required:true,choices:[{name:'Open',value:'open'},{name:'Closed',value:'closed'}]}]},
 {name:'roles',description:'Choose UFB Administrator, Moderator and Team Manager roles',type:1},
 {name:'helpcenter',description:'Create or refresh the categorized UFB help channel and threads',type:1},
 {name:'panel',description:'Private administrator settings panel',type:1},
 {name:'channel',description:'Assign, view or clear a competition free-agent channel',type:1,options:commands.find(c=>c.name==='recruit').options.find(s=>s.name==='channel').options},
 {name:'checkfeed',description:'Validate the configured match feed for a linked team',type:1,options:[{...registeredLeague},{name:'team',description:'Choose a linked team',type:3,required:true,autocomplete:true}]},
 {name:'health',description:'Check links, feed status, jobs and publishing channels',type:1}
]});
// Workshop command definitions intentionally remain above so development can resume
// without reconstructing their schemas. They are excluded from the published bot.
const workshopCommands=commands.filter(command=>['cup','draft'].includes(command.name));
const setupCommand=commands.find(command=>command.name==='setup');
const setupCreate=setupCommand.options.find(option=>option.name==='create');
setupCreate.description='Create an official or custom UFB league';
setupCreate.options=setupCreate.options.filter(option=>!['format','rules'].includes(option.name));
setupCreate.options.find(option=>option.name==='type').choices=setupCreate.options.find(option=>option.name==='type').choices.filter(choice=>choice.value.startsWith('league_'));
setupCommand.options.find(option=>option.name==='competitions').description='List configured official and custom leagues';
commands.splice(0,commands.length,...commands.filter(command=>!workshopCommands.includes(command)&&!['recruit','sign','release'].includes(command.name)));
setupCommand.options=setupCommand.options.filter(option=>option.name!=='channel');
const headers={authorization:`Bot ${botToken}`,'content-type':'application/json'};
const globalCommands=commands.map(command=>({...command,integration_types:[0],contexts:[0]}));
const response = await fetch(`https://discord.com/api/v10/applications/${applicationId}/commands`, {
  method: 'PUT', headers, body: JSON.stringify(globalCommands)
});
if (!response.ok) throw new Error(`Discord command registration failed: ${response.status} ${await response.text()}`);
if(guildId){
 const cleanup=await fetch(`https://discord.com/api/v10/applications/${applicationId}/guilds/${guildId}/commands`,{method:'PUT',headers,body:'[]'});
 if(!cleanup.ok)throw new Error(`Discord legacy guild-command cleanup failed: ${cleanup.status} ${await cleanup.text()}`);
}
console.log(`Registered ${globalCommands.length} global UFB server commands${guildId?' and cleared the legacy test-server copies':''}.`);
