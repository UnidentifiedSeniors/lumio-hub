import { NavLink } from "react-router-dom";
import lumioLogo from "../assets/Lumio Logo.png";
import useAuth from "../context/useAuth";
import { isTradingLicensed } from "../utils/tradingLicense";

const traderNavigation = [
  { to: "/trades", label: "Market", icon: "trades" },
  { to: "/shelf", label: "Shelf", icon: "shelf" },
  { to: "/received-trades", label: "Received Trades", icon: "received" },
  { to: "/sent-trades", label: "Sent Trades", icon: "sent" },
  { to: "/history", label: "History", icon: "history" },
  { to: "/leaderboard", label: "Leaderboard", icon: "leaderboard" },
  { to: "/collection", label: "Collection", icon: "collection" },
];

function NavigationIcon({ name }) {
  const paths = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    trades: <><path d="M7 7h10" /><path d="m13 3 4 4-4 4" /><path d="M17 17H7" /><path d="m11 21-4-4 4-4" /></>,
    shelf: <><path d="M4 4h16v5H4z" /><path d="M4 13h16v7H4z" /><path d="M8 4v5" /><path d="M16 13v7" /></>,
    received: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></>,
    sent: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 3v5h5" /><path d="M12 7v5l3.2 2" /></>,
    leaderboard: <><path d="M7 21h10" /><path d="M8 18V9h8v9" /><path d="M5 18v-5h3" /><path d="M16 13h3v5" /><path d="M10 9V4h4v5" /></>,
    collection: <><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H20v15.5a.5.5 0 0 1-.5.5H6.5A2.5 2.5 0 0 1 4 17.5z" /><path d="M4 6.5v11" /><path d="M8 8h8" /><path d="M8 12h6" /></>,
    community: <><path d="M7.2 8.2A14.1 14.1 0 0 1 12 7c1.7 0 3.3.4 4.8 1.2L18 16.8c-1.2.9-2.5 1.4-3.8 1.7l-.8-1.1h-2.8l-.8 1.1c-1.3-.3-2.6-.8-3.8-1.7z" /><path d="M9.5 12h.01" /><path d="M14.5 12h.01" /><path d="M9 15.1c1.8.8 4.2.8 6 0" /></>,
    license: <><path d="M12 3 19 6v5c0 4.6-2.9 8.1-7 10-4.1-1.9-7-5.4-7-10V6z" /><path d="m9 12 2 2 4-4" /></>,
    admin: <><path d="M12 3 19 6v5c0 4.6-2.9 8.1-7 10-4.1-1.9-7-5.4-7-10V6z" /><path d="m9 12 2 2 4-4" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06-2.12 2.12-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V20h-3v-.08a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06-2.12-2.12.06-.06A1.65 1.65 0 0 0 7.2 15a1.65 1.65 0 0 0-1.51-1H5.6v-3h.08a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82L6.8 8.12 8.92 6l.06.06A1.65 1.65 0 0 0 10.8 6.4h.01a1.65 1.65 0 0 0 1-1.51V4.8h3v.08a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06 2.12 2.12-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H20.4v3h-.08a1.65 1.65 0 0 0-.92 1z" /></>,
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="nav-icon">
      {paths[name]}
    </svg>
  );
}

function Sidebar() {
  const { profile } = useAuth();
  const discordInviteUrl = import.meta.env.VITE_DISCORD_INVITE_URL?.trim();
  const showAdminLink = profile?.discord_username?.toLowerCase() === "bluerose2187";
  const licensed = isTradingLicensed(profile);

  return (
    <aside className="sidebar">
      <NavLink to="/dashboard" className="brand" aria-label="Lumio Hub dashboard">
        <img alt="" className="brand-mark brand-logo" src={lumioLogo} />
        <span>
          <strong>Lumio</strong>
          <small>Trading Hub</small>
        </span>
      </NavLink>

      <nav className="sidebar-nav" aria-label="Main navigation">
        <p className="nav-section-label">Workspace</p>
        <NavLink className={({ isActive }) => `nav-link${isActive ? " active" : ""}`} to="/dashboard"><NavigationIcon name="dashboard" /><span>Dashboard</span></NavLink>
        <NavLink className={({ isActive }) => `nav-link${isActive ? " active" : ""}`} to="/license"><NavigationIcon name="license" /><span>Trading License</span>{!licensed && <em className="nav-license-required">Required</em>}</NavLink>
        {licensed && traderNavigation.map((item) => (
          <NavLink
            className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
            key={item.to}
            to={item.to}
          >
            <NavigationIcon name={item.icon} />
            <span>{item.label}</span>
          </NavLink>
        ))}
        <NavLink className={({ isActive }) => `nav-link${isActive ? " active" : ""}`} to="/settings"><NavigationIcon name="settings" /><span>Settings</span></NavLink>
        {discordInviteUrl && (
          <a className="nav-link" href={discordInviteUrl} rel="noreferrer" target="_blank">
            <NavigationIcon name="community" />
            <span>Community</span>
          </a>
        )}
        {showAdminLink && <NavLink className={({ isActive }) => `nav-link${isActive ? " active" : ""}`} to="/admin"><NavigationIcon name="admin" /><span>Admin Console</span></NavLink>}
      </nav>

      <div className="sidebar-license">
        <span className="license-dot" />
        <span>
          <strong>{licensed ? "Licensed trader" : "License required"}</strong>
          <small>{licensed ? "Trading access active" : "Complete the onboarding test"}</small>
        </span>
      </div>
    </aside>
  );
}

export default Sidebar;
