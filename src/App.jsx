import { Navigate, Routes, Route } from "react-router-dom";

import Champion from "./pages/Champion";
import GlobalAds from "./components/GlobalAds";

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
import License from "./pages/License";

import useAuth from "./context/useAuth";
import PendingTrades from "./pages/PendingTrades";
import Shelf from "./pages/Shelf";
import ReceivedTrades from "./pages/ReceivedTrades";
import TraderProfile from "./pages/TraderProfile";
import { isTradingLicensed } from "./utils/tradingLicense";

function TradingAccess({ children, profile }) {
  return isTradingLicensed(profile) ? children : <Navigate replace to="/license" />;
}

function App() {
  const { user, profile, loading } = useAuth();

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

        <Route path="/market" element={user ? <TradingAccess profile={profile}><Market /></TradingAccess> : <Landing />} />

        <Route path="/champion/:id" element={user ? <Champion /> : <Landing />} />

        <Route path="/trades" element={user ? <TradingAccess profile={profile}><Trading /></TradingAccess> : <Landing />} />

        <Route path="/trading" element={user ? <TradingAccess profile={profile}><Navigate to="/trades" replace /></TradingAccess> : <Landing />} />

        <Route path="/history" element={user ? <TradingAccess profile={profile}><History /></TradingAccess> : <Landing />} />

        <Route path="/collection" element={user ? <TradingAccess profile={profile}><Collection /></TradingAccess> : <Landing />} />

        <Route path="/shelf" element={user ? <TradingAccess profile={profile}><Shelf /></TradingAccess> : <Landing />} />

        <Route path="/received-trades" element={user ? <TradingAccess profile={profile}><ReceivedTrades /></TradingAccess> : <Landing />} />

        <Route path="/sent-trades" element={user ? <TradingAccess profile={profile}><PendingTrades /></TradingAccess> : <Landing />} />

        <Route path="/pending-trades" element={user ? <TradingAccess profile={profile}><Navigate to="/sent-trades" replace /></TradingAccess> : <Landing />} />

        <Route path="/profile" element={user ? <Profile /> : <Landing />} />

        <Route path="/trader/:traderId" element={user ? <TradingAccess profile={profile}><TraderProfile /></TradingAccess> : <Landing />} />

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

        <Route path="/license" element={user ? <License /> : <Landing />} />

        <Route path="/admin" element={user ? <Admin /> : <Landing />} />

        <Route path="*" element={<Navigate replace to={user ? "/dashboard" : "/"} />} />
      </Routes>
      <GlobalAds />
    </>
  );
}

export default App;
