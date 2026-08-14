import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import CatalogPickerDialog from "../components/CatalogPickerDialog";
import ChoiceMenu from "../components/ChoiceMenu";
import ConfirmDialog from "../components/ConfirmDialog";
import Layout from "../components/Layout";
import ListingArtwork from "../components/ListingArtwork";
import champions from "../data/champions";
import traits from "../data/traits";
import useAuth from "../context/useAuth";
import { supabase } from "../lib/supabase";
import { calculateChampionValue, getRarityValue } from "../utils/valueCalculator";
import { getChampionTraits, getOwnedChampionValue } from "../utils/marketplace";
import traitEffectSummary from "../utils/traitEffectSummary";

function championSourceSummary(champion) {
  if (!champion) return "";
  if (champion.statTotal > 0 || champion.clanPoints > 0) {
    return `+${champion.statTotal}% combined bonus · ${champion.clanPoints} Clan Points`;
  }
  return "Base stats not recorded in source";
}

function Collection() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [ownedChampions, setOwnedChampions] = useState([]);
  const [listingsByChampion, setListingsByChampion] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddChampion, setShowAddChampion] = useState(false);
  const [selectedChampionId, setSelectedChampionId] = useState(null);
  const [selectedTrait, setSelectedTrait] = useState("Standard");
  const [picker, setPicker] = useState(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState(() => searchParams.get("search") || "");
  const [rarityFilter, setRarityFilter] = useState("all");
  const [traitFilter, setTraitFilter] = useState("all");
  const [sortBy, setSortBy] = useState("recent");
  const [detailsChampion, setDetailsChampion] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const query = search.trim().toLowerCase();
  const selectedChampion = champions.find((champion) => champion.id === Number(selectedChampionId));
  const selectedTraitData = traits.find((trait) => trait.name === selectedTrait);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchParams.get("search") || "");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [searchParams]);

  const loadCollection = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    const [championsResult, listingsResult] = await Promise.all([
      supabase
        .from("user_champions")
        .select("*")
        .eq("owner_id", user.id)
        .order("updated_at", { ascending: false }),
      supabase
        .from("shelf_listings")
        .select("id, user_champion_id, status")
        .eq("owner_id", user.id)
        .in("status", ["active", "paused"]),
    ]);

    if (championsResult.error || listingsResult.error) {
      setError(championsResult.error?.message || listingsResult.error?.message || "Unable to load your Collection.");
      setLoading(false);
      return;
    }

    setOwnedChampions(championsResult.data || []);
    setListingsByChampion(
      new Map((listingsResult.data || []).map((listing) => [listing.user_champion_id, listing]))
    );
    setLoading(false);
  }, [user]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCollection();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadCollection]);

  const availableTraits = useMemo(
    () => [...new Set(ownedChampions.flatMap((champion) => {
      const championTraits = getChampionTraits(champion);
      return championTraits.length ? championTraits : ["Standard"];
    }))].sort((left, right) => left.localeCompare(right)),
    [ownedChampions],
  );

  const availableRarities = useMemo(
    () => [...new Set(ownedChampions.map((champion) => champion.rarity).filter(Boolean))].sort((left, right) => getRarityValue(right) - getRarityValue(left)),
    [ownedChampions],
  );

  const filteredOwnedChampions = useMemo(() => {
    const championsToShow = ownedChampions.filter((champion) => {
      const championTraits = getChampionTraits(champion);
      const searchableDetails = [champion.name, champion.rarity, ...championTraits].filter(Boolean).join(" ").toLowerCase();
      const matchesSearch = !query || searchableDetails.includes(query);
      const matchesRarity = rarityFilter === "all" || champion.rarity === rarityFilter;
      const matchesTrait = traitFilter === "all" || (traitFilter === "Standard" ? championTraits.length === 0 : championTraits.includes(traitFilter));
      return matchesSearch && matchesRarity && matchesTrait;
    });

    return [...championsToShow].sort((left, right) => {
      if (sortBy === "value-desc") return getOwnedChampionValue(right) - getOwnedChampionValue(left);
      if (sortBy === "value-asc") return getOwnedChampionValue(left) - getOwnedChampionValue(right);
      if (sortBy === "name") return left.name.localeCompare(right.name);
      if (sortBy === "rarity") return getRarityValue(right.rarity) - getRarityValue(left.rarity) || left.name.localeCompare(right.name);
      return new Date(right.updated_at || right.created_at || 0) - new Date(left.updated_at || left.created_at || 0);
    });
  }, [ownedChampions, query, rarityFilter, sortBy, traitFilter]);

  const rarityOptions = [{ value: "all", label: "All rarities" }, ...availableRarities.map((rarity) => ({ value: rarity, label: rarity }))];
  const traitOptions = [{ value: "all", label: "All traits" }, ...availableTraits.map((trait) => ({ value: trait, label: trait }))];
  const sortOptions = [
    { value: "recent", label: "Recently updated" },
    { value: "value-desc", label: "Value: high to low" },
    { value: "value-asc", label: "Value: low to high" },
    { value: "rarity", label: "Rarity" },
    { value: "name", label: "Champion name" },
  ];

  const clearControls = () => {
    setSearch("");
    setRarityFilter("all");
    setTraitFilter("all");
    setSortBy("recent");
  };

  const openAddChampion = () => {
    setError(null);
    setSelectedChampionId(null);
    setSelectedTrait("Standard");
    setShowAddChampion(true);
  };

  const addChampion = async (event) => {
    event.preventDefault();
    if (!selectedChampion || !user) return;

    setSaving(true);
    setError(null);

    const championWithTrait = { ...selectedChampion, traits: selectedTrait === "Standard" ? [] : [selectedTrait] };
    const { error: insertError } = await supabase.from("user_champions").insert({
      owner_id: user.id,
      name: selectedChampion.name,
      image_url: selectedChampion.image_url || null,
      rarity: selectedChampion.rarity,
      trait: selectedTrait,
      base_value: calculateChampionValue(championWithTrait),
      market_adjustment: 1,
    });

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setShowAddChampion(false);
    await loadCollection();
  };

  const removeChampion = async () => {
    if (!deleteTarget || !user) return;

    setDeletingId(deleteTarget.id);
    setError(null);
    const { error: deleteError } = await supabase
      .from("user_champions")
      .delete()
      .eq("id", deleteTarget.id)
      .eq("owner_id", user.id);

    if (deleteError) {
      setError(deleteError.message || "Unable to remove that champion from your Collection.");
    } else {
      setDetailsChampion(null);
      setDeleteTarget(null);
      await loadCollection();
    }
    setDeletingId(null);
  };

  const hasActiveControls = Boolean(search || rarityFilter !== "all" || traitFilter !== "all" || sortBy !== "recent");

  return (
    <Layout>
      <section className="page-heading page-heading-split">
        <div>
          <p className="eyebrow">Personal inventory</p>
          <h1>Collection</h1>
          <p>Keep your champions organized, then put the exact copy you own on your public Shelf.</p>
        </div>
        <button className="primary-action" onClick={openAddChampion} type="button">Add champion</button>
      </section>

      <section className="collection-summary" aria-label="Collection summary">
        <div><span>Owned champions</span><strong>{ownedChampions.length}</strong></div>
        <div><span>On Shelf</span><strong>{[...listingsByChampion.values()].filter((listing) => listing.status === "active").length}</strong></div>
        <div><span>Collection value</span><strong>◈ {ownedChampions.reduce((total, champion) => total + getOwnedChampionValue(champion), 0).toLocaleString()}</strong></div>
      </section>

      <section className="collection-controls" aria-label="Collection controls">
        <label className="collection-search">
          <span>Search</span>
          <input onChange={(event) => setSearch(event.target.value)} placeholder="Champion, rarity, or trait" type="search" value={search} />
        </label>
        <ChoiceMenu label="Rarity" onChange={setRarityFilter} options={rarityOptions} value={rarityFilter} />
        <ChoiceMenu label="Trait" onChange={setTraitFilter} options={traitOptions} value={traitFilter} />
        <ChoiceMenu label="Sort by" onChange={setSortBy} options={sortOptions} value={sortBy} />
        {hasActiveControls && <button className="collection-clear-controls" onClick={clearControls} type="button">Clear controls</button>}
      </section>

      {error && <p className="form-error" role="alert">{error}</p>}

      {loading ? (
        <p className="loading-copy">Loading your Collection...</p>
      ) : filteredOwnedChampions.length === 0 ? (
        <section className="empty-state collection-empty-state">
          <span className="empty-state-icon">✦</span>
          <h2>{query ? "No champions match that search" : "Start your Collection"}</h2>
          <p>{query ? "Try another champion name, or clear the search to see every copy you own." : "Add a champion you own first. Each copy stays uniquely yours, so traits and listings are always clear."}</p>
          {!query && <button className="secondary-action" onClick={openAddChampion} type="button">Add your first champion</button>}
        </section>
      ) : (
        <section className="collection-grid">
          {filteredOwnedChampions.map((champion) => {
            const listing = listingsByChampion.get(champion.id);
            const championTraits = getChampionTraits(champion);
            const traitLabel = championTraits[0] || "Standard";

            return (
              <article className="owned-champion-card" key={champion.id}>
                <div className="card-topline">
                  <span className={`rarity-badge rarity-${champion.rarity.toLowerCase().replaceAll(" ", "-")}`}>{champion.rarity}</span>
                  {listing && <span className={`listing-status listing-${listing.status}`}>{listing.status === "active" ? "On Shelf" : "Shelf paused"}</span>}
                </div>
                <ListingArtwork imageUrl={champion.image_url} name={champion.name} rarity={champion.rarity} trait={traitLabel} />
                <h2>{champion.name}</h2>
                <div className="traits card-traits">{championTraits.length ? championTraits.map((trait) => <span className="trait" key={trait}>✦ {trait}</span>) : <span className="trait">✦ Standard</span>}</div>
                <div className="owned-champion-value"><span>Market value</span><strong>◈ {getOwnedChampionValue(champion).toLocaleString()}</strong></div>
                <div className="card-actions owned-card-actions">
                  <button className="secondary-action" onClick={() => setDetailsChampion(champion)} type="button">View details</button>
                  {listing ? <Link className="secondary-action" to="/shelf">Manage listing</Link> : <Link className="primary-action" to={`/shelf?list=${champion.id}`}>List on Shelf</Link>}
                </div>
              </article>
            );
          })}
        </section>
      )}

      {detailsChampion && (
        <div className="modal-overlay" role="presentation">
          <section aria-modal="true" className="trade-modal collection-details-modal" role="dialog" aria-labelledby="collection-details-title">
            <div className="collection-details-heading">
              <ListingArtwork imageUrl={detailsChampion.image_url} name={detailsChampion.name} rarity={detailsChampion.rarity} trait={getChampionTraits(detailsChampion)[0] || "Standard"} />
              <div>
                <span className={`rarity-badge rarity-${detailsChampion.rarity.toLowerCase().replaceAll(" ", "-")}`}>{detailsChampion.rarity}</span>
                <h2 id="collection-details-title">{detailsChampion.name}</h2>
                <p>{getChampionTraits(detailsChampion).length ? getChampionTraits(detailsChampion).join(" · ") : "Standard trait"}</p>
              </div>
            </div>
            <div className="collection-detail-metrics">
              <div><span>Market value</span><strong>◈ {getOwnedChampionValue(detailsChampion).toLocaleString()}</strong></div>
              <div><span>Shelf status</span><strong>{listingsByChampion.get(detailsChampion.id)?.status === "active" ? "Listed publicly" : listingsByChampion.get(detailsChampion.id)?.status === "paused" ? "Listing paused" : "Private to you"}</strong></div>
            </div>
            <p className="modal-copy">This is one exact copy in your Collection. Listing it on Shelf makes only its champion details visible to other licensed traders.</p>
            <div className="modal-buttons collection-details-actions">
              <button className="danger-action" onClick={() => setDeleteTarget(detailsChampion)} type="button">Remove from Collection</button>
              <button className="secondary-action" onClick={() => setDetailsChampion(null)} type="button">Done</button>
              {listingsByChampion.has(detailsChampion.id) ? <Link className="primary-action" to="/shelf">Manage on Shelf</Link> : <Link className="primary-action" to={`/shelf?list=${detailsChampion.id}`}>List on Shelf</Link>}
            </div>
          </section>
        </div>
      )}

      {showAddChampion && (
        <div className="modal-overlay" role="presentation">
          <form className="trade-modal collection-modal collection-add-modal" onSubmit={addChampion}>
            <p className="eyebrow">Add to Collection</p>
            <h2>Choose your exact copy</h2>
            <p className="modal-copy">Select the champion and trait you own. Lumio keeps that combination as one private, tradeable copy.</p>

            <div className="catalog-field">
              <span className="field-label">Champion</span>
              <button className={`catalog-selection${selectedChampion ? " has-selection" : ""}`} onClick={() => setPicker("champion")} type="button">
                {selectedChampion ? <><span className="rarity-badge">{selectedChampion.rarity}</span><strong>{selectedChampion.name}</strong><small>{championSourceSummary(selectedChampion)}</small><em>Change</em></> : <><strong>Choose a champion</strong><small>Browse the live catalog by name, rarity, and base stats.</small><em>Browse catalog</em></>}
              </button>
            </div>

            <div className="catalog-field">
              <span className="field-label">Trait</span>
              <button className="catalog-selection has-selection" onClick={() => setPicker("trait")} type="button">
                <span className="rarity-badge">{selectedTraitData?.rarity || "Base"}</span><strong>{selectedTrait}</strong><small>{selectedTraitData ? traitEffectSummary(selectedTraitData) : "No trait modifiers"}</small><em>Change</em>
              </button>
              {selectedTraitData?.notes && <p className="collection-source-note">{selectedTraitData.notes}</p>}
            </div>

            {selectedChampion && <div className="form-value-preview"><span>Catalog score · {championSourceSummary(selectedChampion)}</span><strong>◈ {calculateChampionValue({ ...selectedChampion, traits: selectedTrait === "Standard" ? [] : [selectedTrait] }).toLocaleString()}</strong></div>}

            <div className="modal-buttons">
              <button className="secondary-action" onClick={() => setShowAddChampion(false)} type="button">Cancel</button>
              <button className="primary-action" disabled={saving || !selectedChampion} type="submit">{saving ? "Adding…" : "Add champion"}</button>
            </div>
          </form>
        </div>
      )}

      {picker === "champion" && <CatalogPickerDialog items={champions} kind="champion" onChoose={(champion) => { setSelectedChampionId(champion.id); setSelectedTrait("Standard"); }} onClose={() => setPicker(null)} selectedValue={selectedChampionId} title="Choose a champion" />}
      {picker === "trait" && <CatalogPickerDialog items={traits} kind="trait" onChoose={setSelectedTrait} onClose={() => setPicker(null)} selectedValue={selectedTrait} title="Choose a trait" />}
      {deleteTarget && <ConfirmDialog busy={deletingId === deleteTarget.id} cancelLabel="Keep champion" confirmLabel="Remove champion" danger description={listingsByChampion.has(deleteTarget.id) ? `Remove ${deleteTarget.name} from your Collection? Its active Shelf listing will be removed too.` : `Remove ${deleteTarget.name} from your Collection? This only removes your private Lumio record.`} onCancel={() => setDeleteTarget(null)} onConfirm={() => void removeChampion()} title="Remove this champion?" />}
    </Layout>
  );
}

export default Collection;
