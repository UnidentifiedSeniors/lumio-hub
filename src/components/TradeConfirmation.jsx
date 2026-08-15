function TradeConfirmation({
  selected,
  offer,
  onRemove,
  onConfirm,
  onCancel,
  tradeResult,
}) {
  return (
    <div className="modal-overlay">
      <div className="trade-modal">
        <h2>Confirm Trade</h2>

        <div className="modal-section">
          <h3>You Receive:</h3>
          <p><strong>{selected.name}</strong></p>
          <p>Trait: {selected.trait || "Standard"}</p>
        </div>

        <div className="modal-section">
          <h3>You Give:</h3>

          {offer.map((champion, index) => (
            <div key={index} className="offer-item">
              <strong>{champion.name}</strong>
              {champion.traits && champion.traits.length > 0 && (
                <span> ✨ {champion.traits.join(", ")}</span>
              )}
              {onRemove && (
                <button
                  onClick={() => onRemove(champion)}
                  style={{
                    float: "right",
                    fontSize: "11px",
                    padding: "2px 8px",
                    marginRight: "8px",
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>

        {tradeResult && (
          <p style={{ color: tradeResult.valid ? "#4caf50" : "#ff6b6b" }}>
            {tradeResult.valid ? "✅ " + tradeResult.message : "❌ " + tradeResult.message}
          </p>
        )}

        <div className="modal-buttons">
          <button onClick={onCancel}>Cancel</button>
          <button onClick={onConfirm} disabled={!tradeResult?.valid}>
            Confirm Trade
          </button>
        </div>
      </div>
    </div>
  );
}

export default TradeConfirmation;
