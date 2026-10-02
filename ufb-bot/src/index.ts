import { handleCommand } from './commands';
import { EaClubsAdapter } from './ea';
import {pollWatchers,publishRecentPreview} from './match-watchers';
import {wantsStandingsImage,publishStandingsImage} from './standings-image';
import {publishLeagueLeaders} from './league-leaders-image';
import {resolveLeagueSource} from './site-league';
import {publishFreeAgents} from './free-agent-channels';
import {expireFreeAgents} from './free-agent-maintenance';
import {auditDiscordCommands,syncDiscordCommands} from './command-registration';
import {consumeCooldown} from './cooldowns';
import {processRegistrationSchedules} from './registration-reminders';
import {captureOriginalRsvpPost,processRecurringSchedules,processRsvpReminders} from './schedule-events';
import {refreshExistingHelpCenters} from './help-center';
import {refreshBotOwners,withBotOwner} from './permissions';
import {pollPatchUpdates} from './patch-notes';
import {sandyBumsArchive,mountainsArchive,syncSandyBums,syncMountains} from './house-club-history';
import type { DiscordInteraction, Env } from './types';

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });

const fromHex = (value: string) => {
  if (!/^[\da-f]+$/i.test(value) || value.length % 2) throw new Error('Invalid hexadecimal value.');
  return Uint8Array.from(value.match(/../g)!, (pair) => Number.parseInt(pair, 16));
};

async function isDiscordRequest(rawBody: string, signature: string, timestamp: string, publicKey: string) {
  try {
    const key = await crypto.subtle.importKey('raw', fromHex(publicKey), { name: 'Ed25519' }, false, ['verify']);
    return crypto.subtle.verify('Ed25519', key, fromHex(signature), new TextEncoder().encode(timestamp + rawBody));
  } catch {
    return false;
  }
}

export default {
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {ctx.waitUntil(pollWatchers(env));ctx.waitUntil(syncSandyBums(env).catch(error=>console.error(JSON.stringify({event:'sandy_bums_sync_failed',error:String(error)}))));ctx.waitUntil(syncMountains(env).catch(error=>console.error(JSON.stringify({event:'mountains_sync_failed',error:String(error)}))));ctx.waitUntil(expireFreeAgents(env).then(()=>publishFreeAgents(env)));ctx.waitUntil(processRegistrationSchedules(env));ctx.waitUntil(processRecurringSchedules(env));ctx.waitUntil(processRsvpReminders(env));ctx.waitUntil(pollPatchUpdates(env));ctx.waitUntil(refreshBotOwners(env));ctx.waitUntil(syncDiscordCommands(env).then(()=>auditDiscordCommands(env)).catch(error=>console.error(JSON.stringify({event:'discord_command_sync_or_audit_failed',error:String(error)}))));ctx.waitUntil(refreshExistingHelpCenters(env).catch(error=>console.error(JSON.stringify({event:'help_center_refresh_failed',error:String(error)}))));},
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/health') return json({ service: 'ufb', status: 'ok', environment: env.ENVIRONMENT,release:'20260922-league-sources1',liveMatchFeed:env.EA_MATCHES_ENABLED==='true'&&!!(env.EA_MATCH_FEED_URL||env.EA_API_BASE_URL)?'configured':'disabled' });
    if (request.method === 'GET' && url.pathname === '/api/house-clubs/fc-sandy-bums') return sandyBumsArchive(env,url.searchParams.get('month')??'all');
    if (request.method === 'GET' && url.pathname === '/api/house-clubs/fc-mountains') return mountainsArchive(env,url.searchParams.get('month')??'all');
    if (request.method !== 'POST' || url.pathname !== '/interactions') return new Response('Not found', { status: 404 });
    if (!env.DISCORD_PUBLIC_KEY) return json({ error: 'DISCORD_PUBLIC_KEY is not configured.' }, 503);
    const signature = request.headers.get('x-signature-ed25519');
    const timestamp = request.headers.get('x-signature-timestamp');
    const rawBody = await request.text();
    if (!signature || !timestamp || !await isDiscordRequest(rawBody, signature, timestamp, env.DISCORD_PUBLIC_KEY)) return new Response('Bad request signature.', { status: 401 });
    const interaction = JSON.parse(rawBody) as DiscordInteraction;
    if (interaction.type === 1) return json({ type: 1 });
    if(interaction.type===3&&interaction.data?.custom_id?.startsWith('recent-sheet:')){ctx.waitUntil(withBotOwner(env,interaction).then(ownerEnv=>publishRecentPreview(ownerEnv,interaction)));return json({type:5,data:{flags:64}});}
    if(interaction.type===2&&(['matches','playerstats'].includes(interaction.data?.name??'')||interaction.data?.name==='setup'&&['checkfeed','health','helpcenter','leaguesource','patches'].includes(interaction.data.options?.[0]?.name??''))){
      ctx.waitUntil((async()=>{
        let result;
        try{result=await handleCommand(env,interaction,new EaClubsAdapter(env));}catch{result={data:{content:'The verified EA match feed is unavailable. No placeholder matches or stats were returned.'}};}
        const response=await fetch(`https://discord.com/api/v10/webhooks/${interaction.application_id}/${interaction.token}/messages/@original`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({...result.data,allowed_mentions:{parse:[]}}),signal:AbortSignal.timeout(10000)});
        if(!response.ok)console.error(JSON.stringify({event:'ea_diagnostic_reply_failed',status:response.status}));
      })());return json({type:5,data:{flags:64}});
    }
    if(interaction.type===2&&interaction.data?.name==='leaguestats'){
      const source=await resolveLeagueSource(env,interaction);
      if(!source)return json(await handleCommand(env,interaction,new EaClubsAdapter(env)));
      const wait=await consumeCooldown(env,interaction,'league-leaders-image',20);if(wait)return json({type:4,data:{content:`Please wait ${wait} seconds before generating another league leaders image.`,flags:64}});
      ctx.waitUntil(publishLeagueLeaders(env,interaction,source));return json({type:5});
    }
    if(wantsStandingsImage(interaction)){
      const source=await resolveLeagueSource(env,interaction);
      if(source){const wait=await consumeCooldown(env,interaction,'standings-image',20);if(wait)return json({type:4,data:{content:`Please wait ${wait} seconds before generating another standings image.`,flags:64}});ctx.waitUntil(publishStandingsImage(env,interaction,source));return json({type:5});}
    }
    try { const result=await handleCommand(env, interaction, new EaClubsAdapter(env));
      if(interaction.type===2&&interaction.data?.name==='rsvp'&&interaction.data.options?.[0]?.name==='create'&&result.type===4&&result.data?.embeds?.length)ctx.waitUntil(captureOriginalRsvpPost(env,interaction).catch(error=>console.error(JSON.stringify({event:'rsvp_original_post_capture_failed',error:String(error)}))));
      if((interaction.type===3&&interaction.data?.custom_id?.startsWith('fa-competitions:')&&result.type===7)||(interaction.type===3&&interaction.data?.custom_id?.startsWith('recruit-sign:'))||(interaction.type===2&&['recruit','recruiting'].includes(interaction.data?.name??'')&&interaction.data?.options?.[0]?.name==='freeagent'&&result.data?.embeds?.length))ctx.waitUntil(publishFreeAgents(env));
      if(interaction.type===2&&['sign','register'].includes(interaction.data?.name??''))ctx.waitUntil(publishFreeAgents(env));
      if(interaction.type===2&&['recruit','recruiting'].includes(interaction.data?.name??'')&&['edit','renew','close'].includes(interaction.data?.options?.[0]?.name??''))ctx.waitUntil(publishFreeAgents(env));
      return json(result); }
    catch (error) {
      console.error(error);
      return json({ type: 4, data: { content: 'UFB could not finish this request. Check the current state before retrying.', flags: 64 } });
    }
  }
};
