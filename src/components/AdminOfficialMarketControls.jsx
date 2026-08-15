import { useCallback, useEffect, useMemo, useState } from "react";

import CatalogPickerDialog from "./CatalogPickerDialog";
import ChoiceMenu from "./ChoiceMenu";
import ConfirmDialog from "./ConfirmDialog";
import ListingArtwork from "./ListingArtwork";
import RarityBadge from "./RarityBadge";
import useCatalog from "../context/useCatalog";
import { supabase } from "../lib/supabase";
import { getOfficialChampionValue } from "../utils/marketplace";

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "live", label: "Live" },
  { value: "paused", label: "Paused" },
  { value: "ended", label: "Ended" },
];

function toSlug(value) {
  return String(value || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 63);
}

function toDateInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toDatabaseDate(value) {
  return value ? new Date(value).toISOString() : null;
}

function optionalWholeNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : Number.NaN;
}

function emptyEvent() {
  return {
    slug: "",
    title: "",
    summary: "",
    accent_color: "#777cff",
    status: "draft",
    is_featured: false,
    display_order: 0,
    starts_at: "",
    ends_at: "",
  };
}

function emptyDrop() {
  return {
    slug: "",
    event_id: "",
    name: "",
    rarity: "",
    trait: "Standard",
    image_url: "",
    reference_value: "",
    description: "",
    badge_label: "Official drop",
    availability_note: "",
    quantity_total: "",
    quantity_remaining: "",
    accent_color: "#777cff",
    cta_label: "",
    cta_url: "",
    status: "draft",
    is_featured: false,
    display_order: 0,
    starts_at: "",
    ends_at: "",
  };
}

function scheduleLabel(record) {
  if (!record.starts_at && !record.ends_at) return "Always available when live";
  const formatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  return `${record.starts_at ? formatter.format(new Date(record.starts_at)) : "Now"} → ${record.ends_at ? formatter.format(new Date(record.ends_at)) : "Until ended"}`;
}

function recordStatus(record) {
  if (record.status !== "live") return record.status;
  const now = Date.now();
  if (record.starts_at && new Date(record.starts_at).getTime() > now) return "scheduled";
  if (record.ends_at && new Date(record.ends_at).getTime() <= now) return "expired";
  return "live";
}

function AdminOfficialMarketControls({ onUpdated }) {
  const { champions } = useCatalog();
  const [events, setEvents] = useState([]);
  const [drops, setDrops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [eventForm, setEventForm] = useState(emptyEvent);
  const [dropForm, setDropForm] = useState(emptyDrop);
  const [editingEventId, setEditingEventId] = useState(null);
  const [editingDropId, setEditingDropId] = useState(null);
  const [catalogPickerOpen, setCatalogPickerOpen] = useState(false);
  const [saving, setSaving] = useState(null);
  const [message, setMessage] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadDrops = useCallback(async () => {
    setLoading(true);
    const [eventsResult, dropsResult] = await Promise.all([
      supabase.from("official_market_events").select("*").order("is_featured", { ascending: false }).order("display_order", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("official_market_listings").select("*").order("is_featured", { ascending: false }).order("display_order", { ascending: false }).order("created_at", { ascending: false }),
    ]);
    if (eventsResult.error || dropsResult.error) {
      setMessage({ type: "error", text: eventsResult.error?.message || dropsResult.error?.message || "Unable to load Official Drops." });
    } else {
      setEvents(eventsResult.data || []);
      setDrops(dropsResult.data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadDrops(), 0);
    return () => window.clearTimeout(timer);
  }, [loadDrops]);

  const eventOptions = useMemo(() => [{ value: "", label: "No event grouping" }, ...events.map((event) => ({ value: event.id, label: event.title }))], [events]);
  const selectedPreviewChampion = useMemo(() => ({
    name: dropForm.name || "Official champion",
    trait: dropForm.trait || "Standard",
    image_url: dropForm.image_url || null,
  }), [dropForm]);

  const refreshAll = async () => {
    await Promise.all([loadDrops(), onUpdated?.()]);
  };

  const resetEvent = () => {
    setEditingEventId(null);
    setEventForm(emptyEvent());
    setMessage(null);
  };

  const resetDrop = () => {
    setEditingDropId(null);
    setDropForm(emptyDrop());
    setMessage(null);
  };

  const editEvent = (event) => {
    setEditingEventId(event.id);
    setEventForm({
      ...emptyEvent(),
      ...event,
      summary: event.summary || "",
      starts_at: toDateInput(event.starts_at),
      ends_at: toDateInput(event.ends_at),
    });
    setMessage(null);
  };

  const editDrop = (drop) => {
    setEditingDropId(drop.id);
    setDropForm({
      ...emptyDrop(),
      ...drop,
      event_id: drop.event_id || "",
      image_url: drop.image_url || "",
      description: drop.description || "",
      availability_note: drop.availability_note || "",
      quantity_total: drop.quantity_total ?? "",
      quantity_remaining: drop.quantity_remaining ?? "",
      cta_label: drop.cta_label || "",
      cta_url: drop.cta_url || "",
      starts_at: toDateInput(drop.starts_at),
      ends_at: toDateInput(drop.ends_at),
    });
    setMessage(null);
  };

  const saveEvent = async (event) => {
    event.preventDefault();
    const title = eventForm.title.trim();
    const slug = toSlug(eventForm.slug || title);
    if (title.length < 2 || slug.length < 2) {
      setMessage({ type: "error", text: "Give the event a clear title. Its internal slug will be created automatically if needed." });
      return;
    }
    if (eventForm.ends_at && eventForm.starts_at && new Date(eventForm.ends_at) <= new Date(eventForm.starts_at)) {
      setMessage({ type: "error", text: "An event must end after it starts." });
      return;
    }
    setSaving("event");
    const payload = {
      slug,
      title,
      summary: eventForm.summary.trim() || null,
      accent_color: eventForm.accent_color,
      status: eventForm.status,
      is_featured: eventForm.is_featured,
      display_order: Number(eventForm.display_order) || 0,
      starts_at: toDatabaseDate(eventForm.starts_at),
      ends_at: toDatabaseDate(eventForm.ends_at),
    };
    const { error } = editingEventId
      ? await supabase.from("official_market_events").update(payload).eq("id", editingEventId)
      : await supabase.from("official_market_events").insert(payload);
    if (error) setMessage({ type: "error", text: error.message || "Unable to save this official event." });
    else {
      setMessage({ type: "success", text: editingEventId ? "Official event updated." : "Official event created. Add drops to it whenever you are ready." });
      if (!editingEventId) resetEvent();
      await refreshAll();
    }
    setSaving(null);
  };

  const saveDrop = async (event) => {
    event.preventDefault();
    const name = dropForm.name.trim();
    const rarity = dropForm.rarity.trim();
    const slug = toSlug(dropForm.slug || name);
    const quantityTotal = optionalWholeNumber(dropForm.quantity_total);
    const quantityRemaining = optionalWholeNumber(dropForm.quantity_remaining);
    const referenceValue = optionalWholeNumber(dropForm.reference_value);
    const ctaLabel = dropForm.cta_label.trim() || null;
    const ctaUrl = dropForm.cta_url.trim() || null;
    if (!name || slug.length < 2) {
      setMessage({ type: "error", text: "Every official drop needs a champion name." });
      return;
    }
    if ([quantityTotal, quantityRemaining, referenceValue].some(Number.isNaN)) {
      setMessage({ type: "error", text: "Reference value and quantity fields must be whole numbers of zero or more." });
      return;
    }
    if (quantityTotal !== null && quantityTotal < 1) {
      setMessage({ type: "error", text: "A limited drop needs a total quantity of at least one." });
      return;
    }
    if (quantityTotal === null && quantityRemaining !== null) {
      setMessage({ type: "error", text: "Add a total quantity before tracking how many copies remain." });
      return;
    }
    if (quantityTotal !== null && quantityRemaining !== null && quantityRemaining > quantityTotal) {
      setMessage({ type: "error", text: "Remaining quantity cannot exceed the total quantity." });
      return;
    }
    if ((ctaLabel && !ctaUrl) || (!ctaLabel && ctaUrl)) {
      setMessage({ type: "error", text: "A drop action needs both a button label and its destination." });
      return;
    }
    if (dropForm.ends_at && dropForm.starts_at && new Date(dropForm.ends_at) <= new Date(dropForm.starts_at)) {
      setMessage({ type: "error", text: "A drop must end after it starts." });
      return;
    }
    setSaving("drop");
    const payload = {
      slug,
      event_id: dropForm.event_id || null,
      name,
      rarity: rarity || "Official",
      trait: dropForm.trait.trim() || "Standard",
      image_url: dropForm.image_url.trim() || null,
      reference_value: referenceValue ?? 0,
      description: dropForm.description.trim() || null,
      badge_label: dropForm.badge_label.trim() || "Official drop",
      availability_note: dropForm.availability_note.trim() || null,
      quantity_total: quantityTotal,
      quantity_remaining: quantityTotal === null ? null : (quantityRemaining ?? quantityTotal),
      accent_color: dropForm.accent_color,
      cta_label: ctaLabel,
      cta_url: ctaUrl,
      status: dropForm.status,
      is_featured: dropForm.is_featured,
      display_order: Number(dropForm.display_order) || 0,
      starts_at: toDatabaseDate(dropForm.starts_at),
      ends_at: toDatabaseDate(dropForm.ends_at),
    };
    const { error } = editingDropId
      ? await supabase.from("official_market_listings").update(payload).eq("id", editingDropId)
      : await supabase.from("official_market_listings").insert(payload);
    if (error) setMessage({ type: "error", text: error.message || "Unable to save this official drop." });
    else {
      setMessage({ type: "success", text: editingDropId ? "Official drop updated." : "Official drop created. Make it live whenever its event is ready." });
      if (!editingDropId) resetDrop();
      await refreshAll();
    }
    setSaving(null);
  };

  const chooseChampion = (champion) => {
    setDropForm((current) => ({
      ...current,
      name: champion.name,
      rarity: champion.rarity || current.rarity,
      image_url: champion.image_url || "",
      reference_value: current.reference_value || String(getOfficialChampionValue(champion)),
      slug: current.slug || toSlug(champion.name),
    }));
  };

  const toggleRecordStatus = async (kind, record) => {
    setSaving(`${kind}-${record.id}`);
    const table = kind === "event" ? "official_market_events" : "official_market_listings";
    const nextStatus = record.status === "live" ? "paused" : "live";
    const { error } = await supabase.from(table).update({ status: nextStatus }).eq("id", record.id);
    if (error) setMessage({ type: "error", text: error.message || "Unable to update this record." });
    else {
      setMessage({ type: "success", text: `${kind === "event" ? "Event" : "Drop"} ${nextStatus === "live" ? "is live" : "paused"}.` });
      await refreshAll();
    }
    setSaving(null);
  };

  const removeRecord = async () => {
    if (!deleteTarget) return;
    const table = deleteTarget.kind === "event" ? "official_market_events" : "official_market_listings";
    setSaving(`delete-${deleteTarget.record.id}`);
    const { error } = await supabase.from(table).delete().eq("id", deleteTarget.record.id);
    if (error) setMessage({ type: "error", text: error.message || "Unable to delete this record." });
    else {
      setMessage({ type: "success", text: `${deleteTarget.kind === "event" ? "Official event" : "Official drop"} deleted. Existing drops keep their details if an event is removed.` });
      if (deleteTarget.kind === "event" && editingEventId === deleteTarget.record.id) resetEvent();
      if (deleteTarget.kind === "drop" && editingDropId === deleteTarget.record.id) resetDrop();
      await refreshAll();
    }
    setSaving(null);
    setDeleteTarget(null);
  };

  return (
    <section className="admin-panel admin-official-market-controls">
      <div className="admin-panel-heading">
        <div><p className="eyebrow">Official Market</p><h2>Special drops & events</h2></div>
        <div className="admin-official-heading-actions"><button className="quiet-action" onClick={resetEvent} type="button">New event</button><button className="success-action" onClick={resetDrop} type="button">New official drop</button></div>
      </div>
      <p className="admin-panel-copy">Create first-party Lumio listings without pretending they are player inventory. Use an event for rare rotations, feature a drop at the top of Market, set a time window or tracked remaining quantity, then direct players to the exact place to claim or learn about it.</p>

      <div className="admin-official-editor-grid">
        <form className="admin-official-form" onSubmit={saveEvent}>
          <div className="admin-official-form-heading"><div><p className="eyebrow">Event studio</p><h3>{editingEventId ? "Edit official event" : "Create official event"}</h3></div>{editingEventId && <button className="quiet-action" onClick={resetEvent} type="button">New event</button>}</div>
          <label><span>Event title</span><input maxLength="100" onChange={(event) => setEventForm((current) => ({ ...current, title: event.target.value }))} placeholder="Sovereign Summit" value={eventForm.title} /></label>
          <label><span>Event summary <em>optional</em></span><textarea maxLength="300" onChange={(event) => setEventForm((current) => ({ ...current, summary: event.target.value }))} placeholder="Explain the event and what makes its drops special." rows="3" value={eventForm.summary} /></label>
          <div className="admin-field-grid two-columns"><label><span>Internal slug</span><input maxLength="63" onChange={(event) => setEventForm((current) => ({ ...current, slug: event.target.value }))} placeholder="sovereign-summit" value={eventForm.slug} /></label><label><span>Accent color</span><div className="admin-color-input"><input aria-label="Event accent color" onChange={(event) => setEventForm((current) => ({ ...current, accent_color: event.target.value }))} type="color" value={eventForm.accent_color} /><input maxLength="7" onChange={(event) => setEventForm((current) => ({ ...current, accent_color: event.target.value }))} value={eventForm.accent_color} /></div></label></div>
          <div className="admin-choice-row"><ChoiceMenu label="Event status" onChange={(status) => setEventForm((current) => ({ ...current, status }))} options={STATUS_OPTIONS} value={eventForm.status} /><label><span>Priority</span><input max="1000" min="-1000" onChange={(event) => setEventForm((current) => ({ ...current, display_order: event.target.value }))} type="number" value={eventForm.display_order} /></label></div>
          <div className="admin-field-grid two-columns"><label><span>Starts <em>optional</em></span><input onChange={(event) => setEventForm((current) => ({ ...current, starts_at: event.target.value }))} type="datetime-local" value={eventForm.starts_at} /></label><label><span>Ends <em>optional</em></span><input onChange={(event) => setEventForm((current) => ({ ...current, ends_at: event.target.value }))} type="datetime-local" value={eventForm.ends_at} /></label></div>
          <button aria-pressed={eventForm.is_featured} className="admin-toggle" onClick={() => setEventForm((current) => ({ ...current, is_featured: !current.is_featured }))} type="button"><span><strong>Feature this event</strong><small>Featured events visually elevate their attached drops.</small></span><i /></button>
          <button className="success-action" disabled={saving === "event"} type="submit">{saving === "event" ? "Saving…" : editingEventId ? "Save event" : "Create event"}</button>
        </form>

        <form className="admin-official-form admin-official-drop-form" onSubmit={saveDrop}>
          <div className="admin-official-form-heading"><div><p className="eyebrow">Drop studio</p><h3>{editingDropId ? "Edit official drop" : "Create official drop"}</h3></div>{editingDropId && <button className="quiet-action" onClick={resetDrop} type="button">New drop</button>}</div>
          <div className="admin-official-item-picker"><ListingArtwork imageUrl={selectedPreviewChampion.image_url} name={selectedPreviewChampion.name} trait={selectedPreviewChampion.trait} /><div><span>Champion details</span><strong>{dropForm.name || "Choose from catalog or enter a custom drop"}</strong><small>{dropForm.rarity ? <><RarityBadge rarity={dropForm.rarity} /> · </> : null}{dropForm.trait || "Standard"} trait · matching catalog artwork is used automatically</small></div><button className="secondary-action" onClick={() => setCatalogPickerOpen(true)} type="button">Choose champion</button></div>
          <div className="admin-field-grid two-columns"><label><span>Champion name</span><input maxLength="100" onChange={(event) => setDropForm((current) => ({ ...current, name: event.target.value }))} placeholder="Champion name" value={dropForm.name} /></label><label><span>Drop label <em>optional</em></span><input maxLength="60" onChange={(event) => setDropForm((current) => ({ ...current, rarity: event.target.value }))} placeholder="Limited" value={dropForm.rarity} /></label><label><span>Trait</span><input maxLength="100" onChange={(event) => setDropForm((current) => ({ ...current, trait: event.target.value }))} placeholder="Standard" value={dropForm.trait} /></label><label><span>Reference value</span><input min="0" onChange={(event) => setDropForm((current) => ({ ...current, reference_value: event.target.value }))} placeholder="Optional" type="number" value={dropForm.reference_value} /></label></div>
          <div className="admin-field-grid two-columns"><ChoiceMenu label="Event grouping" onChange={(eventId) => setDropForm((current) => ({ ...current, event_id: eventId }))} options={eventOptions} value={dropForm.event_id} /><label><span>Badge label</span><input maxLength="40" onChange={(event) => setDropForm((current) => ({ ...current, badge_label: event.target.value }))} placeholder="Official drop" value={dropForm.badge_label} /></label></div>
          <label><span>Description <em>optional</em></span><textarea maxLength="500" onChange={(event) => setDropForm((current) => ({ ...current, description: event.target.value }))} placeholder="Why this champion is special and what players should know." rows="3" value={dropForm.description} /></label>
          <div className="admin-field-grid two-columns"><label><span>Image URL <em>optional</em></span><input onChange={(event) => setDropForm((current) => ({ ...current, image_url: event.target.value }))} placeholder="https://..." value={dropForm.image_url} /></label><label><span>Availability note <em>optional</em></span><input maxLength="120" onChange={(event) => setDropForm((current) => ({ ...current, availability_note: event.target.value }))} placeholder="Claimed through the weekend event" value={dropForm.availability_note} /></label></div>
          <div className="admin-field-grid three-columns"><label><span>Total quantity <em>optional</em></span><input min="1" onChange={(event) => setDropForm((current) => ({ ...current, quantity_total: event.target.value }))} placeholder="Unlimited" type="number" value={dropForm.quantity_total} /></label><label><span>Remaining</span><input min="0" onChange={(event) => setDropForm((current) => ({ ...current, quantity_remaining: event.target.value }))} placeholder="Auto = total" type="number" value={dropForm.quantity_remaining} /></label><label><span>Priority</span><input max="1000" min="-1000" onChange={(event) => setDropForm((current) => ({ ...current, display_order: event.target.value }))} type="number" value={dropForm.display_order} /></label></div>
          <div className="admin-field-grid two-columns"><label><span>Action label <em>optional</em></span><input maxLength="40" onChange={(event) => setDropForm((current) => ({ ...current, cta_label: event.target.value }))} placeholder="View drop details" value={dropForm.cta_label} /></label><label><span>Action destination <em>optional</em></span><input onChange={(event) => setDropForm((current) => ({ ...current, cta_url: event.target.value }))} placeholder="/ or https://..." value={dropForm.cta_url} /></label></div>
          <div className="admin-field-grid two-columns"><label><span>Internal slug</span><input maxLength="63" onChange={(event) => setDropForm((current) => ({ ...current, slug: event.target.value }))} placeholder="limited-sovereign" value={dropForm.slug} /></label><label><span>Accent color</span><div className="admin-color-input"><input aria-label="Drop accent color" onChange={(event) => setDropForm((current) => ({ ...current, accent_color: event.target.value }))} type="color" value={dropForm.accent_color} /><input maxLength="7" onChange={(event) => setDropForm((current) => ({ ...current, accent_color: event.target.value }))} value={dropForm.accent_color} /></div></label></div>
          <div className="admin-choice-row"><ChoiceMenu label="Drop status" onChange={(status) => setDropForm((current) => ({ ...current, status }))} options={STATUS_OPTIONS} value={dropForm.status} /><button aria-pressed={dropForm.is_featured} className="admin-toggle compact" onClick={() => setDropForm((current) => ({ ...current, is_featured: !current.is_featured }))} type="button"><span><strong>Feature this drop</strong><small>Show it first in Official Drops.</small></span><i /></button></div>
          <div className="admin-field-grid two-columns"><label><span>Starts <em>optional</em></span><input onChange={(event) => setDropForm((current) => ({ ...current, starts_at: event.target.value }))} type="datetime-local" value={dropForm.starts_at} /></label><label><span>Ends <em>optional</em></span><input onChange={(event) => setDropForm((current) => ({ ...current, ends_at: event.target.value }))} type="datetime-local" value={dropForm.ends_at} /></label></div>
          <button className="success-action" disabled={saving === "drop"} type="submit">{saving === "drop" ? "Saving…" : editingDropId ? "Save official drop" : "Create official drop"}</button>
        </form>
      </div>

      {message && <p className={message.type === "success" ? "inline-success" : "inline-error"} role={message.type === "success" ? "status" : "alert"}>{message.text}</p>}

      <section className="admin-official-library">
        <div className="admin-official-library-heading"><div><p className="eyebrow">Official inventory</p><h3>Events & drops</h3></div><span>{events.length} events · {drops.length} drops</span></div>
        {loading ? <p className="admin-empty-copy">Loading official market records...</p> : (events.length || drops.length) ? <div className="admin-official-records">
          {events.map((event) => <article className="admin-official-record event-record" key={event.id} style={{ "--official-accent": event.accent_color }}><div><span className={`admin-record-status status-${recordStatus(event)}`}>{recordStatus(event)}</span>{event.is_featured && <span className="admin-featured-label">Featured event</span>}</div><strong>{event.title}</strong>{event.summary && <p>{event.summary}</p>}<small>{scheduleLabel(event)}</small><footer><button className="secondary-action" onClick={() => editEvent(event)} type="button">Edit</button><button className="quiet-action" disabled={saving === `event-${event.id}`} onClick={() => void toggleRecordStatus("event", event)} type="button">{event.status === "live" ? "Pause" : "Go live"}</button><button className="danger-action" onClick={() => setDeleteTarget({ kind: "event", record: event })} type="button">Delete</button></footer></article>)}
          {drops.map((drop) => { const event = events.find((item) => item.id === drop.event_id); return <article className="admin-official-record drop-record" key={drop.id} style={{ "--official-accent": drop.accent_color }}><div><span className={`admin-record-status status-${recordStatus(drop)}`}>{recordStatus(drop)}</span>{drop.is_featured && <span className="admin-featured-label">Featured drop</span>}</div><strong>{drop.name}</strong><span className="admin-official-record-meta">{drop.rarity} · {drop.trait || "Standard"}{event ? ` · ${event.title}` : ""}</span>{drop.quantity_total !== null && <small>{Number(drop.quantity_remaining ?? drop.quantity_total).toLocaleString()} of {Number(drop.quantity_total).toLocaleString()} remaining</small>}<small>{scheduleLabel(drop)}</small><footer><button className="secondary-action" onClick={() => editDrop(drop)} type="button">Edit</button><button className="quiet-action" disabled={saving === `drop-${drop.id}`} onClick={() => void toggleRecordStatus("drop", drop)} type="button">{drop.status === "live" ? "Pause" : "Go live"}</button><button className="danger-action" onClick={() => setDeleteTarget({ kind: "drop", record: drop })} type="button">Delete</button></footer></article>; })}
        </div> : <p className="admin-empty-copy">No official events or drops exist yet. Create an event for a rotation, then add the champions Lumio is promoting.</p>}
      </section>

      {catalogPickerOpen && <CatalogPickerDialog getItemMeta={() => "Use matching catalog artwork"} items={champions} kind="champion" onChoose={chooseChampion} onClose={() => setCatalogPickerOpen(false)} selectedValue={null} title="Choose champion for official drop" />}
      {deleteTarget && <ConfirmDialog busy={saving === `delete-${deleteTarget.record.id}`} cancelLabel="Keep record" confirmLabel="Delete permanently" danger description={deleteTarget.kind === "event" ? `Delete ${deleteTarget.record.title}? Its drops will keep their information, but they will no longer be grouped under this event.` : `Delete ${deleteTarget.record.name}? It will disappear from the live Official Drops area immediately.`} onCancel={() => setDeleteTarget(null)} onConfirm={() => void removeRecord()} title={`Delete ${deleteTarget.kind === "event" ? "official event" : "official drop"}?`} />}
    </section>
  );
}

export default AdminOfficialMarketControls;
