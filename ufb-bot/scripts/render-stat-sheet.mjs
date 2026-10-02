import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

// Deterministic template renderer: never writes match data to the bot database.
const sharp=(await import(process.env.UFB_SHARP_MODULE || 'sharp')).default;
const [background,output]=process.argv.slice(2);
if(!background||!output)throw new Error('Usage: node scripts/render-stat-sheet.mjs background.png output.png');
const width=1920,height=1080;
const players=[
 ['chuckletrousers','FWD','9.0','2','3','1','10 / 19 (53%)','1 / 4 (25%)','0','0'],
 ['Schweinslap','MID','9.4','0','0','0','39 / 44 (89%)','3 / 4 (75%)','0','0'],
 ['mr_tomahawk10','FWD','9.1','2','2','1','21 / 24 (88%)','1 / 1 (100%)','0','0'],
 ['D-Me11ow-29','MID','8.0','0','0','2','32 / 34 (94%)','1 / 2 (50%)','1','0']
];
const columns=['PLAYER','POS','MR','GLS','SHT','AST','PAS','TKL','INT','SVS'];
const x=[100,430,535,635,735,835,1080,1340,1580,1770];
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;');
const text=(s,px,y,size=21,fill='#fff',weight=500,anchor='middle')=>`<text x="${px}" y="${y}" font-size="${size}" fill="${fill}" font-weight="${weight}" text-anchor="${anchor}">${escape(s)}</text>`;
let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><linearGradient id="shade" x2="0" y2="1"><stop stop-color="#041326" stop-opacity=".78"/><stop offset=".55" stop-color="#041326" stop-opacity=".48"/><stop offset="1" stop-color="#041326" stop-opacity=".72"/></linearGradient></defs><rect width="1920" height="1080" fill="url(#shade)"/><g font-family="Arial, sans-serif">`;
svg+=`<rect x="80" y="42" width="246" height="38" rx="8" fill="#071b36" stroke="#efbc61"/>${text('DEMO · FICTIONAL STATS',203,68,16,'#efbc61',700)}`;
svg+=text('FC MOUNTAINS',725,150,52,'#fff',800,'end')+text('4 — 1',960,150,58,'#efbc61',800)+text('MULA CORPS',1195,150,52,'#fff',800,'start');
svg+=text('FC MOUNTAINS · MATCH PLAYER STATISTICS',960,199,23,'#e0e8ef',600);
svg+=text('4 human participants · ★ MotM: Schweinslap · AI players excluded · FICTIONAL DEMO',960,236,20,'#d0dce6');
svg+=`<rect x="76" y="278" width="1768" height="468" rx="14" fill="#04101e" fill-opacity=".81"/><rect x="76" y="278" width="1768" height="64" rx="14" fill="#071b36" fill-opacity=".96"/><path d="M76 342H1844" stroke="#efbc61" stroke-width="2"/>`;
columns.forEach((c,n)=>svg+=text(c,x[n],319,n===0?23:20,'#fff',700,n===0?'start':'middle'));
players.forEach((p,row)=>{const y=384+row*64;if(row%2===0)svg+=`<rect x="77" y="${y-33}" width="1766" height="64" fill="#ffffff" fill-opacity=".035"/>`;p.forEach((v,n)=>svg+=text(v,x[n],y,n===0?23:n===6||n===7?19:22,n===2?'#efbc61':'#fff',n===0||n===2?700:500,n===0?'start':'middle'));});
svg+=text('MR Rating · GLS Goals · SHT Shots · AST Assists · PAS Passes completed/attempted',96,790,18,'#dce5ed',500,'start');
svg+=text('TKL Tackles won/attempted · INT Interceptions · SVS Saves · ★ Man of the Match',96,820,18,'#dce5ed',500,'start');
svg+=text('UNC FUTBÓL BOT',96,1005,27,'#fff',800,'start')+text('UFL MATCH CENTRE  /  uncfutbolleague.com',96,1036,17,'#c1d0de',500,'start');
svg+=text('PREVIEW ONLY · NOT AN OFFICIAL RESULT',1824,1022,18,'#efbc61',700,'end')+'</g></svg>';
const source=readFileSync(background);
await sharp(source).resize(width,height,{fit:'cover'}).composite([{input:Buffer.from(svg)}]).png().toFile(output);
console.log(pathToFileURL(output).href);
