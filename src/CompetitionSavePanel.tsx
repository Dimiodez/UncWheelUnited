import { useEffect, useState } from "react";

export type SavedCompetition = {
  id: string;
  title: string;
  destination: "community-events" | "league-cup";
  format: string;
  startsAt: string;
  status: "draft" | "published";
  snapshot: Record<string, unknown>;
};

type Props = {
  format: string;
  snapshot: Record<string, unknown>;
  onLoad: (saved: SavedCompetition) => void;
};

const LOCAL_KEY = "uwu.saved-competitions.v1";

export default function CompetitionSavePanel({ format, snapshot, onLoad }: Props) {
  const [events, setEvents] = useState<SavedCompetition[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [title, setTitle] = useState("");
  const [destination, setDestination] = useState<SavedCompetition["destination"]>("community-events");
  const [startsAt, setStartsAt] = useState("");
  const [message, setMessage] = useState("Save a draft now, then keep editing it before or after publication.");

  const readLocal = () => {
    try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]") as SavedCompetition[]; } catch { return []; }
  };

  const refresh = async () => {
    try {
      const response = await fetch("/api/admin/events", { credentials: "same-origin" });
      if (!response.ok) throw new Error();
      const data = await response.json();
      setEvents(data.events);
    } catch { setEvents(readLocal()); }
  };

  useEffect(() => { void refresh(); }, []);

  const choose = (id: string) => {
    setSelectedId(id);
    const saved = events.find(item => item.id === id);
    if (!saved) return;
    setTitle(saved.title); setDestination(saved.destination); setStartsAt(saved.startsAt || "");
  };

  const save = async (status: SavedCompetition["status"]) => {
    if (!title.trim()) return setMessage("Give this competition a name first.");
    const item = { id: selectedId || crypto.randomUUID(), title: title.trim(), destination, startsAt, format, status, snapshot };
    try {
      const response = await fetch("/api/admin/events", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(item) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save.");
      setSelectedId(data.id);
      setMessage(status === "published" ? `Published to ${destination === "league-cup" ? "League Cup" : "Community Events"}. You can continue editing and republish.` : "Draft saved. You can reload and edit it anytime.");
      await refresh();
    } catch (error) {
      const next = [item, ...readLocal().filter(saved => saved.id !== item.id)];
      localStorage.setItem(LOCAL_KEY, JSON.stringify(next)); setEvents(next); setSelectedId(item.id);
      setMessage(`${error instanceof Error ? error.message : "Server unavailable."} Saved in this browser as a local draft; sign in as owner/admin to publish.`);
    }
  };

  const load = () => {
    const saved = events.find(item => item.id === selectedId);
    if (saved) { onLoad(saved); setMessage(`Loaded “${saved.title}”. Changes are not public until you save or publish again.`); }
  };

  return <section className="competition-save-panel">
    <div><p className="eyebrow">SAVE + PUBLISH</p><h2>Event control room</h2><p>{message}</p></div>
    <label>Saved events<select value={selectedId} onChange={event => choose(event.target.value)}><option value="">New event…</option>{events.map(item => <option value={item.id} key={item.id}>{item.status === "published" ? "●" : "○"} {item.title}</option>)}</select></label>
    <button disabled={!selectedId} onClick={load}>Load selected</button>
    <label>Event name<input value={title} onChange={event => setTitle(event.target.value)} placeholder="Friday Night Cup" /></label>
    <label>Date and kickoff<input type="datetime-local" value={startsAt} onChange={event => setStartsAt(event.target.value)} /></label>
    <label>Publish to<select value={destination} onChange={event => setDestination(event.target.value as SavedCompetition["destination"])}><option value="community-events">Community Events</option><option value="league-cup">League Cup</option></select></label>
    <div className="save-actions"><button onClick={() => void save("draft")}>Save draft</button><button className="publish-button" onClick={() => void save("published")}>Save + publish</button></div>
  </section>;
}
