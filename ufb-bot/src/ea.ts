import {liveFeed} from './match-watchers';
import type {Env} from './types';
import type {SelectedTeam} from './team-selectors';
export type EaClub = { id: string; name: string; crestUrl?: string | null };
export type EaMatch = { id: string; opponent: string; scored: number; conceded: number; playedAt: string; scorers?:string[]; assists?:string[]; motm?:string|null; humanPlayers?:number; shots?:number; passesMade?:number; passAttempts?:number; tacklesMade?:number; tackleAttempts?:number; averageRating?:number|null };
export type EaPlayerStat = { player: string; rating: number; goals: number; assists: number };
export type EaPlayerClubTotals = { clubId:string;clubName:string;gamesPlayed:number;goals:number;assists:number;cleanSheets:number;averageRating:number|null;manOfTheMatch:number;redCards:number;yellowCards:number;proOverall:number|null };
export type EaPlayerTotals = { player:string;gamesPlayed:number;goals:number;assists:number;cleanSheets:number;averageRating:number|null;manOfTheMatch:number;redCards:number;yellowCards:number;clubs:EaPlayerClubTotals[] };

export interface EaAdapter {
  searchClubs(name: string, platform: string): Promise<EaClub[]>;
  recentMatches(clubId: string, platform: string): Promise<EaMatch[]>;
  matchStats(matchId: string): Promise<EaPlayerStat[]>;
  playerTotals(playerName:string,guildId?:string):Promise<EaPlayerTotals|null>;
}

const EA_BASE = 'https://proclubs.ea.com/api/fc';
const strings = (record: Record<string, unknown>, ...keys: string[]) => keys.map((key) => record[key]).find((value): value is string | number => typeof value === 'string' || typeof value === 'number');
function candidateClubs(value: unknown, found: EaClub[] = []): EaClub[] { if (Array.isArray(value)) { value.forEach((item) => candidateClubs(item, found)); return found; } if (!value || typeof value !== 'object') return found; const record = value as Record<string, unknown>; const id = strings(record, 'clubId', 'club_id', 'id'); const name = strings(record, 'name', 'clubName', 'club_name'); const kit=record.customKit&&typeof record.customKit==='object'?record.customKit as Record<string,unknown>:null;const crest=kit?strings(kit,'crestUrl'):strings(record,'crestUrl','crest_url'); if (id !== undefined && name !== undefined) found.push({ id: String(id), name: String(name),crestUrl:crest?String(crest):null }); Object.values(record).forEach((item) => candidateClubs(item, found)); return found; }
function apiBase(value?:string){const url=new URL(value||EA_BASE);if(url.protocol!=='https:')throw new Error('EA API base must use HTTPS.');return url.toString().replace(/\/$/,'');}

export class EaClubsAdapter implements EaAdapter {
  constructor(private readonly env?:Env) {}
  async searchClubs(name: string, platform: string): Promise<EaClub[]> {
    const relay=this.env?.EA_API_BASE_URL;
    const url=new URL(relay?`${apiBase(relay)}/clubs/search`:`${EA_BASE}/allTimeLeaderboard/search`);
    url.searchParams.set('platform',platform);
    url.searchParams.set(relay?'name':'clubName',name);
    const response=await fetch(url,{headers:{accept:'application/json'},signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw new Error(`EA club search returned ${response.status}.`);
    const unique=new Map<string,EaClub>();candidateClubs(await response.json()).forEach(club=>unique.set(club.id,club));return [...unique.values()];
  }
  async recentMatches(clubId: string, platform: string): Promise<EaMatch[]> {
    if(!this.env)throw new Error('Verified EA match feed unavailable.');
    const team=await this.env.DB.prepare('SELECT * FROM teams WHERE dissolved_at IS NULL AND ea_club_id=? AND ea_platform=? LIMIT 1').bind(clubId,platform).first<SelectedTeam>();
    if(!team)throw new Error('Club is not linked to a registered team.');
    const matches=await liveFeed(this.env)(team);
    const numberAt=(stats:string[],index:number)=>{const n=Number(stats[index]);return Number.isFinite(n)?n:0;};
    const ratioAt=(stats:string[],index:number)=>{const match=stats[index]?.match(/^(\d+)\s*\/\s*(\d+)/);return match?[Number(match[1]),Number(match[2])] as const:[0,0] as const;};
    const contributors=(players:typeof matches[number]['clubs'][number]['players'],index:number)=>players.filter(p=>numberAt(p.stats,index)>0).map(p=>`${p.name}${numberAt(p.stats,index)>1?` ×${numberAt(p.stats,index)}`:''}`);
    return matches.filter(m=>m.clubs.some(c=>c.id===clubId)).sort((a,b)=>b.playedAt-a.playedAt).map(m=>{
      const club=m.clubs.find(c=>c.id===clubId)!,opponent=m.clubs.find(c=>c.id!==clubId)!,players=club.players;
      const passes=players.map(p=>ratioAt(p.stats,9)).reduce((sum,v)=>[sum[0]+v[0],sum[1]+v[1]],[0,0]);
      const tackles=players.map(p=>ratioAt(p.stats,10)).reduce((sum,v)=>[sum[0]+v[0],sum[1]+v[1]],[0,0]);
      const ratings=players.map(p=>numberAt(p.stats,1)).filter(Boolean);
      return {id:m.id,opponent:opponent.name,scored:club.score,conceded:opponent.score,playedAt:new Date(m.playedAt).toISOString(),scorers:contributors(players,2),assists:contributors(players,4),motm:players.find(player=>player.motm)?.name??null,humanPlayers:players.length,shots:players.reduce((sum,p)=>sum+numberAt(p.stats,3),0),passesMade:passes[0],passAttempts:passes[1],tacklesMade:tackles[0],tackleAttempts:tackles[1],averageRating:ratings.length?ratings.reduce((a,b)=>a+b,0)/ratings.length:null};
    });
  }
  async matchStats(): Promise<EaPlayerStat[]> { throw new Error('Use the verified per-club match feed for human player stats.'); }
  async playerTotals(playerName:string,guildId?:string):Promise<EaPlayerTotals|null>{
    if(!this.env?.EA_API_BASE_URL)throw new Error('FC27 API relay unavailable.');
    const linked=await this.env.DB.prepare(`SELECT DISTINCT t.ea_club_id,COALESCE(t.ea_club_name,t.name) AS club_name,COALESCE(t.ea_platform,'common-gen5') AS platform FROM teams t JOIN leagues l ON l.id=t.league_id WHERE (?='' OR l.guild_id=?) AND t.dissolved_at IS NULL AND t.ea_club_id IS NOT NULL AND t.ea_club_id<>'' ORDER BY club_name`).bind(guildId??'',guildId??'').all<{ea_club_id:string;club_name:string;platform:string}>();
    if(!linked.results.length)return null;
    const root=apiBase(this.env.EA_API_BASE_URL),wanted=playerName.trim().toLocaleLowerCase();
    const requests=await Promise.allSettled(linked.results.map(async club=>{
      const url=new URL(`${root}/clubs/${encodeURIComponent(club.ea_club_id)}/members`);url.searchParams.set('platform',club.platform);
      const response=await fetch(url,{headers:{accept:'application/json'},signal:AbortSignal.timeout(20000)});
      if(!response.ok)throw new Error(`FC27 members feed returned ${response.status}`);
      const payload=await response.json();if(!Array.isArray(payload))throw new Error('Invalid FC27 members response');
      const raw=payload.find(value=>value&&typeof value==='object'&&String((value as Record<string,unknown>).name??'').trim().toLocaleLowerCase()===wanted) as Record<string,unknown>|undefined;
      if(!raw)return null;
      const count=(value:unknown)=>{const parsed=Number(value);return Number.isFinite(parsed)?Math.max(0,Math.trunc(parsed)):0;};
      const decimal=(value:unknown)=>{const parsed=Number(value);return Number.isFinite(parsed)&&parsed>0?parsed:null;};
      return {clubId:club.ea_club_id,clubName:club.club_name,gamesPlayed:count(raw.gamesPlayed),goals:count(raw.goals),assists:count(raw.assists),cleanSheets:count(raw.cleanSheets),averageRating:decimal(raw.averageRating),manOfTheMatch:count(raw.manOfTheMatch),redCards:count(raw.redCards),yellowCards:count(raw.yellowCards),proOverall:decimal(raw.proOverall)} satisfies EaPlayerClubTotals;
    }));
    const clubs=requests.flatMap(result=>result.status==='fulfilled'&&result.value?[result.value]:[]);
    if(!clubs.length){if(requests.every(result=>result.status==='rejected'))throw new Error('FC27 member feeds are unavailable.');return null;}
    const gamesPlayed=clubs.reduce((sum,club)=>sum+club.gamesPlayed,0),ratedGames=clubs.filter(club=>club.averageRating!==null&&club.gamesPlayed>0);
    const ratingWeight=ratedGames.reduce((sum,club)=>sum+club.gamesPlayed,0);
    return {player:playerName,gamesPlayed,goals:clubs.reduce((sum,club)=>sum+club.goals,0),assists:clubs.reduce((sum,club)=>sum+club.assists,0),cleanSheets:clubs.reduce((sum,club)=>sum+club.cleanSheets,0),averageRating:ratingWeight?ratedGames.reduce((sum,club)=>sum+(club.averageRating??0)*club.gamesPlayed,0)/ratingWeight:null,manOfTheMatch:clubs.reduce((sum,club)=>sum+club.manOfTheMatch,0),redCards:clubs.reduce((sum,club)=>sum+club.redCards,0),yellowCards:clubs.reduce((sum,club)=>sum+club.yellowCards,0),clubs};
  }
}

export const eaUnavailable: EaAdapter = {
  async searchClubs() { return []; },
  async recentMatches() { return []; },
  async matchStats() { return []; },
  async playerTotals(){return null;}
};
