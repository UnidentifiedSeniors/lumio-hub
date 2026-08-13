import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import useAuth from "../context/useAuth";
import { supabase } from "../lib/supabase";
import NotificationList from "./NotificationList";

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
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [search, setSearch] = useState("");
  const menuRef = useRef(null);
  const notificationsRef = useRef(null);
  const navigate = useNavigate();

  const displayName =
    profile?.discord_display_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    "Trader";
  const username = profile?.discord_username || user?.user_metadata?.user_name;
  const avatar = profile?.discord_avatar || user?.user_metadata?.avatar_url;
  const initial = displayName.charAt(0).toUpperCase();

  useEffect(() => {
    const closeMenu = (event) => {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false);
      if (!notificationsRef.current?.contains(event.target)) setNotificationsOpen(false);
    };

    document.addEventListener("mousedown", closeMenu);
    return () => document.removeEventListener("mousedown", closeMenu);
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

  const submitSearch = (event) => {
    event.preventDefault();
    const query = search.trim();
    navigate(query ? `/collection?search=${encodeURIComponent(query)}` : "/collection");
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

  return (
    <header className="topbar">
      <form className="topbar-search" onSubmit={submitSearch}>
        <SearchIcon />
        <input
          aria-label="Search Lumio Hub"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search champions, traders, and trades"
          type="search"
          value={search}
        />
        <kbd>⌘ K</kbd>
      </form>

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
              <NotificationList emptyCopy="Trade updates and offers will appear here." notifications={notifications} onOpen={openNotification} />
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
              {username && <small>@{username}</small>}
            </span>
            <svg viewBox="0 0 24 24" aria-hidden="true" className="chevron-icon">
              <path d="m7 10 5 5 5-5" />
            </svg>
          </button>

          {menuOpen && (
            <div className="account-dropdown" role="menu">
              <div className="account-menu-header">
                <strong>{displayName}</strong>
                {username && <span>@{username}</span>}
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
