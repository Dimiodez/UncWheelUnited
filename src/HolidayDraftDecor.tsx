// Decorative only: Christmas ornaments, a gift, and a nine-candle Hanukkiah.
// No animation, external artwork, or interactive overlay.
export default function HolidayDraftDecor() {
  const candleX=[133,143,153,163,173,183,193,203,213];
  return <div className="holiday-header-decor" aria-hidden="true">
    <svg viewBox="0 0 230 58" focusable="false">
      {[{x:14,y:27,color:"#ef244b"},{x:37,y:36,color:"#559ce1"},{x:60,y:24,color:"#d5b963"}].map(o=><g key={o.x}>
        <path d={`M ${o.x} 0 V ${o.y-10}`} stroke="#cee6f3" strokeWidth="1.2"/>
        <rect x={o.x-3} y={o.y-11} width="6" height="4" rx="1" fill="#d7c487"/>
        <circle cx={o.x} cy={o.y} r="9" fill={o.color} stroke="#f5e7b4" strokeWidth=".8"/>
        <path d={`M ${o.x-6} ${o.y-2} Q ${o.x} ${o.y+4} ${o.x+6} ${o.y-2}`} fill="none" stroke="#edf7ff" strokeWidth="1.2"/>
      </g>)}
      <g stroke="#d9c580" strokeWidth="1.5" strokeLinejoin="round">
        <rect x="85" y="30" width="26" height="22" rx="2" fill="#b91d3d"/>
        <rect x="83" y="26" width="30" height="7" rx="1" fill="#de2549"/>
        <path d="M98 26V52M85 40H111M98 26C80 24 89 13 98 26C108 12 117 24 98 26" fill="none"/>
      </g>
      <g stroke="#cfb872" strokeWidth="1.8" fill="none" strokeLinecap="round">
        {candleX.filter(x=>x!==173).map(x=><path key={x} d={`M ${x} 27 V 33 Q ${x} 45 173 45`}/>)}
        <path d="M173 19V53M158 54H188"/>
      </g>
      {candleX.map(x=><g key={x}>
        <rect className="holiday-candle" x={x-2} y={x===173?12:20} width="4" height="9" rx="1" fill="#b8defa"/>
        <path d={`M${x} ${x===173?3:11}q-4 6 0 8q4-2 0-8`} fill="#f4d47c"/>
      </g>)}
    </svg>
  </div>;
}
