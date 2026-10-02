import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const sharp=require('sharp');

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.join(here,'..');
const background=await fs.readFile(path.join(root,'assets','stat-backgrounds','mountain-stadium.png'));
const bg=`data:image/png;base64,${background.toString('base64')}`;
const esc=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const text=(value,x,y,size=20,fill='#fff',weight=500,anchor='start')=>`<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" font-weight="${weight}" text-anchor="${anchor}">${esc(value)}</text>`;
const columns=['PLAYER','POS','MR','GLS','SHT','AST','PAS','TKL','INT','SVS'];
const xs=[115,515,625,725,825,925,1160,1390,1605,1780];
const teams=[
 {name:'FC Mountains',score:4,motm:'Schweinslap',accent:'#efbc61',players:[
  ['chuckletrousers','FWD','9.0','2','3','1','10 / 19 (53%)','1 / 4 (25%)','0','0'],
  ['★ Schweinslap','MID','9.4','0','0','0','39 / 44 (89%)','3 / 4 (75%)','0','0'],
  ['mr_tomahawk10','FWD','9.1','2','2','1','21 / 24 (88%)','1 / 1 (100%)','0','0'],
  ['D-Me11ow-29','MID','8.0','0','0','2','32 / 34 (94%)','1 / 2 (50%)','0','0']
 ]},
 {name:'Mula cops',score:1,motm:'KeeperOne',accent:'#08bfea',players:[
  ['MulaPlayer10','FWD','7.8','1','2','0','14 / 19 (74%)','0 / 1 (0%)','0','0'],
  ['BoxToBox8','MID','7.2','0','1','1','27 / 33 (82%)','2 / 3 (67%)','1','0'],
  ['LastDefender','DEF','7.0','0','0','0','18 / 24 (75%)','4 / 5 (80%)','2','0'],
  ['★ KeeperOne','GK','8.1','0','0','0','11 / 16 (69%)','0 / 0 (0%)','0','6']
 ]}
];
let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><image href="${bg}" width="1920" height="1080" preserveAspectRatio="xMidYMid slice"/><defs><linearGradient id="shade" x2="0" y2="1"><stop stop-color="#031124" stop-opacity=".9"/><stop offset=".5" stop-color="#031124" stop-opacity=".72"/><stop offset="1" stop-color="#031124" stop-opacity=".9"/></linearGradient></defs><rect width="1920" height="1080" fill="url(#shade)"/><g font-family="Arial, sans-serif">`;
svg+=text('TWO-TEAM MATCH REPORT',96,68,18,'#efbc61',800)+text('LAYOUT PREVIEW · SAMPLE DATA',1824,68,16,'#cbd7e2',700,'end');
svg+=text('FC Mountains',760,142,48,'#fff',800,'end')+text('4 — 1',960,144,58,'#efbc61',900,'middle')+text('Mula cops',1160,142,48,'#fff',800,'start');
svg+=text('ONE MATCH · BOTH CLUBS · EA HUMAN-PLAYER DATA',960,180,18,'#cbd7e2',700,'middle');
teams.forEach((team,index)=>{
 const y=218+index*382;
 svg+=`<rect x="76" y="${y}" width="1768" height="352" rx="16" fill="#061322" fill-opacity=".88" stroke="${team.accent}" stroke-opacity=".55"/>`;
 svg+=`<rect x="76" y="${y}" width="1768" height="68" rx="16" fill="#071b36" fill-opacity=".98"/><circle cx="116" cy="${y+34}" r="22" fill="${team.accent}" fill-opacity=".22" stroke="${team.accent}"/>`;
 svg+=text(team.name.slice(0,2).toUpperCase(),116,y+42,16,team.accent,900,'middle')+text(`${team.name} · ${team.score} GOAL${team.score===1?'':'S'}`,155,y+43,26,'#fff',800)+text(`★ MotM: ${team.motm}`,1810,y+42,19,team.accent,700,'end');
 columns.forEach((column,n)=>svg+=text(column,xs[n],y+99,n===0?19:17,'#dfe8ef',800,n===0?'start':'middle'));
 svg+=`<path d="M96 ${y+113}H1824" stroke="${team.accent}" stroke-width="2"/>`;
 team.players.forEach((player,row)=>{const ry=y+153+row*52;if(row%2===0)svg+=`<rect x="96" y="${ry-33}" width="1728" height="48" fill="#fff" fill-opacity=".035"/>`;player.forEach((value,n)=>svg+=text(value,xs[n],ry,n===0?20:n===6||n===7?17:19,n===2?team.accent:'#fff',n===0||n===2?700:500,n===0?'start':'middle'));});
});
svg+=text('MR Rating · GLS Goals · SHT Shots · AST Assists · PAS Passes completed/attempted',96,1000,17,'#dce5ed',500)+text('TKL Tackles won/attempted · INT Interceptions · SVS Saves · ★ Man of the Match',96,1028,17,'#dce5ed',500);
svg+=text('UNC FUTBÓL BOT',1824,1002,21,'#fff',800,'end')+text('CONCEPT ONLY · NOT PUBLISHED',1824,1032,16,'#efbc61',700,'end')+'</g></svg>';
await sharp(Buffer.from(svg)).png().toFile(path.join(root,'two-team-match-concept.png'));
