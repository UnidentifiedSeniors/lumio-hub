import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import CatalogPickerDialog from "../components/CatalogPickerDialog";
import Layout from "../components/Layout";
import ListingArtwork from "../components/ListingArtwork";
import useAuth from "../context/useAuth";
import { supabase } from "../lib/supabase";
import { readBooleanPreference, saveBooleanPreference } from "../utils/clientPreferences";
import { formatDateTime, getChampionTraits, getOwnedChampionValue } from "../utils/marketplace";

function Shelf() {
  const { user } = useAuth();
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
  const completedPreferenceKey = user?.id ? `lumio-shelf-hide-completed:${user.id}` : "";
  const [hideCompleted, setHideCompleted] = useState(() => readBooleanPreference(completedPreferenceKey));

  const loadShelf = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    const [listingsResult, championsResult] = await Promise.all([
      supabase
        .from("shelf_listings")
        .select("id, user_champion_id, status, note, created_at, updated_at, user_champions(id, name, image_url, rarity, trait, base_value, market_adjustment)")
        .eq("owner_id", user.id)
        .order("updated_at", { ascending: false }),
      supabase
        .from("user_champions")
        .select("id, name, image_url, rarity, trait, base_value, market_adjustment")
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
                <div className="card-topline">
                  <span className={`rarity-badge rarity-${champion.rarity.toLowerCase().replaceAll(" ", "-")}`}>{champion.rarity}</span>
                  <span className={`listing-status listing-${listing.status}`}>{listing.status}</span>
                </div>
                <ListingArtwork imageUrl={champion.image_url} name={champion.name} rarity={champion.rarity} trait={traitLabel} />
                <h2>{champion.name}</h2>
                <div className="traits card-traits">{championTraits.length ? championTraits.map((trait) => <span className="trait" key={trait}>✦ {trait}</span>) : <span className="trait">✦ Standard</span>}</div>
                <p className="market-value">◈ {getOwnedChampionValue(champion).toLocaleString()}</p>
                {listing.note && <p className="listing-note">“{listing.note}”</p>}
                <p className="card-meta">Listed {formatDateTime(listing.created_at)}</p>
                <div className="card-actions">
                  {listing.status === "active" ? <button className="secondary-action" disabled={busyId === listing.id} onClick={() => updateListingStatus(listing, "paused")} type="button">Pause</button> : listing.status === "paused" ? <button className="primary-action" disabled={busyId === listing.id} onClick={() => updateListingStatus(listing, "active")} type="button">Resume</button> : null}
                  {!["removed", "completed"].includes(listing.status) && <button className="quiet-action" disabled={busyId === listing.id} onClick={() => updateListingStatus(listing, "removed")} type="button">Remove</button>}
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
            <p className="modal-copy">Your champion name, rarity, trait, market value, and trader card become visible to licensed members.</p>
            <div className="catalog-field">
              <span className="field-label">Champion copy</span>
              <button className={`catalog-selection${selectedChampion ? " has-selection" : ""}`} onClick={() => setShowChampionPicker(true)} type="button">
                {selectedChampion ? <><span className="rarity-badge">{selectedChampion.rarity}</span><strong>{selectedChampion.name}</strong><small>{selectedChampion.trait || "Standard"} trait · ◈ {getOwnedChampionValue(selectedChampion).toLocaleString()}</small><em>Change</em></> : <><strong>Choose a champion copy</strong><small>Browse your private Collection before publishing.</small><em>Browse Collection</em></>}
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

      {showChampionPicker && <CatalogPickerDialog getItemMeta={(champion) => `${champion.trait || "Standard"} trait · ◈ ${getOwnedChampionValue(champion).toLocaleString()}`} items={availableChampions} kind="champion" onChoose={(champion) => setSelectedChampionId(champion.id)} onClose={() => setShowChampionPicker(false)} selectedValue={selectedChampionId} title="Choose a champion copy" />}
    </Layout>
  );
}

export default Shelf;
