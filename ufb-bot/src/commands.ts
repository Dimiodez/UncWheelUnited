import { eaUnavailable, type EaAdapter } from './ea';
import {freeAgentPicker,freeAgentSelection,freeAgentBrowse,freeAgentManagerReport,competitionOptions} from './free-agent-competitions';
import {freeAgentChannelCommand} from './free-agent-channels';
import {competitionSigningUpdates,signingUpdates} from './free-agent-signing';
import {selectedTeam,teamAutocomplete,managesTeam} from './team-selectors';
import {maintainFreeAgent,expireFreeAgents} from './free-agent-maintenance';
import {navigation} from './navigation';
import {resolveLeagueSource,siteLeagueCommand} from './site-league';
import { draftCommand, draftComponent, draftAutocomplete } from './drafts';
import { cupControls } from './cup-controls';
import {watcherCommand,statsTeamAutocomplete,matchAutocomplete,recentPublishComponent} from './match-watchers';
import { embed, message } from './responses';
import type { DiscordInteraction, DiscordOption, Env, InteractionResponse } from './types';
import {botOwner,leagueStaff,teamManager,ufbAdministrator,withBotOwner} from './permissions';
import {withStaffRoles,type StaffRoleSettings} from './staff-roles';
import {infoReset} from './system-reset';
import {scheduleEventCommand,scheduleRsvp,rsvpTimezoneAutocomplete} from './schedule-events';
import {availableSlug,requireGuild,scopedSlug} from './guild-scope';

const option = (options: DiscordOption[] | undefined, name: string) => { const value = options?.find((item) => item.name === name)?.value; return typeof value === 'string' ? value.trim() : value === undefined ? '' : String(value); };
const subcommand = (interaction: DiscordInteraction) => interaction.data?.options?.find((item) => item.type === 1);
const commandOptions = (interaction: DiscordInteraction) => subcommand(interaction)?.options ?? interaction.data?.options;
const identity = (interaction: DiscordInteraction) => interaction.member?.user ?? interaction.user;
const displayName = (interaction: DiscordInteraction) => identity(interaction)?.global_name || identity(interaction)?.username || 'UFB member';
const matchnightButtons = (id: number) => [{ type: 1, components: [
  { type: 2, style: 3, label: 'Yes', emoji: { name: '✅' }, custom_id: `matchnight:${id}:yes` },
  { type: 2, style: 2, label: 'Tentative', emoji: { name: '❔' }, custom_id: `matchnight:${id}:tentative` },
  { type: 2, style: 4, label: 'No', emoji: { name: '❌' }, custom_id: `matchnight:${id}:no` }
] }];

async function ensureMember(env: Env, interaction: DiscordInteraction) {
  const user = identity(interaction);
  if (!user) throw new Error('Discord user identity was not included with this interaction.');
  await env.DB.prepare(`INSERT INTO members (discord_id, display_name) VALUES (?, ?)
    ON CONFLICT(discord_id) DO UPDATE SET display_name = excluded.display_name, updated_at = CURRENT_TIMESTAMP`)
    .bind(user.id, displayName(interaction)).run();
  return user;
}

function isManager(env: Env, interaction: DiscordInteraction) {
  return teamManager(env,interaction);
}

async function freeAgentReport(env:Env,interaction:DiscordInteraction):Promise<InteractionResponse>{
 const group=interaction.data?.options?.find(o=>o.type===2),action=group?.options?.find(o=>o.type===1)?.name;
 if(group?.name!=='fa'||action!=='list')return message('Choose a recruiting action.',true);
 if(!leagueStaff(env,interaction))return message('Only UFB Administrators, Moderators and Team Managers can view the full free-agent report.',true);
 await expireFreeAgents(env);
 return freeAgentManagerReport(env,interaction);
}

async function managerOwnsTeam(env: Env, teamName: string, discordId: string, guildId:string) {
  return selectedTeam(env,teamName,guildId,botOwner(env)?undefined:discordId);
}

async function ufb(): Promise<InteractionResponse> {
  return embed('UFB — Unc Futból Bot', 'The starting point for UNC teams, EA friendlies, and league information.', [
    { name: '👤 User', value: '`/claim` · `/profile`' },
    { name: '🏟 Team', value: '`/register` · `/team` · `/linkclub` · `/roster`' },
    { name: '⚽ FC27', value: '`/matches` · `/gamestats` · `/automode` · `/playerstats`' },
    { name: '🗓️ Attendance', value: '`/rsvp create` — one night or recurring, with optional reminders and a discussion thread · `/rsvp list` · `/rsvp cancel`' },
    { name: '🏆 League', value: '`/standings` · `/schedule` · `/leaguestats`' },
    { name: '📣 Recruiting', value: 'Free-agent and player-signing tools are in the workspace for later use.' },
    { name: '⚙️ Administrator', value: '`/setup create` · `/setup competitions` · `/setup panel` · `/info reset`' }
  ]);
}

async function recruiting(env: Env, interaction: DiscordInteraction): Promise<InteractionResponse> {
  if(interaction.data?.options?.some(o=>o.type===2))return freeAgentReport(env,interaction);
  const action = subcommand(interaction)?.name; const options = commandOptions(interaction); const user = await ensureMember(env, interaction);
  if(action==='sign')return recruitSignPicker(env,interaction,user.id);
  if (action === 'club') {
    const teamName = option(options, 'team'); const positions = option(options, 'positions'); const contact = option(options, 'contact'); const pitch = option(options, 'pitch');
    const team = await managerOwnsTeam(env, teamName, user.id, requireGuild(interaction.guild_id)); if (!team || !positions || !contact || !pitch) return message('Only that team’s manager can post. Include positions, contact, and a short pitch.', true);
    await env.DB.prepare('UPDATE recruitment_posts SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE team_id = ? AND kind = \'club\' AND active = 1').bind(team.id).run();
    await env.DB.prepare('INSERT INTO recruitment_posts (kind, author_discord_id, team_id, title, needed_positions, contact, pitch,guild_id) VALUES (\'club\', ?, ?, ?, ?, ?, ?,?)').bind(user.id, team.id, team.name, positions, contact, pitch,interaction.guild_id??null).run();
    return embed('📋 Club Recruitment', `**${team.name} are signing**\n\n_${pitch}_`, [{ name: '🎯 Looking for', value: positions, inline: true }, { name: '👤 Contact', value: contact, inline: true }]);
  }
  if (action === 'freeagent') {
    const available=await competitionOptions(env,false,interaction.guild_id);
    if(!available.length)return message('No leagues have been created in this server yet. Ask an administrator to use /setup create first.',true);
    const primary = option(options, 'primary'); const backup = option(options, 'backup'); const avoid = option(options, 'avoid'); const contact = option(options, 'contact'); const pitch = option(options, 'pitch_availability') || option(options, 'pitch');
    if (!primary || !backup || !avoid || !contact || !pitch) return message('Include primary, backup, and avoid positions, contact, and a short message.', true);
    const leagues=[...new Set(['league_1','league_2','league_3'].map(name=>option(options,name)).filter((value):value is string=>!!value))];
    if(leagues.length){if(leagues.some(value=>!available.some(c=>c.value===value)))return message('Choose leagues from the league selections.',true);if(leagues.includes('all')&&leagues.length>1)return message('Choose All active leagues by itself, or select individual leagues.',true);}
    const created=await env.DB.prepare('INSERT INTO recruitment_posts (kind, author_discord_id, title, primary_positions, backup_positions, avoid_positions, contact, pitch,active,awaiting_competitions,guild_id) VALUES (\'free_agent\', ?, ?, ?, ?, ?, ?, ?,0,1,?)').bind(user.id, displayName(interaction), primary, backup, avoid, contact, pitch,interaction.guild_id||null).run();
    const id=Number(created.meta.last_row_id);
    if(leagues.length){const result=await freeAgentSelection(env,{...interaction,type:3,data:{custom_id:`fa-competitions:${id}`,values:leagues}});return {...result,type:4};}
    return freeAgentPicker(env,interaction,id);
  }
  const kind = option(options, 'type');
  if (action === 'close') { const result = await env.DB.prepare('UPDATE recruitment_posts SET active = 0, awaiting_competitions = 0, updated_at = CURRENT_TIMESTAMP WHERE guild_id=? AND author_discord_id = ? AND kind = ? AND (active = 1 OR awaiting_competitions = 1)').bind(interaction.guild_id??'',user.id, kind).run(); return message(result.meta.changes ? 'Your recruiting post is now closed.' : 'You do not have an active post of that type.', true); }
  if (action === 'browse') { const posts = await env.DB.prepare('SELECT title, needed_positions, primary_positions, backup_positions, avoid_positions, contact, pitch FROM recruitment_posts WHERE guild_id=? AND kind = ? AND active = 1 ORDER BY updated_at DESC LIMIT 10').bind(interaction.guild_id??'',kind).all<{ title:string; needed_positions:string|null; primary_positions:string|null; backup_positions:string|null; avoid_positions:string|null; contact:string; pitch:string }>(); if (!posts.results.length) return message(`No active ${kind === 'club' ? 'club recruitment' : 'free-agent'} posts yet.`, true); return embed(kind === 'club' ? '📋 Clubs Recruiting' : '🟢 Free Agents', 'Current active UFB listings.', posts.results.map(p => ({ name: kind === 'club' ? `${p.title} are signing` : p.title, value: kind === 'club' ? `Looking for: **${p.needed_positions}**\n${p.pitch}\nContact: ${p.contact}` : `Primary: **${p.primary_positions}** · Backup: ${p.backup_positions}\nAvoid: ${p.avoid_positions}\n${p.pitch}\nContact: ${p.contact}` }))); }
  return message('Choose a recruiting action.', true);
}

const cupSlug = (name: string) => name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
const nextPowerOfTwo = (value: number) => { let size = 2; while (size < value) size *= 2; return size; };

const cupFormatLabel = (mode: string) => ({ knockout: 'Knockout', draw: 'Random draw knockout', league: 'League', league_knockout: 'League + knockout' }[mode] || 'Knockout');
// Keep the knockout field near half of registration, always even. On a tie, let
// the larger even field qualify: 9–10 entries => 6, while 32 => 16.
const playoffSizeFor = (entries: number) => Math.max(2, Math.ceil(entries / 4) * 2);

async function cupBracket(env: Env, cup: { id: number; name: string; entry_type: string; format: string; competition_mode?: string; playoff_size?: number | null }): Promise<InteractionResponse> {
  const entries = await env.DB.prepare('SELECT entry_name FROM cup_entries WHERE cup_id = ? ORDER BY entry_name COLLATE NOCASE').bind(cup.id).all<{ entry_name: string }>();
  const mode = cup.competition_mode ?? cup.format;
  const matches = await env.DB.prepare(`SELECT m.match_number, m.status, m.stage, h.entry_name AS home, a.entry_name AS away FROM cup_matches m LEFT JOIN cup_entries h ON h.id = m.home_entry_id LEFT JOIN cup_entries a ON a.id = m.away_entry_id WHERE m.cup_id = ? AND m.round_number = 1 ORDER BY m.match_number`).bind(cup.id).all<{ match_number: number; status: string; stage: string; home: string | null; away: string | null }>();
  if (!matches.results.length) return embed(`${cup.name} — Registration`, `${entries.results.length} entries registered. The organizer will generate the competition when registration closes.`, [{ name: 'Format', value: `${cupFormatLabel(mode)} · ${cup.entry_type === 'byot' ? 'BYOT' : 'UFB teams'}`, inline: true }, { name: 'Entries', value: entries.results.length ? entries.results.map((entry, i) => `${i + 1}. ${entry.entry_name}`).join('\n') : '_None yet_' }]);
  const lines = matches.results.map((match) => `${match.match_number}. **${match.home ?? 'BYE'}** vs **${match.away ?? 'BYE'}**${match.status === 'bye' ? ' — bye' : ''}`).join('\n');
  if (mode === 'league' || mode === 'league_knockout') return embed(`${cup.name} — League Stage`, `${entries.results.length} entries · ${matches.results.length} league fixtures. ${mode === 'league_knockout' ? `The top ${cup.playoff_size} advance to knockout.` : 'The team highest in the table wins.'}`, [{ name: 'Fixtures', value: lines }]);
  return embed(`${cup.name} — Round 1`, `${mode === 'draw' ? 'Random draw complete.' : 'Knockout bracket created.'} ${entries.results.length} entries.`, [{ name: 'Round 1', value: lines }]);
}

async function cup(env: Env, interaction: DiscordInteraction): Promise<InteractionResponse> {
  const action = subcommand(interaction)?.name; const options = commandOptions(interaction); const user = await ensureMember(env, interaction);
  if (action === 'create') {
    if (!isManager(env, interaction)) return message('Only members with the Discord **Manager** role can create a cup.', true);
    const name = option(options, 'name'); const entryType = option(options, 'entry_type'); const format = option(options, 'format'); const guild=requireGuild(interaction.guild_id); const baseSlug=cupSlug(name);
    if (!name || !baseSlug || !['team', 'byot'].includes(entryType) || !['knockout', 'draw', 'league', 'league_knockout'].includes(format)) return message('Choose a cup name, entry type, and format.', true);
    let slug:string;
    try { slug=await availableSlug(env.DB,'cups',guild,baseSlug,name);await env.DB.prepare('INSERT INTO cups (slug, name, entry_type, format, competition_mode, created_by, guild_id) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(slug, name, entryType, format === 'draw' ? 'draw' : 'knockout', format, user.id,guild).run(); }
    catch (error) { if (error instanceof Error && (error.message.includes('UNIQUE')||error.message.includes('GUILD_NAME_EXISTS'))) return message('A cup with that name already exists. Choose a different name.', true); throw error; }
    return embed('Cup created', `**${name}** is open for registration.`, [{ name: 'Entries', value: entryType === 'byot' ? 'BYOT — managers may enter any team name.' : 'UFB team — managers enter one of their registered UFB teams.', inline: true }, { name: 'Format', value: format === 'league' ? 'League — every entry plays every other entry.' : format === 'league_knockout' ? 'League + knockout — table first, then the top teams advance.' : format === 'draw' ? 'Random draw — entries will be shuffled into a knockout bracket.' : 'Knockout — single elimination with automatic byes.', inline: true }, { name: 'Next', value: `Managers can use \`/cup register cup:${slug}\`.` }]);
  }
  const slug = option(options, 'cup').toLowerCase();
  const found = await env.DB.prepare('SELECT id, slug, name, entry_type, format, competition_mode, playoff_size, registration_open, created_by FROM cups WHERE guild_id=? AND slug = ?').bind(interaction.guild_id??'',slug).first<{ id: number; slug: string; name: string; entry_type: string; format: string; competition_mode: string; playoff_size: number | null; registration_open: number; created_by: string }>();
  if (!found) return message('Choose a cup from the selection list.', true);
  if (action === 'register') {
    if (!found.registration_open) return message(`Registration for **${found.name}** is closed.`, true);
    let entryName = option(options, 'entry'); if (!entryName) return message('Enter the team name you want to register.', true);
    let teamId: number | null = null;
    if (found.entry_type === 'team') { const owned = await managerOwnsTeam(env, entryName, user.id,requireGuild(interaction.guild_id)); if (!owned) return message('This cup requires one of your registered UFB teams. Use that exact team name.', true); teamId = owned.id; entryName=owned.name; }
    try { await env.DB.prepare('INSERT INTO cup_entries (cup_id, entry_name, manager_discord_id, team_id) VALUES (?, ?, ?, ?)').bind(found.id, entryName, user.id, teamId).run(); }
    catch (error) { if (error instanceof Error && error.message.includes('UNIQUE')) return message('That team, or your manager account, is already registered for this cup.', true); throw error; }
    return embed('Cup entry registered', `**${entryName}** is in **${found.name}**.`, [{ name: 'Format', value: cupFormatLabel(found.competition_mode), inline: true }, { name: 'Next', value: 'The organizer will close registration and generate the competition.' }]);
  }
  if (action === 'close') {
    if (!isManager(env, interaction) || found.created_by !== user.id&&!botOwner(env)) return message('Only the manager who created this cup can close registration.', true);
    const entries = await env.DB.prepare('SELECT id FROM cup_entries WHERE cup_id = ? ORDER BY registered_at, id').bind(found.id).all<{ id: number }>();
    if (entries.results.length < 2) return message('A cup needs at least two registered entries before its bracket can be made.', true);
    const requestedQualifiers = option(options, 'qualifiers'); const playoffSize = requestedQualifiers === '' ? playoffSizeFor(entries.results.length) : Number(requestedQualifiers);
    if (found.competition_mode === 'league_knockout' && (!Number.isInteger(playoffSize) || playoffSize < 2 || playoffSize > entries.results.length || playoffSize % 2 !== 0)) return message(`Qualifiers must be an even whole number from 2 through ${entries.results.length}.`, true);
    const existing = await env.DB.prepare('SELECT id FROM cup_matches WHERE cup_id = ? LIMIT 1').bind(found.id).first(); if (existing) return message('This cup already has a bracket.', true);
    if (found.competition_mode === 'league' || found.competition_mode === 'league_knockout') {
      let matchNumber = 1; for (let home = 0; home < entries.results.length; home += 1) for (let away = home + 1; away < entries.results.length; away += 1) { await env.DB.prepare('INSERT INTO cup_matches (cup_id, round_number, match_number, home_entry_id, away_entry_id, stage) VALUES (?, 1, ?, ?, ?, \'league\')').bind(found.id, matchNumber++, entries.results[home].id, entries.results[away].id).run(); }
      const storedPlayoffSize = found.competition_mode === 'league_knockout' ? playoffSize : null; await env.DB.prepare('UPDATE cups SET registration_open = 0, playoff_size = ? WHERE id = ?').bind(storedPlayoffSize, found.id).run(); found.playoff_size = storedPlayoffSize; return cupBracket(env, found);
    }
    const seeded = [...entries.results]; if (found.competition_mode === 'draw') for (let i = seeded.length - 1; i > 0; i -= 1) { const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1); [seeded[i], seeded[j]] = [seeded[j], seeded[i]]; }
    const slots = [...seeded, ...Array(nextPowerOfTwo(seeded.length) - seeded.length).fill(null)];
    for (let i = 0; i < slots.length; i += 2) { const home = slots[i] as { id: number } | null; const away = slots[i + 1] as { id: number } | null; await env.DB.prepare('INSERT INTO cup_matches (cup_id, round_number, match_number, home_entry_id, away_entry_id, status) VALUES (?, 1, ?, ?, ?, ?)').bind(found.id, (i / 2) + 1, home?.id ?? null, away?.id ?? null, home && away ? 'scheduled' : 'bye').run(); }
    await env.DB.prepare('UPDATE cups SET registration_open = 0 WHERE id = ?').bind(found.id).run(); return cupBracket(env, found);
  }
  if (action === 'bracket') return cupBracket(env, found);
  return message('Choose a cup action.', true);
}

async function claim(env: Env, interaction: DiscordInteraction): Promise<InteractionResponse> {
  const playerName = option(interaction.data?.options, 'player');
  if (!playerName) return message('Choose the EA player name you want to claim.', true);
  const user = await ensureMember(env, interaction);
  try {
    await env.DB.prepare(`INSERT INTO guild_player_claims (guild_id, discord_id, ea_player_name) VALUES (?, ?, ?)
      ON CONFLICT(guild_id,discord_id) DO UPDATE SET ea_player_name = excluded.ea_player_name, claimed_at = CURRENT_TIMESTAMP`)
      .bind(requireGuild(interaction.guild_id),user.id, playerName).run();
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE')) return message(`**${playerName}** is already claimed by another Discord account.`, true);
    throw error;
  }
  return embed('EA player claimed', `**${displayName(interaction)}** is now linked to **${playerName}**.`, [{ name: 'Next', value: 'Use `/playerstats` to view your FC27 totals. Player-signing tools are currently in the workspace.' }]);
}

async function profile(env: Env, interaction: DiscordInteraction): Promise<InteractionResponse> {
  const user = await ensureMember(env, interaction);
  const guild=requireGuild(interaction.guild_id);
  const claim = await env.DB.prepare('SELECT ea_player_name FROM guild_player_claims WHERE guild_id=? AND discord_id = ?').bind(guild,user.id).first<{ ea_player_name: string }>();
  const teams = await env.DB.prepare(`SELECT t.name,CASE WHEN t.unassigned=1 THEN NULL ELSE l.name END AS league_name,CASE WHEN EXISTS(SELECT 1 FROM team_managers mgr WHERE mgr.team_id=t.id AND mgr.discord_id=?) OR t.manager_discord_id=? THEN 'manager' ELSE 'player' END AS role FROM teams t JOIN leagues l ON l.id=t.league_id WHERE l.guild_id=? AND t.dissolved_at IS NULL AND (EXISTS(SELECT 1 FROM team_members tm WHERE tm.team_id=t.id AND tm.discord_id=?) OR EXISTS(SELECT 1 FROM team_managers mgr WHERE mgr.team_id=t.id AND mgr.discord_id=?) OR t.manager_discord_id=?) ORDER BY t.unassigned DESC,l.name,t.name`).bind(user.id,user.id,guild,user.id,user.id,user.id).all<{ name: string; league_name: string|null; role: string }>();
  const registeredTeams = teams.results.length ? teams.results.map((team) => `${team.role === 'manager' ? '👑' : '⚽'} **${team.name}** — ${team.league_name??'Unassigned'}`).join('\n') : '_No UFB teams yet._';
  return embed(`${displayName(interaction)} — UFB profile`, 'Your UFB identity and current teams.', [{ name: 'EA player', value: claim?.ea_player_name || '_Not claimed_', inline: true }, { name: 'Teams', value: registeredTeams }]);
}

async function register(env: Env, interaction: DiscordInteraction): Promise<InteractionResponse> {
  if (!isManager(env, interaction)) return message('Only members with the Discord **Manager** role can register a team.', true);
  const leagueSlug = option(interaction.data?.options, 'league').toLowerCase();
  const teamName = option(commandOptions(interaction), 'team');
  if (!teamName) return message('Enter a team name.', true);
  const user = await ensureMember(env, interaction);
  const guild=requireGuild(interaction.guild_id);
  const requested=['manager_1','manager_2','manager_3'].map(name=>option(commandOptions(interaction),name)).filter(Boolean);
  if(ufbAdministrator(env,interaction)&&!requested.length)return message('Choose `manager_1` for this team. Select yourself only if you want to manage it; administrators are never assigned automatically.',true);
  if(option(commandOptions(interaction),'manager_2')&&!option(commandOptions(interaction),'manager_1')||option(commandOptions(interaction),'manager_3')&&!option(commandOptions(interaction),'manager_2'))return message('Choose managers in order: first, then second, then third.',true);
  if(requested.length!==new Set(requested).size)return message('Choose each manager only once.',true);
  if(requested.some(id=>!/^[0-9]{15,22}$/.test(id)))return message('Choose managers from the Discord member picker.',true);
  if(requested.some(id=>id!==user.id)&&!ufbAdministrator(env,interaction))return message('Only a UFB Administrator or Discord administrator can appoint another team manager.',true);
  const managers=requested.length?requested:[user.id];
  const league = leagueSlug?await env.DB.prepare('SELECT id,name,squad_size FROM leagues WHERE guild_id=? AND slug=? AND registration_open=1 AND archived_at IS NULL AND is_system=0').bind(guild,leagueSlug).first<{id:number;name:string;squad_size:number}>():null;
  if (leagueSlug&&!league) return message('That league is unavailable or registration is closed. Ask an administrator to review it with `/setup competitions` or create it with `/setup create`.', true);
  if(!league&&await env.DB.prepare('SELECT 1 FROM teams t JOIN leagues l ON l.id=t.league_id WHERE l.guild_id=? AND t.unassigned=1 AND t.name=? AND t.dissolved_at IS NULL').bind(guild,teamName).first())return message(`An unassigned team named **${teamName}** already exists in this server. Choose it from the team selector or use a different name.`,true);
  const holdingSlug=scopedSlug(guild,`unassigned-${crypto.randomUUID()}`);
  try {
    await env.DB.batch([
      ...managers.map(id=>env.DB.prepare('INSERT INTO members(discord_id,display_name) VALUES(?,?) ON CONFLICT(discord_id) DO NOTHING').bind(id,id===user.id?displayName(interaction):`Discord member ${id}`)),
      ...(league?[env.DB.prepare('INSERT INTO teams (league_id,name,manager_discord_id) VALUES (?,?,?)').bind(league.id,teamName,managers[0])]:[env.DB.prepare("INSERT INTO leagues(slug,name,squad_size,registration_open,is_system,guild_id) VALUES(?,'Unassigned club',1,0,1,?)").bind(holdingSlug,guild),env.DB.prepare('INSERT INTO teams(league_id,name,manager_discord_id,unassigned) SELECT id,?,?,1 FROM leagues WHERE guild_id=? AND slug=?').bind(teamName,managers[0],guild,holdingSlug)]),
      ...managers.map(id=>env.DB.prepare('INSERT INTO team_managers(team_id,discord_id) SELECT t.id,? FROM teams t JOIN leagues l ON l.id=t.league_id WHERE l.guild_id=? AND l.slug=? AND t.name=?').bind(id,guild,leagueSlug||holdingSlug,teamName)),
      ...(!requested.length?[env.DB.prepare("INSERT INTO team_members(team_id,discord_id,role) SELECT t.id,?,'manager' FROM teams t JOIN leagues l ON l.id=t.league_id WHERE l.guild_id=? AND l.slug=? AND t.name=?").bind(user.id,guild,leagueSlug||holdingSlug,teamName),...(league?competitionSigningUpdates(env,user.id,interaction.guild_id,`${league.squad_size}v${league.squad_size}`):[])]:[])
    ]);
  } catch (error) {
    if(error instanceof Error&&error.message.includes('ROSTER_LEAGUE_CONFLICT'))return message('You already belong to a team in this league. Release that membership first.',true);
    if (error instanceof Error && error.message.includes('UNIQUE')) return message(`**${teamName}** is already registered${league?` in ${league.name}`:' without a league'}.`, true);
    throw error;
  }
  return embed('Team registered', league?`**${teamName}** is registered for **${league.name}**.`:`**${teamName}** is registered without a league.`, [
    { name: managers.length===1?'Manager':'Managers', value: managers.map(id=>`<@${id}>`).join(', '), inline: true },
    { name: 'Competition', value: league?.name??'_Not assigned_', inline: true },
    { name: 'Roster', value: requested.length?'Appointed managers were not added as players.':'The self-registering manager was also added as a player.' },
    { name: 'Next', value: league?'Use `/linkclub` to connect this team to its EA club. Player-signing tools are currently in the workspace.':'Use `/linkclub` now if desired. Later use `/team assign` to place the club into an open league.' }
  ]);
}

async function sign(env: Env, interaction: DiscordInteraction): Promise<InteractionResponse> {
  const teamName = option(interaction.data?.options, 'team');
  const memberId = option(interaction.data?.options, 'member');
  const user = await ensureMember(env, interaction);
  if (!teamName || !memberId) return message('Choose a team and Discord member to sign.', true);
  const team = await managerOwnsTeam(env, teamName, user.id,requireGuild(interaction.guild_id));
  if (!team) return message('Only that team’s manager can sign players.', true);
  await env.DB.prepare('INSERT INTO members (discord_id, display_name) VALUES (?, ?) ON CONFLICT(discord_id) DO NOTHING').bind(memberId, `Discord member ${memberId}`).run();
  try {
    await env.DB.batch([env.DB.prepare("INSERT INTO team_members (team_id, discord_id, role) VALUES (?, ?, 'player')").bind(team.id, memberId),...signingUpdates(env,memberId,interaction.guild_id,team.id)]);
  } catch (error) {
    if (error instanceof Error && error.message.includes('ROSTER_LEAGUE_CONFLICT')) return message('That player already belongs to another team in this league. Their current manager must release them first. Playing in a different league is still allowed.',true);
    if (error instanceof Error && error.message.includes('UNIQUE')) return message('That player is already on this roster.', true);
    throw error;
  }
  return message(`Signed <@${memberId}> to **${team.name}**. Free-agent availability for this team's league has been removed; other competitions remain unchanged. Channel updates are queued.`);
}

async function recruitSignPicker(env:Env,interaction:DiscordInteraction,managerId:string):Promise<InteractionResponse>{
 const teamValue=option(commandOptions(interaction),'team');
 const team=await managerOwnsTeam(env,teamValue,managerId,requireGuild(interaction.guild_id));
 if(!team)return message('Only that team’s manager can sign players.',true);
 return {type:4,data:{content:`Choose up to 10 Discord members to sign to **${team.name}**. They do not need to use \`/claim\` first; claiming only links an EA player identity.`,flags:64,components:[{type:1,components:[{type:5,custom_id:`recruit-sign:${team.id}:${managerId}`,placeholder:'Select players to sign',min_values:1,max_values:10}]}]}};
}

async function recruitSignSelection(env:Env,interaction:DiscordInteraction):Promise<InteractionResponse>{
 const [prefix,teamId,managerId]=interaction.data?.custom_id?.split(':')??[];
 const actor=identity(interaction)?.id??'';
 if(prefix!=='recruit-sign'||!teamId||actor!==managerId)return message('This signing selector belongs to the manager who opened it.',true);
 const team=await managerOwnsTeam(env,teamId,actor,requireGuild(interaction.guild_id));
 if(!team)return message('You no longer manage that team.',true);
 const members=[...new Set(interaction.data?.values??[])].slice(0,10);
 if(!members.length)return message('Select at least one Discord member.',true);
 const signed:string[]=[],already:string[]=[],conflicts:string[]=[],failed:string[]=[];
 for(const memberId of members){
  try{
   await env.DB.prepare('INSERT INTO members (discord_id, display_name) VALUES (?, ?) ON CONFLICT(discord_id) DO NOTHING').bind(memberId,`Discord member ${memberId}`).run();
   await env.DB.batch([env.DB.prepare("INSERT INTO team_members (team_id, discord_id, role) VALUES (?, ?, 'player')").bind(team.id,memberId),...signingUpdates(env,memberId,interaction.guild_id,team.id)]);
   signed.push(memberId);
  }catch(error){const detail=String(error);if(detail.includes('ROSTER_LEAGUE_CONFLICT'))conflicts.push(memberId);else if(detail.includes('UNIQUE'))already.push(memberId);else failed.push(memberId);}
 }
 const lines=[signed.length?`**Signed (${signed.length})** ${signed.map(id=>`<@${id}>`).join(', ')}`:'',already.length?`**Already rostered here** ${already.map(id=>`<@${id}>`).join(', ')}`:'',conflicts.length?`**Already on another team in this league** ${conflicts.map(id=>`<@${id}>`).join(', ')}`:'',failed.length?`**Could not sign** ${failed.map(id=>`<@${id}>`).join(', ')}`:''].filter(Boolean);
 return {type:7,data:{content:`${lines.join('\n')}\n\nFree-agent availability was removed only for successfully signed players in this league; their other leagues remain unchanged.`,flags:64,components:[]}};
}

async function release(env: Env, interaction: DiscordInteraction): Promise<InteractionResponse> {
  const teamName = option(interaction.data?.options, 'team');
  const memberId = option(interaction.data?.options, 'member');
  const user = await ensureMember(env, interaction);
  if (!teamName || !memberId) return message('Choose a team and Discord member to release.', true);
  const team = await managerOwnsTeam(env, teamName, user.id,requireGuild(interaction.guild_id));
  if (!team) return message('Only that team’s manager can release players.', true);
  const result = await env.DB.prepare("DELETE FROM team_members WHERE team_id = ? AND discord_id = ? AND role = 'player'").bind(team.id, memberId).run();
  if (!result.meta.changes) return message('That member is not a releasable player on this roster.', true);
  return message(`Released <@${memberId}> from **${team.name}**.`);
}

async function roster(env: Env, interaction: DiscordInteraction): Promise<InteractionResponse> {
  const teamName = option(interaction.data?.options, 'team');
  if (!teamName) return message('Choose a team to view its roster.', true);
  const guild=requireGuild(interaction.guild_id),team = await selectedTeam(env,teamName,guild);
  if (!team) return message('No UFB team matches that name.', true);
  const members = await env.DB.prepare(`SELECT m.display_name, tm.role, pc.ea_player_name FROM team_members tm JOIN members m ON m.discord_id = tm.discord_id LEFT JOIN guild_player_claims pc ON pc.discord_id = m.discord_id AND pc.guild_id=? WHERE tm.team_id = ? ORDER BY tm.role DESC, m.display_name COLLATE NOCASE`).bind(guild,team.id).all<{ display_name: string; role: string; ea_player_name: string | null }>();
  const list = members.results.length ? members.results.map((member) => `${member.role === 'manager' ? '👑' : '⚽'} **${member.display_name}**${member.ea_player_name ? ` — ${member.ea_player_name}` : ''}`).join('\n') : '_No players signed yet._';
  const managers=await env.DB.prepare('SELECT discord_id FROM team_managers WHERE team_id=? ORDER BY discord_id').bind(team.id).all<{discord_id:string}>();
  return embed(`${team.name} roster`, `**${team.league_name??'Unassigned'}**\nManagers: ${(managers.results.length?managers.results.map(row=>`<@${row.discord_id}>`):[`<@${team.manager_discord_id}>`]).join(', ')}\n\nPlayers:\n${list}`);
}

async function team(env: Env, interaction: DiscordInteraction): Promise<InteractionResponse> {
  const action=subcommand(interaction)?.name??'view';
  const teamName = option(commandOptions(interaction), 'team');
  if (!teamName) return message('Choose a team to view.', true);
  const guild=requireGuild(interaction.guild_id),selected = await selectedTeam(env,teamName,guild);
  if(action==='assign'){
    const user=await ensureMember(env,interaction),leagueSlug=option(commandOptions(interaction),'league').toLowerCase(),confirmed=option(commandOptions(interaction),'confirm')==='true';
    if(!selected)return message('Choose an active team from the suggestions.',true);
    const admin=ufbAdministrator(env,interaction);
    if(!await managesTeam(env,selected.id,user.id)&&!admin)return message('Only that team’s manager or a UFB Administrator can assign it to a league.',true);
    const target=await env.DB.prepare(`SELECT id,name,squad_size,registration_open FROM leagues WHERE guild_id=? AND slug=? AND archived_at IS NULL AND is_system=0 ${admin?'':'AND registration_open=1'}`).bind(guild,leagueSlug).first<{id:number;name:string;squad_size:number;registration_open:number}>();
    if(!target)return message(admin?'Choose an active league.':'Choose an open league. An administrator can reopen registration with `/setup registration`.',true);
    if(selected.unassigned===0&&selected.league_id===target.id)return message(`**${selected.name}** is already assigned to **${target.name}**.`,true);
    if(!confirmed)return message(`Nothing changed. Run \`/team assign\` again with **confirm:true** to place **${selected.name}** in **${target.name}**.`,true);
    const roster=await env.DB.prepare('SELECT discord_id FROM team_members WHERE team_id=?').bind(selected.id).all<{discord_id:string}>();
    try{await env.DB.batch([env.DB.prepare('UPDATE teams SET league_id=?,unassigned=0 WHERE id=? AND dissolved_at IS NULL').bind(target.id,selected.id),...(target.squad_size===6||target.squad_size===10?roster.results.flatMap(member=>competitionSigningUpdates(env,member.discord_id,interaction.guild_id,`${target.squad_size}v${target.squad_size}`)):[])]);}
    catch(error){if(String(error).includes('ROSTER_LEAGUE_CONFLICT'))return message('This team cannot enter that league because at least one roster member already belongs to another team there. Release the conflicting membership first.',true);throw error;}
    return message(`**${selected.name}** is now assigned to **${target.name}**. Its manager, roster and EA club link were preserved.`,true);
  }
  if(action==='unassign'){
    const user=await ensureMember(env,interaction),confirmed=option(commandOptions(interaction),'confirm')==='true';
    if(!selected)return message('Choose an active team from the suggestions.',true);
    if(!await managesTeam(env,selected.id,user.id)&&!ufbAdministrator(env,interaction))return message('Only that team’s manager or a UFB Administrator can remove it from a league.',true);
    if(selected.unassigned===1)return message(`**${selected.name}** is already unassigned.`,true);
    if(!confirmed)return message(`Nothing changed. Run \`/team unassign\` again with **confirm:true** to remove **${selected.name}** from **${selected.league_name}**.`,true);
    await env.DB.prepare('UPDATE teams SET unassigned=1 WHERE id=? AND dissolved_at IS NULL').bind(selected.id).run();
    return message(`**${selected.name}** was removed from **${selected.league_name}** and is now unassigned. Its manager, roster, EA club link and history were preserved; use \`/team assign\` to place it in another league.`,true);
  }
  if(action==='dissolve'){
    const user=await ensureMember(env,interaction),confirmed=option(commandOptions(interaction),'confirm')==='true';
    if(!selected)return message('Choose an active team from the suggestions.',true);
    if(!await managesTeam(env,selected.id,user.id)&&!ufbAdministrator(env,interaction))return message('Only that team’s manager or a UFB Administrator can dissolve it.',true);
    if(!confirmed)return message(`Nothing changed. Run \`/team dissolve\` again with **confirm:true** to dissolve **${selected.name}**.`,true);
    const roster=await env.DB.prepare('SELECT COUNT(*) AS n FROM team_members WHERE team_id=?').bind(selected.id).first<{n:number}>();
    await env.DB.batch([
      env.DB.prepare("UPDATE match_watchers SET status='stopped',last_error='Team dissolved' WHERE status='pending' AND (team_a=? OR team_b=?)").bind(selected.id,selected.id),
      env.DB.prepare("UPDATE recruitment_posts SET active=0,awaiting_competitions=0,updated_at=CURRENT_TIMESTAMP WHERE team_id=? AND active=1").bind(selected.id),
      env.DB.prepare("UPDATE matchnights SET status='closed' WHERE team_id=? AND status='open'").bind(selected.id),
      env.DB.prepare('DELETE FROM team_members WHERE team_id=?').bind(selected.id),
      env.DB.prepare('DELETE FROM team_managers WHERE team_id=?').bind(selected.id),
      env.DB.prepare('UPDATE teams SET dissolved_at=CURRENT_TIMESTAMP,ea_club_id=NULL,ea_club_name=NULL,ea_platform=NULL,ea_crest_url=NULL WHERE id=? AND dissolved_at IS NULL').bind(selected.id)
    ]);
    return message(`**${selected.name}** has been dissolved. ${roster?.n??0} roster membership(s) were released, recruiting and match monitoring were stopped, and its EA link was removed. Historical match and competition records were preserved.`,true);
  }
  const found = selected;
  if (!found) return message('No UFB team matches that name.', true);
  const count = await env.DB.prepare('SELECT COUNT(*) AS total FROM team_members WHERE team_id = ?').bind(found.id).first<{ total: number }>();
  const managers=await env.DB.prepare('SELECT discord_id FROM team_managers WHERE team_id=? ORDER BY discord_id').bind(found.id).all<{discord_id:string}>();
  return embed(`${found.name} — Team`, found.unassigned===1?'_Not assigned to a league_':`**${found.league_name}**`, [{ name: 'Managers', value: (managers.results.length?managers.results.map(row=>`<@${row.discord_id}>`):[`<@${found.manager_discord_id}>`]).join(', '), inline: true }, { name: 'Roster', value: `${count?.total ?? 0} members`, inline: true }, { name: 'EA club', value: found.ea_club_name || '_Not linked_', inline: true }]);
}

async function reportMatch(env: Env, interaction: DiscordInteraction): Promise<InteractionResponse> {
  const teamName = option(interaction.data?.options, 'team'); const opponent = option(interaction.data?.options, 'opponent'); const teamScore = Number(option(interaction.data?.options, 'team_score')); const opponentScore = Number(option(interaction.data?.options, 'opponent_score')); const user = await ensureMember(env, interaction);
  if (!teamName || !opponent || !Number.isInteger(teamScore) || !Number.isInteger(opponentScore) || teamScore < 0 || opponentScore < 0) return message('Enter a team, opponent, and whole-number scores of zero or higher.', true);
  const found = await managerOwnsTeam(env, teamName, user.id,requireGuild(interaction.guild_id)); if (!found) return message('Only that team’s manager can report a match.', true);
  const result = await env.DB.prepare('INSERT INTO matches (team_id, opponent_name, team_score, opponent_score, reported_by) VALUES (?, ?, ?, ?, ?)').bind(found.id, opponent, teamScore, opponentScore, user.id).run();
  return embed('Match recorded', `**${found.name} ${teamScore}–${opponentScore} ${opponent}**`, [{ name: 'Match ID', value: String(result.meta.last_row_id), inline: true }, { name: 'Next', value: `Add player lines with \`/reportstat match_id:${result.meta.last_row_id}\`.` }]);
}

async function reportStat(env: Env, interaction: DiscordInteraction): Promise<InteractionResponse> {
  const matchId = Number(option(interaction.data?.options, 'match_id')); const memberId = option(interaction.data?.options, 'member'); const goals = Number(option(interaction.data?.options, 'goals')); const assists = Number(option(interaction.data?.options, 'assists')); const ratingValue = option(interaction.data?.options, 'rating'); const rating = ratingValue === '' ? null : Number(ratingValue); const user = await ensureMember(env, interaction);
  if (!Number.isInteger(matchId) || !memberId || !Number.isInteger(goals) || goals < 0 || !Number.isInteger(assists) || assists < 0 || (rating !== null && (!Number.isFinite(rating) || rating < 0 || rating > 10))) return message('Use a valid match ID, player, non-negative goals/assists, and a rating from 0–10.', true);
  const match = await env.DB.prepare('SELECT m.id, t.id AS team_id, t.name FROM matches m JOIN teams t ON t.id = m.team_id JOIN leagues l ON l.id=t.league_id WHERE l.guild_id=? AND m.id = ?').bind(interaction.guild_id??'',matchId).first<{ id: number; team_id:number; name: string }>();
  if (!match || !await managesTeam(env,match.team_id,user.id)&&!botOwner(env)) return message('Only the reporting team’s manager can add stats for this match.', true);
  await env.DB.prepare('INSERT INTO members (discord_id, display_name) VALUES (?, ?) ON CONFLICT(discord_id) DO NOTHING').bind(memberId, `Discord member ${memberId}`).run();
  await env.DB.prepare(`INSERT INTO match_player_stats (match_id, discord_id, goals, assists, rating) VALUES (?, ?, ?, ?, ?) ON CONFLICT(match_id, discord_id) DO UPDATE SET goals = excluded.goals, assists = excluded.assists, rating = excluded.rating`).bind(matchId, memberId, goals, assists, rating).run();
  return message(`Saved **${goals} G · ${assists} A${rating === null ? '' : ` · ${rating.toFixed(1)} rating`}** for <@${memberId}> in match #${matchId}.`);
}

async function matchDetails(env: Env, matchId: number,guild:string): Promise<InteractionResponse['data'] | null> {
  const match = await env.DB.prepare('SELECT m.id, m.opponent_name, m.team_score, m.opponent_score, m.played_at, t.name AS team_name FROM matches m JOIN teams t ON t.id = m.team_id JOIN leagues l ON l.id=t.league_id WHERE l.guild_id=? AND m.id = ?').bind(guild,matchId).first<{ id: number; opponent_name: string; team_score: number; opponent_score: number; played_at: string; team_name: string }>();
  if (!match) return null;
  const players = await env.DB.prepare('SELECT u.display_name, s.goals, s.assists, s.rating FROM match_player_stats s JOIN members u ON u.discord_id = s.discord_id WHERE s.match_id = ? ORDER BY s.goals DESC, s.assists DESC, s.rating DESC').bind(matchId).all<{ display_name: string; goals: number; assists: number; rating: number | null }>();
  const lines = players.results.length ? players.results.map((player) => `**${player.display_name}** — ${player.goals} G · ${player.assists} A${player.rating === null ? '' : ` · ${player.rating.toFixed(1)}`}`).join('\n') : '_No player stats reported yet._';
  return { embeds: [{ title: `${match.team_name} ${match.team_score}–${match.opponent_score} ${match.opponent_name}`, description: `Manual match #${match.id}\n\n${lines}`, color: 0x08bfea }] };
}

async function stats(env: Env, interaction: DiscordInteraction): Promise<InteractionResponse> {
  const teamName = option(interaction.data?.options, 'team'); if (!teamName) return message('Choose a team to view its recent matches.', true);
  const team = await selectedTeam(env,teamName,requireGuild(interaction.guild_id)); if (!team) return message('Choose the team and league from the suggestion list; typed duplicate names are ambiguous.', true);
  const recent = await env.DB.prepare('SELECT id, opponent_name, team_score, opponent_score FROM matches WHERE team_id = ? ORDER BY played_at DESC, id DESC LIMIT 3').bind(team.id).all<{ id: number; opponent_name: string; team_score: number; opponent_score: number }>();
  if (!recent.results.length) return message(`No manual matches have been reported for **${team.name}** yet. A manager can use \`/reportmatch\`.`, true);
  return { type: 4, data: { embeds: [{ title: `${team.name} — Recent Matches`, description: 'Choose a match to view its player statistics.', color: 0x08bfea, fields: recent.results.map((match, index) => ({ name: `${index + 1}. ${team.name} ${match.team_score}–${match.opponent_score} ${match.opponent_name}`, value: `Match #${match.id}` })) }], components: [{ type: 1, components: recent.results.map((match) => ({ type: 2, style: 2, label: `${match.team_score}–${match.opponent_score} vs ${match.opponent_name}`.slice(0, 80), custom_id: `stats:${match.id}` })) }] } };
}

async function playerStats(env: Env, interaction: DiscordInteraction,ea:EaAdapter): Promise<InteractionResponse> {
  const memberId = option(interaction.data?.options, 'member') || identity(interaction)?.id; if (!memberId) return message('Discord player identity is unavailable.', true);
  const player=await env.DB.prepare(`SELECT m.display_name,p.ea_player_name FROM members m LEFT JOIN guild_player_claims p ON p.discord_id=m.discord_id AND p.guild_id=? WHERE m.discord_id=?`).bind(requireGuild(interaction.guild_id),memberId).first<{display_name:string;ea_player_name:string|null}>();
  if(!player)return message('That player does not have a UFB profile yet.',true);
  if(!player.ea_player_name)return message(`**${player.display_name}** has not linked an EA player yet. Use \`/claim\` first.`,true);
  const totals=await ea.playerTotals(player.ea_player_name,interaction.guild_id);
  if(!totals)return message(`EA did not find **${player.ea_player_name}** on any Pro Club currently linked to UFB. Link the player’s club with \`/linkclub\`, then retry.`,true);
  const fields=[{name:'Games played',value:String(totals.gamesPlayed),inline:true},{name:'Goals',value:String(totals.goals),inline:true},{name:'Assists',value:String(totals.assists),inline:true},{name:'Average rating',value:totals.averageRating===null?'—':totals.averageRating.toFixed(2),inline:true},{name:'Man of the Match',value:String(totals.manOfTheMatch),inline:true},{name:'Clean sheets',value:String(totals.cleanSheets),inline:true},{name:'Cards',value:`${totals.yellowCards} yellow · ${totals.redCards} red`,inline:true}];
  fields.push({name:`Linked Pro Clubs — ${totals.clubs.length}`,value:totals.clubs.map(club=>`**${club.clubName}** — ${club.gamesPlayed} GP · ${club.goals} G · ${club.assists} A · ${club.averageRating?.toFixed(1)??'—'} rating`).join('\n'),inline:false});
  return embed(`${player.display_name} — FC27 Pro Clubs Stats`,`EA totals for claimed player **${player.ea_player_name}**, combined across every linked Pro Club where that player is on the roster.`,fields);
}

async function statsComponent(env: Env, interaction: DiscordInteraction): Promise<InteractionResponse> { const id = Number(interaction.data?.custom_id?.split(':')[1]); if (!Number.isSafeInteger(id)) return message('This stats control is invalid.', true); const card = await matchDetails(env, id,interaction.guild_id??''); return card ? { type: 7, data: card } : message('That match could not be found.', true); }

async function standings(env: Env, interaction: DiscordInteraction): Promise<InteractionResponse> {
  const slug = option(interaction.data?.options, 'league').toLowerCase();
  const guild=requireGuild(interaction.guild_id),leagues = await env.DB.prepare(`SELECT id, name, registration_open FROM leagues WHERE guild_id=? ${slug ? 'AND slug = ?' : ''} ORDER BY name`).bind(guild,...(slug ? [slug] : [])).all<{ id: number; name: string; registration_open: number }>();
  if (!leagues.results.length) return message('No matching UFB league exists yet.', true);
  const fields = await Promise.all(leagues.results.map(async (league) => {
    const teams = await env.DB.prepare('SELECT name FROM teams WHERE league_id=? AND unassigned=0 AND dissolved_at IS NULL ORDER BY name COLLATE NOCASE').bind(league.id).all<{ name: string }>();
    const table = teams.results.length ? teams.results.map((team, index) => `${index + 1}. ${team.name} — 0 PTS`).join('\n') : '_No teams registered_';
    return { name: `${league.name}${league.registration_open ? ' · Registration Open' : ''}`, value: `${table}\n_Official fixtures and results are not yet published._` };
  }));
  return embed('UFB standings', 'Current registration table. Link this league’s matching website source with `/setup leaguesource` to display official points.', fields);
}

async function linkClub(env: Env, interaction: DiscordInteraction, ea: EaAdapter): Promise<InteractionResponse> {
  const teamName = option(interaction.data?.options, 'team'); const clubName = option(interaction.data?.options, 'club'); const platform = option(interaction.data?.options, 'platform') || 'common-gen5'; const user = await ensureMember(env, interaction);
  if (!teamName || !clubName) return message('Choose your UFB team and the EA club name.', true);
  const team = await managerOwnsTeam(env, teamName, user.id,requireGuild(interaction.guild_id)); if (!team) return message('Only that team’s manager can link its EA club.', true);
  try { const results = await ea.searchClubs(clubName, platform); const normalized = clubName.trim().toLocaleLowerCase(); const exact = results.filter((club) => club.name.trim().toLocaleLowerCase() === normalized); const selected = exact.length === 1 ? exact[0] : results.length === 1 ? results[0] : null;
    if (!selected) { const choices = results.slice(0, 5).map((club) => `• ${club.name}`).join('\n'); return message(choices ? `I found multiple EA clubs. Please retry with the exact club name:\n${choices}` : `EA did not return a club named **${clubName}** on **${platform}**. Check the EA name and platform, then try again.`, true); }
    await env.DB.prepare('UPDATE teams SET ea_club_id = ?, ea_club_name = ?, ea_platform = ?, ea_crest_url = ? WHERE id = ?').bind(selected.id, selected.name, platform, selected.crestUrl??null, team.id).run(); return embed('EA FC 27 club linked', `**${team.name}** is linked to EA FC 27 club **${selected.name}**.`, [{ name: 'EA club ID', value: selected.id, inline: true }, { name: 'Platform', value: platform, inline: true }, { name: 'Next', value: 'Use `/matches` to verify recent FC 27 league/playoff matches, then `/setup checkfeed`.' }]);
  } catch (error) { const detail = error instanceof Error ? error.message : 'Unknown EA request error.'; console.error('EA club link failed:', detail); return message(`EA club search did not complete: **${detail}** No club link was saved.`, true); }
}

async function matches(env: Env, interaction: DiscordInteraction, ea: EaAdapter): Promise<InteractionResponse> {
  const teamName = option(interaction.data?.options, 'team');
  const requested=Number(option(interaction.data?.options,'count')||3);
  const count=[3,6,9].includes(requested)?requested:3;
  if (!teamName) return message('Choose a team to view recent EA matches.', true);
  const team = await selectedTeam(env,teamName,requireGuild(interaction.guild_id));
  if (!team) return message('No UFB team matches that name.', true);
  if (!team.ea_club_id) return message(`**${team.name}** has not been linked to an EA FC 27 club yet. Use \`/linkclub\` first.`, true);
  const recent = await ea.recentMatches(team.ea_club_id, team.ea_platform || 'common-gen5');
  if (!recent.length) return message(`No recent EA matches are available for **${team.name}** yet.`, true);
  const shown=recent.slice(0,count);
  const pct=(made=0,total=0)=>total?`${Math.round(made/total*100)}%`:'—';
  const fields=shown.map(match=>{
    const timestamp=Math.floor(Date.parse(match.playedAt)/1000),result=match.scored>match.conceded?'🟢 WIN':match.scored<match.conceded?'🔴 LOSS':'🟡 DRAW';
    const date=Number.isFinite(timestamp)?`<t:${timestamp}:d> · <t:${timestamp}:t>`:match.playedAt;
    const playerTotals=[`${match.shots??0} shots`,`${match.passesMade??0}/${match.passAttempts??0} passes (${pct(match.passesMade,match.passAttempts)})`,`${match.tacklesMade??0}/${match.tackleAttempts??0} tackles`,...(match.averageRating?[`${match.averageRating.toFixed(1)} avg rating`]:[])].join(' · ');
    return {name:`${result} · ${match.scored}–${match.conceded} vs ${match.opponent}`.slice(0,256),value:`${date}\n⚽ **Scorers:** ${match.scorers?.join(', ')||'None'}\n🅰️ **Assists:** ${match.assists?.join(', ')||'None'}\n⭐ **MotM:** ${match.motm||'Not recorded'}\n📊 **${match.humanPlayers??0} human players:** ${playerTotals}`.slice(0,500)};
  });
  const result=embed(`${team.name} — Recent matches`,`Showing ${shown.length} of ${recent.length} games returned by the verified EA feed. Use \`count:6\` or \`count:9\` for a longer history; EA may return fewer. Preview a sheet privately, then choose a channel if you want to publish it.`,fields);
  const previewButtons=shown.map(match=>({type:2,style:2,label:`Preview · ${match.scored}–${match.conceded} vs ${match.opponent}`.slice(0,80),custom_id:`recent-sheet:${team.id}:${match.id}:${identity(interaction)?.id??''}`}));
  result.data!.components=Array.from({length:Math.ceil(previewButtons.length/5)},(_,index)=>({type:1,components:previewButtons.slice(index*5,index*5+5)}));
  return result;
}

async function matchnight(env: Env, interaction: DiscordInteraction): Promise<InteractionResponse> {
  const teamName = option(interaction.data?.options, 'team');
  const startsAt = option(interaction.data?.options, 'starts_at');
  const user = await ensureMember(env, interaction);
  if (!teamName || !startsAt || !interaction.channel_id) return message('Choose a team and start time.', true);
  const team = await managerOwnsTeam(env, teamName, user.id,requireGuild(interaction.guild_id));
  if (!team) return message('Only that team’s manager can start its matchnight RSVP.', true);
  const created = await env.DB.prepare('INSERT INTO matchnights (team_id, starts_at, channel_id, created_by) VALUES (?, ?, ?, ?)').bind(team.id, startsAt, interaction.channel_id, user.id).run();
  return { type: 4, data: { embeds: [{ title: `${team.name} — Match Night`, description: `**${startsAt}**\n\nChoose your availability below. You can change it anytime.`, color: 0x08bfea, fields: [{ name: '✅ Yes', value: '_No responses yet_', inline: true }, { name: '❔ Tentative', value: '_No responses yet_', inline: true }, { name: '❌ No', value: '_No responses yet_', inline: true }] }], components: matchnightButtons(Number(created.meta.last_row_id)) } };
}

async function matchnightCard(env: Env, id: number,guild:string): Promise<InteractionResponse['data'] | null> {
  const night = await env.DB.prepare(`SELECT m.id, m.starts_at, t.name AS team_name FROM matchnights m JOIN teams t ON t.id = m.team_id JOIN leagues l ON l.id=t.league_id WHERE l.guild_id=? AND m.id = ? AND m.status = 'open'`).bind(guild,id).first<{ id: number; starts_at: string; team_name: string }>();
  if (!night) return null;
  const responses = await env.DB.prepare(`SELECT r.response, m.display_name FROM matchnight_responses r JOIN members m ON m.discord_id = r.discord_id WHERE r.matchnight_id = ? ORDER BY m.display_name COLLATE NOCASE`).bind(id).all<{ response: string; display_name: string }>();
  const names = (kind: string) => responses.results.filter((row) => row.response === kind).map((row) => row.display_name);
  const list = (kind: string) => { const entries = names(kind); return entries.length ? entries.map((name) => `• ${name}`).join('\n') : '_None_'; };
  return { embeds: [{ title: `${night.team_name} — Match Night`, description: `**${night.starts_at}**\n\nChoose your availability below. You can change it anytime.`, color: 0x08bfea, fields: [{ name: `✅ Yes — ${names('yes').length}`, value: list('yes'), inline: true }, { name: `❔ Tentative — ${names('tentative').length}`, value: list('tentative'), inline: true }, { name: `❌ No — ${names('no').length}`, value: list('no'), inline: true }] }], components: matchnightButtons(id) };
}

async function matchnightResponse(env: Env, interaction: DiscordInteraction): Promise<InteractionResponse> {
  const parts = interaction.data?.custom_id?.split(':') ?? []; const id = Number(parts[1]); const response = parts[2];
  if (parts[0] !== 'matchnight' || !Number.isSafeInteger(id) || !['yes', 'tentative', 'no'].includes(response)) return message('This matchnight control is invalid.', true);
  const user = await ensureMember(env, interaction);
  await env.DB.prepare(`INSERT INTO matchnight_responses (matchnight_id, discord_id, response) VALUES (?, ?, ?) ON CONFLICT(matchnight_id, discord_id) DO UPDATE SET response = excluded.response, updated_at = CURRENT_TIMESTAMP`).bind(id, user.id, response).run();
  const card = await matchnightCard(env, id,interaction.guild_id??''); if (!card) return message('This matchnight is no longer open.', true);
  return { type: 7, data: card };
}

async function leagueAutocomplete(env: Env, interaction: DiscordInteraction): Promise<InteractionResponse> {
  const focused = interaction.data?.options?.find((item) => item.focused);
  const nestedFocused = interaction.data?.options?.flatMap((item) => item.options ?? []).find((item) => item.focused);
  const target = focused ?? nestedFocused;
  if (target?.name !== 'league' && target?.name !== 'cup') return { type: 8, data: { choices: [] } };
  const query = String(target.value || '').trim();
  if (target.name === 'cup') {
    const cups = await env.DB.prepare('SELECT slug, name, registration_open FROM cups WHERE guild_id=? AND (slug LIKE ? OR name LIKE ?) ORDER BY registration_open DESC, name LIMIT 25').bind(interaction.guild_id??'',`%${query}%`, `%${query}%`).all<{ slug: string; name: string; registration_open: number }>();
    return { type: 8, data: { choices: cups.results.map((item) => ({ name: `${item.name}${item.registration_open ? ' — Registration Open' : ''}`, value: item.slug })) } };
  }
  const leagues = await env.DB.prepare(`SELECT slug, name, registration_open FROM leagues WHERE guild_id=? AND archived_at IS NULL AND is_system=0 AND (slug LIKE ? OR name LIKE ?) ORDER BY name LIMIT 25`).bind(interaction.guild_id??'',`%${query}%`, `%${query}%`).all<{ slug: string; name: string; registration_open: number }>();
  const choices=leagues.results.map((league) => ({ name: `${league.name}${league.registration_open ? ' — Registration Open' : ''}`, value: league.slug }));
  const defaults=await env.DB.prepare('SELECT default_league FROM server_settings WHERE guild_id=?').bind(interaction.guild_id??'').first<{default_league:string|null}>();
  choices.sort((a,b)=>Number(b.value===defaults?.default_league)-Number(a.value===defaults?.default_league));
  return { type: 8, data: { choices: choices.slice(0,25) } };
}

export async function handleCommand(env: Env, interaction: DiscordInteraction, ea: EaAdapter = eaUnavailable): Promise<InteractionResponse> {
  const commandName=interaction.data?.name??'';
  const customId=interaction.data?.custom_id??'';
  const workshopCommand=['recruit','recruiting','sign','release'].includes(commandName)
    ||(commandName==='setup'&&subcommand(interaction)?.name==='channel')
    ||customId.startsWith('recruit-sign:')||customId.startsWith('fa-competitions:')
    ||/^hub:[^:]+:(agents|browse|edit|edit-save|renew|sign|release)(:|$)/.test(customId)
    ||customId.startsWith('setup:fa')||customId.startsWith('setup:assign:');
  if(workshopCommand&&env.ENVIRONMENT!=='workshop-test')return interaction.type===4?{type:8,data:{choices:[]}}:message('Free-agent and player-signing tools are in the UFB workspace and are not available in the live bot.',true);
  env=await withBotOwner(env,interaction);
  if(interaction.guild_id){
    const settings=await env.DB.prepare('SELECT admin_role_id,moderator_role_id,manager_role_id,moderator_role_ids,manager_role_ids,default_league,default_cup FROM server_settings WHERE guild_id=?').bind(interaction.guild_id).first<StaffRoleSettings&{default_league:string|null;default_cup:string|null}>();
    env=withStaffRoles(env,settings);
    const sub=subcommand(interaction);
    if(interaction.type===2&&interaction.data?.name==='cup'&&sub?.name==='panel'&&!sub.options?.some(o=>o.name==='cup')&&settings?.default_cup)sub.options=[{name:'cup',value:settings.default_cup}];
  }
  if(interaction.type===2){
    const opts=commandOptions(interaction)??[],league=option(opts,'league'),activeSub=subcommand(interaction);
    for(const entry of opts.filter(o=>['team','team_a','team_b'].includes(o.name)&&interaction.data?.name!=='register')){
      if(league&&!(interaction.data?.name==='team'&&activeSub?.name==='assign')){const chosen=await selectedTeam(env,String(entry.value??''),requireGuild(interaction.guild_id),undefined,league);if(!chosen)return message('Choose the registered team from the selected league’s suggestions. The EA club name is entered separately and may be identical to the registered team name.',true);entry.value=String(chosen.id);}
    }
  }
  if(interaction.type!==4){const result=await navigation(env,interaction,next=>handleCommand(env,next,ea));if(result)return result;}
  if(interaction.type===3&&interaction.data?.custom_id?.startsWith('info-reset:'))return infoReset(env,interaction);
  if(interaction.type===3&&interaction.data?.custom_id?.startsWith('schedule-rsvp:'))return scheduleRsvp(env,interaction);
  if(interaction.type===2&&['recruit','recruiting'].includes(interaction.data?.name??'')){
    await expireFreeAgents(env);
    if(['edit','renew'].includes(subcommand(interaction)?.name??''))return maintainFreeAgent(env,interaction);
  }
  if(interaction.type===4&&interaction.data?.name==='gamestats'&&commandOptions(interaction)?.some(o=>o.name==='league'&&o.focused))return leagueAutocomplete(env,interaction);
  if(interaction.type===4&&interaction.data?.name==='gamestats'&&commandOptions(interaction)?.some(o=>o.name==='match_id'&&o.focused))return matchAutocomplete(env,interaction);
  if(interaction.type===4){const result=rsvpTimezoneAutocomplete(interaction);if(result)return result;}
  if(interaction.type===4){const result=await teamAutocomplete(env,interaction);if(result)return result;}
  if(interaction.type===4&&interaction.data?.name==='setup'&&subcommand(interaction)?.name==='channel')return handleCommand(env,{...interaction,data:{...interaction.data,name:'recruit'}},ea);
  if(interaction.type===4&&['recruit','recruiting'].includes(interaction.data?.name??'')&&['freeagent','edit'].includes(interaction.data?.options?.[0]?.name??'')){
    const opts=interaction.data?.options?.[0]?.options||[],focused=opts.find(o=>o.focused),selected=opts.filter(o=>!o.focused&&o.name.startsWith('league_')).map(o=>o.value);
    return {type:8,data:{choices:(await competitionOptions(env,false,interaction.guild_id)).filter(c=>!selected.includes(c.value)&&!(selected.includes('all')||c.value==='all'&&selected.length>0)&&c.label.toLowerCase().includes(String(focused?.value||'').toLowerCase())).map(c=>({name:c.label,value:c.value}))}};
  }
  if(['recruit','recruiting'].includes(interaction.data?.name??'')&&interaction.data?.options?.[0]?.name==='channel'){
    if(interaction.type===4){const focused=interaction.data.options[0].options?.find(o=>o.focused);return {type:8,data:{choices:(await competitionOptions(env,true,interaction.guild_id)).filter(c=>c.value!=='all'&&c.label.toLowerCase().includes(String(focused?.value||'').toLowerCase())).map(c=>({name:c.label,value:c.value}))}};}
    if(interaction.type===2)return freeAgentChannelCommand(env,interaction);
  }
  if(interaction.type===3&&interaction.data?.custom_id?.startsWith('fa-competitions:'))return freeAgentSelection(env,interaction);
  if(interaction.type===3&&interaction.data?.custom_id?.startsWith('recruit-sign:'))return recruitSignSelection(env,interaction);
  if(interaction.type===3&&interaction.data?.custom_id?.startsWith('recent-publish:'))return recentPublishComponent(env,interaction);
  if(['recruit','recruiting'].includes(interaction.data?.name??'')&&interaction.data?.options?.[0]?.name==='browse'){
    if(interaction.type===4){const focused=interaction.data.options[0].options?.find(o=>o.focused);const choices=await competitionOptions(env,false,interaction.guild_id);return {type:8,data:{choices:choices.filter(c=>c.label.toLowerCase().includes(String(focused?.value||'').toLowerCase())).map(c=>({name:c.label,value:c.value}))}};}
    if(interaction.type===2&&interaction.data.options[0].options?.some(o=>o.name==='type'&&o.value==='free_agent'))return freeAgentBrowse(env,interaction);
  }
  if(interaction.type===2&&['standings','schedule','leaguestats'].includes(interaction.data?.name??'')){
    const source=await resolveLeagueSource(env,interaction);
    if(source)return siteLeagueCommand(interaction,source);
    if(interaction.data?.name==='standings')return standings(env,interaction);
    const guild=requireGuild(interaction.guild_id),slug=option(interaction.data?.options,'league');
    const league=await env.DB.prepare('SELECT name FROM leagues WHERE guild_id=? AND slug=? AND archived_at IS NULL AND is_system=0').bind(guild,slug).first<{name:string}>();
    return message(league?`**${league.name}** does not have an official website statistics source linked in this server yet.`:'Choose a league configured in this Discord server.',true);
  }
  if(['gamestats','automode'].includes(interaction.data?.name??'')){
    if(interaction.type===4)return statsTeamAutocomplete(env,interaction);
    if(interaction.type===2)return watcherCommand(env,interaction);
  }
  if (interaction.type === 3 && interaction.data?.custom_id?.startsWith('draft:')) return draftComponent(env, interaction);
  if (interaction.type === 3 && interaction.data?.custom_id?.startsWith('cup:')) {
    const [,action,slug]=interaction.data.custom_id.split(':');
    if(!['fixtures','panel','advance','pause','reopen','withdraw'].includes(action))return message('Unknown cup action.',true);
    const result=await cupControls(env,{...interaction,type:2,data:{name:'cup',options:[{name:action,type:1,options:[{name:'cup',value:slug}]}]}});
    if(result?.data)result.data.flags=64;return result??message('Cup not found.',true);
  }
  if (interaction.type === 4 && interaction.data?.name === 'draft') return draftAutocomplete(env, interaction);
  if (interaction.type === 2 && interaction.data?.name === 'draft') return draftCommand(env, interaction);
  if (interaction.type === 2 && interaction.data?.name === 'cup') { const result = await cupControls(env, interaction); if (result) return result; }
  if (interaction.type === 3) return interaction.data?.custom_id?.startsWith('stats:') ? statsComponent(env, interaction) : matchnightResponse(env, interaction);
  if (interaction.type === 4) return leagueAutocomplete(env, interaction);
  switch (interaction.data?.name) {
    case 'ufb': return ufb();
    case 'info': return infoReset(env,interaction);
    case 'cup': return cup(env, interaction);
    case 'recruiting':
    case 'recruit': return recruiting(env, interaction);
    case 'claim': return claim(env, interaction);
    case 'profile': return profile(env, interaction);
    case 'register': return register(env, interaction);
    case 'sign': return sign(env, interaction);
    case 'release': return release(env, interaction);
    case 'roster': return roster(env, interaction);
    case 'team': return team(env, interaction);
    case 'reportmatch': return reportMatch(env, interaction);
    case 'reportstat': return reportStat(env, interaction);
    case 'linkclub': return linkClub(env, interaction, ea);
    case 'matches': return matches(env, interaction, ea);
    case 'stats': return stats(env, interaction);
    case 'playerstats': return playerStats(env, interaction,ea);
    case 'matchnight': return matchnight(env, interaction);
    case 'rsvp': return scheduleEventCommand(env,interaction);
    case 'standings': return standings(env, interaction);
    default: return message('That UFB command is not available yet.', true);
  }
}
