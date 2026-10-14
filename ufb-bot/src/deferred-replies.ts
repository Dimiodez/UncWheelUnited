import type {DiscordInteraction,InteractionResponse} from './types';

// Never log the webhook URL: it contains the interaction token.
export async function deliverDeferredReply(interaction:DiscordInteraction,data:InteractionResponse['data']):Promise<boolean>{
 const url=`https://discord.com/api/v10/webhooks/${interaction.application_id}/${interaction.token}/messages/@original`;
 let payload={...data,allowed_mentions:{parse:[]}};
 for(let attempt=0;attempt<2;attempt++){
  try{
   const response=await fetch(url,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(8000)});
   if(response.ok){console.log(JSON.stringify({event:'ea_diagnostic_reply_completed',interactionId:interaction.id,command:interaction.data?.name}));return true;}
   const detail=await response.json().catch(()=>null) as {code?:number;retry_after?:number}|null;
   console.error(JSON.stringify({event:'ea_diagnostic_reply_failed',interactionId:interaction.id,status:response.status,discordCode:detail?.code??null,attempt:attempt+1}));
   if(response.status===400&&attempt===0){
    payload={content:'UFB could not display this response. Please retry the command. No match results were invented.',embeds:[],components:[],allowed_mentions:{parse:[]}};
    continue;
   }
   if(response.status===429&&attempt===0&&Number(detail?.retry_after??1)<=2){await new Promise(resolve=>setTimeout(resolve,Math.max(100,Number(detail?.retry_after??1)*1000)));continue;}
   if(response.status>=500&&attempt===0)continue;
   return false;
  }catch(error){
   console.error(JSON.stringify({event:'ea_diagnostic_reply_failed',interactionId:interaction.id,errorType:error instanceof Error?error.name:'Unknown error',attempt:attempt+1}));
  }
 }
 return false;
}
