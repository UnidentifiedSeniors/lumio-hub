import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import Layout from "../components/Layout";
import ListingArtwork from "../components/ListingArtwork";
import OfferComposer from "../components/OfferComposer";
import useAuth from "../context/useAuth";
import { supabase } from "../lib/supabase";
import { formatDateTime, getChampionTraits, getListingCode, getOwnedChampionValue } from "../utils/marketplace";

function formatCount(value) {
  if (value === null || value === undefined) return "—";
  return Number(value).toLocaleString();
}

function TraderProfile() {
  const { traderId } = useParams();
  const { user } = useAuth();
  const [trader, setTrader] = useState(null);
  const [listings, setListings] = useState([]);
  const [publicCollection, setPublicCollection] = useState([]);
  const [traderStats, setTraderStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [offerTarget, setOfferTarget] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const loadProfile = useCallback(async () => {
    if (!traderId) return;
    setLoading(true);
    setError(null);

    const [profileResult, listingsResult, statsResult] = await Promise.all([
      supabase
        .from("public_profiles")
        .select("*")
        .eq("id", traderId)
        .maybeSingle(),
      supabase
        .from("marketplace_listings")
        .select("*")
        .eq("owner_id", traderId)
        .order("created_at", { ascending: false }),
      supabase
        .from("public_trader_stats")
        .select("completed_trade_count, collection_count, active_listing_count")
        .eq("id", traderId)
        .maybeSingle(),
    ]);

    if (profileResult.error || listingsResult.error) {
      setError(profileResult.error?.message || listingsResult.error?.message || "Unable to load this trader profile.");
    } else {
      const profileData = profileResult.data;
      const canViewCollection = profileData?.collection_visibility === "public" || profileData?.id === user?.id;

      if (canViewCollection) {
        const { data: collectionData, error: collectionError } = await supabase
          .from("user_champions")
          .select("id, name, image_url, rarity, trait, base_value, market_adjustment, updated_at")
          .eq("owner_id", traderId)
          .order("updated_at", { ascending: false });

        if (collectionError) {
          setError(collectionError.message || "Unable to load this trader's Collection.");
          setLoading(false);
          return;
        }
        setPublicCollection(collectionData || []);
      } else {
        setPublicCollection([]);
      }

      setTrader(profileData);
      setListings(listingsResult.data || []);
      setTraderStats(statsResult.data || null);
    }
    setLoading(false);
  }, [traderId, user?.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadProfile();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadProfile]);

  if (loading) {
    return <Layout><p className="loading-copy">Loading trader profile...</p></Layout>;
  }

  if (error || !trader) {
    return (
      <Layout>
        <section className="empty-state">
          <span className="empty-state-icon">?</span>
          <h2>Trader profile unavailable</h2>
          <p>{error || "This trader may no longer have a public Lumio profile."}</p>
          <Link className="secondary-action" to="/trades">Explore Market</Link>
        </section>
      </Layout>
    );
  }

  const displayName = trader.lumio_display_name || trader.discord_display_name || trader.discord_username || "Licensed trader";
  const isOwnProfile = user?.id === trader.id;
  const collectionIsPublic = trader.collection_visibility === "public";
  const canViewCollection = isOwnProfile || collectionIsPublic;
  const directOffersEnabled = trader.direct_offers_enabled !== false;
  const openDirectOffer = () => {
    setSuccessMessage(null);
    setOfferTarget({
      recipientId: trader.id,
      title: `Send an offer to ${displayName}`,
      summary: "Open direct offer · no specific Shelf listing requested",
    });
  };
  const openListingOffer = (listing) => {
    setSuccessMessage(null);
    setOfferTarget({
      recipientId: trader.id,
      listingId: listing.id,
      requestedChampion: listing,
      title: `Offer for ${listing.name}`,
      summary: `${listing.name} · ◈ ${getOwnedChampionValue(listing).toLocaleString()}`,
    });
  };

  return (
    <Layout>
      <Link className="back-link" to="/trades">← Back to Market</Link>
      <section className="trader-hero">
        {trader.discord_avatar ? <img alt="" className="trader-avatar" src={trader.discord_avatar} /> : <span className="trader-avatar avatar-fallback">{displayName.charAt(0).toUpperCase()}</span>}
        <div className="trader-hero-copy">
          <p className="eyebrow">Licensed trader</p>
          <h1>{displayName}</h1>
          {trader.discord_display_name && <p className="trader-handle">Discord · {trader.discord_display_name}</p>}
          <div className="trader-meta"><span>{trader.rank || "Rookie Trader"}</span><span>{formatCount(trader.xp)} XP</span><span>Joined {formatDateTime(trader.created_at)}</span></div>
        </div>
        <div className="trader-hero-action">
          {isOwnProfile ? <Link className="secondary-action" to="/profile">Edit my profile</Link> : directOffersEnabled ? <button className="primary-action" onClick={openDirectOffer} type="button">Send trade offer</button> : <button className="secondary-action" disabled type="button">Direct offers paused</button>}
          <span>{isOwnProfile ? "Manage your public trading availability in Settings." : directOffersEnabled ? "Private offers go directly to this trader." : "This trader is not accepting profile-based offers right now."}</span>
        </div>
      </section>

      <section className="trader-profile-stats" aria-label={`${displayName}'s public trading summary`}>
        <article><span>Completed trades</span><strong>{formatCount(traderStats?.completed_trade_count)}</strong><small>Confirmed in-game exchanges</small></article>
        <article><span>Collection</span><strong>{canViewCollection ? formatCount(traderStats?.collection_count) : "Private"}</strong><small>{collectionIsPublic ? "Champion copies shared publicly" : isOwnProfile ? "Private to other traders" : "This trader keeps it private"}</small></article>
        <article><span>Active listings</span><strong>{formatCount(traderStats?.active_listing_count ?? listings.length)}</strong><small>Available on Shelf</small></article>
      </section>

      <section className="page-heading profile-listings-heading">
        <p className="eyebrow">Public Shelf</p>
        <h2>{isOwnProfile ? "Your active listings" : `${displayName}'s active listings`}</h2>
        <p>Only champions this trader chose to list are visible here. Collection visibility is managed separately.</p>
      </section>

      {successMessage && <p className="form-success" role="status">{successMessage}</p>}

      {listings.length === 0 ? (
        <section className="empty-state">
          <span className="empty-state-icon">⌁</span>
          <h2>No public listings yet</h2>
          <p>{isOwnProfile ? "Add a champion to your Shelf when you are ready to receive marketplace offers." : directOffersEnabled ? "You can still send this trader an open direct offer from their profile." : "This trader has paused profile-based offers and does not have any public Shelf listings right now."}</p>
          {!isOwnProfile && directOffersEnabled && <button className="secondary-action" onClick={openDirectOffer} type="button">Send direct offer</button>}
        </section>
      ) : (
        <section className="marketplace-grid">
          {listings.map((listing) => {
            const traits = getChampionTraits(listing);
            return (
              <article className="marketplace-card" key={listing.id}>
                <div className="card-topline"><span className={`rarity-badge rarity-${listing.rarity.toLowerCase().replaceAll(" ", "-")}`}>{listing.rarity}</span><span className="listing-status listing-active">Live on Shelf</span></div>
                <span className="listing-code">Listing {getListingCode(listing.id)}</span>
                <ListingArtwork imageUrl={listing.image_url} name={listing.name} rarity={listing.rarity} trait={traits[0] || "Standard"} />
                <h2>{listing.name}</h2>
                <div className="traits card-traits">{traits.length ? traits.map((trait) => <span className="trait" key={trait}>✦ {trait}</span>) : <span className="trait">✦ Standard</span>}</div>
                <p className="market-value">◈ {getOwnedChampionValue(listing).toLocaleString()}</p>
                {listing.note && <p className="listing-note">“{listing.note}”</p>}
                {!isOwnProfile && <button className="primary-action card-action" onClick={() => openListingOffer(listing)} type="button">Make an offer</button>}
              </article>
            );
          })}
        </section>
      )}

      <section className="public-collection-heading">
        <div>
          <p className="eyebrow">Collection</p>
          <h2>{isOwnProfile ? "Your recorded champions" : `${displayName}'s recorded champions`}</h2>
          <p>{canViewCollection ? "Champion copies recorded in Lumio, including their trait and current calculated value." : "This trader has chosen not to share their recorded champions publicly."}</p>
        </div>
        <span className={`collection-visibility-badge${collectionIsPublic ? " is-public" : " is-private"}`}>{collectionIsPublic ? "Public Collection" : isOwnProfile ? "Private to others" : "Private Collection"}</span>
      </section>

      {!canViewCollection ? (
        <section className="collection-privacy-panel">
          <span className="collection-privacy-icon" aria-hidden="true">⌾</span>
          <div><h3>Collection is private</h3><p>{displayName} has kept their recorded champion copies private. Their live Shelf listings remain available above.</p></div>
        </section>
      ) : publicCollection.length === 0 ? (
        <section className="collection-privacy-panel">
          <span className="collection-privacy-icon" aria-hidden="true">⌁</span>
          <div><h3>No champions recorded yet</h3><p>{isOwnProfile ? "Add champions in Collection to build the inventory other traders can see when you make it public." : "This trader has not recorded any champion copies yet."}</p></div>
        </section>
      ) : (
        <section className="public-collection-grid">
          {publicCollection.map((champion) => {
            const traits = getChampionTraits(champion);
            const rarity = champion.rarity || "AFS Champion";
            return (
              <article className="public-collection-card" key={champion.id}>
                <div className="card-topline"><span className={`rarity-badge rarity-${rarity.toLowerCase().replaceAll(" ", "-")}`}>{rarity}</span><span className="collection-copy-label">Collection copy</span></div>
                <ListingArtwork imageUrl={champion.image_url} name={champion.name} rarity={rarity} trait={traits[0] || "Standard"} />
                <h3>{champion.name}</h3>
                <div className="traits card-traits">{traits.length ? traits.map((trait) => <span className="trait" key={trait}>✦ {trait}</span>) : <span className="trait">✦ Standard</span>}</div>
                <p className="market-value">◈ {getOwnedChampionValue(champion).toLocaleString()}</p>
              </article>
            );
          })}
        </section>
      )}

      {offerTarget && <OfferComposer onClose={() => setOfferTarget(null)} onSent={(code) => { setOfferTarget(null); setSuccessMessage(`Offer ${code ? `#${code}` : "sent"} is now in ${displayName}'s Received Trades.`); }} target={offerTarget} />}
    </Layout>
  );
}

export default TraderProfile;
