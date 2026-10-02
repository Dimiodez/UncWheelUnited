export interface Env {
  DB: D1Database;
  ENVIRONMENT: string;
  DISCORD_APPLICATION_ID?: string;
  DISCORD_PUBLIC_KEY?: string;
  DISCORD_BOT_TOKEN?: string;
  DISCORD_GUILD_ID?: string;
  BOT_OWNER_DISCORD_ID?: string;
  BOT_OWNER_AUTHORIZED?: boolean;
  MANAGER_ROLE_ID?: string;
  ADMIN_ROLE_ID?: string;
  MODERATOR_ROLE_ID?: string;
  MODERATOR_ROLE_IDS?: string;
  MANAGER_ROLE_IDS?: string;
  BROWSER: Fetcher;
  ASSETS: Fetcher;
  EA_MATCHES_ENABLED?: string;
  EA_MATCH_FEED_URL?: string;
  EA_API_BASE_URL?: string;
}

export type DiscordOption = { name: string; type?: number; value?: string | number | boolean; focused?: boolean; options?: DiscordOption[] };

export interface DiscordInteraction {
  type: number;
  id: string;
  token: string;
  application_id: string;
  app_permissions?: string;
  guild_id?: string;
  channel_id?: string;
  member?: { user: { id: string; username: string; global_name?: string | null }; roles: string[]; permissions?: string };
  user?: { id: string; username: string; global_name?: string | null };
  data?: { name?: string; custom_id?: string; options?: DiscordOption[]; values?: string[]; components?:Array<{components:Array<{custom_id:string;value:string}>}>; resolved?: {channels?:Record<string,{id:string;type:number}>} };
}

export type InteractionResponse = {
  type: number;
  data?: { custom_id?:string;title?:string;content?: string; flags?: number; allowed_mentions?:{parse:Array<'everyone'|'roles'|'users'>}; embeds?: Array<{ title?: string; description?: string; color?: number; fields?: Array<{ name: string; value: string; inline?: boolean }> }>; components?: unknown[]; choices?: Array<{ name: string; value: string }> };
};
