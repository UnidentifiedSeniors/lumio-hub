import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import useAuth from "../context/useAuth";

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
  const [search, setSearch] = useState("");
  const menuRef = useRef(null);
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
    };

    document.addEventListener("mousedown", closeMenu);
    return () => document.removeEventListener("mousedown", closeMenu);
  }, []);

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
        <button className="icon-button notification-button" type="button" aria-label="Notifications">
          <BellIcon />
          <span className="notification-dot" />
        </button>

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
