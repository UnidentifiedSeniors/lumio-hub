import LoginButton from "../components/LoginButton";

function Landing() {
  return (
    <div className="landing">
      <h1>Lumio Hub</h1>

      <p>The ultimate champion trading platform.</p>

      <div className="stats">
        <div className="stat-card">
          <h2>127</h2>
          <p>Champions Available</p>
        </div>

        <div className="stat-card">
          <h2>4,582</h2>
          <p>Active Traders</p>
        </div>

        <div className="stat-card">
          <h2>12,940</h2>
          <p>Trades Completed</p>
        </div>
      </div>

      <LoginButton />
    </div>
  );
}

export default Landing;
