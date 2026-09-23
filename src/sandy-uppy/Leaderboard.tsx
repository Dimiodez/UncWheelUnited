import {useEffect,useState} from 'react';
type Entry={displayName:string;score:number;seconds:number;combo:number};
export default function Leaderboard(){
 const [entries,setEntries]=useState<Entry[]>([]),[message,setMessage]=useState('Loading leaderboard…');
 const refresh=async()=>{try{const r=await fetch('/api/sandy/leaderboard');const data=await r.json();if(!r.ok)throw Error();setEntries(data.entries);setMessage(data.entries.length?'One personal best per signed-in player.':'No scores yet. Be the first Unc on the board!');}catch{setMessage('Leaderboard unavailable right now. Try refreshing.');}};
 useEffect(()=>{void refresh();const saved=()=>{void refresh();};window.addEventListener('sandy-score-saved',saved);return()=>window.removeEventListener('sandy-score-saved',saved);},[]);
 return <section className="sandy-leaderboard"><h3>Fellow Uncs · Leaderboard</h3><p>{message}</p><div className="sandy-table-wrap"><table><thead><tr><th>Rank</th><th>Player</th><th>Score</th><th>Survived</th><th>Best combo</th></tr></thead><tbody>{entries.map((entry,i)=><tr key={i}><td>{i+1}</td><td>{entry.displayName}</td><td>{entry.score.toLocaleString()}</td><td>{Math.floor(entry.seconds/60)}:{String(entry.seconds%60).padStart(2,'0')}</td><td>{entry.combo}</td></tr>)}</tbody></table></div><button type="button" onClick={()=>void refresh()}>Refresh leaderboard</button></section>;
}
