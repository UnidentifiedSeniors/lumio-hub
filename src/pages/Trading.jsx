import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import Layout from "../components/Layout";
import OfferComposer from "../components/OfferComposer";
import useAuth from "../context/useAuth";
import { supabase } from "../lib/supabase";
import { getChampionTraits, getOwnedChampionValue } from "../utils/marketplace";

function Trading() {
  const { user } = useAuth();
  const [listings, setListings] = useState([]);
  const [ownedChampions, setOwnedChampions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [offerTarget, setOfferTarget] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const loadMarketplace = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    const [listingsResult, ownedResult] = await Promise.all([
      supabase.from("marketplace_listings").select("*").order("created_at", { ascending: false }),
      supabase.from("user_champions").select("*").eq("owner_id", user.id).order("updated_at", { ascending: false }),
    ]);

    if (listingsResult.error || ownedResult.error) {
      setError(listingsResult.error?.message || ownedResult.error?.message || "Unable to load the marketplace.");
    } else {
      setListings(listingsResult.data || []);
      setOwnedChampions(ownedResult.data || []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadMarketplace();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadMarketplace]);

  const visibleListings = useMemo(() => {
    const normalizedQuery = search.trim().toLowerCase();
    return listings.filter((listing) => {
      if (listing.owner_id === user?.id) return false;
      return !normalizedQuery || [listing.name, listing.rarity, listing.trait, listing.discord_display_name, listing.discord_username]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedQuery));
    });
  }, [listings, search, user]);

  const openOffer = (listing) => {
    setError(null);
    setSuccessMessage(null);
    setOfferTarget({
      recipientId: listing.owner_id,
      listingId: listing.id,
      requestedChampion: listing,
      title: `Offer for ${listing.name}`,
      summary: `${listing.name} · ◈ ${getOwnedChampionValue(listing).toLocaleString()}`,
    });
  };

  return (
    <Layout>
      <section className="page-heading page-heading-split">
        <div>
          <p className="eyebrow">Live community listings</p>
          <h1>Market</h1>
          <p>Browse champions other licensed members have placed on Shelf, then send a private multi-champion offer.</p>
        </div>
        <label className="market-search">
          <span>Search</span>
          <input onChange={(event) => setSearch(event.target.value)} placeholder="Champion, trait, or trader" type="search" value={search} />
        </label>
      </section>

      <section className="marketplace-summary">
        <span><strong>{listings.length}</strong> active community listings</span>
        <span><strong>{ownedChampions.length}</strong> champions ready to offer</span>
        <span>Offers are private until accepted</span>
      </section>

      {error && <p className="form-error" role="alert">{error}</p>}
      {successMessage && <p className="form-success" role="status">{successMessage}</p>}

      {loading ? (
        <p className="loading-copy">Loading live listings...</p>
      ) : visibleListings.length === 0 ? (
        <section className="empty-state marketplace-empty-state">
          <span className="empty-state-icon">⇄</span>
          <h2>{listings.length ? "No listings match that search" : "The marketplace is quiet right now"}</h2>
          <p>{listings.length ? "Try a different champion, trait, or trader name." : "Create your own Shelf listing to be ready when other licensed traders arrive."}</p>
        </section>
      ) : (
        <section className="marketplace-grid">
          {visibleListings.map((listing) => {
            const traits = getChampionTraits(listing);
            const sellerName = listing.discord_display_name || listing.discord_username || "Licensed trader";
            return (
              <article className="marketplace-card" key={listing.id}>
                <div className="card-topline">
                  <span className={`rarity-badge rarity-${listing.rarity.toLowerCase().replaceAll(" ", "-")}`}>{listing.rarity}</span>
                  <span className="listing-status listing-active">Live on Shelf</span>
                </div>
                <h2>{listing.name}</h2>
                <div className="traits card-traits">{traits.length ? traits.map((trait) => <span className="trait" key={trait}>✦ {trait}</span>) : <span className="trait">✦ Standard</span>}</div>
                <p className="market-value">◈ {getOwnedChampionValue(listing).toLocaleString()}</p>
                {listing.note && <p className="listing-note">“{listing.note}”</p>}
                <Link className="seller-row" to={`/trader/${listing.owner_id}`}>
                  {listing.discord_avatar ? <img alt="" src={listing.discord_avatar} /> : <span>{sellerName.charAt(0).toUpperCase()}</span>}
                  <div><small>Listed by</small><strong>{sellerName}</strong>{listing.discord_display_name && <em>Discord · {listing.discord_display_name}</em>}</div>
                </Link>
                <button className="primary-action card-action" onClick={() => openOffer(listing)} type="button">Make an offer</button>
              </article>
            );
          })}
        </section>
      )}

      {offerTarget && <OfferComposer onClose={() => setOfferTarget(null)} onSent={(code) => { setOfferTarget(null); setSuccessMessage(`Offer ${code ? `#${code}` : "sent"} is now in the trader’s Received Trades.`); }} target={offerTarget} />}
    </Layout>
  );
}

export default Trading;
