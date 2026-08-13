import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import Layout from "../components/Layout";
import champions from "../data/champions";
import useAuth from "../context/useAuth";
import { supabase } from "../lib/supabase";
import { calculateChampionValue } from "../utils/valueCalculator";
import { getChampionTraits, getOwnedChampionValue } from "../utils/marketplace";

function Collection() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [ownedChampions, setOwnedChampions] = useState([]);
  const [listingsByChampion, setListingsByChampion] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddChampion, setShowAddChampion] = useState(false);
  const [selectedChampionId, setSelectedChampionId] = useState(champions[0]?.id);
  const [selectedTrait, setSelectedTrait] = useState(champions[0]?.traits?.[0] || "Standard");
  const [saving, setSaving] = useState(false);

  const query = searchParams.get("search")?.trim().toLowerCase() || "";
  const selectedChampion = champions.find((champion) => champion.id === Number(selectedChampionId));

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

  const filteredOwnedChampions = useMemo(
    () => ownedChampions.filter((champion) => champion.name.toLowerCase().includes(query)),
    [ownedChampions, query]
  );

  const addChampion = async (event) => {
    event.preventDefault();
    if (!selectedChampion || !user) return;

    setSaving(true);
    setError(null);

    const championWithTrait = { ...selectedChampion, traits: [selectedTrait] };
    const { error: insertError } = await supabase.from("user_champions").insert({
      owner_id: user.id,
      name: selectedChampion.name,
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
                <h2>{champion.name}</h2>
                <div className="traits card-traits">
                  {traits.length ? traits.map((trait) => <span className="trait" key={trait}>✦ {trait}</span>) : <span className="trait">✦ Standard</span>}
                </div>
                <div className="owned-champion-value">
                  <span>Market value</span>
                  <strong>◈ {getOwnedChampionValue(champion).toLocaleString()}</strong>
                </div>
                {listing ? (
                  <Link className="secondary-action card-action" to="/shelf">Manage listing</Link>
                ) : (
                  <Link className="primary-action card-action" to={`/shelf?list=${champion.id}`}>List on Shelf</Link>
                )}
              </article>
            );
          })}
        </section>
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
                const nextChampion = champions.find((champion) => champion.id === Number(event.target.value));
                setSelectedChampionId(event.target.value);
                setSelectedTrait(nextChampion?.traits?.[0] || "Standard");
              }}
              value={selectedChampionId}
            >
              {champions.map((champion) => <option key={champion.id} value={champion.id}>{champion.name} · {champion.rarity}</option>)}
            </select>

            <label className="field-label" htmlFor="trait-select">Trait</label>
            <select id="trait-select" onChange={(event) => setSelectedTrait(event.target.value)} value={selectedTrait}>
              {(selectedChampion?.traits || ["Standard"]).map((trait) => <option key={trait} value={trait}>{trait}</option>)}
            </select>

            {selectedChampion && <div className="form-value-preview"><span>Starting market value</span><strong>◈ {calculateChampionValue({ ...selectedChampion, traits: [selectedTrait] }).toLocaleString()}</strong></div>}

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
