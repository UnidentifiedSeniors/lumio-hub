export const TRADE_OUTCOME_FILTERS = [
  { key: "all", label: "Default view" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
  { key: "completed_cancelled", label: "Completed + cancelled" },
];

export function filterTradeActivity(trades, outcomeFilter, { hideCancelled, hideCompleted }) {
  return (trades || []).filter((trade) => {
    if (outcomeFilter === "completed") return trade.status === "completed";
    if (outcomeFilter === "cancelled") return trade.status === "cancelled";
    if (outcomeFilter === "completed_cancelled") {
      return ["completed", "cancelled"].includes(trade.status);
    }

    return !(hideCompleted && trade.status === "completed")
      && !(hideCancelled && trade.status === "cancelled");
  });
}
