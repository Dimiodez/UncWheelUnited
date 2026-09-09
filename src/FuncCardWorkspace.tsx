import { useEffect, useMemo, useRef, useState } from "react";

type StatKey = "PAC" | "SHO" | "PAS" | "DRI" | "DEF" | "PHY";
type Stats = Record<StatKey, number>;

const STAT_KEYS: StatKey[] = ["PAC", "SHO", "PAS", "DRI", "DEF", "PHY"];
const POSITIONS = ["ST", "CF", "LW", "RW", "CAM", "CM", "CDM", "LB", "RB", "CB"];

const TEAMS = [
  ["goth", "UFL Gotham City"], ["nl", "UFL New Legacy"], ["ib", "UFL Island Boys"],
  ["tab", "UFL TabascoKids"], ["jag", "UFL Jagiellonia"], ["ham", "UFL HamKam"],
  ["pum", "UFL Pumas UNAM"], ["com", "UFL Como"], ["bay", "UFL Bayern"],
  ["pal", "UFL Palermo"]
] as const;

const STAT_PROFILES: Record<string, Stats> = {
  ST: { PAC: 82, SHO: 86, PAS: 72, DRI: 81, DEF: 38, PHY: 78 },
  CF: { PAC: 80, SHO: 83, PAS: 79, DRI: 84, DEF: 42, PHY: 74 },
  LW: { PAC: 88, SHO: 79, PAS: 78, DRI: 87, DEF: 39, PHY: 67 },
  RW: { PAC: 88, SHO: 79, PAS: 78, DRI: 87, DEF: 39, PHY: 67 },
  CAM: { PAC: 76, SHO: 78, PAS: 87, DRI: 86, DEF: 48, PHY: 66 },
  CM: { PAC: 72, SHO: 73, PAS: 85, DRI: 81, DEF: 70, PHY: 74 },
  CDM: { PAC: 68, SHO: 61, PAS: 80, DRI: 74, DEF: 85, PHY: 83 },
  LB: { PAC: 84, SHO: 58, PAS: 76, DRI: 77, DEF: 82, PHY: 79 },
  RB: { PAC: 84, SHO: 58, PAS: 76, DRI: 77, DEF: 82, PHY: 79 },
  CB: { PAC: 69, SHO: 44, PAS: 67, DRI: 62, DEF: 88, PHY: 87 }
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const assetUrl = (name: string) => `${import.meta.env.BASE_URL}assets/${name}`;
const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = reject;
  image.src = src;
});

export default function FuncCardWorkspace() {
  const [name, setName] = useState("UNC PLAYER");
  const [position, setPosition] = useState("ST");
  const [rating, setRating] = useState(86);
  const [teamKey, setTeamKey] = useState<(typeof TEAMS)[number][0]>("goth");
  const [stats, setStats] = useState<Stats>({ ...STAT_PROFILES.ST });
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoScale, setPhotoScale] = useState(1);
  const [photoX, setPhotoX] = useState(0);
  const [photoY, setPhotoY] = useState(0);
  const [message, setMessage] = useState("Upload a portrait to begin. Everything stays on this device.");
  const dragRef = useRef<{ x: number; y: number; originX: number; originY: number } | null>(null);
  const selectedTeam = useMemo(() => TEAMS.find(([key]) => key === teamKey) || TEAMS[0], [teamKey]);
  const teamLogo = assetUrl(`func-teams/${teamKey}.png`);
  const frameUrl = assetUrl("func-card-vintage.png");

  useEffect(() => () => { if (photoUrl) URL.revokeObjectURL(photoUrl); }, [photoUrl]);

  const randomizeStats = () => {
    const base = STAT_PROFILES[position];
    const next = Object.fromEntries(STAT_KEYS.map((key) => {
      const variance = Math.floor(Math.random() * 13) - 6;
      return [key, clamp(base[key] + variance, 35, 96)];
    })) as Stats;
    const average = Math.round(STAT_KEYS.reduce((sum, key) => sum + next[key], 0) / STAT_KEYS.length);
    setStats(next);
    setRating(clamp(average + 10, 70, 95));
    setMessage(`${position}-appropriate ratings generated. You can still edit every number.`);
  };

  const updatePosition = (nextPosition: string) => {
    setPosition(nextPosition);
    setStats({ ...STAT_PROFILES[nextPosition] });
  };

  const uploadPhoto = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setMessage("Please choose an image file.");
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(URL.createObjectURL(file));
    setPhotoScale(1);
    setPhotoX(0);
    setPhotoY(0);
    setMessage("Portrait loaded. Drag it on the card or use the crop controls.");
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!photoUrl) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, originX: photoX, originY: photoY };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    setPhotoX(clamp(dragRef.current.originX + (event.clientX - dragRef.current.x) * .42, -100, 100));
    setPhotoY(clamp(dragRef.current.originY + (event.clientY - dragRef.current.y) * .42, -100, 100));
  };

  const exportCard = async () => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1024;
      canvas.height = 1434;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas is unavailable");
      const [frame, crest, portrait] = await Promise.all([
        loadImage(frameUrl), loadImage(teamLogo), photoUrl ? loadImage(photoUrl) : Promise.resolve(null)
      ]);
      context.drawImage(frame, 0, 0, canvas.width, canvas.height);
      if (portrait) {
        context.save();
        context.beginPath();
        context.ellipse(512, 600, 300, 285, 0, 0, Math.PI * 2);
        context.clip();
        context.globalCompositeOperation = "multiply";
        const box = { x: 200, y: 330, width: 624, height: 560 };
        const coverScale = Math.max(box.width / portrait.width, box.height / portrait.height) * photoScale;
        const width = portrait.width * coverScale;
        const height = portrait.height * coverScale;
        context.drawImage(portrait, box.x + (box.width - width) / 2 + photoX * 2.5, box.y + (box.height - height) / 2 + photoY * 2.5, width, height);
        context.restore();
      }
      context.save();
      context.fillStyle = "#122e4b";
      context.textAlign = "center";
      context.font = "900 72px Arial Black, Impact, sans-serif";
      context.fillText(String(rating), 250, 286);
      context.font = "900 36px Arial Black, Impact, sans-serif";
      context.fillText(position, 250, 335);
      context.drawImage(crest, 690, 205, 150, 150);
      context.font = "900 47px Arial Black, Impact, sans-serif";
      const fittedName = name.trim().slice(0, 22).toUpperCase() || "UNC PLAYER";
      context.fillText(fittedName, 512, 943, 560);
      const centers = [[365, 1080], [660, 1080], [365, 1158], [660, 1158], [365, 1236], [660, 1236]];
      STAT_KEYS.forEach((key, index) => {
        const [x, y] = centers[index];
        context.font = "900 34px Arial Black, Impact, sans-serif";
        context.fillText(`${stats[key]}  ${key}`, x, y);
      });
      context.restore();
      const link = document.createElement("a");
      link.download = `func-${(name || "player").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      setMessage("Full-resolution PNG exported.");
    } catch {
      setMessage("The card could not be exported. Try reloading the photo and exporting again.");
    }
  };

  return <section className="func-workspace">
    <header className="func-intro">
      <div><p className="eyebrow">FUT, BUT MAKE IT UNC</p><h2>FUNC Card Studio</h2></div>
      <p>Build a UFL player card, tune the crop, and export a share-ready PNG. This prototype is test-only.</p>
    </header>

    <div className="func-layout">
      <div className="func-card-column">
        <div className="func-card" aria-label="FUNC player card preview">
          <img className="func-frame" src={frameUrl} alt="Vintage UFL player card frame" />
          <div className={`func-portrait-window ${photoUrl ? "has-photo" : ""}`} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={() => { dragRef.current = null; }} onPointerCancel={() => { dragRef.current = null; }}>
            {photoUrl ? <img src={photoUrl} alt="Uploaded player portrait" draggable={false} style={{ transform: `translate(calc(-50% + ${photoX}px), calc(-50% + ${photoY}px)) scale(${photoScale})` }} /> : <div className="func-photo-placeholder"><span>+</span><strong>YOUR FACE</strong></div>}
          </div>
          <div className="func-rating"><strong>{rating}</strong><span>{position}</span></div>
          <img className="func-team-logo" src={teamLogo} alt={`${selectedTeam[1]} crest`} />
          <div className="func-player-name">{name.trim() || "UNC PLAYER"}</div>
          <div className="func-stats">{STAT_KEYS.map((key) => <div key={key}><strong>{stats[key]}</strong><span>{key}</span></div>)}</div>
        </div>
        <p className="func-drag-hint">Drag the portrait directly on the card to reposition it.</p>
      </div>

      <form className="func-controls" onSubmit={(event) => event.preventDefault()}>
        <section><p className="eyebrow">IDENTITY</p><h3>Player details</h3>
          <label>Player or Discord name<input value={name} maxLength={22} onChange={(event) => setName(event.target.value)} placeholder="Enter player name" /></label>
          <div className="func-control-pair"><label>Position<select value={position} onChange={(event) => updatePosition(event.target.value)}>{POSITIONS.map((item) => <option key={item}>{item}</option>)}</select></label><label>Overall rating<input type="text" inputMode="numeric" maxLength={2} value={rating} onChange={(event) => setRating(clamp(Number(event.target.value.replace(/\D/g, "")) || 0, 0, 99))} /></label></div>
          <label>6v6 club<select value={teamKey} onChange={(event) => setTeamKey(event.target.value as typeof teamKey)}>{TEAMS.map(([key, team]) => <option value={key} key={key}>{team}</option>)}</select></label>
        </section>

        <section><p className="eyebrow">PORTRAIT</p><h3>Upload & crop</h3>
          <label className="func-upload">Choose player photo<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => uploadPhoto(event.target.files?.[0])} /></label>
          <label>Zoom <span>{photoScale.toFixed(2)}×</span><input type="range" min="0.7" max="2.2" step="0.01" value={photoScale} onChange={(event) => setPhotoScale(Number(event.target.value))} /></label>
          <div className="func-control-pair"><label>Left / right<input type="range" min="-100" max="100" value={photoX} onChange={(event) => setPhotoX(Number(event.target.value))} /></label><label>Up / down<input type="range" min="-100" max="100" value={photoY} onChange={(event) => setPhotoY(Number(event.target.value))} /></label></div>
          <button type="button" className="secondary" onClick={() => { setPhotoScale(1); setPhotoX(0); setPhotoY(0); }}>Reset crop</button>
        </section>

        <section><div className="func-section-heading"><div><p className="eyebrow">ATTRIBUTES</p><h3>FUT-style stats</h3></div><button type="button" onClick={randomizeStats}>Randomize for {position}</button></div>
          <div className="func-stat-inputs">{STAT_KEYS.map((key) => <label key={key}>{key}<input type="text" inputMode="numeric" maxLength={2} value={stats[key]} onChange={(event) => setStats({ ...stats, [key]: clamp(Number(event.target.value.replace(/\D/g, "")) || 0, 0, 99) })} /></label>)}</div>
        </section>

        <div className="func-export"><button type="button" className="primary" onClick={exportCard}>Export full-size PNG</button><p aria-live="polite">{message}</p></div>
      </form>
    </div>
  </section>;
}
