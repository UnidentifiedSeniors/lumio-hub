export function hasTwoPartyConfirmation(trade) {
  return Object.hasOwn(trade || {}, "sender_confirmed_at")
    && Object.hasOwn(trade || {}, "recipient_confirmed_at");
}

function TradeCompletionConfirmation({ busy, counterpartName, currentUserId, onConfirm, trade }) {
  if (!hasTwoPartyConfirmation(trade)) return null;

  const isSender = currentUserId === trade.sender_id;
  const ownConfirmed = isSender ? Boolean(trade.sender_confirmed_at) : Boolean(trade.recipient_confirmed_at);
  const counterpartConfirmed = isSender ? Boolean(trade.recipient_confirmed_at) : Boolean(trade.sender_confirmed_at);
  const counterpartLabel = counterpartName || "Other trader";

  return (
    <section className="trade-coordination trade-confirmation">
      <span className="trade-confirmation-kicker">In-game exchange checkpoint</span>
      <strong>Both traders must confirm the exchange.</strong>
      <p>Complete the champion exchange in Anime Fighting Simulator first. Lumio marks the trade complete, awards XP, and updates Discord only after both confirmations.</p>
      <div className="trade-confirmation-progress">
        <span className={ownConfirmed ? "confirmed" : "waiting"}>You {ownConfirmed ? "confirmed" : "still need to confirm"}</span>
        <span className={counterpartConfirmed ? "confirmed" : "waiting"}>{counterpartLabel} {counterpartConfirmed ? "confirmed" : "is still reviewing"}</span>
      </div>
      {!ownConfirmed && <button className="primary-action" disabled={busy} onClick={() => onConfirm(trade)} type="button">{busy ? "Confirming…" : "Confirm my exchange"}</button>}
    </section>
  );
}

export default TradeCompletionConfirmation;
