import { useEffect, useMemo, useRef, useState } from "react";

type StatKey = "PAC" | "SHO" | "PAS" | "DRI" | "DEF" | "PHY";
type Stats = Record<StatKey, number>;
type TemplateKey = "vintage" | "classic" | "midnight" | "beach" | "mountains" | "champions";
type LayerId = "photo" | "rating" | "position" | "crest" | "name" | `stat-${StatKey}`;
type LayerTransform = { x: number; y: number; scale: number };
type CardLayout = Record<LayerId, LayerTransform>;
type CardColors = { top: string; name: string; stats: string };

const STAT_KEYS: StatKey[] = ["PAC", "SHO", "PAS", "DRI", "DEF", "PHY"];
const POSITIONS = ["ST", "CF", "LW", "RW", "CAM", "CM", "CDM", "LB", "RB", "CB"];
const LAYER_LABELS: Record<LayerId, string> = {
  photo: "Player portrait", rating: "Overall rating", position: "Position", crest: "Team crest", name: "Player name",
  "stat-PAC": "PAC stat", "stat-SHO": "SHO stat", "stat-PAS": "PAS stat", "stat-DRI": "DRI stat", "stat-DEF": "DEF stat", "stat-PHY": "PHY stat"
};
const COLOR_THEMES: Record<string, { label: string; colors: CardColors }> = {
  navy: { label: "UFL Navy", colors: { top: "#102f51", name: "#102f51", stats: "#102f51" } },
  light: { label: "Stadium White", colors: { top: "#fff8e8", name: "#fff8e8", stats: "#fff8e8" } },
  gold: { label: "Champions Gold", colors: { top: "#f4d47a", name: "#f4d47a", stats: "#f4d47a" } },
  black: { label: "Pitch Black", colors: { top: "#17130d", name: "#17130d", stats: "#17130d" } },
  red: { label: "UFL Red", colors: { top: "#d7193f", name: "#d7193f", stats: "#d7193f" } }
};

const TEAMS = [
  ["goth", "UFL Gotham City"], ["nl", "UFL New Legacy"], ["ib", "UFL Island Boys"],
  ["tab", "UFL TabascoKids"], ["jag", "UFL Jagiellonia"], ["ham", "UFL HamKam"],
  ["pum", "UFL Pumas UNAM"], ["com", "UFL Como"], ["bay", "UFL Bayern"], ["pal", "UFL Palermo"]
] as const;
type TeamKey = (typeof TEAMS)[number][0];
type SavedCreation = {
  id: string; savedAt: number; name: string; position: string; rating: number; teamKey: TeamKey; stats: Stats;
  templateKey: TemplateKey; layout: CardLayout; colors: CardColors; photoUrl: string; photoZoom: number;
  photoCropX: number; photoCropY: number; photoFeather: number; nameArc: number;
};

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
const openFuncDatabase = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open("func-card-studio", 1);
  request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains("creations")) request.result.createObjectStore("creations", { keyPath: "id" }); };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
const readSavedCreations = async () => { const database = await openFuncDatabase(); return new Promise<SavedCreation[]>((resolve, reject) => { const request = database.transaction("creations", "readonly").objectStore("creations").getAll(); request.onsuccess = () => { database.close(); resolve((request.result as SavedCreation[]).sort((a, b) => b.savedAt - a.savedAt)); }; request.onerror = () => { database.close(); reject(request.error); }; }); };
const storeCreation = async (creation: SavedCreation) => { const database = await openFuncDatabase(); return new Promise<void>((resolve, reject) => { const transaction = database.transaction("creations", "readwrite"); transaction.objectStore("creations").put(creation); transaction.oncomplete = () => { database.close(); resolve(); }; transaction.onerror = () => { database.close(); reject(transaction.error); }; }); };
const deleteCreation = async (id: string) => { const database = await openFuncDatabase(); return new Promise<void>((resolve, reject) => { const transaction = database.transaction("creations", "readwrite"); transaction.objectStore("creations").delete(id); transaction.oncomplete = () => { database.close(); resolve(); }; transaction.onerror = () => { database.close(); reject(transaction.error); }; }); };

export default function FuncCardWorkspace() {
  const [name, setName] = useState("UNC PLAYER");
  const [position, setPosition] = useState("ST");
  const [rating, setRating] = useState(86);
  const [teamKey, setTeamKey] = useState<TeamKey>("goth");
  const [stats, setStats] = useState<Stats>({ ...STAT_PROFILES.ST });
  const [templateKey, setTemplateKey] = useState<TemplateKey>("vintage");
  const [layouts, setLayouts] = useState<Record<TemplateKey, CardLayout>>(() => Object.fromEntries(Object.entries(TEMPLATES).map(([key, value]) => [key, copyLayout(value.layout)])) as Record<TemplateKey, CardLayout>);
  const [colors, setColors] = useState<Record<TemplateKey, CardColors>>(() => Object.fromEntries(Object.entries(TEMPLATES).map(([key, value]) => [key, { top: value.topInk, name: value.ink, stats: value.ink }])) as Record<TemplateKey, CardColors>);
  const [selectedLayer, setSelectedLayer] = useState<LayerId>("photo");
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoZoom, setPhotoZoom] = useState(1);
  const [photoCropX, setPhotoCropX] = useState(0);
  const [photoCropY, setPhotoCropY] = useState(0);
  const [photoFeather, setPhotoFeather] = useState(32);
  const [nameArc, setNameArc] = useState(0);
  const [snapVertical, setSnapVertical] = useState(false);
  const [snapHorizontal, setSnapHorizontal] = useState(false);
  const [savedCreations, setSavedCreations] = useState<SavedCreation[]>([]);
  const [message, setMessage] = useState("Choose a border, then click any card element to move or resize it.");
  const cardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ layer: LayerId; x: number; y: number; originX: number; originY: number } | null>(null);
  const template = TEMPLATES[templateKey];
  const currentLayout = layouts[templateKey];
  const currentColors = colors[templateKey];
  const selectedTransform = currentLayout[selectedLayer];
  const displayName = name.trim().slice(0, 22).toUpperCase() || "UNC PLAYER";
  const selectedTeam = useMemo(() => TEAMS.find(([key]) => key === teamKey) || TEAMS[0], [teamKey]);
  const teamLogo = assetUrl(`func-teams/${teamKey}.png`);
  const frameUrl = assetUrl(template.file);

  useEffect(() => { readSavedCreations().then(setSavedCreations).catch(() => setMessage("Saved creations are unavailable in this browser session.")); }, []);

  const snap = (value: number, enabled: boolean) => enabled ? Math.round(value * 2) / 2 : value;
  const setLayerTransform = (layerId: LayerId, patch: Partial<LayerTransform>) => setLayouts((current) => ({ ...current, [templateKey]: { ...current[templateKey], [layerId]: { ...current[templateKey][layerId], ...patch, ...(patch.x === undefined ? {} : { x: snap(patch.x, snapVertical) }), ...(patch.y === undefined ? {} : { y: snap(patch.y, snapHorizontal) }) } } }));
  const setCardColors = (patch: Partial<CardColors>) => setColors((current) => ({ ...current, [templateKey]: { ...current[templateKey], ...patch } }));
  const startDrag = (layerId: LayerId, event: React.PointerEvent<HTMLElement>) => { event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); setSelectedLayer(layerId); const transform = currentLayout[layerId]; dragRef.current = { layer: layerId, x: event.clientX, y: event.clientY, originX: transform.x, originY: transform.y }; };
  const moveDrag = (event: React.PointerEvent<HTMLElement>) => { if (!dragRef.current || !cardRef.current) return; const rect = cardRef.current.getBoundingClientRect(); setLayerTransform(dragRef.current.layer, { x: clamp(dragRef.current.originX + (event.clientX - dragRef.current.x) / rect.width * 100, 2, 98), y: clamp(dragRef.current.originY + (event.clientY - dragRef.current.y) / rect.height * 100, 2, 98) }); };
  const stopDrag = () => { dragRef.current = null; };
  const layerProps = (layerId: LayerId) => ({ "data-selected": selectedLayer === layerId, onPointerDown: (event: React.PointerEvent<HTMLElement>) => startDrag(layerId, event), onPointerMove: moveDrag, onPointerUp: stopDrag, onPointerCancel: stopDrag, style: { left: `${currentLayout[layerId].x}%`, top: `${currentLayout[layerId].y}%`, transform: `translate(-50%, -50%) scale(${currentLayout[layerId].scale})` } });

  const randomizeStats = () => { const base = STAT_PROFILES[position]; const next = Object.fromEntries(STAT_KEYS.map((key) => [key, clamp(base[key] + Math.floor(Math.random() * 13) - 6, 35, 96)])) as Stats; setStats(next); setRating(clamp(Math.round(STAT_KEYS.reduce((sum, key) => sum + next[key], 0) / STAT_KEYS.length) + 10, 70, 95)); setMessage(`${position}-appropriate ratings generated. Every number remains editable.`); };
  const updatePosition = (nextPosition: string) => { setPosition(nextPosition); setStats({ ...STAT_PROFILES[nextPosition] }); };
  const uploadPhoto = (file?: File) => { if (!file) return; if (!file.type.startsWith("image/")) return setMessage("Please choose an image file."); const reader = new FileReader(); reader.onload = () => { setPhotoUrl(String(reader.result)); setPhotoZoom(1); setPhotoCropX(0); setPhotoCropY(0); setPhotoFeather(32); setSelectedLayer("photo"); setMessage("Portrait loaded. Use crop, position, and feather controls to keep the full face visible."); }; reader.onerror = () => setMessage("The portrait could not be loaded. Try another image."); reader.readAsDataURL(file); };
  const resetSelected = () => setLayerTransform(selectedLayer, { ...template.layout[selectedLayer] });
  const resetLayout = () => setLayouts((current) => ({ ...current, [templateKey]: copyLayout(template.layout) }));
  const saveCreation = async () => { try { const creation: SavedCreation = { id: crypto.randomUUID(), savedAt: Date.now(), name: displayName, position, rating, teamKey, stats: { ...stats }, templateKey, layout: copyLayout(currentLayout), colors: { ...currentColors }, photoUrl, photoZoom: Math.max(1, photoZoom), photoCropX, photoCropY, photoFeather, nameArc }; await storeCreation(creation); setSavedCreations((current) => [creation, ...current]); setMessage(`${displayName} saved on this device. You can reopen it below or download a PNG.`); } catch { setMessage("This browser could not save the card. Check private-browsing or storage settings."); } };
  const loadCreation = (creation: SavedCreation) => { setName(creation.name); setPosition(creation.position); setRating(creation.rating); setTeamKey(creation.teamKey); setStats({ ...creation.stats }); setTemplateKey(creation.templateKey); setLayouts((current) => ({ ...current, [creation.templateKey]: copyLayout(creation.layout) })); setColors((current) => ({ ...current, [creation.templateKey]: { ...creation.colors } })); setPhotoUrl(creation.photoUrl); setPhotoZoom(Math.max(1, creation.photoZoom)); setPhotoCropX(creation.photoCropX); setPhotoCropY(creation.photoCropY); setPhotoFeather(creation.photoFeather); setNameArc(creation.nameArc); setMessage(`${creation.name} reopened for editing.`); };
  const removeCreation = async (id: string) => { try { await deleteCreation(id); setSavedCreations((current) => current.filter((creation) => creation.id !== id)); setMessage("Saved creation removed from this device."); } catch { setMessage("The saved creation could not be removed."); } };

  const exportCard = async () => {
    try {
      const canvas = document.createElement("canvas"); canvas.width = template.width; canvas.height = template.height; const context = canvas.getContext("2d"); if (!context) throw new Error("Canvas unavailable");
      const [frame, crest, portrait] = await Promise.all([loadImage(frameUrl), loadImage(teamLogo), photoUrl ? loadImage(photoUrl) : Promise.resolve(null)]); context.drawImage(frame, 0, 0, canvas.width, canvas.height);
      const point = (id: LayerId) => ({ ...currentLayout[id], x: currentLayout[id].x / 100 * canvas.width, y: currentLayout[id].y / 100 * canvas.height });
      if (portrait) { const spot = point("photo"); const boxWidth = template.photoWidth / 100 * canvas.width * spot.scale; const boxHeight = template.photoHeight / 100 * canvas.height * spot.scale; const portraitCanvas = document.createElement("canvas"); portraitCanvas.width = canvas.width; portraitCanvas.height = canvas.height; const portraitContext = portraitCanvas.getContext("2d"); if (!portraitContext) throw new Error("Portrait canvas unavailable"); const cover = Math.max(boxWidth / portrait.width, boxHeight / portrait.height) * Math.max(1, photoZoom); const width = portrait.width * cover; const height = portrait.height * cover; portraitContext.drawImage(portrait, spot.x - width / 2 + photoCropX / 100 * boxWidth, spot.y - height / 2 + photoCropY / 100 * boxHeight, width, height); portraitContext.globalCompositeOperation = "destination-in"; portraitContext.save(); portraitContext.translate(spot.x, spot.y); portraitContext.scale(boxWidth / 2, boxHeight / 2); const featherStart = clamp(1 - photoFeather / 100, 0, .999); const gradient = portraitContext.createRadialGradient(0, 0, featherStart, 0, 0, 1); gradient.addColorStop(0, "rgba(0,0,0,1)"); gradient.addColorStop(1, "rgba(0,0,0,0)"); portraitContext.fillStyle = gradient; portraitContext.beginPath(); portraitContext.arc(0, 0, 1, 0, Math.PI * 2); portraitContext.fill(); portraitContext.restore(); context.drawImage(portraitCanvas, 0, 0); }
      context.fillStyle = currentColors.top; context.textAlign = "center"; context.textBaseline = "middle";
      const ratingSpot = point("rating"); context.font = `900 ${Math.round(canvas.width * .071 * ratingSpot.scale)}px Arial Black, Impact, sans-serif`; context.fillText(String(rating), ratingSpot.x, ratingSpot.y);
      const positionSpot = point("position"); context.font = `900 ${Math.round(canvas.width * .038 * positionSpot.scale)}px Arial Black, Impact, sans-serif`; context.fillText(position, positionSpot.x, positionSpot.y);
      const crestSpot = point("crest"); const crestSize = canvas.width * .145 * crestSpot.scale; context.drawImage(crest, crestSpot.x - crestSize / 2, crestSpot.y - crestSize / 2, crestSize, crestSize); context.fillStyle = currentColors.name;
      const nameSpot = point("name"); context.font = `900 ${Math.round(canvas.width * .047 * nameSpot.scale)}px Arial Black, Impact, sans-serif`; const maxNameWidth = canvas.width * .58 * nameSpot.scale; const naturalNameWidth = context.measureText(displayName).width; const nameWidthScale = Math.min(1, maxNameWidth / naturalNameWidth); const charWidths = [...displayName].map((character) => context.measureText(character).width); const totalNameWidth = charWidths.reduce((sum, width) => sum + width, 0) * nameWidthScale; const arcHeight = nameArc * canvas.width * .002; let nameX = nameSpot.x - totalNameWidth / 2; [...displayName].forEach((character, index) => { const progress = displayName.length === 1 ? 0 : index / (displayName.length - 1) * 2 - 1; const offsetY = -arcHeight * (1 - progress * progress); const tangent = totalNameWidth ? 4 * arcHeight * progress / totalNameWidth : 0; const characterWidth = charWidths[index] * nameWidthScale; context.save(); context.translate(nameX + characterWidth / 2, nameSpot.y + offsetY); context.rotate(Math.atan(tangent)); context.scale(nameWidthScale, 1); context.fillText(character, 0, 0); context.restore(); nameX += characterWidth; }); context.fillStyle = currentColors.stats;
      STAT_KEYS.forEach((key) => { const spot = point(`stat-${key}`); context.font = `900 ${Math.round(canvas.width * .033 * spot.scale)}px Arial Black, Impact, sans-serif`; context.fillText(`${stats[key]}  ${key}`, spot.x, spot.y, canvas.width * .26 * spot.scale); });
      const link = document.createElement("a"); link.download = `func-${templateKey}-${(name || "player").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.png`; link.href = canvas.toDataURL("image/png"); link.click(); setMessage(`Full-resolution ${template.name} card exported.`);
    } catch { setMessage("The card could not be exported. Reload the portrait and try again."); }
  };

  return <section className="func-workspace">
    <header className="func-intro"><div><p className="eyebrow">FUT, BUT MAKE IT UNC</p><h2>FUNC Card Studio</h2></div><p>Choose a UFL border, then drag and scale every card element until the layout is yours.</p></header>
    <div className="func-layout">
      <div className="func-card-column">
        <div className="func-card func-card-editable" ref={cardRef} style={{ aspectRatio: `${template.width}/${template.height}`, "--func-name-ink": currentColors.name, "--func-stat-ink": currentColors.stats, "--func-top-ink": currentColors.top } as React.CSSProperties} onPointerDown={() => setSelectedLayer("photo")} aria-label="Editable FUNC player card preview">
          <img className="func-frame" src={frameUrl} alt={`${template.name} UFL player card border`} />
          <div className={`func-layer func-portrait-window ${photoUrl ? "has-photo" : ""}`} {...layerProps("photo")} style={{ ...layerProps("photo").style, width: `${template.photoWidth}%`, height: `${template.photoHeight}%`, "--func-feather": `${photoFeather}%` } as React.CSSProperties}>{photoUrl ? <img src={photoUrl} alt="Uploaded player portrait" draggable={false} style={{ left: `${50 + photoCropX}%`, top: `${50 + photoCropY}%`, transform: `translate(-50%, -50%) scale(${Math.max(1, photoZoom)})` }} /> : <div className="func-photo-placeholder"><span>+</span><strong>YOUR FACE</strong></div>}</div>
          <strong className="func-layer func-rating-value" {...layerProps("rating")}>{rating}</strong><strong className="func-layer func-position-value" {...layerProps("position")}>{position}</strong>
          <img className="func-layer func-team-logo" {...layerProps("crest")} src={teamLogo} alt={`${selectedTeam[1]} crest`} draggable={false} />
          <div className="func-layer func-player-name" {...layerProps("name")} aria-label={displayName}><svg viewBox="0 0 1000 160" role="presentation"><defs><path id={`func-name-curve-${templateKey}`} d={`M 30 120 Q 500 ${120 - nameArc * 6} 970 120`} /></defs><text fontSize={Math.min(78, 1200 / displayName.length)}><textPath href={`#func-name-curve-${templateKey}`} startOffset="50%" textAnchor="middle">{displayName}</textPath></text></svg></div>
          {STAT_KEYS.map((key) => <div className="func-layer func-stat-value" {...layerProps(`stat-${key}`)} key={key}><strong>{stats[key]}</strong><span>{key}</span></div>)}
        </div><p className="func-drag-hint"><strong>{LAYER_LABELS[selectedLayer]}</strong> selected · drag it directly on the card.</p>
      </div>
      <form className="func-controls" onSubmit={(event) => event.preventDefault()}>
        <section><p className="eyebrow">BORDER COLLECTION</p><h3>Choose a card</h3><div className="func-template-grid">{(Object.entries(TEMPLATES) as [TemplateKey, typeof TEMPLATES[TemplateKey]][]).map(([key, option]) => <button type="button" className={templateKey === key ? "active" : ""} onClick={() => { setTemplateKey(key); setMessage(`${option.name} border selected. Its layout can be tuned independently.`); }} key={key}><img src={assetUrl(option.file)} alt="" /><span>{option.name}</span></button>)}</div></section>
        <section className="func-layout-editor"><div className="func-section-heading"><div><p className="eyebrow">LAYOUT EDITOR</p><h3>Move & resize</h3></div><button type="button" onClick={resetLayout}>Reset this border</button></div><label>Selected element<select value={selectedLayer} onChange={(event) => setSelectedLayer(event.target.value as LayerId)}>{(Object.entries(LAYER_LABELS) as [LayerId, string][]).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label><label>Element size <span>{selectedTransform.scale.toFixed(2)}×</span><input type="range" min="0.45" max="2.25" step="0.01" value={selectedTransform.scale} onChange={(event) => setLayerTransform(selectedLayer, { scale: Number(event.target.value) })} /></label><div className="func-control-pair"><label>Left / right<input type="range" min="2" max="98" step="0.1" value={selectedTransform.x} onChange={(event) => setLayerTransform(selectedLayer, { x: Number(event.target.value) })} /></label><label>Up / down<input type="range" min="2" max="98" step="0.1" value={selectedTransform.y} onChange={(event) => setLayerTransform(selectedLayer, { y: Number(event.target.value) })} /></label></div><div className="func-snap-controls"><label><input type="checkbox" checked={snapVertical} onChange={(event) => setSnapVertical(event.target.checked)} /> Vertical grid <span>snaps left/right</span></label><label><input type="checkbox" checked={snapHorizontal} onChange={(event) => setSnapHorizontal(event.target.checked)} /> Horizontal grid <span>snaps up/down</span></label></div><button type="button" className="secondary" onClick={resetSelected}>Reset selected element</button></section>
        <section className="func-color-editor"><div className="func-section-heading"><div><p className="eyebrow">COLOR THEMES</p><h3>Card lettering</h3></div><button type="button" onClick={() => setCardColors({ top: template.topInk, name: template.ink, stats: template.ink })}>Use border default</button></div><div className="func-color-themes">{Object.entries(COLOR_THEMES).map(([key, theme]) => <button type="button" onClick={() => setCardColors(theme.colors)} key={key}><i style={{ background: theme.colors.top }} /><span>{theme.label}</span></button>)}</div><div className="func-color-pickers"><label>Rating & position<input type="color" value={currentColors.top} onChange={(event) => setCardColors({ top: event.target.value })} /></label><label>Player name<input type="color" value={currentColors.name} onChange={(event) => setCardColors({ name: event.target.value })} /></label><label>Six stats<input type="color" value={currentColors.stats} onChange={(event) => setCardColors({ stats: event.target.value })} /></label></div></section>
        <section><p className="eyebrow">IDENTITY</p><h3>Player details</h3><label>Player or Discord name<input value={name} maxLength={22} onChange={(event) => setName(event.target.value)} placeholder="Enter player name" /></label><label>Name ribbon arc <span>{nameArc > 0 ? "+" : ""}{nameArc}</span><input type="range" min="-10" max="10" step="1" value={nameArc} onChange={(event) => setNameArc(Number(event.target.value))} /></label><div className="func-control-pair"><label>Position<select value={position} onChange={(event) => updatePosition(event.target.value)}>{POSITIONS.map((item) => <option key={item}>{item}</option>)}</select></label><label>Overall rating<input type="text" inputMode="numeric" maxLength={2} value={rating} onChange={(event) => setRating(clamp(Number(event.target.value.replace(/\D/g, "")) || 0, 0, 99))} /></label></div><label>6v6 club<select value={teamKey} onChange={(event) => setTeamKey(event.target.value as typeof teamKey)}>{TEAMS.map(([key, team]) => <option value={key} key={key}>{team}</option>)}</select></label></section>
        <section><p className="eyebrow">PORTRAIT</p><h3>Upload & crop</h3><label className="func-upload">Choose player photo<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => uploadPhoto(event.target.files?.[0])} /></label><label>Face crop / zoom <span>{photoZoom.toFixed(2)}×</span><input type="range" min="1" max="2.8" step="0.01" value={Math.max(1, photoZoom)} onChange={(event) => setPhotoZoom(clamp(Number(event.target.value), 1, 2.8))} /><small>Edge-safe minimum keeps the original photo boundary outside the portrait mask.</small></label><label>Edge feather <span>{photoFeather}%</span><input type="range" min="0" max="70" step="1" value={photoFeather} onChange={(event) => setPhotoFeather(Number(event.target.value))} /></label><div className="func-control-pair"><label>Face left / right<input type="range" min="-100" max="100" value={photoCropX} onChange={(event) => setPhotoCropX(Number(event.target.value))} /></label><label>Face up / down<input type="range" min="-100" max="100" value={photoCropY} onChange={(event) => setPhotoCropY(Number(event.target.value))} /></label></div><button type="button" className="secondary" onClick={() => { setPhotoZoom(1); setPhotoCropX(0); setPhotoCropY(0); setPhotoFeather(32); }}>Reset portrait</button></section>
        <section><div className="func-section-heading"><div><p className="eyebrow">ATTRIBUTES</p><h3>FUT-style stats</h3></div><button type="button" onClick={randomizeStats}>Randomize for {position}</button></div><div className="func-stat-inputs">{STAT_KEYS.map((key) => <label key={key}>{key}<input type="text" inputMode="numeric" maxLength={2} value={stats[key]} onChange={(event) => setStats({ ...stats, [key]: clamp(Number(event.target.value.replace(/\D/g, "")) || 0, 0, 99) })} /></label>)}</div></section>
        <section className="func-saved-editor"><div className="func-section-heading"><div><p className="eyebrow">MY CREATIONS</p><h3>Save and reopen</h3></div><button type="button" onClick={saveCreation}>Save current card</button></div><p className="func-storage-note">Saved privately in this browser on this device, including the uploaded portrait and editable layout.</p>{savedCreations.length ? <div className="func-saved-list">{savedCreations.map((creation) => <article key={creation.id}><div><strong>{creation.name}</strong><span>{TEMPLATES[creation.templateKey].name} · {creation.position} · {new Date(creation.savedAt).toLocaleString()}</span></div><button type="button" onClick={() => loadCreation(creation)}>Open</button><button type="button" className="danger" onClick={() => removeCreation(creation.id)}>Delete</button></article>)}</div> : <p className="func-empty-saves">No saved cards yet.</p>}</section>
        <div className="func-export"><button type="button" className="primary" onClick={exportCard}>Download full-size PNG</button><p aria-live="polite">{message}</p></div>
      </form>
    </div>
  </section>;
}
