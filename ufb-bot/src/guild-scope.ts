export const requireGuild=(guildId:string|undefined)=>{
 if(!guildId)throw new Error('This action requires a Discord server.');
 return guildId;
};

// `slug` is historically globally unique in D1. Prefixing the internal value
// lets separate servers use the same visible league/cup name without a schema
// rebuild that could endanger existing foreign keys.
export const scopedSlug=(guildId:string,base:string)=>base.startsWith(`${guildId}:`)?base:`${guildId}:${base}`.slice(0,100);

type LookupDb={prepare:(sql:string)=>{bind:(...args:unknown[])=>{first:<T>()=>Promise<T|null>}}};
export async function availableSlug(db:LookupDb,table:'leagues'|'cups',guildId:string,base:string,name:string){
 const same=await db.prepare(`SELECT 1 AS found FROM ${table} WHERE guild_id=? AND (slug=? OR name=? COLLATE NOCASE) LIMIT 1`).bind(guildId,base,name).first<{found:number}>();
 if(same)throw new Error('GUILD_NAME_EXISTS');
 const collision=await db.prepare(`SELECT 1 AS found FROM ${table} WHERE slug=? LIMIT 1`).bind(base).first<{found:number}>();
 return collision?scopedSlug(guildId,base):base;
}
