import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import CatalogPickerDialog from "../components/CatalogPickerDialog";
import ChoiceMenu from "../components/ChoiceMenu";
import CollapsibleChampionArtwork from "../components/CollapsibleChampionArtwork";
import ConfirmDialog from "../components/ConfirmDialog";
import Layout from "../components/Layout";
import ListingArtwork from "../components/ListingArtwork";
import RarityBadge from "../components/RarityBadge";
import useAuth from "../context/useAuth";
import { supabase } from "../lib/supabase";
import { readBooleanPreference, saveBooleanPreference } from "../utils/clientPreferences";
import { getDatePreferences } from "../utils/datePreferences";
import { formatDateTime, getChampionTraits, getOfficialChampionValue } from "../utils/marketplace";

const LISTING_STATUS_OPTIONS = [
  { value: "active", label: "Live on Market" },
  { value: "paused", label: "Paused" },
];

function Shelf() {
  const { user, profile } = useAuth();
  const datePreferences = getDatePreferences(profile);
  const [searchParams, setSearchParams] = useSearchParams();
  const [listings, setListings] = useState([]);
  const [availableChampions, setAvailableChampions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [showListingForm, setShowListingForm] = useState(Boolean(searchParams.get("list")));
  const [selectedChampionId, setSelectedChampionId] = useState(searchParams.get("list") || "");
  const [showChampionPicker, setShowChampionPicker] = useState(false);
  const [note, setNote] = useState("");
  const [editingListing, setEditingListing] = useState(null);
  const [editingNote, setEditingNote] = useState("");
  const [editingStatus, setEditingStatus] = useState("active");
  const [removalTarget, setRemovalTarget] = useState(null);
  const completedPreferenceKey = user?.id ? `lumio-shelf-hide-completed:${user.id}` : "";
  const [hideCompleted, setHideCompleted] = useState(() => readBooleanPreference(completedPreferenceKey));

  const loadShelf = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    const [listingsResult, championsResult] = await Promise.all([
      supabase
        .from("shelf_listings")
        .select("id, user_champion_id, status, note, created_at, updated_at, user_champions(id, name, image_url, rarity, trait, base_value)")
        .eq("owner_id", user.id)
        .order("updated_at", { ascending: false }),
      supabase
        .from("user_champions")
        .select("id, name, image_url, rarity, trait, base_value")
        .eq("owner_id", user.id)
        .order("updated_at", { ascending: false }),
    ]);

    if (listingsResult.error || championsResult.error) {
      setError(listingsResult.error?.message || championsResult.error?.message || "Unable to load Shelf listings.");
      setLoading(false);
      return;
    }

    const currentListings = listingsResult.data || [];
    setListings(currentListings);
    setAvailableChampions(
      (championsResult.data || []).filter(
        (champion) => !currentListings.some(
          (listing) => listing.user_champion_id === champion.id && ["active", "paused"].includes(listing.status)
        )
      )
    );
    setLoading(false);
  }, [user]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadShelf();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadShelf]);

  const selectedChampion = availableChampions.find((champion) => champion.id === selectedChampionId);
  const completedListings = listings.filter((listing) => listing.status === "completed");
  const visibleListings = useMemo(
    () => hideCompleted ? listings.filter((listing) => listing.status !== "completed") : listings,
    [hideCompleted, listings],
  );

  const toggleCompletedVisibility = () => {
    const next = !hideCompleted;
    setHideCompleted(next);
    saveBooleanPreference(completedPreferenceKey, next);
  };

  const createListing = async (event) => {
    event.preventDefault();
    if (!user) return;
    if (!selectedChampionId) {
      setError("Choose a champion before publishing your Shelf listing.");
      return;
    }

    setBusyId("new");
    setError(null);
    const { error: insertError } = await supabase.from("shelf_listings").insert({
      owner_id: user.id,
      user_champion_id: selectedChampionId,
      note: note.trim() || null,
    });

    if (insertError) {
      setError(insertError.message);
      setBusyId(null);
      return;
    }

    setBusyId(null);
    setShowListingForm(false);
    setSelectedChampionId("");
    setNote("");
    setSearchParams({});
    await loadShelf();
  };

  const updateListingStatus = async (listing, status) => {
    setBusyId(listing.id);
    setError(null);
    const { error: updateError } = await supabase
      .from("shelf_listings")
      .update({ status })
      .eq("id", listing.id);

    if (updateError) {
      setError(updateError.message);
    } else {
      await loadShelf();
    }
    setBusyId(null);
  };

  const openListingEditor = (listing) => {
    setError(null);
    setEditingListing(listing);
    setEditingNote(listing.note || "");
    setEditingStatus(listing.status === "paused" ? "paused" : "active");
  };

  const saveListing = async (event) => {
    event.preventDefault();
    if (!editingListing || !user) return;

    setBusyId(editingListing.id);
    setError(null);
    const { error: updateError } = await supabase
      .from("shelf_listings")
      .update({ note: editingNote.trim() || null, status: editingStatus })
      .eq("id", editingListing.id)
      .eq("owner_id", user.id);

    if (updateError) {
      setError(updateError.message || "Unable to update that Shelf listing.");
    } else {
      setEditingListing(null);
      await loadShelf();
    }
    setBusyId(null);
  };

  const removeListing = async () => {
    if (!removalTarget) return;
    await updateListingStatus(removalTarget, "removed");
    setRemovalTarget(null);
  };

  return (
    <Layout>
      <section className="page-heading page-heading-split">
        <div>
          <p className="eyebrow">Your public marketplace</p>
          <h1>Shelf</h1>
          <p>Manage the champions you have listed for other licensed traders.</p>
        </div>
        <button className="primary-action" disabled={loading || availableChampions.length === 0} onClick={() => setShowListingForm(true)} type="button">List a champion</button>
      </section>

      <section className="shelf-summary">
        <span><strong>{listings.filter((listing) => listing.status === "active").length}</strong> active listings</span>
        <span><strong>{listings.filter((listing) => listing.status === "paused").length}</strong> paused</span>
        <span>Only you can edit this Shelf</span>
        {completedListings.length > 0 && <button aria-pressed={hideCompleted} className="activity-visibility-control" onClick={toggleCompletedVisibility} type="button">{hideCompleted ? "Show completed listings" : "Hide completed listings"}</button>}
      </section>

      {error && <p className="form-error" role="alert">{error}</p>}

      {loading ? (
        <p className="loading-copy">Loading your Shelf...</p>
      ) : visibleListings.length === 0 ? (
        <section className="empty-state shelf-empty-state">
          <span className="empty-state-icon">⌁</span>
          <h2>{listings.length && hideCompleted ? "Completed listings are hidden" : "Your Shelf is waiting"}</h2>
          <p>{listings.length && hideCompleted ? "Show completed listings whenever you want to review your previous exchanges." : "Select a champion from your Collection to create a public listing. Active listings appear in Market, while every offer stays private."}</p>
          {listings.length && hideCompleted ? <button className="secondary-action" onClick={toggleCompletedVisibility} type="button">Show completed listings</button> : availableChampions.length ? <button className="secondary-action" onClick={() => setShowListingForm(true)} type="button">Create first listing</button> : <Link className="secondary-action" to="/collection">Open Collection</Link>}
        </section>
      ) : (
        <section className="shelf-grid">
          {visibleListings.map((listing) => {
            const champion = listing.user_champions;
            if (!champion) return null;
            const championTraits = getChampionTraits(champion);
            const traitLabel = championTraits[0] || "Standard";

            return (
              <article className="shelf-card" key={listing.id}>
                <div className="card-topline"><RarityBadge rarity={champion.rarity} /><span className={`listing-status listing-${listing.status}`}>{listing.status}</span></div>
                <CollapsibleChampionArtwork imageUrl={champion.image_url} name={champion.name} trait={traitLabel} />
                <h2>{champion.name}</h2>
                <div className="traits card-traits">{championTraits.length ? championTraits.map((trait) => <span className="trait" key={trait}>✦ {trait}</span>) : <span className="trait">✦ Standard</span>}</div>
                <p className="market-value">Value · ◈ {getOfficialChampionValue(champion).toLocaleString()}</p>
                {listing.note && <p className="listing-note">“{listing.note}”</p>}
                <p className="card-meta">Listed {formatDateTime(listing.created_at, datePreferences)}</p>
                <div className="card-actions">
                  {listing.status === "active" ? <button className="secondary-action" disabled={busyId === listing.id} onClick={() => updateListingStatus(listing, "paused")} type="button">Pause</button> : listing.status === "paused" ? <button className="primary-action" disabled={busyId === listing.id} onClick={() => updateListingStatus(listing, "active")} type="button">Resume</button> : null}
                  {!["removed", "completed"].includes(listing.status) && <button className="secondary-action" disabled={busyId === listing.id} onClick={() => openListingEditor(listing)} type="button">Edit</button>}
                  {!["removed", "completed"].includes(listing.status) && <button className="quiet-action" disabled={busyId === listing.id} onClick={() => setRemovalTarget(listing)} type="button">Remove</button>}
                </div>
              </article>
            );
          })}
        </section>
      )}

      {showListingForm && (
        <div className="modal-overlay" role="presentation">
          <form className="trade-modal collection-modal collection-add-modal" onSubmit={createListing}>
            <p className="eyebrow">Public Shelf</p>
            <h2>Create listing</h2>
            <p className="modal-copy">Your champion name, artwork, trait, and trader card become visible to licensed members.</p>
            <div className="catalog-field">
              <span className="field-label">Champion copy</span>
              <button className={`catalog-selection${selectedChampion ? " has-selection" : ""}`} onClick={() => setShowChampionPicker(true)} type="button">
                {selectedChampion ? <><strong>{selectedChampion.name}</strong><small>{selectedChampion.trait || "Standard"} trait</small><em>Change</em></> : <><strong>Choose a champion copy</strong><small>Browse your private Collection before publishing.</small><em>Browse Collection</em></>}
              </button>
            </div>
            <label className="field-label" htmlFor="listing-note">Note <span>optional</span></label>
            <textarea id="listing-note" maxLength="280" onChange={(event) => setNote(event.target.value)} placeholder="What kind of offers are you open to?" rows="4" value={note} />
            <div className="modal-buttons">
              <button className="secondary-action" onClick={() => setShowListingForm(false)} type="button">Cancel</button>
              <button className="primary-action" disabled={busyId === "new" || !selectedChampion} type="submit">{busyId === "new" ? "Publishing…" : "Publish listing"}</button>
            </div>
          </form>
        </div>
      )}

      {showChampionPicker && <CatalogPickerDialog getItemMeta={(champion) => `${champion.trait || "Standard"} trait`} items={availableChampions} kind="champion" onChoose={(champion) => setSelectedChampionId(champion.id)} onClose={() => setShowChampionPicker(false)} selectedValue={selectedChampionId} title="Choose a champion copy" />}

      {editingListing && (
        <div className="modal-overlay" role="presentation">
          <form aria-modal="true" className="trade-modal listing-editor-modal" onSubmit={saveListing} role="dialog" aria-labelledby="listing-editor-title">
            <p className="eyebrow">Public Shelf</p>
            <h2 id="listing-editor-title">Edit listing</h2>
            <p className="modal-copy">Update the listing note or make the exact champion copy live or paused. Its champion and trait stay unchanged.</p>
            {editingListing.user_champions && <div className="listing-editor-preview"><ListingArtwork imageUrl={editingListing.user_champions.image_url} name={editingListing.user_champions.name} trait={editingListing.user_champions.trait || "Standard"} /><div><RarityBadge rarity={editingListing.user_champions.rarity} /><strong>{editingListing.user_champions.name}</strong><small>Value ◈ {getOfficialChampionValue(editingListing.user_champions).toLocaleString()} · {editingListing.user_champions.trait || "Standard"} trait</small></div></div>}
            <ChoiceMenu label="Listing visibility" onChange={setEditingStatus} options={LISTING_STATUS_OPTIONS} value={editingStatus} />
            <label className="field-label" htmlFor="edit-listing-note">Note <span>optional</span></label>
            <textarea id="edit-listing-note" maxLength="280" onChange={(event) => setEditingNote(event.target.value)} placeholder="What kind of offers are you open to?" rows="4" value={editingNote} />
            <div className="modal-buttons">
              <button className="secondary-action" disabled={busyId === editingListing.id} onClick={() => setEditingListing(null)} type="button">Cancel</button>
              <button className="primary-action" disabled={busyId === editingListing.id} type="submit">{busyId === editingListing.id ? "Saving…" : "Save listing"}</button>
            </div>
          </form>
        </div>
      )}

      {removalTarget && <ConfirmDialog busy={busyId === removalTarget.id} cancelLabel="Keep listing" confirmLabel="Remove listing" danger description={`Remove ${removalTarget.user_champions?.name || "this champion"} from your public Shelf? The champion stays in your private Collection and can be listed again later.`} onCancel={() => setRemovalTarget(null)} onConfirm={() => void removeListing()} title="Remove this Shelf listing?" />}
    </Layout>
  );
}

export default Shelf;
