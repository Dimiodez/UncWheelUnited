import { useEffect, useMemo, useRef, useState } from "react";

type StatKey = "PAC" | "SHO" | "PAS" | "DRI" | "DEF" | "PHY";
type Stats = Record<StatKey, number>;
type TemplateKey = "vintage" | "classic" | "midnight" | "beach" | "mountains" | "champions";
type LayerId = "photo" | "rating" | "position" | "crest" | "name" | `stat-${StatKey}`;
type LayerTransform = { x: number; y: number; scale: number };
type CardLayout = Record<LayerId, LayerTransform>;

const STAT_KEYS: StatKey[] = ["PAC", "SHO", "PAS", "DRI", "DEF", "PHY"];
const POSITIONS = ["ST", "CF", "LW", "RW", "CAM", "CM", "CDM", "LB", "RB", "CB"];
const LAYER_LABELS: Record<LayerId, string> = {
  photo: "Player portrait", rating: "Overall rating", position: "Position", crest: "Team crest", name: "Player name",
  "stat-PAC": "PAC stat", "stat-SHO": "SHO stat", "stat-PAS": "PAS stat", "stat-DRI": "DRI stat", "stat-DEF": "DEF stat", "stat-PHY": "PHY stat"
};

const TEAMS = [
  ["goth", "UFL Gotham City"], ["nl", "UFL New Legacy"], ["ib", "UFL Island Boys"],
  ["tab", "UFL TabascoKids"], ["jag", "UFL Jagiellonia"], ["ham", "UFL HamKam"],
  ["pum", "UFL Pumas UNAM"], ["com", "UFL Como"], ["bay", "UFL Bayern"], ["pal", "UFL Palermo"]
] as const;

const STAT_PROFILES: Record<string, Stats> = {
  ST: { PAC: 82, SHO: 86, PAS: 72, DRI: 81, DEF: 38, PHY: 78 }, CF: { PAC: 80, SHO: 83, PAS: 79, DRI: 84, DEF: 42, PHY: 74 },
  LW: { PAC: 88, SHO: 79, PAS: 78, DRI: 87, DEF: 39, PHY: 67 }, RW: { PAC: 88, SHO: 79, PAS: 78, DRI: 87, DEF: 39, PHY: 67 },
  CAM: { PAC: 76, SHO: 78, PAS: 87, DRI: 86, DEF: 48, PHY: 66 }, CM: { PAC: 72, SHO: 73, PAS: 85, DRI: 81, DEF: 70, PHY: 74 },
  CDM: { PAC: 68, SHO: 61, PAS: 80, DRI: 74, DEF: 85, PHY: 83 }, LB: { PAC: 84, SHO: 58, PAS: 76, DRI: 77, DEF: 82, PHY: 79 },
  RB: { PAC: 84, SHO: 58, PAS: 76, DRI: 77, DEF: 82, PHY: 79 }, CB: { PAC: 69, SHO: 44, PAS: 67, DRI: 62, DEF: 88, PHY: 87 }
};

const layer = (x: number, y: number, scale = 1): LayerTransform => ({ x, y, scale });
const layout = (values: Partial<CardLayout>): CardLayout => ({
  photo: layer(50, 43), rating: layer(25, 20), position: layer(25, 25), crest: layer(77, 21), name: layer(50, 65),
  "stat-PAC": layer(36, 75), "stat-SHO": layer(64, 75), "stat-PAS": layer(36, 80.5), "stat-DRI": layer(64, 80.5),
  "stat-DEF": layer(36, 86), "stat-PHY": layer(64, 86), ...values
});

const TEMPLATES: Record<TemplateKey, { name: string; file: string; width: number; height: number; photoWidth: number; photoHeight: number; ink: string; topInk: string; layout: CardLayout }> = {
  vintage: { name: "Vintage Stadium", file: "func-card-vintage.png", width: 1024, height: 1434, photoWidth: 61, photoHeight: 39, ink: "#122e4b", topInk: "#122e4b", layout: layout({ photo: layer(50, 43.5), rating: layer(24.5, 18.5), position: layer(24.5, 24.5), crest: layer(75, 19.5), name: layer(50, 64.5), "stat-PAC": layer(36, 74.5), "stat-SHO": layer(64, 74.5), "stat-PAS": layer(36, 80), "stat-DRI": layer(64, 80), "stat-DEF": layer(36, 85.2), "stat-PHY": layer(64, 85.2) }) },
  classic: { name: "Classic White", file: "func-card-classic.png", width: 1198, height: 1313, photoWidth: 61, photoHeight: 35, ink: "#102f51", topInk: "#102f51", layout: layout({ rating: layer(25, 19.5), position: layer(25, 26), crest: layer(77, 22), name: layer(50, 63.5), "stat-PAC": layer(36, 70.8), "stat-SHO": layer(64, 70.8), "stat-PAS": layer(36, 76.4), "stat-DRI": layer(64, 76.4), "stat-DEF": layer(36, 82), "stat-PHY": layer(64, 82) }) },
  midnight: { name: "Midnight", file: "func-card-midnight.png", width: 1122, height: 1402, photoWidth: 61, photoHeight: 36, ink: "#102f51", topInk: "#f4ead8", layout: layout({ rating: layer(23.5, 19), position: layer(23.5, 25.5), crest: layer(76.5, 20.5), name: layer(50, 61.7), "stat-PAC": layer(35, 70.7), "stat-SHO": layer(65, 70.7), "stat-PAS": layer(35, 76.2), "stat-DRI": layer(65, 76.2), "stat-DEF": layer(35, 81.6), "stat-PHY": layer(65, 81.6) }) },
  beach: { name: "Sandy Bums Beach", file: "func-card-beach.png", width: 1024, height: 1536, photoWidth: 64, photoHeight: 38, ink: "#082f55", topInk: "#082f55", layout: layout({ photo: layer(52, 44), rating: layer(20, 22.5), position: layer(20, 29), crest: layer(81, 24), name: layer(50, 64.5), "stat-PAC": layer(31, 71.7), "stat-SHO": layer(69, 71.7), "stat-PAS": layer(31, 77.3), "stat-DRI": layer(69, 77.3), "stat-DEF": layer(31, 83), "stat-PHY": layer(69, 83) }) },
  mountains: { name: "FC Mountains", file: "func-card-mountains.png", width: 1086, height: 1448, photoWidth: 61, photoHeight: 36, ink: "#0d3156", topInk: "#0d3156", layout: layout({ photo: layer(50, 44), rating: layer(20, 19), position: layer(20, 25.5), crest: layer(80, 21), name: layer(50, 60), "stat-PAC": layer(34, 68), "stat-SHO": layer(66, 68), "stat-PAS": layer(34, 73.5), "stat-DRI": layer(66, 73.5), "stat-DEF": layer(34, 79), "stat-PHY": layer(66, 79) }) },
  champions: { name: "Champions Gold", file: "func-card-champions.png", width: 1024, height: 1536, photoWidth: 61, photoHeight: 37, ink: "#241707", topInk: "#f4d47a", layout: layout({ photo: layer(50, 43.5), rating: layer(20, 19), position: layer(20, 25), crest: layer(80, 20.5), name: layer(50, 62), "stat-PAC": layer(33, 70.8), "stat-SHO": layer(67, 70.8), "stat-PAS": layer(33, 76), "stat-DRI": layer(67, 76), "stat-DEF": layer(33, 81.2), "stat-PHY": layer(67, 81.2) }) }
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const assetUrl = (name: string) => `${import.meta.env.BASE_URL}assets/${name}`;
const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = src; });
const copyLayout = (source: CardLayout): CardLayout => Object.fromEntries(Object.entries(source).map(([key, value]) => [key, { ...value }])) as CardLayout;

export default function FuncCardWorkspace() {
  const [name, setName] = useState("UNC PLAYER");
  const [position, setPosition] = useState("ST");
  const [rating, setRating] = useState(86);
  const [teamKey, setTeamKey] = useState<(typeof TEAMS)[number][0]>("goth");
  const [stats, setStats] = useState<Stats>({ ...STAT_PROFILES.ST });
  const [templateKey, setTemplateKey] = useState<TemplateKey>("vintage");
  const [layouts, setLayouts] = useState<Record<TemplateKey, CardLayout>>(() => Object.fromEntries(Object.entries(TEMPLATES).map(([key, value]) => [key, copyLayout(value.layout)])) as Record<TemplateKey, CardLayout>);
  const [selectedLayer, setSelectedLayer] = useState<LayerId>("photo");
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoZoom, setPhotoZoom] = useState(1);
  const [photoCropX, setPhotoCropX] = useState(0);
  const [photoCropY, setPhotoCropY] = useState(0);
  const [message, setMessage] = useState("Choose a border, then click any card element to move or resize it.");
  const cardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ layer: LayerId; x: number; y: number; originX: number; originY: number } | null>(null);
  const template = TEMPLATES[templateKey];
  const currentLayout = layouts[templateKey];
  const selectedTransform = currentLayout[selectedLayer];
  const selectedTeam = useMemo(() => TEAMS.find(([key]) => key === teamKey) || TEAMS[0], [teamKey]);
  const teamLogo = assetUrl(`func-teams/${teamKey}.png`);
  const frameUrl = assetUrl(template.file);

  useEffect(() => () => { if (photoUrl) URL.revokeObjectURL(photoUrl); }, [photoUrl]);

  const setLayerTransform = (layerId: LayerId, patch: Partial<LayerTransform>) => setLayouts((current) => ({ ...current, [templateKey]: { ...current[templateKey], [layerId]: { ...current[templateKey][layerId], ...patch } } }));
  const startDrag = (layerId: LayerId, event: React.PointerEvent<HTMLElement>) => { event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); setSelectedLayer(layerId); const transform = currentLayout[layerId]; dragRef.current = { layer: layerId, x: event.clientX, y: event.clientY, originX: transform.x, originY: transform.y }; };
  const moveDrag = (event: React.PointerEvent<HTMLElement>) => { if (!dragRef.current || !cardRef.current) return; const rect = cardRef.current.getBoundingClientRect(); setLayerTransform(dragRef.current.layer, { x: clamp(dragRef.current.originX + (event.clientX - dragRef.current.x) / rect.width * 100, 2, 98), y: clamp(dragRef.current.originY + (event.clientY - dragRef.current.y) / rect.height * 100, 2, 98) }); };
  const stopDrag = () => { dragRef.current = null; };
  const layerProps = (layerId: LayerId) => ({ "data-selected": selectedLayer === layerId, onPointerDown: (event: React.PointerEvent<HTMLElement>) => startDrag(layerId, event), onPointerMove: moveDrag, onPointerUp: stopDrag, onPointerCancel: stopDrag, style: { left: `${currentLayout[layerId].x}%`, top: `${currentLayout[layerId].y}%`, transform: `translate(-50%, -50%) scale(${currentLayout[layerId].scale})` } });

  const randomizeStats = () => { const base = STAT_PROFILES[position]; const next = Object.fromEntries(STAT_KEYS.map((key) => [key, clamp(base[key] + Math.floor(Math.random() * 13) - 6, 35, 96)])) as Stats; setStats(next); setRating(clamp(Math.round(STAT_KEYS.reduce((sum, key) => sum + next[key], 0) / STAT_KEYS.length) + 10, 70, 95)); setMessage(`${position}-appropriate ratings generated. Every number remains editable.`); };
  const updatePosition = (nextPosition: string) => { setPosition(nextPosition); setStats({ ...STAT_PROFILES[nextPosition] }); };
  const uploadPhoto = (file?: File) => { if (!file) return; if (!file.type.startsWith("image/")) return setMessage("Please choose an image file."); if (photoUrl) URL.revokeObjectURL(photoUrl); setPhotoUrl(URL.createObjectURL(file)); setPhotoZoom(1); setPhotoCropX(0); setPhotoCropY(0); setSelectedLayer("photo"); setMessage("Portrait loaded. Drag its layer, then use crop controls for the face within it."); };
  const resetSelected = () => setLayerTransform(selectedLayer, { ...template.layout[selectedLayer] });
  const resetLayout = () => setLayouts((current) => ({ ...current, [templateKey]: copyLayout(template.layout) }));

  const exportCard = async () => {
    try {
      const canvas = document.createElement("canvas"); canvas.width = template.width; canvas.height = template.height; const context = canvas.getContext("2d"); if (!context) throw new Error("Canvas unavailable");
      const [frame, crest, portrait] = await Promise.all([loadImage(frameUrl), loadImage(teamLogo), photoUrl ? loadImage(photoUrl) : Promise.resolve(null)]); context.drawImage(frame, 0, 0, canvas.width, canvas.height);
      const point = (id: LayerId) => ({ ...currentLayout[id], x: currentLayout[id].x / 100 * canvas.width, y: currentLayout[id].y / 100 * canvas.height });
      if (portrait) { const spot = point("photo"); const boxWidth = template.photoWidth / 100 * canvas.width * spot.scale; const boxHeight = template.photoHeight / 100 * canvas.height * spot.scale; context.save(); context.beginPath(); context.ellipse(spot.x, spot.y, boxWidth / 2, boxHeight / 2, 0, 0, Math.PI * 2); context.clip(); const cover = Math.max(boxWidth / portrait.width, boxHeight / portrait.height) * photoZoom; const width = portrait.width * cover; const height = portrait.height * cover; context.drawImage(portrait, spot.x - width / 2 + photoCropX / 100 * boxWidth, spot.y - height / 2 + photoCropY / 100 * boxHeight, width, height); context.restore(); }
      context.fillStyle = template.topInk; context.textAlign = "center"; context.textBaseline = "middle";
      const ratingSpot = point("rating"); context.font = `900 ${Math.round(canvas.width * .071 * ratingSpot.scale)}px Arial Black, Impact, sans-serif`; context.fillText(String(rating), ratingSpot.x, ratingSpot.y);
      const positionSpot = point("position"); context.font = `900 ${Math.round(canvas.width * .038 * positionSpot.scale)}px Arial Black, Impact, sans-serif`; context.fillText(position, positionSpot.x, positionSpot.y);
      const crestSpot = point("crest"); const crestSize = canvas.width * .145 * crestSpot.scale; context.drawImage(crest, crestSpot.x - crestSize / 2, crestSpot.y - crestSize / 2, crestSize, crestSize); context.fillStyle = template.ink;
      const nameSpot = point("name"); context.font = `900 ${Math.round(canvas.width * .047 * nameSpot.scale)}px Arial Black, Impact, sans-serif`; context.fillText(name.trim().slice(0, 22).toUpperCase() || "UNC PLAYER", nameSpot.x, nameSpot.y, canvas.width * .58 * nameSpot.scale);
      STAT_KEYS.forEach((key) => { const spot = point(`stat-${key}`); context.font = `900 ${Math.round(canvas.width * .033 * spot.scale)}px Arial Black, Impact, sans-serif`; context.fillText(`${stats[key]}  ${key}`, spot.x, spot.y, canvas.width * .26 * spot.scale); });
      const link = document.createElement("a"); link.download = `func-${templateKey}-${(name || "player").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.png`; link.href = canvas.toDataURL("image/png"); link.click(); setMessage(`Full-resolution ${template.name} card exported.`);
    } catch { setMessage("The card could not be exported. Reload the portrait and try again."); }
  };

  return <section className="func-workspace">
    <header className="func-intro"><div><p className="eyebrow">FUT, BUT MAKE IT UNC</p><h2>FUNC Card Studio</h2></div><p>Choose a UFL border, then drag and scale every card element until the layout is yours.</p></header>
    <div className="func-layout">
      <div className="func-card-column">
        <div className="func-card func-card-editable" ref={cardRef} style={{ aspectRatio: `${template.width}/${template.height}`, "--func-ink": template.ink, "--func-top-ink": template.topInk } as React.CSSProperties} onPointerDown={() => setSelectedLayer("photo")} aria-label="Editable FUNC player card preview">
          <img className="func-frame" src={frameUrl} alt={`${template.name} UFL player card border`} />
          <div className={`func-layer func-portrait-window ${photoUrl ? "has-photo" : ""}`} {...layerProps("photo")} style={{ ...layerProps("photo").style, width: `${template.photoWidth}%`, height: `${template.photoHeight}%` }}>{photoUrl ? <img src={photoUrl} alt="Uploaded player portrait" draggable={false} style={{ transform: `translate(calc(-50% + ${photoCropX}px), calc(-50% + ${photoCropY}px)) scale(${photoZoom})` }} /> : <div className="func-photo-placeholder"><span>+</span><strong>YOUR FACE</strong></div>}</div>
          <strong className="func-layer func-rating-value" {...layerProps("rating")}>{rating}</strong><strong className="func-layer func-position-value" {...layerProps("position")}>{position}</strong>
          <img className="func-layer func-team-logo" {...layerProps("crest")} src={teamLogo} alt={`${selectedTeam[1]} crest`} draggable={false} />
          <div className="func-layer func-player-name" {...layerProps("name")}>{name.trim() || "UNC PLAYER"}</div>
          {STAT_KEYS.map((key) => <div className="func-layer func-stat-value" {...layerProps(`stat-${key}`)} key={key}><strong>{stats[key]}</strong><span>{key}</span></div>)}
        </div><p className="func-drag-hint"><strong>{LAYER_LABELS[selectedLayer]}</strong> selected · drag it directly on the card.</p>
      </div>
      <form className="func-controls" onSubmit={(event) => event.preventDefault()}>
        <section><p className="eyebrow">BORDER COLLECTION</p><h3>Choose a card</h3><div className="func-template-grid">{(Object.entries(TEMPLATES) as [TemplateKey, typeof TEMPLATES[TemplateKey]][]).map(([key, option]) => <button type="button" className={templateKey === key ? "active" : ""} onClick={() => { setTemplateKey(key); setMessage(`${option.name} border selected. Its layout can be tuned independently.`); }} key={key}><img src={assetUrl(option.file)} alt="" /><span>{option.name}</span></button>)}</div></section>
        <section className="func-layout-editor"><div className="func-section-heading"><div><p className="eyebrow">LAYOUT EDITOR</p><h3>Move & resize</h3></div><button type="button" onClick={resetLayout}>Reset this border</button></div><label>Selected element<select value={selectedLayer} onChange={(event) => setSelectedLayer(event.target.value as LayerId)}>{(Object.entries(LAYER_LABELS) as [LayerId, string][]).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label><label>Element size <span>{selectedTransform.scale.toFixed(2)}×</span><input type="range" min="0.45" max="2.25" step="0.01" value={selectedTransform.scale} onChange={(event) => setLayerTransform(selectedLayer, { scale: Number(event.target.value) })} /></label><div className="func-control-pair"><label>Left / right<input type="range" min="2" max="98" step="0.1" value={selectedTransform.x} onChange={(event) => setLayerTransform(selectedLayer, { x: Number(event.target.value) })} /></label><label>Up / down<input type="range" min="2" max="98" step="0.1" value={selectedTransform.y} onChange={(event) => setLayerTransform(selectedLayer, { y: Number(event.target.value) })} /></label></div><button type="button" className="secondary" onClick={resetSelected}>Reset selected element</button></section>
        <section><p className="eyebrow">IDENTITY</p><h3>Player details</h3><label>Player or Discord name<input value={name} maxLength={22} onChange={(event) => setName(event.target.value)} placeholder="Enter player name" /></label><div className="func-control-pair"><label>Position<select value={position} onChange={(event) => updatePosition(event.target.value)}>{POSITIONS.map((item) => <option key={item}>{item}</option>)}</select></label><label>Overall rating<input type="text" inputMode="numeric" maxLength={2} value={rating} onChange={(event) => setRating(clamp(Number(event.target.value.replace(/\D/g, "")) || 0, 0, 99))} /></label></div><label>6v6 club<select value={teamKey} onChange={(event) => setTeamKey(event.target.value as typeof teamKey)}>{TEAMS.map(([key, team]) => <option value={key} key={key}>{team}</option>)}</select></label></section>
        <section><p className="eyebrow">PORTRAIT</p><h3>Upload & crop</h3><label className="func-upload">Choose player photo<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => uploadPhoto(event.target.files?.[0])} /></label><label>Face zoom <span>{photoZoom.toFixed(2)}×</span><input type="range" min="0.7" max="2.8" step="0.01" value={photoZoom} onChange={(event) => setPhotoZoom(Number(event.target.value))} /></label><div className="func-control-pair"><label>Face left / right<input type="range" min="-100" max="100" value={photoCropX} onChange={(event) => setPhotoCropX(Number(event.target.value))} /></label><label>Face up / down<input type="range" min="-100" max="100" value={photoCropY} onChange={(event) => setPhotoCropY(Number(event.target.value))} /></label></div><button type="button" className="secondary" onClick={() => { setPhotoZoom(1); setPhotoCropX(0); setPhotoCropY(0); }}>Reset face crop</button></section>
        <section><div className="func-section-heading"><div><p className="eyebrow">ATTRIBUTES</p><h3>FUT-style stats</h3></div><button type="button" onClick={randomizeStats}>Randomize for {position}</button></div><div className="func-stat-inputs">{STAT_KEYS.map((key) => <label key={key}>{key}<input type="text" inputMode="numeric" maxLength={2} value={stats[key]} onChange={(event) => setStats({ ...stats, [key]: clamp(Number(event.target.value.replace(/\D/g, "")) || 0, 0, 99) })} /></label>)}</div></section>
        <div className="func-export"><button type="button" className="primary" onClick={exportCard}>Export full-size PNG</button><p aria-live="polite">{message}</p></div>
      </form>
    </div>
  </section>;
}
