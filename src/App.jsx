import { Navigate, Routes, Route } from "react-router-dom";

import Champion from "./pages/Champion";
import DiscordCommunityPrompt from "./components/DiscordCommunityPrompt";

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

import useAuth from "./context/useAuth";
import PendingTrades from "./pages/PendingTrades";
import Shelf from "./pages/Shelf";
import ReceivedTrades from "./pages/ReceivedTrades";
import TraderProfile from "./pages/TraderProfile";

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
    <>
      <Routes>
        <Route path="/" element={user ? <Dashboard /> : <Landing />} />

        <Route path="/dashboard" element={user ? <Dashboard /> : <Landing />} />

        <Route path="/market" element={user ? <Market /> : <Landing />} />

        <Route path="/champion/:id" element={user ? <Champion /> : <Landing />} />

        <Route path="/trades" element={user ? <Trading /> : <Landing />} />

        <Route path="/trading" element={<Navigate to="/trades" replace />} />

        <Route path="/history" element={user ? <History /> : <Landing />} />

        <Route path="/collection" element={user ? <Collection /> : <Landing />} />

        <Route path="/shelf" element={user ? <Shelf /> : <Landing />} />

        <Route path="/received-trades" element={user ? <ReceivedTrades /> : <Landing />} />

        <Route path="/sent-trades" element={user ? <PendingTrades /> : <Landing />} />

        <Route path="/pending-trades" element={<Navigate to="/sent-trades" replace />} />

        <Route path="/profile" element={user ? <Profile /> : <Landing />} />

        <Route path="/trader/:traderId" element={user ? <TraderProfile /> : <Landing />} />

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

        <Route path="*" element={<Navigate replace to={user ? "/dashboard" : "/"} />} />
      </Routes>
      <DiscordCommunityPrompt />
    </>
  );
}

export default App;
