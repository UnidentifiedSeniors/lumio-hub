import { Routes, Route } from "react-router-dom";

import Champion from "./pages/Champion";

import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Market from "./pages/Market";
import Trading from "./pages/Trading";
import History from "./pages/History";
import Collection from "./pages/Collection";

import Profile from "./pages/Profile";
import Missions from "./pages/Missions";
import Leaderboard from "./pages/Leaderboard";
import Competitions from "./pages/Competitions";
import Settings from "./pages/Settings";
import Admin from "./pages/Admin";

import { useAuth } from "./context/AuthContext";
import PendingTrades from "./pages/PendingTrades";

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={user ? <Dashboard /> : <Landing />} />

      <Route path="/dashboard" element={user ? <Dashboard /> : <Landing />} />

      <Route path="/market" element={user ? <Market /> : <Landing />} />

      <Route path="/champion/:id" element={user ? <Champion /> : <Landing />} />

      <Route path="/trading" element={user ? <Trading /> : <Landing />} />

      <Route path="/history" element={user ? <History /> : <Landing />} />

      <Route path="/collection" element={user ? <Collection /> : <Landing />} />

      <Route
        path="/pending-trades"
        element={user ? <PendingTrades /> : <Landing />}
      />

      <Route path="/profile" element={user ? <Profile /> : <Landing />} />

      <Route path="/missions" element={user ? <Missions /> : <Landing />} />

      <Route
        path="/leaderboard"
        element={user ? <Leaderboard /> : <Landing />}
      />

      <Route
        path="/competitions"
        element={user ? <Competitions /> : <Landing />}
      />

      <Route path="/settings" element={user ? <Settings /> : <Landing />} />

      <Route path="/admin" element={user ? <Admin /> : <Landing />} />
    </Routes>
  );
}

export default App;
