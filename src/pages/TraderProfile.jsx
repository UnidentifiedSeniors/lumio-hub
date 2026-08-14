import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import Layout from "../components/Layout";
import OfferComposer from "../components/OfferComposer";
import useAuth from "../context/useAuth";
import { supabase } from "../lib/supabase";
import { formatDateTime, getChampionTraits, getOwnedChampionValue } from "../utils/marketplace";

function TraderProfile() {
  const { traderId } = useParams();
  const { user } = useAuth();
  const [trader, setTrader] = useState(null);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [offerTarget, setOfferTarget] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const loadProfile = useCallback(async () => {
    if (!traderId) return;
    setLoading(true);
    setError(null);

    const [profileResult, listingsResult] = await Promise.all([
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
    ]);

    if (profileResult.error || listingsResult.error) {
      setError(profileResult.error?.message || listingsResult.error?.message || "Unable to load this trader profile.");
    } else {
      setTrader(profileResult.data);
      setListings(listingsResult.data || []);
    }
    setLoading(false);
  }, [traderId]);

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

  const displayName = trader.discord_display_name || trader.discord_username || "Licensed trader";
  const isOwnProfile = user?.id === trader.id;
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
          <div className="trader-meta"><span>{trader.rank || "Rookie Trader"}</span><span>Joined {formatDateTime(trader.created_at)}</span></div>
        </div>
        <div className="trader-hero-action">
          {isOwnProfile ? <Link className="secondary-action" to="/profile">Edit my profile</Link> : <button className="primary-action" onClick={openDirectOffer} type="button">Send trade offer</button>}
          <span>Private offers go directly to this trader.</span>
        </div>
      </section>

      <section className="page-heading profile-listings-heading">
        <p className="eyebrow">Public Shelf</p>
        <h2>{isOwnProfile ? "Your active listings" : `${displayName}'s active listings`}</h2>
        <p>Only champions this trader chose to list are visible here. Their private Collection remains private.</p>
      </section>

      {successMessage && <p className="form-success" role="status">{successMessage}</p>}

      {listings.length === 0 ? (
        <section className="empty-state">
          <span className="empty-state-icon">⌁</span>
          <h2>No public listings yet</h2>
          <p>{isOwnProfile ? "Add a champion to your Shelf when you are ready to receive marketplace offers." : "You can still send this trader an open direct offer from their profile."}</p>
          {!isOwnProfile && <button className="secondary-action" onClick={openDirectOffer} type="button">Send direct offer</button>}
        </section>
      ) : (
        <section className="marketplace-grid">
          {listings.map((listing) => {
            const traits = getChampionTraits(listing);
            return (
              <article className="marketplace-card" key={listing.id}>
                <div className="card-topline"><span className={`rarity-badge rarity-${listing.rarity.toLowerCase().replaceAll(" ", "-")}`}>{listing.rarity}</span><span className="listing-status listing-active">Live on Shelf</span></div>
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

      {offerTarget && <OfferComposer onClose={() => setOfferTarget(null)} onSent={(code) => { setOfferTarget(null); setSuccessMessage(`Offer ${code ? `#${code}` : "sent"} is now in ${displayName}'s Received Trades.`); }} target={offerTarget} />}
    </Layout>
  );
}

export default TraderProfile;
