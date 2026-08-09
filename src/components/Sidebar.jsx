import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function Sidebar() {
  const { profile } = useAuth();
  // Admin-only guard (basic — extend with real role checks later)
  const isAdmin = profile?.role === "admin";

  return (
    <aside className="sidebar">
      <h2>Lumio Hub</h2>

      <nav>
        <Link to="/dashboard">🏠 Dashboard</Link>
        <Link to="/trading">🤝 Trade Terminal</Link>
        <Link to="/pending-trades">⏳ Pending Trades</Link>
        <Link to="/history">📜 Trade History</Link>
        <Link to="/collection">🏆 Collection</Link>
        <Link to="/market">🌎 Market</Link>
        <Link to="/leaderboard">🏅 Leaderboard</Link>
        <Link to="/profile">👤 Profile</Link>
        <Link to="/settings">⚙️ Settings</Link>
        {isAdmin && <Link to="/admin">🔒 Admin</Link>}
      </nav>
    </aside>
  );
}

export default Sidebar;
