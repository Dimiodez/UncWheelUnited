import { describe, expect, it } from "vitest";
import { emptyDraft, moveDraftPlayer, pickingTeam } from "./draft";
import { sampleSession } from "./session";
import type { Session } from "../types";

function setup(limit: 1 | 2 = 1): Session {
 const s=sampleSession();
 s.players=s.players.slice(0,8).map((p,i)=>({...p,id:"p"+i}));
 s.teams=s.teams.slice(0,3).map((t,i)=>({...t,id:"t"+i,capacity:3,captainId:"p"+i,playerIds:["p"+i]}));
 s.drafts={captain:{...emptyDraft(),whiteElephant:true,stealLimit:limit,order:["t0","t1","t2"],selectedCaptainIds:["p0","p1","p2"]}};
 return s;
}
const move=(s:Session,p:string,t:string)=>moveDraftPlayer(s,"captain",p,t);
describe("White Elephant captain draft",()=>{
 it("a draft and a steal each consume one turn and remove only the stolen player",()=>{
  let s=setup();s=move(s,"p3","t0").session;
  expect(pickingTeam(s.drafts!.captain!)).toBe("t1");
  s=move(s,"p3","t1").session;
  expect(s.teams[0].playerIds).toEqual(["p0"]);
  expect(s.teams[1].playerIds).toEqual(["p1","p3"]);
  expect(s.drafts!.captain!.steals.p3).toBe(1);
  expect(pickingTeam(s.drafts!.captain!)).toBe("t2");
 });
 it("locks at one steal without consuming a failed turn",()=>{
  let s=move(setup(),"p3","t0").session;s=move(s,"p3","t1").session;
  const result=move(s,"p3","t2");
  expect(result.error).toContain("locked");expect(result.session).toBe(s);
 });
 it("allows exactly two steals when configured",()=>{
  let s=move(setup(2),"p3","t0").session;s=move(s,"p3","t1").session;
  s=move(s,"p3","t2").session;
  expect(s.drafts!.captain!.steals.p3).toBe(2);
  s=move(s,"p4","t2").session; // snake endpoint picks twice
  expect(move(s,"p3","t1").error).toContain("locked");
 });
 it("protects captains, rejects out-of-turn drops and no-op drops",()=>{
  const s=setup();
  expect(move(s,"p1","t0").error).toContain("Captains");
  expect(move(s,"p3","t1").error).toContain("currently picking");
  expect(move(s,"p0","t0").session).toBe(s);
 });
 it("uses snake endpoints and skips full teams using projected post-steal rosters",()=>{
  let s=setup();s.teams[0].capacity=2;
  s=move(s,"p3","t0").session;s=move(s,"p3","t1").session;s=move(s,"p4","t2").session;
  expect(pickingTeam(s.drafts!.captain!)).toBe("t2");
  s=move(s,"p5","t2").session;expect(pickingTeam(s.drafts!.captain!)).toBe("t1");
  s=move(s,"p6","t1").session;expect(pickingTeam(s.drafts!.captain!)).toBe("t0");
  s=move(s,"p7","t0").session;expect(s.drafts!.captain!.complete).toBe(true);
  expect(pickingTeam(s.drafts!.captain!)).toBeUndefined();
 });
 it("does not end just because the available pool is empty if a legal steal remains",()=>{
  let s=setup();s.players=s.players.slice(0,4);
  s=move(s,"p3","t0").session;
  expect(s.drafts!.captain!.complete).toBe(false);
  s=move(s,"p3","t1").session;
  expect(s.drafts!.captain!.complete).toBe(true);
 });
 it("persists steal locks and turn across JSON save/reload",()=>{
  let s=move(setup(),"p3","t0").session;s=move(s,"p3","t1").session;
  const saved=JSON.parse(JSON.stringify(s)) as Session;
  expect(move(saved,"p3","t2").error).toContain("locked");
  expect(pickingTeam(saved.drafts!.captain!)).toBe("t2");
 });
 it("standard drafting stays separate, and fantasy is never White Elephant",()=>{
  const s=setup();s.drafts!.captain!.whiteElephant=false;
  let result=move(s,"p3","t0").session;
  const index=result.drafts!.captain!.pickIndex;
  result=move(result,"p3","t2").session;
  expect(result.drafts!.captain!.pickIndex).toBe(index);
  expect(result.drafts!.captain!.steals).toEqual({});
  expect(moveDraftPlayer(setup(),"fantasy","p3","t2").error).toBeUndefined();
 });
});
