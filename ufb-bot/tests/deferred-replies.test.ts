import {afterEach,describe,expect,it,vi} from 'vitest';
import {deliverDeferredReply} from '../src/deferred-replies';
const interaction={type:2,id:'synthetic-test',application_id:'synthetic-app',token:'synthetic-token',data:{name:'matches'}};
afterEach(()=>vi.unstubAllGlobals());
describe('deferred Discord reply delivery',()=>{
 it('retries a temporary Discord server error',async()=>{
  const send=vi.fn().mockResolvedValueOnce(Response.json({code:0},{status:503})).mockResolvedValueOnce(Response.json({}));
  vi.stubGlobal('fetch',send);
  expect(await deliverDeferredReply(interaction,{content:'Test'})).toBe(true);expect(send).toHaveBeenCalledTimes(2);
 });
 it('replaces a rejected embed with a readable error instead of leaving the deferred response unfinished',async()=>{
  const send=vi.fn().mockResolvedValueOnce(Response.json({code:50035},{status:400})).mockResolvedValueOnce(Response.json({}));
  vi.stubGlobal('fetch',send);
  expect(await deliverDeferredReply(interaction,{embeds:[{title:'Test'}]})).toBe(true);
  expect(JSON.parse(send.mock.calls[1][1].body)).toMatchObject({content:expect.stringContaining('could not display'),embeds:[],components:[],allowed_mentions:{parse:[]}});
 });
 it('does not keep retrying an expired or unknown interaction',async()=>{
  const send=vi.fn().mockResolvedValue(Response.json({code:10015},{status:404}));vi.stubGlobal('fetch',send);
  expect(await deliverDeferredReply(interaction,{content:'Test'})).toBe(false);expect(send).toHaveBeenCalledTimes(1);
 });
 it('retries a network exception once',async()=>{
  const send=vi.fn().mockRejectedValueOnce(new TypeError('Network error')).mockResolvedValueOnce(Response.json({}));vi.stubGlobal('fetch',send);
  expect(await deliverDeferredReply(interaction,{content:'Test'})).toBe(true);expect(send).toHaveBeenCalledTimes(2);
 });
});
