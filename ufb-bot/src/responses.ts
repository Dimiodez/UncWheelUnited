import type { InteractionResponse } from './types';

const UFB_BLUE = 0x08bfea;

export const message = (content: string, ephemeral = false): InteractionResponse => ({
  type: 4,
  data: { content, ...(ephemeral ? { flags: 64 } : {}) }
});

export const embed = (title: string, description: string, fields: Array<{ name: string; value: string; inline?: boolean }> = []): InteractionResponse => ({
  type: 4,
  data: { embeds: [{ title, description, color: UFB_BLUE, fields }] }
});
