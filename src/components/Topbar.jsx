import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import useAuth from "../context/useAuth";
import { supabase } from "../lib/supabase";
import { getDatePreferences } from "../utils/datePreferences";
import { getDiscordIdentity } from "../utils/discordIdentity";
import NotificationList from "./NotificationList";

const EMPTY_SEARCH_RESULTS = {
  collection: [],
  official: [],
  market: [],
  traders: [],
  trades: [],
};

function matchesSearch(item, fields, query) {
  return fields.some((field) => String(item?.[field] || "").toLowerCase().includes(query));
}

function tradeMatchesSearch(trade, query) {
  const championNames = [
    ...(trade.requested_champions || []),
    ...(trade.requested_champion ? [trade.requested_champion] : []),
    ...(trade.offered_champions || []),
  ].map((champion) => [champion?.name, champion?.rarity, champion?.trait, ...(champion?.traits || [])].filter(Boolean).join(" "));

  return [trade.trade_code, trade.status, ...championNames]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(query));
}

function requestedTradeLabel(trade) {
  const requested = trade.requested_champions?.length
    ? trade.requested_champions
    : (trade.requested_champion ? [trade.requested_champion] : []);
  return requested.map((champion) => champion.name).filter(Boolean).join(" · ") || "Open direct offer";
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </svg>
  );
}

function Topbar() {
  const { user, profile, logout } = useAuth();
  const datePreferences = getDatePreferences(profile);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [searchResults, setSearchResults] = useState(EMPTY_SEARCH_RESULTS);
  const menuRef = useRef(null);
  const notificationsRef = useRef(null);
  const searchRef = useRef(null);
  const searchInputRef = useRef(null);
  const navigate = useNavigate();
  const discordIdentity = getDiscordIdentity(user);

  const displayName =
    profile?.lumio_display_name ||
    profile?.discord_display_name ||
    discordIdentity.displayName ||
    "Trader";
  const discordDisplayName = profile?.discord_display_name || discordIdentity.displayName || "Discord member";
  const avatar = profile?.discord_avatar || discordIdentity.avatar;
  const initial = displayName.charAt(0).toUpperCase();

  useEffect(() => {
    const closeMenu = (event) => {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false);
      if (!notificationsRef.current?.contains(event.target)) setNotificationsOpen(false);
      if (!searchRef.current?.contains(event.target)) setSearchOpen(false);
    };

    document.addEventListener("mousedown", closeMenu);
    return () => document.removeEventListener("mousedown", closeMenu);
  }, []);

  useEffect(() => {
    const handleShortcut = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
        searchInputRef.current?.focus();
      }
      if (event.key === "Escape") setSearchOpen(false);
    };

    document.addEventListener("keydown", handleShortcut);
    return () => document.removeEventListener("keydown", handleShortcut);
  }, []);

  const loadNotifications = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("notifications")
      .select("id, type, title, body, link_path, trade_id, created_at, read_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(8);

    if (!error) setNotifications(data || []);
  }, [user]);

  useEffect(() => {
    if (!user) {
      const clearNotifications = window.setTimeout(() => setNotifications([]), 0);
      return () => window.clearTimeout(clearNotifications);
    }

    const initialLoad = window.setTimeout(() => void loadNotifications(), 0);
    const interval = window.setInterval(() => void loadNotifications(), 60000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, [user, loadNotifications]);

  useEffect(() => {
    const query = search.trim().toLowerCase();
    let active = true;

    if (!user || query.length < 2) {
      const resetTimer = window.setTimeout(() => {
        if (!active) return;
        setSearchResults(EMPTY_SEARCH_RESULTS);
        setSearchLoading(false);
        setSearchError(null);
      }, 0);
      return () => {
        active = false;
        window.clearTimeout(resetTimer);
      };
    }

    const searchTimer = window.setTimeout(() => {
      const loadSearchResults = async () => {
        setSearchLoading(true);
        setSearchError(null);

        const [collectionResult, officialResult, marketResult, traderResult, tradeResult] = await Promise.all([
          supabase.from("user_champions").select("id, name, rarity, trait, updated_at").eq("owner_id", user.id).order("updated_at", { ascending: false }).limit(120),
          supabase.from("official_marketplace_listings").select("id, name, rarity, trait, badge_label, event_title, description, created_at").order("is_featured", { ascending: false }).order("display_order", { ascending: false }).limit(120),
          supabase.from("marketplace_listings").select("id, owner_id, name, rarity, trait, lumio_display_name, discord_display_name, discord_username, created_at").order("created_at", { ascending: false }).limit(120),
          supabase.from("public_profiles").select("id, lumio_display_name, discord_display_name, discord_username, rank, xp").order("xp", { ascending: false }).limit(120),
          supabase.from("trades").select("id, trade_code, status, sender_id, recipient_id, requested_champion, requested_champions, offered_champions, updated_at").or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`).order("updated_at", { ascending: false }).limit(120),
        ]);

        if (!active) return;

        const sourceError = [collectionResult, officialResult, marketResult, traderResult, tradeResult].find((result) => result.error)?.error;
        if (sourceError) setSearchError(sourceError.message || "Unable to search every Lumio area right now.");

        setSearchResults({
          collection: (collectionResult.data || []).filter((champion) => matchesSearch(champion, ["name", "rarity", "trait"], query)).slice(0, 3),
          official: (officialResult.data || []).filter((drop) => matchesSearch(drop, ["name", "rarity", "trait", "badge_label", "event_title", "description"], query)).slice(0, 3),
          market: (marketResult.data || []).filter((listing) => listing.owner_id !== user.id && matchesSearch(listing, ["name", "rarity", "trait", "lumio_display_name", "discord_display_name", "discord_username"], query)).slice(0, 3),
          traders: (traderResult.data || []).filter((trader) => trader.id !== user.id && matchesSearch(trader, ["lumio_display_name", "discord_display_name", "discord_username", "rank"], query)).slice(0, 3),
          trades: (tradeResult.data || []).filter((trade) => tradeMatchesSearch(trade, query)).slice(0, 3),
        });
        setSearchLoading(false);
      };

      void loadSearchResults();
    }, 180);

    return () => {
      active = false;
      window.clearTimeout(searchTimer);
    };
  }, [search, user]);

  const submitSearch = (event) => {
    event.preventDefault();
    const query = search.trim();
    if (query.length >= 2) {
      setSearchOpen(true);
      return;
    }
    navigate(query ? `/collection?search=${encodeURIComponent(query)}` : "/collection");
  };

  const openSearchResult = (path) => {
    setSearchOpen(false);
    setSearch("");
    navigate(path);
  };

  const handleSignOut = async () => {
    setMenuOpen(false);
    await logout();
    navigate("/");
  };

  const openNotifications = () => {
    setMenuOpen(false);
    setNotificationsOpen((open) => !open);
    void loadNotifications();
  };

  const openNotification = async (notification) => {
    setNotificationsOpen(false);

    if (!notification.read_at) {
      const readAt = new Date().toISOString();
      setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, read_at: readAt } : item));
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: readAt })
        .eq("id", notification.id);
      if (error) void loadNotifications();
    }

    navigate(notification.link_path || "/dashboard");
  };

  const markAllRead = async () => {
    if (!user) return;
    const readAt = new Date().toISOString();
    setNotifications((current) => current.map((item) => item.read_at ? item : { ...item, read_at: readAt }));
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: readAt })
      .eq("user_id", user.id)
      .is("read_at", null);
    if (error) void loadNotifications();
  };

  const unreadCount = notifications.filter((notification) => !notification.read_at).length;
  const hasSearchResults = Object.values(searchResults).some((results) => results.length > 0);

  return (
    <header className="topbar">
      <div className="topbar-search-wrap" ref={searchRef}>
        <form className="topbar-search" onSubmit={submitSearch}>
          <SearchIcon />
          <input
            aria-controls="global-search-results"
            aria-expanded={searchOpen}
            aria-label="Search Lumio Hub"
            onChange={(event) => { setSearch(event.target.value); setSearchOpen(true); }}
            onFocus={() => setSearchOpen(true)}
            placeholder="Search champions, drops, traders, and trades"
            ref={searchInputRef}
            type="search"
            value={search}
          />
          <kbd>⌘ K</kbd>
        </form>
        {searchOpen && (
          <section aria-label="Lumio search results" className="global-search-panel" id="global-search-results" role="dialog">
            {search.trim().length < 2 ? (
              <p className="global-search-empty">Type at least two characters to search your Collection, Official Drops, the Market, traders, and trade activity.</p>
            ) : searchLoading ? (
              <p className="global-search-empty">Searching Lumio...</p>
            ) : (
              <>
                {searchError && <p className="global-search-error" role="alert">{searchError}</p>}
                {hasSearchResults ? (
                  <div className="global-search-groups">
                    {searchResults.collection.length > 0 && <section className="global-search-group"><p>Your Collection</p>{searchResults.collection.map((champion) => <button className="global-search-result" key={champion.id} onClick={() => openSearchResult(`/collection?search=${encodeURIComponent(champion.name)}`)} type="button"><span className="global-search-result-kind">Collection</span><span><strong>{champion.name}</strong><small>{champion.rarity} · {champion.trait || "Standard"}</small></span></button>)}</section>}
                    {searchResults.official.length > 0 && <section className="global-search-group"><p>Official Drops</p>{searchResults.official.map((drop) => <button className="global-search-result" key={drop.id} onClick={() => openSearchResult(`/trades?drop=${drop.id}`)} type="button"><span className="global-search-result-kind">Official</span><span><strong>{drop.name}</strong><small>{drop.rarity} · {drop.trait || "Standard"}{drop.event_title ? ` · ${drop.event_title}` : ""}</small></span></button>)}</section>}
                    {searchResults.market.length > 0 && <section className="global-search-group"><p>Live Market</p>{searchResults.market.map((listing) => <button className="global-search-result" key={listing.id} onClick={() => openSearchResult(`/trades?listing=${listing.id}`)} type="button"><span className="global-search-result-kind">Market</span><span><strong>{listing.name}</strong><small>{listing.rarity} · {listing.trait || "Standard"} · {listing.lumio_display_name || listing.discord_display_name || listing.discord_username || "Licensed trader"}</small></span></button>)}</section>}
                    {searchResults.traders.length > 0 && <section className="global-search-group"><p>Traders</p>{searchResults.traders.map((trader) => { const name = trader.lumio_display_name || trader.discord_display_name || trader.discord_username || "Licensed trader"; return <button className="global-search-result" key={trader.id} onClick={() => openSearchResult(`/trader/${trader.id}`)} type="button"><span className="global-search-result-kind">Trader</span><span><strong>{name}</strong><small>{trader.rank || "Rookie Trader"} · {Number(trader.xp || 0).toLocaleString()} XP</small></span></button>; })}</section>}
                    {searchResults.trades.length > 0 && <section className="global-search-group"><p>Your Trade Activity</p>{searchResults.trades.map((trade) => { const isSender = trade.sender_id === user?.id; const path = ["pending", "accepted"].includes(trade.status) ? (isSender ? "/sent-trades" : "/received-trades") : "/history"; return <button className="global-search-result" key={trade.id} onClick={() => openSearchResult(path)} type="button"><span className="global-search-result-kind">Trade</span><span><strong>{trade.trade_code ? `#${trade.trade_code}` : "Trade offer"} · {trade.status}</strong><small>{requestedTradeLabel(trade)}</small></span></button>; })}</section>}
                  </div>
                ) : <p className="global-search-empty">No Lumio results match “{search.trim()}”.</p>}
                <div className="global-search-footer"><button onClick={() => openSearchResult(`/collection?search=${encodeURIComponent(search.trim())}`)} type="button">Open Collection search</button><span>Esc to close</span></div>
              </>
            )}
          </section>
        )}
      </div>

      <div className="topbar-actions">
        <div className="notification-menu" ref={notificationsRef}>
          <button aria-expanded={notificationsOpen} aria-haspopup="dialog" className="icon-button notification-button" onClick={openNotifications} type="button" aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}>
            <BellIcon />
            {unreadCount > 0 && <span className="notification-dot" />}
          </button>
          {notificationsOpen && (
            <section aria-label="Notifications" className="notification-dropdown" role="dialog">
              <div className="notification-dropdown-heading">
                <div><strong>Notifications</strong><span>{unreadCount ? `${unreadCount} unread` : "All caught up"}</span></div>
                {unreadCount > 0 && <button onClick={() => void markAllRead()} type="button">Mark all read</button>}
              </div>
              <NotificationList datePreferences={datePreferences} emptyCopy="Trade updates and offers will appear here." notifications={notifications} onOpen={openNotification} />
            </section>
          )}
        </div>

        <div className="account-menu" ref={menuRef}>
          <button
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="account-trigger"
            onClick={() => setMenuOpen((open) => !open)}
            type="button"
          >
            {avatar ? (
              <img src={avatar} alt="" className="account-avatar" />
            ) : (
              <span className="account-avatar avatar-fallback">{initial}</span>
            )}
            <span className="account-trigger-copy">
              <strong>{displayName}</strong>
              <small>Discord · {discordDisplayName}</small>
            </span>
            <svg viewBox="0 0 24 24" aria-hidden="true" className="chevron-icon">
              <path d="m7 10 5 5 5-5" />
            </svg>
          </button>

          {menuOpen && (
            <div className="account-dropdown" role="menu">
              <div className="account-menu-header">
                <strong>{displayName}</strong>
                <span>Discord · {discordDisplayName}</span>
              </div>
              <Link onClick={() => setMenuOpen(false)} role="menuitem" to="/profile">
                My Profile
              </Link>
              <Link onClick={() => setMenuOpen(false)} role="menuitem" to="/settings">
                Settings
              </Link>
              <button onClick={handleSignOut} role="menuitem" type="button">
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default Topbar;
