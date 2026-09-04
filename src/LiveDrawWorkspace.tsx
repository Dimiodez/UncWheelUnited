import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import CompetitionSavePanel from "./CompetitionSavePanel";
import type { SavedCompetition } from "./CompetitionSavePanel";
import CollapsiblePanel from "./CollapsiblePanel";
import { createBracket, roundName, setBracketScore } from "./core/bracket";
import type { BracketRounds } from "./core/bracket";
import { calculateGroupStandings, createGroupStageFromGroups, groupQualifiers, groupStageComplete } from "./core/groupStage";
import type { GroupStage } from "./core/groupStage";

const SIZES = [8,12,16,20,24,32];

export default function LiveDrawWorkspace() {
  const [entrantCount,setEntrantCount]=useState(8);
  const [groupCount,setGroupCount]=useState(2);
  const [names,setNames]=useState(Array.from({length:8},(_,i)=>`Team ${i+1}`));
  const [groups,setGroups]=useState<string[][]>([[],[]]);
  const [remaining,setRemaining]=useState<string[]>([]);
  const [revealed,setRevealed]=useState<string|null>(null);
  const [targetGroup,setTargetGroup]=useState<number|null>(null);
  const [drawing,setDrawing]=useState(false);
  const [started,setStarted]=useState(false);
  const [groupStage,setGroupStage]=useState<GroupStage|null>(null);
  const [rounds,setRounds]=useState<BracketRounds>([]);
  const [qualifiersPerGroup,setQualifiersPerGroup]=useState(2);
  const [message,setMessage]=useState("Prepare the entrants, dim the lights, and begin the draw.");

  const resize=(count:number)=>{const nextGroupCount=Math.min(groupCount,Math.max(2,Math.floor(count/2)));setEntrantCount(count);setGroupCount(nextGroupCount);setNames(current=>Array.from({length:count},(_,i)=>current[i]||`Team ${i+1}`));setStarted(false);setRemaining([]);setGroups(Array.from({length:nextGroupCount},()=>[]));setGroupStage(null);setRounds([]);setRevealed(null);};
  const reset=()=>{setStarted(false);setRemaining([]);setGroups(Array.from({length:groupCount},()=>[]));setGroupStage(null);setRounds([]);setRevealed(null);setTargetGroup(null);setMessage("The draw room has been reset.");};
  const begin=()=>{
    const clean=names.map(name=>name.trim());
    if(clean.some(name=>!name)) return setMessage("Every ballot needs a team name.");
    if(new Set(clean.map(name=>name.toLowerCase())).size!==clean.length) return setMessage("Every team name must be unique.");
    setGroups(Array.from({length:groupCount},()=>[]));setRemaining(clean);setGroupStage(null);setRounds([]);setRevealed(null);setTargetGroup(null);setStarted(true);setMessage(`${clean.length} sealed ballots are in the bowl.`);
  };
  const draw=()=>{
    if(drawing||!remaining.length) return;
    setDrawing(true);setRevealed(null);setTargetGroup(null);setMessage("The bowl is turning…");
    const selected=remaining[Math.floor(Math.random()*remaining.length)];
    const assignedIndex=(entrantCount-remaining.length)%groupCount;
    window.setTimeout(()=>{setRevealed(selected);setTargetGroup(assignedIndex);setMessage(`${selected} has been drawn into Group ${String.fromCharCode(65+assignedIndex)}.`);},900);
    window.setTimeout(()=>{
      setGroups(current=>{
        const next=current.map(group=>[...group]);next[assignedIndex].push(selected);
        if(remaining.length===1){setGroupStage(createGroupStageFromGroups(next));setMessage("The group draw is complete. Fixtures are ready.");}
        return next;
      });
      setRemaining(current=>current.filter(name=>name!==selected));setDrawing(false);
    },2100);
  };
  const updateGroupScore=(id:string,side:"home"|"away",value:string)=>setGroupStage(current=>current?{...current,fixtures:current.fixtures.map(match=>match.id===id?{...match,[side==="home"?"homeScore":"awayScore"]:value.replace(/\D/g,"")}:match)}:current);
  const createKnockout=()=>{if(!groupStage||!groupStageComplete(groupStage))return;setRounds(createBracket(groupQualifiers(groupStage,qualifiersPerGroup,true),()=>.999999));setMessage("The qualifiers have entered the knockout draw.");};
  const champion=rounds.at(-1)?.[0]?.winner;
  const snapshot=useMemo(()=>({kind:"competition",format:"groups",entrantCount,names,rounds,groupStage,groupCount,groupSetup:groups,doubleElimination:false,qualifiersPerGroup,crossoverSeeding:true,leagueReady:false,leagueSnapshot:null,drawMode:"live"}),[entrantCount,names,rounds,groupStage,groupCount,groups,qualifiersPerGroup]);
  const load=(saved:SavedCompetition)=>{
    const data=saved.snapshot as typeof snapshot;if(data.kind!=="competition")return;
    setEntrantCount(data.entrantCount);setNames(data.names);setGroupCount(data.groupCount||2);setGroups(data.groupStage?.groups||data.groupSetup||[]);setGroupStage(data.groupStage||null);setRounds(data.rounds||[]);setQualifiersPerGroup(data.qualifiersPerGroup||2);setRemaining([]);setStarted(true);setMessage(`Loaded “${saved.title}”.`);
  };

  return <section className="live-draw-workspace">
    <CompetitionSavePanel format="groups" snapshot={snapshot} onLoad={load}/>
    <section className="draw-ceremony">
      <div className="ceremony-lights"/><div className="ceremony-heading"><p className="eyebrow">LIVE CEREMONY</p><h2>Champions Draw</h2><p>Every click opens one ballot and places that club into its group.</p></div>
      <div className="ceremony-stage">
        <div className={`ballot-bowl ${drawing?"drawing":""}`}><button onClick={draw} disabled={!started||drawing||!remaining.length} aria-label="Draw the next team"><span className="bowl-rim"/>{Array.from({length:12},(_,i)=><i key={i} style={{"--ball":i} as CSSProperties}/>) }<span className="bowl-label">Click the bowl to draw</span><span className="ballot-count"><strong>{remaining.length}</strong><small>ballots remain</small></span></button></div>
        <div className={`draw-reveal ${drawing?"active":""} ${revealed?"revealed":""}`}><span>{drawing&&!revealed?"OPENING BALLOT":revealed?"DRAWN CLUB":"THE NEXT CLUB"}</span><h3>{drawing&&!revealed?"…":revealed||"Awaits the draw"}</h3>{targetGroup!==null&&<strong>GROUP {String.fromCharCode(65+targetGroup)}</strong>}</div>
        <div className="ceremony-controls"><button onClick={begin} disabled={drawing}>{started?"Restart ceremony":"Begin ceremony"}</button><button onClick={reset} disabled={drawing}>Reset</button><p>{message}</p></div>
      </div>
      <div className="live-group-wall">{groups.map((group,index)=><article className={targetGroup===index&&revealed?"receiving":""} key={index}><header><span>GROUP</span><strong>{String.fromCharCode(65+index)}</strong></header>{Array.from({length:Math.ceil(entrantCount/groupCount)},(_,slot)=><div className={group[slot]?"filled":""} key={slot}><b>{String(slot+1).padStart(2,"0")}</b><span>{group[slot]||"Awaiting ballot"}</span></div>)}</article>)}</div>
    </section>

    {!started&&<CollapsiblePanel title="Draw setup" eyebrow="THE BALLOTS" meta={`${entrantCount} teams`} className="standings-collapsible"><div className="live-draw-setup"><label>Teams<select value={entrantCount} onChange={event=>resize(Number(event.target.value))}>{SIZES.map(size=><option key={size}>{size}</option>)}</select></label><label>Groups<select value={groupCount} onChange={event=>{const count=Number(event.target.value);setGroupCount(count);setGroups(Array.from({length:count},()=>[]));}}>{Array.from({length:Math.max(1,Math.floor(entrantCount/2)-1)},(_,i)=>i+2).map(count=><option key={count}>{count}</option>)}</select></label><label>Advance per group<select value={qualifiersPerGroup} onChange={event=>setQualifiersPerGroup(Number(event.target.value))}><option value={1}>1 team</option><option value={2}>2 teams</option></select></label><div className="entrant-grid">{names.map((name,index)=><label key={index}><span>{String(index+1).padStart(2,"0")}</span><input value={name} onChange={event=>setNames(names.map((item,i)=>i===index?event.target.value:item))}/></label>)}</div></div></CollapsiblePanel>}

    {groupStage&&<CollapsiblePanel title="Groups and fixtures" eyebrow="GROUP STAGE" meta={`${groupStage.fixtures.length} matches`} className="standings-collapsible"><section className="group-stage-board"><div className="group-stage-heading"><p>Complete every group result, then send the top {qualifiersPerGroup} into the knockout rounds.</p><button disabled={!groupStageComplete(groupStage)} onClick={createKnockout}>{groupStageComplete(groupStage)?"Create knockout bracket":"Complete all group matches"}</button></div><div className="group-grid">{groupStage.groups.map((group,index)=>{const fixtures=groupStage.fixtures.filter(match=>match.groupIndex===index),table=calculateGroupStandings(group,fixtures);return <article className="group-card" key={index}><h3>Group {String.fromCharCode(65+index)}</h3><div className="group-table"><div className="table-head"><span>#</span><span>Entrant</span><span>P</span><span>GD</span><span>Pts</span></div>{table.map((row,place)=><div className={place<qualifiersPerGroup?"qualifying":""} key={row.name}><span>{place+1}</span><strong>{row.name}</strong><span>{row.played}</span><span>{row.goalDifference>0?`+${row.goalDifference}`:row.goalDifference}</span><b>{row.points}</b></div>)}</div><div className="group-fixtures">{fixtures.map(match=><div key={match.id}><span>{match.home}</span><input value={match.homeScore} onChange={event=>updateGroupScore(match.id,"home",event.target.value)}/><em>–</em><input value={match.awayScore} onChange={event=>updateGroupScore(match.id,"away",event.target.value)}/><span>{match.away}</span></div>)}</div></article>})}</div></section></CollapsiblePanel>}

    {rounds.length>0&&<CollapsiblePanel title="Knockout bracket" eyebrow="FINAL STAGE" meta={`${rounds.length} rounds`} className="standings-collapsible"><div className="bracket-layout"><div className="bracket-board">{rounds.map((round,roundIndex)=><div className="bracket-round" key={roundIndex}><h3>{roundName(roundIndex,rounds.length)}</h3><div className="round-matches">{round.map((match,matchIndex)=><article className="bracket-match" key={match.id}><div className={match.winner===match.home?"winner":""}><span>{match.home||"TBD"}</span><input disabled={!match.home||!match.away} value={match.homeScore} onChange={event=>setRounds(setBracketScore(rounds,roundIndex,matchIndex,"home",event.target.value.replace(/\D/g,"")))}/></div><div className={match.winner===match.away?"winner":""}><span>{match.away||(roundIndex===0&&match.home?"BYE":"TBD")}</span><input disabled={!match.home||!match.away} value={match.awayScore} onChange={event=>setRounds(setBracketScore(rounds,roundIndex,matchIndex,"away",event.target.value.replace(/\D/g,"")))}/></div></article>)}</div></div>)}</div><aside className="match-centre"><p className="eyebrow">MATCH CENTRE</p><h2>{champion?"Champion":"The road ahead"}</h2>{champion?<div className="champion-card">🏆 <strong>{champion}</strong></div>:<p>Winners advance automatically as scores are entered.</p>}</aside></div></CollapsiblePanel>}
  </section>;
}
