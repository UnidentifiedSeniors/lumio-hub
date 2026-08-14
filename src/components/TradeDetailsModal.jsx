import { getChampionTraits, getOwnedChampionValue, formatDateTime } from "../utils/marketplace";

function championValue(champion) {
  const snapshotValue = Number(champion?.value);
  return Number.isFinite(snapshotValue) ? Math.round(snapshotValue) : getOwnedChampionValue(champion);
}

export function TradeChampionList({ champions, emptyCopy }) {
  if (!champions?.length) return <p className="trade-champion-empty">{emptyCopy}</p>;

  return (
    <div className="trade-champion-list">
      {champions.map((champion, index) => {
        const traits = getChampionTraits(champion);
        return (
          <article className="trade-champion-row" key={`${champion.user_champion_id || champion.id || champion.name}-${index}`}>
            <div>
              <strong>{champion.name || "Unknown champion"}</strong>
              {champion.rarity && <span>{champion.rarity}</span>}
              <small>{traits.length ? traits.join(" · ") : "Standard"}</small>
            </div>
            <em>◈ {championValue(champion).toLocaleString()}</em>
          </article>
        );
      })}
    </div>
  );
}

function TradeDetailsModal({ trade, counterpartName, leftLabel, leftChampions, rightLabel, rightChampions, onClose, datePreferences }) {
  const tradeCode = trade.trade_code ? `#${trade.trade_code}` : "Trade details";

  return (
    <div className="modal-overlay" role="presentation">
      <section aria-modal="true" className="trade-modal trade-details-modal" role="dialog" aria-labelledby="trade-details-title">
        <p className="eyebrow">Private offer</p>
        <h2 id="trade-details-title">{tradeCode}</h2>
        <p className="modal-copy">A complete snapshot of this offer from {counterpartName || "a licensed trader"}.</p>

        <div className="trade-detail-meta">
          <div><span>Status</span><strong className={`trade-status status-${trade.status}`}>{trade.status}</strong></div>
          <div><span>Created</span><strong>{formatDateTime(trade.created_at, datePreferences, { forceTime: true })}</strong></div>
          <div><span>Offer value</span><strong>◈ {Number(trade.offer_value || 0).toLocaleString()}</strong></div>
        </div>

        {trade.offer_note && <section className="trade-note-preview"><span>Offer note</span><p>{trade.offer_note}</p></section>}

        <div className="trade-detail-groups">
          <section>
            <h3>{leftLabel}</h3>
            <TradeChampionList champions={leftChampions} emptyCopy="Open direct offer — no specific champion was requested." />
          </section>
          <section>
            <h3>{rightLabel}</h3>
            <TradeChampionList champions={rightChampions} emptyCopy="No champions were included in this offer." />
          </section>
        </div>

        <div className="modal-buttons"><button className="primary-action" onClick={onClose} type="button">Done</button></div>
      </section>
    </div>
  );
}

export default TradeDetailsModal;
