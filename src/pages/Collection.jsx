import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import Layout from "../components/Layout";
import ListingArtwork from "../components/ListingArtwork";
import champions from "../data/champions";
import traits from "../data/traits";
import useAuth from "../context/useAuth";
import { supabase } from "../lib/supabase";
import { calculateChampionValue, getRarityValue } from "../utils/valueCalculator";
import { getChampionTraits, getOwnedChampionValue } from "../utils/marketplace";

const TRAIT_BONUS_LABELS = {
  chakra: "Chakra",
  strength: "Strength",
  trainingSpeed: "Training speed",
  statsGain: "Stats gain",
  sword: "Sword",
  lootChance: "Loot chance",
  cooldownReduction: "Cooldown reduction",
  chikara: "Chikara",
  yen: "Yen",
  speed: "Speed",
  defense: "Defense",
  allDamage: "All damage",
};

function traitEffectSummary(trait) {
  if (!trait) return null;
  const bonuses = Object.entries(trait.bonuses)
    .filter(([, bonus]) => bonus > 0)
    .map(([key, bonus]) => `${TRAIT_BONUS_LABELS[key]} +${bonus}%`);
  return bonuses.join(" · ") || "No bonus recorded";
}

function Collection() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [ownedChampions, setOwnedChampions] = useState([]);
  const [listingsByChampion, setListingsByChampion] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddChampion, setShowAddChampion] = useState(false);
  const [selectedChampionId, setSelectedChampionId] = useState(champions[0]?.id);
  const [selectedTrait, setSelectedTrait] = useState("Standard");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState(() => searchParams.get("search") || "");
  const [rarityFilter, setRarityFilter] = useState("all");
  const [traitFilter, setTraitFilter] = useState("all");
  const [sortBy, setSortBy] = useState("recent");
  const [detailsChampion, setDetailsChampion] = useState(null);

  const query = search.trim().toLowerCase();
  const selectedChampion = champions.find((champion) => champion.id === Number(selectedChampionId));
  const selectedTraitData = traits.find((trait) => trait.name === selectedTrait);

  useEffect(() => {
    setSearch(searchParams.get("search") || "");
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
      const traits = getChampionTraits(champion);
      return traits.length ? traits : ["Standard"];
    }))].sort((left, right) => left.localeCompare(right)),
    [ownedChampions],
  );

  const availableRarities = useMemo(
    () => [...new Set(ownedChampions.map((champion) => champion.rarity).filter(Boolean))].sort((left, right) => getRarityValue(right) - getRarityValue(left)),
    [ownedChampions],
  );

  const filteredOwnedChampions = useMemo(() => {
    const championsToShow = ownedChampions.filter((champion) => {
      const traits = getChampionTraits(champion);
      const searchableDetails = [champion.name, champion.rarity, ...traits].filter(Boolean).join(" ").toLowerCase();
      const matchesSearch = !query || searchableDetails.includes(query);
      const matchesRarity = rarityFilter === "all" || champion.rarity === rarityFilter;
      const matchesTrait = traitFilter === "all" || (traitFilter === "Standard" ? traits.length === 0 : traits.includes(traitFilter));
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

  const clearControls = () => {
    setSearch("");
    setRarityFilter("all");
    setTraitFilter("all");
    setSortBy("recent");
  };

  const hasActiveControls = Boolean(search || rarityFilter !== "all" || traitFilter !== "all" || sortBy !== "recent");

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
      trait: selectedTrait || "Standard",
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

  return (
    <Layout>
      <section className="page-heading page-heading-split">
        <div>
          <p className="eyebrow">Personal inventory</p>
          <h1>Collection</h1>
          <p>Keep your champions organized, then put the exact copy you own on your public Shelf.</p>
        </div>
        <button className="primary-action" onClick={() => setShowAddChampion(true)} type="button">
          Add champion
        </button>
      </section>

      <section className="collection-summary" aria-label="Collection summary">
        <div>
          <span>Owned champions</span>
          <strong>{ownedChampions.length}</strong>
        </div>
        <div>
          <span>On Shelf</span>
          <strong>{[...listingsByChampion.values()].filter((listing) => listing.status === "active").length}</strong>
        </div>
        <div>
          <span>Collection value</span>
          <strong>◈ {ownedChampions.reduce((total, champion) => total + getOwnedChampionValue(champion), 0).toLocaleString()}</strong>
        </div>
      </section>

      <section className="collection-controls" aria-label="Collection controls">
        <label className="collection-search">
          <span>Search</span>
          <input onChange={(event) => setSearch(event.target.value)} placeholder="Champion, rarity, or trait" type="search" value={search} />
        </label>
        <label className="collection-control-select">
          <span>Rarity</span>
          <select onChange={(event) => setRarityFilter(event.target.value)} value={rarityFilter}>
            <option value="all">All rarities</option>
            {availableRarities.map((rarity) => <option key={rarity} value={rarity}>{rarity}</option>)}
          </select>
        </label>
        <label className="collection-control-select">
          <span>Trait</span>
          <select onChange={(event) => setTraitFilter(event.target.value)} value={traitFilter}>
            <option value="all">All traits</option>
            {availableTraits.map((trait) => <option key={trait} value={trait}>{trait}</option>)}
          </select>
        </label>
        <label className="collection-control-select">
          <span>Sort by</span>
          <select onChange={(event) => setSortBy(event.target.value)} value={sortBy}>
            <option value="recent">Recently updated</option>
            <option value="value-desc">Value: high to low</option>
            <option value="value-asc">Value: low to high</option>
            <option value="rarity">Rarity</option>
            <option value="name">Champion name</option>
          </select>
        </label>
        {hasActiveControls && <button className="collection-clear-controls" onClick={clearControls} type="button">Clear controls</button>}
      </section>

      {error && <p className="form-error" role="alert">{error}</p>}

      {loading ? (
        <p className="loading-copy">Loading your Collection...</p>
      ) : filteredOwnedChampions.length === 0 ? (
        <section className="empty-state collection-empty-state">
          <span className="empty-state-icon">✦</span>
          <h2>{query ? "No champions match that search" : "Start your Collection"}</h2>
          <p>
            {query
              ? "Try another champion name, or clear the search to see every copy you own."
              : "Add a champion you own first. Each copy stays uniquely yours, so traits and listings are always clear."}
          </p>
          {!query && <button className="secondary-action" onClick={() => setShowAddChampion(true)} type="button">Add your first champion</button>}
        </section>
      ) : (
        <section className="collection-grid">
          {filteredOwnedChampions.map((champion) => {
            const listing = listingsByChampion.get(champion.id);
            const traits = getChampionTraits(champion);

            return (
              <article className="owned-champion-card" key={champion.id}>
                <div className="card-topline">
                  <span className={`rarity-badge rarity-${champion.rarity.toLowerCase().replaceAll(" ", "-")}`}>{champion.rarity}</span>
                  {listing && <span className={`listing-status listing-${listing.status}`}>{listing.status === "active" ? "On Shelf" : "Shelf paused"}</span>}
                </div>
                <ListingArtwork imageUrl={champion.image_url} name={champion.name} rarity={champion.rarity} />
                <h2>{champion.name}</h2>
                <div className="traits card-traits">
                  {traits.length ? traits.map((trait) => <span className="trait" key={trait}>✦ {trait}</span>) : <span className="trait">✦ Standard</span>}
                </div>
                <div className="owned-champion-value">
                  <span>Market value</span>
                  <strong>◈ {getOwnedChampionValue(champion).toLocaleString()}</strong>
                </div>
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
              <ListingArtwork imageUrl={detailsChampion.image_url} name={detailsChampion.name} rarity={detailsChampion.rarity} />
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
            <div className="modal-buttons">
              <button className="secondary-action" onClick={() => setDetailsChampion(null)} type="button">Done</button>
              {listingsByChampion.has(detailsChampion.id) ? <Link className="primary-action" to="/shelf">Manage on Shelf</Link> : <Link className="primary-action" to={`/shelf?list=${detailsChampion.id}`}>List on Shelf</Link>}
            </div>
          </section>
        </div>
      )}

      {showAddChampion && (
        <div className="modal-overlay" role="presentation">
          <form className="trade-modal collection-modal" onSubmit={addChampion}>
            <p className="eyebrow">Add to Collection</p>
            <h2>Which copy do you own?</h2>
            <p className="modal-copy">This creates a private inventory record. You can list it publicly whenever you are ready.</p>

            <label className="field-label" htmlFor="champion-select">Champion</label>
            <select
              id="champion-select"
              onChange={(event) => {
                setSelectedChampionId(event.target.value);
                setSelectedTrait("Standard");
              }}
              value={selectedChampionId}
            >
              {champions.map((champion) => <option key={champion.id} value={champion.id}>{champion.name} · {champion.clanPoints} clan points</option>)}
            </select>

            <label className="field-label" htmlFor="trait-select">Trait</label>
            <select id="trait-select" onChange={(event) => setSelectedTrait(event.target.value)} value={selectedTrait}>
              <option value="Standard">Standard</option>
              {traits.map((trait) => <option key={trait.name} value={trait.name}>{trait.name} · {trait.rarity}</option>)}
            </select>
            {selectedTraitData && <p className="collection-source-note"><strong>{selectedTraitData.rarity}</strong> · {traitEffectSummary(selectedTraitData)}{selectedTraitData.notes ? ` · ${selectedTraitData.notes}` : ""}</p>}

            {selectedChampion && <div className="form-value-preview"><span>Catalog score · {selectedChampion.statTotal}% total bonus · {selectedChampion.clanPoints} clan points</span><strong>◈ {calculateChampionValue({ ...selectedChampion, traits: selectedTrait === "Standard" ? [] : [selectedTrait] }).toLocaleString()}</strong></div>}

            <div className="modal-buttons">
              <button className="secondary-action" onClick={() => setShowAddChampion(false)} type="button">Cancel</button>
              <button className="primary-action" disabled={saving} type="submit">{saving ? "Adding…" : "Add champion"}</button>
            </div>
          </form>
        </div>
      )}
    </Layout>
  );
}

export default Collection;
