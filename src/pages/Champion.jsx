import { useParams, Link } from "react-router-dom";

import Layout from "../components/Layout";
import ListingArtwork from "../components/ListingArtwork";
import RarityBadge from "../components/RarityBadge";
import useCatalog from "../context/useCatalog";
import { getOfficialChampionValue } from "../utils/marketplace";

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
          <RarityBadge rarity={champion.rarity} />
          <h1>{champion.name}</h1>
          <p>Value ◈ {getOfficialChampionValue(champion).toLocaleString()} · record the copy you own, choose its trait, and keep trade discussions focused on the exact copy.</p>
        </div>
        <ListingArtwork imageUrl={champion.image_url} name={champion.name} trait="AFS champion" />
      </section>

      <section className="champion-catalog-layout">
        <article className="champion-stat-card">
          <div className="section-title-row">
            <div>
              <p className="eyebrow">Lumio value reference</p>
              <h2>◈ {getOfficialChampionValue(champion).toLocaleString()}</h2>
            </div>
          </div>
          <p className="modal-copy">Values consider {champion.clanPoints || 0} Clan Points trained, {champion.obtainment || "the champion’s obtainment difficulty"}, and a small amount of revised personal judgment. They guide fair discussion rather than guaranteeing a specific trade outcome.</p>
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
