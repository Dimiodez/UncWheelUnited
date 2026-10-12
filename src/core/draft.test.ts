import { describe, expect, it } from "vitest";
import { createDraftTeam, emptyDraft, moveDraftPlayer, pickingTeam } from "./draft";
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
 it("creates teams directly before drafting with the selected roster size",()=>{
  const s=setup();s.drafts!.captain!.order=[];
  const result=createDraftTeam(s,"  Snowball United  ",6);
  expect(result.error).toBeUndefined();expect(result.session.teams).toHaveLength(4);
  expect(result.session.teams[3]).toMatchObject({name:"Snowball United",capacity:6,playerIds:[]});
  expect(result.session.teams[3].id).toBeTruthy();
  expect(s.teams).toHaveLength(3);
 });
 it("rejects blank or duplicate names, invalid sizes and changes after order is picked",()=>{
  const s=setup();expect(createDraftTeam(s,"New",4).error).toContain("locked");
  s.drafts!.captain!.order=[];
  expect(createDraftTeam(s," ",4).error).toBeTruthy();
  expect(createDraftTeam(s,s.teams[0].name.toUpperCase(),4).error).toContain("already exists");
  for(const size of [0,13,2.5,NaN])expect(createDraftTeam(s,"New",size).error).toBeTruthy();
 });
 it("gives the displaced team an immediate replacement without consuming its regular turn",()=>{
  let s=setup();s=move(s,"p3","t0").session;
  expect(pickingTeam(s.drafts!.captain!)).toBe("t1");
  s=move(s,"p3","t1").session;
  expect(s.teams[0].playerIds).toEqual(["p0"]);
  expect(s.teams[1].playerIds).toEqual(["p1","p3"]);
  expect(s.drafts!.captain!.steals.p3).toBe(1);
  expect(pickingTeam(s.drafts!.captain!)).toBe("t0");
  expect(s.drafts!.captain!.pickIndex).toBe(1);
  expect(move(s,"p4","t2").error).toContain("currently picking");
  s=move(s,"p4","t0").session;
  expect(pickingTeam(s.drafts!.captain!)).toBe("t2");
  expect(s.drafts!.captain!.replacementTeamId).toBeUndefined();
 });
 it("locks at one steal without consuming a failed turn",()=>{
  let s=move(setup(),"p3","t0").session;s=move(s,"p3","t1").session;
  const result=move(s,"p3","t0");
  expect(result.error).toContain("locked");expect(result.session).toBe(s);
 });
 it("allows exactly two steals when configured",()=>{
  let s=move(setup(2),"p3","t0").session;s=move(s,"p3","t1").session;
  s=move(s,"p3","t0").session;
  expect(s.drafts!.captain!.steals.p3).toBe(2);
  expect(pickingTeam(s.drafts!.captain!)).toBe("t1");
  expect(move(s,"p3","t1").error).toContain("locked");
  s=move(s,"p4","t1").session;
  expect(pickingTeam(s.drafts!.captain!)).toBe("t2");
  expect(s.drafts!.captain!.pickIndex).toBe(2);
 });
 it("protects captains, rejects out-of-turn drops and no-op drops",()=>{
  const s=setup();
  expect(move(s,"p1","t0").error).toContain("Captains");
  expect(move(s,"p3","t1").error).toContain("currently picking");
  expect(move(s,"p0","t0").session).toBe(s);
 });
 it("uses snake endpoints and skips full teams using projected post-steal rosters",()=>{
  let s=setup();s.teams[0].capacity=2;
  s=move(s,"p3","t0").session;s=move(s,"p3","t1").session;
  s=move(s,"p4","t0").session;s=move(s,"p5","t2").session;
  expect(pickingTeam(s.drafts!.captain!)).toBe("t2");
  s=move(s,"p6","t2").session;expect(pickingTeam(s.drafts!.captain!)).toBe("t1");
  s=move(s,"p7","t1").session;expect(s.drafts!.captain!.complete).toBe(true);
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
  expect(move(saved,"p3","t0").error).toContain("locked");
  expect(pickingTeam(saved.drafts!.captain!)).toBe("t0");
  const replaced=move(saved,"p4","t0").session;
  expect(pickingTeam(replaced.drafts!.captain!)).toBe("t2");
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
