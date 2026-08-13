import Layout from "../components/Layout";

function ReceivedTrades() {
  return (
    <Layout>
      <section className="page-heading">
        <p className="eyebrow">Private offers</p>
        <h1>Received Trades</h1>
        <p>Review direct offers sent to you by other licensed traders.</p>
      </section>

      <section className="empty-state">
        <span className="empty-state-icon">↓</span>
        <h2>No incoming offers</h2>
        <p>
          When a trader chooses <strong>Send Trade Offer</strong> from your profile, their proposal will appear here with every requested and offered champion.
        </p>
      </section>
    </Layout>
  );
}

export default ReceivedTrades;
