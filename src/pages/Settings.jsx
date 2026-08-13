import Layout from "../components/Layout";

function Settings() {
  return (
    <Layout>
      <section className="page-heading">
        <p className="eyebrow">Account preferences</p>
        <h1>Settings</h1>
        <p>Manage the connections and preferences that shape your trading experience.</p>
      </section>

      <section className="settings-grid">
        <article className="settings-card">
          <span className="settings-card-label">Connections</span>
          <h2>Discord</h2>
          <p>Your Discord account is used to verify your trader license and send trade updates.</p>
          <span className="connected-label">Connected</span>
        </article>
        <article className="settings-card">
          <span className="settings-card-label">Connections</span>
          <h2>Roblox</h2>
          <p>Connect your Roblox identity to make accepted trade coordination clearer.</p>
          <button className="secondary-action" type="button">Connect Roblox</button>
        </article>
        <article className="settings-card">
          <span className="settings-card-label">Trading</span>
          <h2>Offer notifications</h2>
          <p>Choose how Lumio Hub should alert you when your trade activity changes.</p>
          <span className="coming-soon-label">Preference controls next</span>
        </article>
      </section>
    </Layout>
  );
}

export default Settings;
