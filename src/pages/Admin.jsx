import { useCallback, useEffect, useMemo, useState } from "react";

import AdminCatalogControls from "../components/AdminCatalogControls";
import AdminMemberControls from "../components/AdminMemberControls";
import AdminOfficialMarketControls from "../components/AdminOfficialMarketControls";
import AdminTradeControls from "../components/AdminTradeControls";
import ChoiceMenu from "../components/ChoiceMenu";
import ConfirmDialog from "../components/ConfirmDialog";
import Layout from "../components/Layout";
import useAuth from "../context/useAuth";
import { supabase } from "../lib/supabase";
import { getDatePreferences } from "../utils/datePreferences";

const AD_FIELDS = "id, slug, title, body, accent_color, placement, audience, primary_button_label, primary_button_url, secondary_button_label, secondary_button_url, dismiss_label, show_once, is_dismissible, is_active, priority, starts_at, ends_at, created_at, updated_at";
const PLACEMENT_OPTIONS = [{ value: "modal", label: "Focused modal" }, { value: "banner", label: "Global banner" }];
const AUDIENCE_OPTIONS = [{ value: "all", label: "Everyone" }, { value: "signed_out", label: "Signed out" }, { value: "signed_in", label: "Signed in" }];

function emptyAd() {
  return {
    slug: "",
    title: "",
    body: "",
    accent_color: "#777cff",
    placement: "modal",
    audience: "all",
    primary_button_label: "",
    primary_button_url: "",
    secondary_button_label: "",
    secondary_button_url: "",
    dismiss_label: "Continue to Lumio",
    show_once: true,
    is_dismissible: true,
    is_active: false,
    priority: 0,
    starts_at: "",
    ends_at: "",
  };
}

function toDateInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toSlug(value) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 63);
}

function toDatabaseDate(value) {
  return value ? new Date(value).toISOString() : null;
}

function formatSchedule(ad) {
  if (!ad.starts_at && !ad.ends_at) return "Live whenever enabled";
  const formatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  const start = ad.starts_at ? formatter.format(new Date(ad.starts_at)) : "now";
  const end = ad.ends_at ? formatter.format(new Date(ad.ends_at)) : "until paused";
  return `${start} → ${end}`;
}

function AdPreview({ ad }) {
  return (
    <div className={`admin-ad-preview ${ad.placement === "banner" ? "is-banner" : ""}`} style={{ "--ad-accent": ad.accent_color || "#777cff" }}>
      <span className="admin-ad-preview-accent" />
      <small>{ad.placement === "banner" ? "Banner preview" : "Modal preview"}</small>
      {ad.title && <strong>{ad.title}</strong>}
      {ad.body && <p>{ad.body}</p>}
      <div>
        {ad.is_dismissible && <button type="button">{ad.dismiss_label || "Continue"}</button>}
        {ad.secondary_button_label && <button type="button">{ad.secondary_button_label}</button>}
        {ad.primary_button_label && <button className="primary" type="button">{ad.primary_button_label}</button>}
      </div>
    </div>
  );
}

function Admin() {
  const { user, profile } = useAuth();
  const datePreferences = getDatePreferences(profile);
  const [access, setAccess] = useState("checking");
  const [metrics, setMetrics] = useState(null);
  const [ads, setAds] = useState([]);
  const [marketListings, setMarketListings] = useState([]);
  const [members, setMembers] = useState([]);
  const [trades, setTrades] = useState([]);
  const [auditEvents, setAuditEvents] = useState([]);
  const [form, setForm] = useState(emptyAd);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [moderationTarget, setModerationTarget] = useState(null);
  const [moderating, setModerating] = useState(false);

  const loadAdminData = useCallback(async () => {
    const { data: allowed, error: accessError } = await supabase.rpc("is_lumio_admin");
    if (accessError || !allowed) {
      setAccess("denied");
      return;
    }

    const [metricsResult, adsResult, marketResult, memberResult, tradeResult, auditResult] = await Promise.all([
      supabase.rpc("get_admin_dashboard_metrics"),
      supabase.from("site_ads").select(AD_FIELDS).order("priority", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("marketplace_listings").select("id, name, rarity, trait, note, updated_at, discord_username, discord_display_name").order("updated_at", { ascending: false }).limit(8),
      supabase.rpc("get_admin_member_directory"),
      supabase.rpc("get_admin_trade_activity"),
      supabase.from("admin_audit_events").select("id, action, details, created_at").order("created_at", { ascending: false }).limit(12),
    ]);

    if (metricsResult.error || adsResult.error || marketResult.error || memberResult.error || tradeResult.error || auditResult.error) {
      setMessage({ type: "error", text: metricsResult.error?.message || adsResult.error?.message || marketResult.error?.message || memberResult.error?.message || tradeResult.error?.message || auditResult.error?.message || "Unable to load the administrator console." });
    } else {
      setMetrics(metricsResult.data);
      setAds(adsResult.data || []);
      setMarketListings(marketResult.data || []);
      setMembers(memberResult.data || []);
      setTrades(tradeResult.data || []);
      setAuditEvents(auditResult.data || []);
    }
    setAccess("allowed");
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    const frame = window.requestAnimationFrame(() => {
      void loadAdminData();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loadAdminData, user]);

  const updateForm = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const previewAd = useMemo(() => ({ ...form, title: form.title.trim(), body: form.body.trim() }), [form]);

  const beginNewAd = () => {
    setEditingId(null);
    setForm(emptyAd());
    setMessage(null);
  };

  const editAd = (ad) => {
    setEditingId(ad.id);
    setForm({
      ...emptyAd(),
      ...ad,
      title: ad.title || "",
      body: ad.body || "",
      primary_button_label: ad.primary_button_label || "",
      primary_button_url: ad.primary_button_url || "",
      secondary_button_label: ad.secondary_button_label || "",
      secondary_button_url: ad.secondary_button_url || "",
      starts_at: toDateInput(ad.starts_at),
      ends_at: toDateInput(ad.ends_at),
    });
    setMessage(null);
  };

  const saveAd = async (event) => {
    event.preventDefault();
    const title = form.title.trim() || null;
    const body = form.body.trim() || null;
    const slug = toSlug(form.slug || form.title || form.body);
    const primaryLabel = form.primary_button_label.trim() || null;
    const primaryUrl = form.primary_button_url.trim() || null;
    const secondaryLabel = form.secondary_button_label.trim() || null;
    const secondaryUrl = form.secondary_button_url.trim() || null;

    if (!title && !body) {
      setMessage({ type: "error", text: "Add a title, a body, or both before saving an ad." });
      return;
    }
    if (slug.length < 2) {
      setMessage({ type: "error", text: "Add a short campaign slug so this ad can be managed reliably." });
      return;
    }
    if ((primaryLabel && !primaryUrl) || (!primaryLabel && primaryUrl) || (secondaryLabel && !secondaryUrl) || (!secondaryLabel && secondaryUrl)) {
      setMessage({ type: "error", text: "Every button needs both a label and a destination link." });
      return;
    }
    if (!form.is_dismissible && !primaryUrl && !secondaryUrl) {
      setMessage({ type: "error", text: "A non-dismissible ad needs at least one linked action." });
      return;
    }

    setSaving(true);
    setMessage(null);
    const payload = {
      slug,
      title,
      body,
      accent_color: form.accent_color,
      placement: form.placement,
      audience: form.audience,
      primary_button_label: primaryLabel,
      primary_button_url: primaryUrl,
      secondary_button_label: secondaryLabel,
      secondary_button_url: secondaryUrl,
      dismiss_label: form.dismiss_label.trim() || "Continue to Lumio",
      show_once: form.show_once,
      is_dismissible: form.is_dismissible,
      is_active: form.is_active,
      priority: Number(form.priority) || 0,
      starts_at: toDatabaseDate(form.starts_at),
      ends_at: toDatabaseDate(form.ends_at),
    };
    const { error } = editingId
      ? await supabase.from("site_ads").update(payload).eq("id", editingId)
      : await supabase.from("site_ads").insert(payload);

    if (error) {
      setMessage({ type: "error", text: error.message || "Unable to save this ad." });
    } else {
      setMessage({ type: "success", text: editingId ? "Ad updated. Its new schedule is live immediately." : "Ad created. Turn it live whenever you are ready." });
      await loadAdminData();
      if (!editingId) beginNewAd();
    }
    setSaving(false);
  };

  const toggleAd = async (ad) => {
    setMessage(null);
    const { error } = await supabase.from("site_ads").update({ is_active: !ad.is_active }).eq("id", ad.id);
    if (error) setMessage({ type: "error", text: error.message || "Unable to update ad status." });
    else await loadAdminData();
  };

  const deleteAd = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from("site_ads").delete().eq("id", deleteTarget.id);
    if (error) setMessage({ type: "error", text: error.message || "Unable to delete this ad." });
    else {
      setMessage({ type: "success", text: "Ad deleted." });
      if (editingId === deleteTarget.id) beginNewAd();
      await loadAdminData();
    }
    setDeleting(false);
    setDeleteTarget(null);
  };

  const removeMarketListing = async () => {
    if (!moderationTarget) return;
    setModerating(true);
    const { error } = await supabase
      .from("shelf_listings")
      .update({ status: "removed" })
      .eq("id", moderationTarget.id);
    if (error) {
      setMessage({ type: "error", text: error.message || "Unable to remove that marketplace listing." });
    } else {
      setMessage({ type: "success", text: "Marketplace listing removed. The owner keeps their champion in their Collection." });
      await loadAdminData();
    }
    setModerating(false);
    setModerationTarget(null);
  };

  if (access === "checking") return <Layout><p className="loading-copy">Checking administrator access...</p></Layout>;
  if (access === "denied") {
    return <Layout><section className="empty-state"><span className="empty-state-icon">⌁</span><h2>Administrator access required</h2><p>This area is restricted to Lumio administrators.</p></section></Layout>;
  }

  return (
    <Layout>
      <section className="page-heading admin-page-heading">
        <div><p className="eyebrow">Lumio operations</p><h1>Admin Console</h1><p>Run live campaigns, official drops, the catalog, and community operations from one secure workspace.</p></div>
        <button className="success-action" onClick={beginNewAd} type="button">Create campaign</button>
      </section>

      <section className="admin-metrics" aria-label="Lumio operational summary">
        {[{ label: "Members", value: metrics?.members }, { label: "Champion copies", value: metrics?.champion_copies }, { label: "Live Shelf listings", value: metrics?.active_listings }, { label: "Official drops", value: metrics?.official_drops }, { label: "Pending trades", value: metrics?.pending_trades }, { label: "Live campaigns", value: metrics?.active_ads }].map((metric) => <article key={metric.label}><span>{metric.label}</span><strong>{Number(metric.value || 0).toLocaleString()}</strong></article>)}
      </section>

      <section className="admin-console-grid">
        <form className="admin-panel admin-ad-editor" onSubmit={saveAd}>
          <div className="admin-panel-heading"><div><p className="eyebrow">Campaign studio</p><h2>{editingId ? "Edit campaign" : "Create campaign"}</h2></div>{editingId && <button className="quiet-action" onClick={beginNewAd} type="button">New campaign</button>}</div>
          <p className="admin-panel-copy">Build a scheduled announcement for everyone, signed-out visitors, or existing traders. One-time ads remember a dismissal on that device.</p>

          <div className="admin-field-grid two-columns">
            <label><span>Campaign slug</span><input maxLength="63" onChange={(event) => updateForm("slug", event.target.value)} placeholder="discord-community" value={form.slug} /><small>Internal only. Auto-generated from the title if left blank.</small></label>
            <label><span>Accent color</span><div className="admin-color-input"><input aria-label="Accent color" onChange={(event) => updateForm("accent_color", event.target.value)} type="color" value={form.accent_color} /><input maxLength="7" onChange={(event) => updateForm("accent_color", event.target.value)} value={form.accent_color} /></div></label>
          </div>
          <label><span>Title <em>optional</em></span><input maxLength="100" onChange={(event) => updateForm("title", event.target.value)} placeholder="Trade better together." value={form.title} /></label>
          <label><span>Body <em>optional</em></span><textarea maxLength="700" onChange={(event) => updateForm("body", event.target.value)} placeholder="Explain the announcement, offer, or next step." rows="4" value={form.body} /></label>

          <div className="admin-choice-row"><ChoiceMenu label="Placement" onChange={(placement) => updateForm("placement", placement)} options={PLACEMENT_OPTIONS} value={form.placement} /><ChoiceMenu label="Audience" onChange={(audience) => updateForm("audience", audience)} options={AUDIENCE_OPTIONS} value={form.audience} /></div>
          <div className="admin-field-grid two-columns"><label><span>Starts <em>optional</em></span><input onChange={(event) => updateForm("starts_at", event.target.value)} type="datetime-local" value={form.starts_at} /></label><label><span>Ends <em>optional</em></span><input onChange={(event) => updateForm("ends_at", event.target.value)} type="datetime-local" value={form.ends_at} /></label></div>

          <div className="admin-button-fields"><strong>Linked actions</strong><div className="admin-field-grid two-columns"><label><span>Primary label</span><input maxLength="40" onChange={(event) => updateForm("primary_button_label", event.target.value)} placeholder="Join Discord" value={form.primary_button_label} /></label><label><span>Primary link</span><input onChange={(event) => updateForm("primary_button_url", event.target.value)} placeholder="https://discord.gg/... or /market" value={form.primary_button_url} /></label><label><span>Secondary label</span><input maxLength="40" onChange={(event) => updateForm("secondary_button_label", event.target.value)} placeholder="Learn more" value={form.secondary_button_label} /></label><label><span>Secondary link</span><input onChange={(event) => updateForm("secondary_button_url", event.target.value)} placeholder="https://... or /" value={form.secondary_button_url} /></label></div></div>

          <div className="admin-field-grid two-columns"><label><span>Dismiss button</span><input maxLength="40" onChange={(event) => updateForm("dismiss_label", event.target.value)} value={form.dismiss_label} /></label><label><span>Priority</span><input max="1000" min="-1000" onChange={(event) => updateForm("priority", event.target.value)} type="number" value={form.priority} /><small>Higher ads appear first.</small></label></div>
          <div className="admin-toggle-grid"><button aria-pressed={form.is_active} className="admin-toggle" onClick={() => updateForm("is_active", !form.is_active)} type="button"><span><strong>Campaign is live</strong><small>{form.is_active ? "Eligible visitors can see it now." : "Saved as a draft until launched."}</small></span><i /></button><button aria-pressed={form.show_once} className="admin-toggle" onClick={() => updateForm("show_once", !form.show_once)} type="button"><span><strong>Show once per device</strong><small>{form.show_once ? "A dismissal is remembered." : "It appears on every fresh page load."}</small></span><i /></button><button aria-pressed={form.is_dismissible} className="admin-toggle" onClick={() => updateForm("is_dismissible", !form.is_dismissible)} type="button"><span><strong>Allow dismissal</strong><small>{form.is_dismissible ? "Users can continue without taking action." : "A linked action is required."}</small></span><i /></button></div>
          {message && <p className={message.type === "success" ? "inline-success" : "inline-error"} role={message.type === "success" ? "status" : "alert"}>{message.text}</p>}
          <div className="admin-editor-footer"><span>{form.placement === "modal" ? "Only the highest-priority modal appears at once." : "Banners stack at the bottom of the app."}</span><button className="success-action" disabled={saving} type="submit">{saving ? "Saving…" : editingId ? "Save campaign" : "Create campaign"}</button></div>
        </form>

        <aside className="admin-sidebar">
          <section className="admin-panel"><div className="admin-panel-heading"><div><p className="eyebrow">Live preview</p><h2>Before you publish</h2></div></div><AdPreview ad={previewAd} /></section>
          <section className="admin-panel admin-campaign-list"><div className="admin-panel-heading"><div><p className="eyebrow">Campaign library</p><h2>{ads.length} {ads.length === 1 ? "campaign" : "campaigns"}</h2></div></div>{ads.length ? ads.map((ad) => <article className="admin-campaign-card" key={ad.id} style={{ "--ad-accent": ad.accent_color }}><span className={`admin-campaign-status${ad.is_active ? " is-live" : ""}`}>{ad.is_active ? "Live" : "Draft"}</span><strong>{ad.title || "Untitled announcement"}</strong><p>{ad.body || "Button-only announcement"}</p><small>{ad.placement} · {ad.audience.replace("_", " ")} · {ad.show_once ? "once per device" : "recurring"}</small><small>{formatSchedule(ad)}</small><div><button className="secondary-action" onClick={() => editAd(ad)} type="button">Edit</button><button aria-pressed={ad.is_active} className="quiet-action" onClick={() => void toggleAd(ad)} type="button">{ad.is_active ? "Pause" : "Launch"}</button><button className="danger-action" onClick={() => setDeleteTarget(ad)} type="button">Delete</button></div></article>) : <p className="admin-empty-copy">No campaigns yet. Create one to add a message anywhere in Lumio.</p>}</section>
          <section className="admin-panel admin-market-moderation"><div className="admin-panel-heading"><div><p className="eyebrow">Marketplace safety</p><h2>Latest live listings</h2></div><span className="admin-market-count">{Number(metrics?.active_listings || 0)} live</span></div><p className="admin-panel-copy">Remove a listing when it breaks marketplace rules. This never removes the owner’s champion.</p>{marketListings.length ? <div className="admin-market-list">{marketListings.map((listing) => <article key={listing.id}><div><strong>{listing.name}</strong><span>{listing.rarity} · {listing.trait}</span><small>Listed by {listing.discord_display_name || listing.discord_username || "Unknown trader"}</small>{listing.note && <p>{listing.note}</p>}</div><button className="danger-action" onClick={() => setModerationTarget(listing)} type="button">Remove</button></article>)}</div> : <p className="admin-empty-copy">No live listings need review right now.</p>}</section>
        </aside>
      </section>

      <AdminCatalogControls onUpdated={loadAdminData} />
      <AdminOfficialMarketControls onUpdated={loadAdminData} />
      <AdminMemberControls auditEvents={auditEvents} datePreferences={datePreferences} members={members} onUpdated={loadAdminData} />
      <AdminTradeControls datePreferences={datePreferences} onUpdated={loadAdminData} trades={trades} />

      {deleteTarget && <ConfirmDialog busy={deleting} cancelLabel="Keep campaign" confirmLabel="Delete campaign" danger description={`Permanently delete “${deleteTarget.title || "this campaign"}”? It will disappear from Lumio immediately.`} onCancel={() => setDeleteTarget(null)} onConfirm={() => void deleteAd()} title="Delete this campaign?" />}
      {moderationTarget && <ConfirmDialog busy={moderating} cancelLabel="Keep listing" confirmLabel="Remove listing" danger description={`Remove ${moderationTarget.name} from the live marketplace? The owner will keep the champion in their Collection.`} onCancel={() => setModerationTarget(null)} onConfirm={() => void removeMarketListing()} title="Remove marketplace listing?" />}
    </Layout>
  );
}

export default Admin;
