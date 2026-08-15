import { useParams, Link } from "react-router-dom";

import Layout from "../components/Layout";
import ListingArtwork from "../components/ListingArtwork";
import useCatalog from "../context/useCatalog";

function Champion() {
  const { id } = useParams();
  const { champions } = useCatalog();
  const champion = champions.find((item) => item.id === Number(id));

  if (!champion) {
    return (
      <Layout>
        <section className="empty-state">
          <h1>Champion not found</h1>
          <p>That catalog entry is no longer available.</p>
          <Link className="secondary-action" to="/collection">Open Collection</Link>
        </section>
      </Layout>
    );
  }

  return (
    <Layout>
      <section className="champion-catalog-hero">
        <div>
          <p className="eyebrow">AFS source catalog</p>
          <h1>{champion.name}</h1>
          <p>Record the champion copy you own, choose its trait, and keep trade discussions focused on the exact copy.</p>
        </div>
        <ListingArtwork imageUrl={champion.image_url} name={champion.name} trait="AFS champion" />
      </section>

      <section className="champion-catalog-layout">
        <article className="champion-stat-card">
          <div className="section-title-row">
            <div>
              <p className="eyebrow">Champion identity</p>
              <h2>Trade the exact copy you own.</h2>
            </div>
          </div>
          <p className="modal-copy">Lumio uses the source catalog for champion names and artwork. Your chosen trait and trade terms identify the individual copy you are offering.</p>
        </article>

        <aside className="champion-catalog-note">
          <p className="eyebrow">Traits</p>
          <h2>Applied per copy</h2>
          <p>Traits are recorded per copy, not permanently attached to the catalog image. Choose the trait on the champion you actually own.</p>
          <Link className="primary-action" to="/collection">Add to Collection</Link>
        </aside>
      </section>
    </Layout>
  );
}

export default Champion;
