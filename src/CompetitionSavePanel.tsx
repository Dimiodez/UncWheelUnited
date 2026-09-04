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
const ZONES = [
  ["America/New_York", "Eastern (ET)"], ["America/Chicago", "Central (CT)"],
  ["America/Denver", "Mountain (MT)"], ["America/Los_Angeles", "Pacific (PT)"], ["UTC", "UTC"]
] as const;

const partsInZone = (date: Date, timeZone: string) => Object.fromEntries(new Intl.DateTimeFormat("en-US", {
  timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
}).formatToParts(date).filter(part => part.type !== "literal").map(part => [part.type, part.value]));

const localTimeToIso = (value: string, timeZone: string) => {
  if (!value) return "";
  const [date, time] = value.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const desired = Date.UTC(year, month - 1, day, hour, minute);
  const shown = partsInZone(new Date(desired), timeZone);
  const represented = Date.UTC(Number(shown.year), Number(shown.month) - 1, Number(shown.day), Number(shown.hour), Number(shown.minute));
  return new Date(desired + (desired - represented)).toISOString();
};

const isoToLocalInput = (value: string, timeZone: string) => {
  if (!value) return "";
  const part = partsInZone(new Date(value), timeZone);
  return `${part.year}-${part.month}-${part.day}T${part.hour}:${part.minute}`;
};

export default function CompetitionSavePanel({ format, snapshot, onLoad }: Props) {
  const [events, setEvents] = useState<SavedCompetition[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [title, setTitle] = useState("");
  const [destination, setDestination] = useState<SavedCompetition["destination"]>("community-events");
  const [startsAt, setStartsAt] = useState("");
  const [timeZone, setTimeZone] = useState("America/New_York");
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
    const savedZone = String(saved.snapshot.__eventTimeZone || "America/New_York");
    setTitle(saved.title); setDestination(saved.destination); setTimeZone(savedZone); setStartsAt(isoToLocalInput(saved.startsAt || "", savedZone));
  };

  const save = async (status: SavedCompetition["status"]) => {
    if (!title.trim()) return setMessage("Give this competition a name first.");
    const item = { id: selectedId || crypto.randomUUID(), title: title.trim(), destination, startsAt: localTimeToIso(startsAt, timeZone), format, status, snapshot: { ...snapshot, __eventTimeZone: timeZone } };
    try {
      const response = await fetch("/api/admin/events", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(item) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save.");
      setSelectedId(data.id);
      setMessage(status === "published" ? `Published to ${destination === "league-cup" ? "League Cup" : "Community Events"}. You can continue editing and republish.` : "Draft saved. You can reload and edit it anytime.");
      await refresh();
    } catch (error) {
      if (status === "published") {
        setMessage(`${error instanceof Error ? error.message : "Publishing failed."} Sign in to UncFutbolLeague.com with an owner/admin account, then publish again.`);
        return;
      }
      const next = [item, ...readLocal().filter(saved => saved.id !== item.id)];
      localStorage.setItem(LOCAL_KEY, JSON.stringify(next)); setEvents(next); setSelectedId(item.id);
      setMessage(`${error instanceof Error ? error.message : "Server unavailable."} Saved in this browser as a local draft; sign in as owner/admin to publish.`);
    }
  };

  const remove = async () => {
    if (!selectedId || !window.confirm("Remove this saved event and take it off the public schedule?")) return;
    try {
      const response = await fetch(`/api/admin/events?id=${encodeURIComponent(selectedId)}`, { method: "DELETE", credentials: "same-origin" });
      if (!response.ok) throw new Error("Only a signed-in owner/admin can remove a published event.");
      setEvents(current => current.filter(item => item.id !== selectedId)); setSelectedId(""); setTitle("");
      setMessage("Event removed from saved events and the public schedule.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to remove event."); }
  };

  const load = () => {
    const saved = events.find(item => item.id === selectedId);
    if (saved) { onLoad(saved); setMessage(`Loaded “${saved.title}”. Changes are not public until you save or publish again.`); }
  };

  return <section className="competition-save-panel">
    <div><p className="eyebrow">SAVE + PUBLISH</p><h2>Event control room</h2><p>{message}</p><a className="owner-sign-in" href="/account" target="_top">Owner/admin sign-in</a></div>
    <label>Saved events<select value={selectedId} onChange={event => choose(event.target.value)}><option value="">New event…</option>{events.map(item => <option value={item.id} key={item.id}>{item.status === "published" ? "●" : "○"} {item.title}</option>)}</select></label>
    <button disabled={!selectedId} onClick={load}>Load selected</button>
    <label>Event name<input value={title} onChange={event => setTitle(event.target.value)} placeholder="Friday Night Cup" /></label>
    <label>Date and kickoff<input type="datetime-local" value={startsAt} onChange={event => setStartsAt(event.target.value)} /></label>
    <label>Entered timezone<select value={timeZone} onChange={event => setTimeZone(event.target.value)}>{ZONES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
    <label>Publish to<select value={destination} onChange={event => setDestination(event.target.value as SavedCompetition["destination"])}><option value="community-events">Community Events</option><option value="league-cup">League Cup</option></select></label>
    <div className="save-actions"><button onClick={() => void save("draft")}>Save draft</button><button className="publish-button" onClick={() => void save("published")}>{events.find(item => item.id === selectedId)?.status === "published" ? "Update published" : "Save + publish"}</button>{selectedId && <button className="remove-event-button" onClick={() => void remove()}>Remove</button>}</div>
  </section>;
}
