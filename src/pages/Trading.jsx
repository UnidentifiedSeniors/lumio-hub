import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import CollapsibleChampionArtwork from "../components/CollapsibleChampionArtwork";
import Layout from "../components/Layout";
import OfferComposer from "../components/OfferComposer";
import RarityBadge from "../components/RarityBadge";
import useAuth from "../context/useAuth";
import { supabase } from "../lib/supabase";
import { getDatePreferences } from "../utils/datePreferences";
import { formatDateTime, getChampionTraits, getListingCode, getOfficialChampionValue } from "../utils/marketplace";

const hiddenListingsKey = (userId) => `lumio-market-hidden-listings:${userId}`;
const blockedTradersKey = (userId) => `lumio-market-blocked-traders:${userId}`;

function getSavedIds(storageKey) {
  try {
    const saved = JSON.parse(window.localStorage.getItem(storageKey) || "[]");
    return Array.isArray(saved) ? saved.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function saveIds(storageKey, ids) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(ids));
  } catch {
    // Market safety controls still work for this visit if storage is unavailable.
  }
}

async function copyText(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const field = document.createElement("textarea");
  field.value = value;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.appendChild(field);
  field.select();
  document.execCommand("copy");
  field.remove();
}

function Trading() {
  const { user, profile } = useAuth();
  const datePreferences = getDatePreferences(profile);
  const [searchParams] = useSearchParams();
  const [listings, setListings] = useState([]);
  const [officialDrops, setOfficialDrops] = useState([]);
  const [ownedChampions, setOwnedChampions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [offerTarget, setOfferTarget] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [hiddenListingIds, setHiddenListingIds] = useState([]);
  const [blockedTraderIds, setBlockedTraderIds] = useState([]);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [reportTarget, setReportTarget] = useState(null);
  const [blockTarget, setBlockTarget] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const menuRef = useRef(null);
  const sharedListingId = searchParams.get("listing");
  const sharedDropId = searchParams.get("drop");
  const discordInviteUrl = import.meta.env.VITE_DISCORD_INVITE_URL?.trim();

  useEffect(() => {
    if (!user?.id) return undefined;
    const timer = window.setTimeout(() => {
      setHiddenListingIds(getSavedIds(hiddenListingsKey(user.id)));
      setBlockedTraderIds(getSavedIds(blockedTradersKey(user.id)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [user?.id]);

  useEffect(() => {
    if (!openMenuId) return undefined;

    const closeOnOutsidePress = (event) => {
      if (!menuRef.current?.contains(event.target)) setOpenMenuId(null);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpenMenuId(null);
    };

    window.addEventListener("pointerdown", closeOnOutsidePress, true);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeOnOutsidePress, true);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [openMenuId]);

  const loadMarketplace = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    const [listingsResult, officialDropsResult, ownedResult] = await Promise.all([
      supabase.from("marketplace_listings").select("*").order("created_at", { ascending: false }),
      supabase.from("official_marketplace_listings").select("*").order("is_featured", { ascending: false }).order("event_is_featured", { ascending: false }).order("display_order", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("user_champions").select("*").eq("owner_id", user.id).order("updated_at", { ascending: false }),
    ]);

    if (listingsResult.error || officialDropsResult.error || ownedResult.error) {
      setError(listingsResult.error?.message || officialDropsResult.error?.message || ownedResult.error?.message || "Unable to load the marketplace.");
    } else {
      setListings(listingsResult.data || []);
      setOfficialDrops(officialDropsResult.data || []);
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
      if (hiddenListingIds.includes(listing.id) || blockedTraderIds.includes(listing.owner_id)) return false;
      return !normalizedQuery || [listing.name, listing.rarity, listing.trait, listing.lumio_display_name, listing.discord_display_name, listing.discord_username]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedQuery));
    });
  }, [blockedTraderIds, hiddenListingIds, listings, search, user]);

  const hiddenListings = useMemo(
    () => listings.filter((listing) => hiddenListingIds.includes(listing.id)),
    [hiddenListingIds, listings],
  );

  const blockedTraders = useMemo(() => {
    const traders = new Map();
    listings.forEach((listing) => {
      if (blockedTraderIds.includes(listing.owner_id)) traders.set(listing.owner_id, listing);
    });
    return [...traders.values()];
  }, [blockedTraderIds, listings]);

  const visibleOfficialDrops = useMemo(() => {
    const normalizedQuery = search.trim().toLowerCase();
    if (!normalizedQuery) return officialDrops;
    return officialDrops.filter((drop) => [drop.name, drop.rarity, drop.trait, drop.badge_label, drop.event_title, drop.event_summary, drop.description]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(normalizedQuery)));
  }, [officialDrops, search]);

  useEffect(() => {
    if (!sharedListingId || loading || !visibleListings.some((listing) => listing.id === sharedListingId)) return;
    const listingCard = document.getElementById(`listing-${sharedListingId}`);
    listingCard?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [loading, sharedListingId, visibleListings]);

  useEffect(() => {
    if (!sharedDropId || loading || !visibleOfficialDrops.some((drop) => drop.id === sharedDropId)) return;
    const dropCard = document.getElementById(`official-drop-${sharedDropId}`);
    dropCard?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [loading, sharedDropId, visibleOfficialDrops]);

  const openOffer = (listing) => {
    setError(null);
    setSuccessMessage(null);
    setOfferTarget({
      recipientId: listing.owner_id,
      listingId: listing.id,
      requestedChampion: listing,
      title: `Offer for ${listing.name}`,
      summary: `${listing.name} · ◈ ${getOfficialChampionValue(listing).toLocaleString()} · ${listing.trait || "Standard"} trait`,
    });
  };

  const hideListing = (listing) => {
    const nextIds = [...new Set([...hiddenListingIds, listing.id])];
    setHiddenListingIds(nextIds);
    saveIds(hiddenListingsKey(user.id), nextIds);
    setOpenMenuId(null);
    setSuccessMessage(`${listing.name} will not be shown again on this device.`);
  };

  const blockTrader = () => {
    if (!blockTarget) return;
    const nextIds = [...new Set([...blockedTraderIds, blockTarget.owner_id])];
    setBlockedTraderIds(nextIds);
    saveIds(blockedTradersKey(user.id), nextIds);
    setBlockTarget(null);
    setSuccessMessage(`${blockTarget.lumio_display_name || blockTarget.discord_display_name || blockTarget.discord_username || "This trader"} is now hidden from your Market on this device.`);
  };

  const copyListingLink = async (listing) => {
    const link = new URL("/trades", window.location.origin);
    link.searchParams.set("listing", listing.id);

    try {
      await copyText(link.toString());
      setSuccessMessage("Listing link copied. Share it with a licensed Lumio trader.");
    } catch {
      setError("Unable to copy that link. Please try again.");
    }
    setOpenMenuId(null);
  };

  const copyReportReference = async () => {
    if (!reportTarget) return;
    const sellerName = reportTarget.lumio_display_name || reportTarget.discord_display_name || reportTarget.discord_username || "Unknown trader";
    const link = new URL("/trades", window.location.origin);
    link.searchParams.set("listing", reportTarget.id);
    const reportReference = [
      "Lumio Market listing report",
      `Listing: ${getListingCode(reportTarget.id)} · ${reportTarget.name} · ◈ ${getOfficialChampionValue(reportTarget).toLocaleString()}`,
      `Trader: ${sellerName}`,
      `Link: ${link.toString()}`,
      "Reason:",
    ].join("\n");

    try {
      await copyText(reportReference);
      setSuccessMessage("Report details copied. Paste them in the Lumio Discord with a short explanation.");
    } catch {
      setError("Unable to copy the report details. Please try again.");
    }
  };

  const restoreListing = (listingId) => {
    const nextIds = hiddenListingIds.filter((id) => id !== listingId);
    setHiddenListingIds(nextIds);
    saveIds(hiddenListingsKey(user.id), nextIds);
  };

  const unblockTrader = (traderId) => {
    const nextIds = blockedTraderIds.filter((id) => id !== traderId);
    setBlockedTraderIds(nextIds);
    saveIds(blockedTradersKey(user.id), nextIds);
  };

  const clearMarketFilters = () => {
    setHiddenListingIds([]);
    setBlockedTraderIds([]);
    saveIds(hiddenListingsKey(user.id), []);
    saveIds(blockedTradersKey(user.id), []);
    setFiltersOpen(false);
    setSuccessMessage("Market filters cleared. All available listings and traders are visible again.");
  };

  return (
    <Layout>
      <section className="page-heading page-heading-split">
        <div>
          <p className="eyebrow">Official drops & community listings</p>
          <h1>Market</h1>
          <p>Discover Lumio’s official releases, then browse champions licensed members have placed on Shelf for private offers.</p>
        </div>
        <label className="market-search">
          <span>Search</span>
          <input onChange={(event) => setSearch(event.target.value)} placeholder="Champion, trait, or trader" type="search" value={search} />
        </label>
      </section>

      <section className="marketplace-summary">
        <span><strong>{officialDrops.length}</strong> official drops</span>
        <span><strong>{listings.length}</strong> active community listings</span>
        <span><strong>{ownedChampions.length}</strong> champions ready to offer</span>
        <span>Offers are private until accepted</span>
        {(hiddenListingIds.length > 0 || blockedTraderIds.length > 0) && <button className="market-filter-control" onClick={() => setFiltersOpen(true)} type="button">Manage Market filters</button>}
      </section>

      <section className="official-value-guidance" aria-label="Lumio value guide">
        <span aria-hidden="true">◈</span>
        <p><strong>Lumio value guide.</strong> Values are set using the champion’s Clan Points trained, how difficult it is to obtain, and a small amount of revised personal judgment. They are a reference for fair discussion, not a guaranteed trade outcome.</p>
      </section>

      {error && <p className="form-error" role="alert">{error}</p>}
      {successMessage && <p className="form-success" role="status">{successMessage}</p>}

      {loading ? (
        <p className="loading-copy">Loading live listings...</p>
      ) : (
        <>
          {visibleOfficialDrops.length > 0 && <section className="official-market-section" aria-labelledby="official-drops-heading"><header className="official-market-heading"><div><p className="eyebrow">Lumio official</p><h2 id="official-drops-heading">Official Drops</h2><p>Rare releases and event opportunities curated by Lumio—not player-owned Shelf listings.</p></div><span>{visibleOfficialDrops.length} live</span></header><div className="official-market-grid">{visibleOfficialDrops.map((drop) => {
            const isSoldOut = drop.quantity_total !== null && Number(drop.quantity_remaining ?? drop.quantity_total) <= 0;
            const accent = drop.accent_color || drop.event_accent_color || "#777cff";
            const ctaIsExternal = drop.cta_url?.startsWith("http");
            return <article className={`official-drop-card${drop.is_featured || drop.event_is_featured ? " is-featured" : ""}${isSoldOut ? " is-sold-out" : ""}`} id={`official-drop-${drop.id}`} key={drop.id} style={{ "--official-accent": accent }}><div className="card-topline"><span className="official-drop-label">Lumio official</span><span className="listing-status official-drop-status">{isSoldOut ? "Allocated" : drop.badge_label}</span></div>{drop.event_title && <span className="official-event-name">{drop.event_title}</span>}<span className="listing-code">Official · {drop.slug.toUpperCase()}</span><CollapsibleChampionArtwork imageUrl={drop.image_url} name={drop.name} trait={drop.trait || "Standard"} /><h2>{drop.name}</h2><div className="traits card-traits"><span className="trait">✦ {drop.trait || "Standard"}</span></div>{drop.description && <p className="listing-note">{drop.description}</p>}{!drop.description && drop.event_summary && <p className="listing-note">{drop.event_summary}</p>}<div className="official-drop-details">{drop.quantity_total !== null && <span><strong>{Number(drop.quantity_remaining ?? drop.quantity_total).toLocaleString()}</strong> of {Number(drop.quantity_total).toLocaleString()} remaining</span>}{drop.availability_note && <span>{drop.availability_note}</span>}{drop.ends_at && <span>Ends {formatDateTime(drop.ends_at, datePreferences)}</span>}</div><div className="official-drop-footer"><span>{drop.reference_value > 0 ? `◈ ${Number(drop.reference_value).toLocaleString()} reference value` : "Official release"}</span>{drop.cta_url && !isSoldOut ? <a className="success-action" href={drop.cta_url} rel={ctaIsExternal ? "noreferrer" : undefined} target={ctaIsExternal ? "_blank" : undefined}>{drop.cta_label}</a> : <span className="official-drop-unavailable">{isSoldOut ? "All available copies allocated" : "Details coming soon"}</span>}</div></article>;
          })}</div></section>}

          <section className="community-market-section" aria-labelledby="community-listings-heading"><header className="community-market-heading"><div><p className="eyebrow">Trader marketplace</p><h2 id="community-listings-heading">Community listings</h2><p>Private offers stay between licensed traders until accepted.</p></div></header>{visibleListings.length === 0 ? <section className="empty-state marketplace-empty-state"><span className="empty-state-icon">⇄</span><h2>{listings.length ? "No community listings match that search" : officialDrops.length ? "No community listings yet" : "The marketplace is quiet right now"}</h2><p>{listings.length ? "Try a different champion, trait, or trader name." : "Create your own Shelf listing to be ready when other licensed traders arrive."}</p></section> : <section className="marketplace-grid">{visibleListings.map((listing) => {
            const traits = getChampionTraits(listing);
            const sellerName = listing.lumio_display_name || listing.discord_display_name || listing.discord_username || "Licensed trader";
            return <article className={`marketplace-card${sharedListingId === listing.id ? " shared-listing" : ""}`} id={`listing-${listing.id}`} key={listing.id}><div className="card-topline"><RarityBadge rarity={listing.rarity} /><span className="listing-status listing-active">Live on Shelf</span></div><span className="listing-code">Listing {getListingCode(listing.id)}</span><CollapsibleChampionArtwork imageUrl={listing.image_url} name={listing.name} trait={traits[0] || "Standard"} /><h2>{listing.name}</h2><div className="traits card-traits">{traits.length ? traits.map((trait) => <span className="trait" key={trait}>✦ {trait}</span>) : <span className="trait">✦ Standard</span>}</div><p className="market-value">Value · ◈ {getOfficialChampionValue(listing).toLocaleString()}</p>{listing.note && <p className="listing-note">“{listing.note}”</p>}<Link className="seller-row" to={`/trader/${listing.owner_id}`}>{listing.discord_avatar ? <img alt="" src={listing.discord_avatar} /> : <span>{sellerName.charAt(0).toUpperCase()}</span>}<div><small>Listed by</small><strong>{sellerName}</strong>{listing.discord_display_name && <em>Discord · {listing.discord_display_name}</em>}</div></Link><div className="listing-card-actions"><button className="primary-action" onClick={() => openOffer(listing)} type="button">Make an offer</button><div className="listing-menu-wrap" ref={openMenuId === listing.id ? menuRef : null}><button aria-controls={`listing-menu-${listing.id}`} aria-expanded={openMenuId === listing.id} aria-haspopup="menu" className="listing-menu-trigger" onClick={() => setOpenMenuId((current) => current === listing.id ? null : listing.id)} type="button"><span className="sr-only">More actions for {listing.name}</span><span aria-hidden="true">•••</span></button>{openMenuId === listing.id && <div className="listing-action-menu" id={`listing-menu-${listing.id}`} role="menu"><button onClick={() => hideListing(listing)} role="menuitem" type="button">Don&apos;t show again</button><button onClick={() => { setOpenMenuId(null); setReportTarget(listing); }} role="menuitem" type="button">Report listing</button><button onClick={() => { setOpenMenuId(null); setBlockTarget(listing); }} role="menuitem" type="button">Block trader</button><button onClick={() => void copyListingLink(listing)} role="menuitem" type="button">Copy listing link</button><Link onClick={() => setOpenMenuId(null)} role="menuitem" to={`/trader/${listing.owner_id}`}>View trader profile</Link></div>}</div></div></article>;
          })}</section>}</section>
        </>
      )}

      {offerTarget && <OfferComposer onClose={() => setOfferTarget(null)} onSent={(code) => { setOfferTarget(null); setSuccessMessage(`Offer ${code ? `#${code}` : "sent"} is now in the trader’s Received Trades.`); }} target={offerTarget} />}

      {reportTarget && (
        <div className="modal-overlay" role="presentation">
          <section aria-modal="true" className="trade-modal market-safety-modal" role="dialog">
            <p className="eyebrow">Market safety</p>
            <h2>Report this listing</h2>
            <p className="modal-copy">We&apos;ll copy the listing details and direct link. Paste them in the Lumio Discord with a short explanation so the team can review it.</p>
            <div className="form-value-preview"><span>Listing</span><strong>{reportTarget.name} · ◈ {getOfficialChampionValue(reportTarget).toLocaleString()}</strong></div>
            <div className="modal-buttons">
              <button className="secondary-action" onClick={() => setReportTarget(null)} type="button">Cancel</button>
              <button className="secondary-action" onClick={() => void copyReportReference()} type="button">Copy report details</button>
              {discordInviteUrl && <a className="primary-action" href={discordInviteUrl} rel="noreferrer" target="_blank">Open Lumio Discord</a>}
            </div>
          </section>
        </div>
      )}

      {blockTarget && (
        <div className="modal-overlay" role="presentation">
          <section aria-modal="true" className="trade-modal market-safety-modal" role="dialog">
            <p className="eyebrow">Market safety</p>
            <h2>Block this trader?</h2>
            <p className="modal-copy">Their active and future Market listings will be hidden in this browser. You can undo this anytime from Manage Market filters.</p>
            <div className="form-value-preview"><span>Trader</span><strong>{blockTarget.lumio_display_name || blockTarget.discord_display_name || blockTarget.discord_username || "Licensed trader"}</strong></div>
            <div className="modal-buttons">
              <button className="secondary-action" onClick={() => setBlockTarget(null)} type="button">Keep visible</button>
              <button className="danger-action" onClick={blockTrader} type="button">Block trader</button>
            </div>
          </section>
        </div>
      )}

      {filtersOpen && (
        <div className="modal-overlay" role="presentation">
          <section aria-modal="true" className="trade-modal market-safety-modal market-filters-modal" role="dialog">
            <p className="eyebrow">Market safety</p>
            <h2>Manage Market filters</h2>
            <p className="modal-copy">These controls are saved only in this browser, so they stay private to you.</p>
            <div className="market-filter-list">
              <div>
                <h3>Hidden listings</h3>
                {hiddenListings.length ? hiddenListings.map((listing) => <p key={listing.id}><span>{listing.name}</span><button onClick={() => restoreListing(listing.id)} type="button">Show again</button></p>) : <small>No hidden listings.</small>}
              </div>
              <div>
                <h3>Blocked traders</h3>
                {blockedTraders.length ? blockedTraders.map((listing) => <p key={listing.owner_id}><span>{listing.lumio_display_name || listing.discord_display_name || listing.discord_username || "Licensed trader"}</span><button onClick={() => unblockTrader(listing.owner_id)} type="button">Unblock</button></p>) : <small>No blocked traders.</small>}
              </div>
            </div>
            <div className="modal-buttons"><button className="secondary-action" onClick={clearMarketFilters} type="button">Clear all filters</button><button className="primary-action" onClick={() => setFiltersOpen(false)} type="button">Done</button></div>
          </section>
        </div>
      )}
    </Layout>
  );
}

export default Trading;
