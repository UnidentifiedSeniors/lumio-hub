import { useParams, Link } from "react-router-dom";

import Layout from "../components/Layout";
import champions, { championStatLabels } from "../data/gameCatalog";
import { calculateChampionValue } from "../utils/valueCalculator";

function Champion() {
  const { id } = useParams();
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

  const catalogScore = calculateChampionValue(champion);

  return (
    <Layout>
      <section className="champion-catalog-hero">
        <div>
          <p className="eyebrow">AFS source catalog</p>
          <h1>{champion.name}</h1>
          <p>Base champion bonuses from the supplied game data. Choose a trait when you add an exact copy to your Collection.</p>
        </div>
        <span className="rarity-badge">{champion.rarity}</span>
      </section>

      <section className="champion-catalog-summary" aria-label={`${champion.name} summary`}>
        <article>
          <span>Combined stat bonus</span>
          <strong>+{champion.statTotal}%</strong>
        </article>
        <article>
          <span>Clan Points</span>
          <strong>{champion.clanPoints}</strong>
        </article>
        <article>
          <span>Lumio catalog score</span>
          <strong>◈ {catalogScore.toLocaleString()}</strong>
        </article>
      </section>

      <section className="champion-catalog-layout">
        <article className="champion-stat-card">
          <div className="section-title-row">
            <div>
              <p className="eyebrow">Base bonuses</p>
              <h2>Champion stats</h2>
            </div>
            <span>+{champion.statTotal}% total</span>
          </div>
          <dl className="champion-stat-grid">
            {Object.entries(champion.statBonuses).map(([stat, bonus]) => (
              <div key={stat}>
                <dt>{championStatLabels[stat]}</dt>
                <dd>{bonus > 0 ? `+${bonus}%` : "—"}</dd>
              </div>
            ))}
          </dl>
        </article>

        <aside className="champion-catalog-note">
          <p className="eyebrow">Traits</p>
          <h2>Applied per copy</h2>
          <p>Traits are a shared catalog, not fixed to one champion in the source data. Add the copy you own to select its actual trait and see its effect.</p>
          <Link className="primary-action" to="/collection">Add to Collection</Link>
        </aside>
      </section>

      <p className="champion-catalog-disclaimer">Lumio catalog scores are an in-app comparison aid based on the supplied bonuses and Clan Points. They are not a live market price.</p>
    </Layout>
  );
}

export default Champion;
