import { Link } from "react-router-dom";
import Layout from "../components/Layout";

function Shelf() {
  return (
    <Layout>
      <section className="page-heading page-heading-split">
        <div>
          <p className="eyebrow">Your public marketplace</p>
          <h1>Shelf</h1>
          <p>Manage the champions you have listed for other licensed traders.</p>
        </div>
        <Link className="primary-action" to="/collection">
          List a champion
        </Link>
      </section>

      <section className="empty-state shelf-empty-state">
        <span className="empty-state-icon">⌁</span>
        <h2>Your Shelf is waiting</h2>
        <p>
          Select a champion from your Collection to create a public listing. Active listings will be visible in Trades, while direct offers remain private.
        </p>
        <Link className="secondary-action" to="/collection">
          Open Collection
        </Link>
      </section>
    </Layout>
  );
}

export default Shelf;
