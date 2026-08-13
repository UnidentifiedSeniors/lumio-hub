import { useCallback, useEffect, useMemo, useState } from "react";

import Layout from "../components/Layout";
import useAuth from "../context/useAuth";
import { supabase } from "../lib/supabase";
import { getChampionTraits, getOwnedChampionValue, toTradeChampion } from "../utils/marketplace";

const OFFER_LIMIT = 4;

function Trading() {
  const { user } = useAuth();
  const [listings, setListings] = useState([]);
  const [ownedChampions, setOwnedChampions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [activeListing, setActiveListing] = useState(null);
  const [offerIds, setOfferIds] = useState([]);
  const [submitting, setSubmitting] = useState(false);
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

  const selectedOffer = ownedChampions.filter((champion) => offerIds.includes(champion.id));
  const offerValue = selectedOffer.reduce((total, champion) => total + getOwnedChampionValue(champion), 0);

  const toggleOfferChampion = (championId) => {
    setOfferIds((current) => {
      if (current.includes(championId)) return current.filter((id) => id !== championId);
      if (current.length >= OFFER_LIMIT) return current;
      return [...current, championId];
    });
  };

  const openOffer = (listing) => {
    setError(null);
    setSuccessMessage(null);
    setActiveListing(listing);
    setOfferIds([]);
  };

  const submitOffer = async () => {
    if (!activeListing || !user || selectedOffer.length === 0) return;
    setSubmitting(true);
    setError(null);

    const requestedChampion = toTradeChampion({
      id: activeListing.user_champion_id,
      name: activeListing.name,
      rarity: activeListing.rarity,
      trait: activeListing.trait,
      base_value: activeListing.base_value,
      market_adjustment: activeListing.market_adjustment,
    });

    const { data, error: insertError } = await supabase
      .from("trades")
      .insert({
        sender_id: user.id,
        recipient_id: activeListing.owner_id,
        listing_id: activeListing.id,
        requested_champion: requestedChampion,
        requested_champions: [requestedChampion],
        offered_champions: selectedOffer.map(toTradeChampion),
        offer_value: offerValue,
        requested_value: getOwnedChampionValue(activeListing),
        status: "pending",
      })
      .select("trade_code")
      .single();

    if (insertError) {
      setError(insertError.message);
      setSubmitting(false);
      return;
    }

    setSuccessMessage(`Offer ${data?.trade_code ? `#${data.trade_code}` : "sent"} is now in the trader’s Received Trades.`);
    setActiveListing(null);
    setOfferIds([]);
    setSubmitting(false);
  };

  return (
    <Layout>
      <section className="page-heading page-heading-split">
        <div>
          <p className="eyebrow">Live community listings</p>
          <h1>Trades</h1>
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
                <div className="seller-row">
                  {listing.discord_avatar ? <img alt="" src={listing.discord_avatar} /> : <span>{sellerName.charAt(0).toUpperCase()}</span>}
                  <div><small>Listed by</small><strong>{sellerName}</strong>{listing.discord_username && <em>@{listing.discord_username}</em>}</div>
                </div>
                <button className="primary-action card-action" onClick={() => openOffer(listing)} type="button">Make an offer</button>
              </article>
            );
          })}
        </section>
      )}

      {activeListing && (
        <div className="modal-overlay" role="presentation">
          <section aria-modal="true" className="trade-modal offer-modal" role="dialog">
            <p className="eyebrow">Private offer</p>
            <h2>Offer for {activeListing.name}</h2>
            <div className="offer-target"><span>They have listed</span><strong>{activeListing.name} · ◈ {getOwnedChampionValue(activeListing).toLocaleString()}</strong></div>
            {ownedChampions.length === 0 ? (
              <p className="modal-copy">Add at least one champion to your Collection before sending an offer.</p>
            ) : (
              <>
                <p className="modal-copy">Choose up to {OFFER_LIMIT} champions from your Collection. The other trader will see every selection before they accept or decline.</p>
                <div className="offer-picker">
                  {ownedChampions.map((champion) => {
                    const selected = offerIds.includes(champion.id);
                    return (
                      <button className={`offer-choice${selected ? " selected" : ""}`} key={champion.id} onClick={() => toggleOfferChampion(champion.id)} type="button">
                        <span className="offer-choice-check">{selected ? "✓" : "+"}</span>
                        <span><strong>{champion.name}</strong><small>{champion.rarity} · {champion.trait || "Standard"}</small></span>
                        <em>◈ {getOwnedChampionValue(champion).toLocaleString()}</em>
                      </button>
                    );
                  })}
                </div>
                <div className="offer-total"><span>{selectedOffer.length} selected</span><strong>Offer total ◈ {offerValue.toLocaleString()}</strong></div>
              </>
            )}
            <div className="modal-buttons">
              <button className="secondary-action" onClick={() => setActiveListing(null)} type="button">Cancel</button>
              {ownedChampions.length > 0 && <button className="primary-action" disabled={selectedOffer.length === 0 || submitting} onClick={submitOffer} type="button">{submitting ? "Sending…" : "Send trade offer"}</button>}
            </div>
          </section>
        </div>
      )}
    </Layout>
  );
}

export default Trading;
