import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import Layout from "../components/Layout";
import TradeDetailsModal from "../components/TradeDetailsModal";
import useAuth from "../context/useAuth";
import { supabase } from "../lib/supabase";
import { getDatePreferences } from "../utils/datePreferences";
import { formatDateTime } from "../utils/marketplace";

const ARCHIVED_STATUSES = ["completed", "declined", "cancelled"];

const STATUS_LABELS = {
  completed: "Completed",
  declined: "Declined",
  cancelled: "Withdrawn",
};

function requestedChampions(trade) {
  if (trade.requested_champions?.length) return trade.requested_champions;
  return trade.requested_champion ? [trade.requested_champion] : [];
}

function championSummary(champions, emptyCopy) {
  const names = champions.map((champion) => champion.name).filter(Boolean);
  if (!names.length) return emptyCopy;
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} · ${names[1]}`;
  return `${names[0]} · ${names[1]} +${names.length - 2}`;
}

function historyTitle(trade, counterpartName, isSender) {
  if (trade.status === "completed") return `Completed with ${counterpartName}`;
  if (trade.status === "declined") return isSender ? `${counterpartName} declined your offer` : `You declined ${counterpartName}'s offer`;
  return isSender ? `You withdrew your offer to ${counterpartName}` : `${counterpartName} withdrew their offer`;
}

function History() {
  const { user, profile } = useAuth();
  const datePreferences = getDatePreferences(profile);
  const [trades, setTrades] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");
  const [detailsTrade, setDetailsTrade] = useState(null);

  useEffect(() => {
    if (!user) return undefined;

    let active = true;

    const loadHistory = async () => {
      setLoading(true);
      setError(null);

      const { data, error: tradeError } = await supabase
        .from("trades")
        .select("*")
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .in("status", ARCHIVED_STATUSES)
        .order("updated_at", { ascending: false });

      if (!active) return;
      if (tradeError) {
        setError(tradeError.message);
        setLoading(false);
        return;
      }

      const archivedTrades = data || [];
      const counterpartIds = [...new Set(archivedTrades.map((trade) => (
        trade.sender_id === user.id ? trade.recipient_id : trade.sender_id
      )).filter(Boolean))];

      if (counterpartIds.length) {
        const { data: profileData, error: profileError } = await supabase
          .from("public_profiles")
          .select("*")
          .in("id", counterpartIds);

        if (!active) return;
        if (profileError) setError(profileError.message);
        setProfiles(Object.fromEntries((profileData || []).map((profile) => [profile.id, profile])));
      } else {
        setProfiles({});
      }

      setTrades(archivedTrades);
      setLoading(false);
    };

    void loadHistory();

    return () => {
      active = false;
    };
  }, [user]);

  const visibleTrades = useMemo(() => (
    filter === "all"
      ? trades
      : filter === "completed_cancelled"
        ? trades.filter((trade) => ["completed", "cancelled"].includes(trade.status))
        : trades.filter((trade) => trade.status === filter)
  ), [filter, trades]);

  const completedCount = trades.filter((trade) => trade.status === "completed").length;
  const closedCount = trades.length - completedCount;
  const xpEarned = trades
    .filter((trade) => trade.status === "completed")
    .reduce((total, trade) => total + Number(trade.xp_awarded || 0), 0);

  return (
    <Layout>
      <section className="page-heading">
        <p className="eyebrow">Trading record</p>
        <h1>Trade History</h1>
        <p>Review completed exchanges and closed offers. Active negotiations remain in Sent Trades and Received Trades.</p>
      </section>

      <section aria-label="Trade history summary" className="history-overview">
        <article><span>Completed</span><strong>{completedCount}</strong><small>Confirmed in-game exchanges</small></article>
        <article><span>Closed offers</span><strong>{closedCount}</strong><small>Declined or withdrawn</small></article>
        <article><span>XP earned</span><strong>{xpEarned.toLocaleString()}</strong><small>From completed trades</small></article>
      </section>

      <section className="history-toolbar" aria-label="Trade history filters">
        <div>
          <p className="eyebrow">Archive</p>
          <h2>{visibleTrades.length} {visibleTrades.length === 1 ? "record" : "records"}</h2>
        </div>
        <div className="history-filters" role="group" aria-label="Filter trade history">
          {[{ key: "all", label: "All" }, { key: "completed", label: "Completed" }, { key: "cancelled", label: "Withdrawn" }, { key: "completed_cancelled", label: "Completed + withdrawn" }, { key: "declined", label: "Declined" }].map((option) => (
            <button aria-pressed={filter === option.key} className={filter === option.key ? "active" : ""} key={option.key} onClick={() => setFilter(option.key)} type="button">{option.label}</button>
          ))}
        </div>
      </section>

      {error && <p className="form-error" role="alert">{error}</p>}

      {loading ? (
        <p className="loading-copy">Loading trade history...</p>
      ) : visibleTrades.length === 0 ? (
        <section className="empty-state">
          <span className="empty-state-icon">◈</span>
          <h2>{trades.length ? "No matching records" : "No trade history yet"}</h2>
          <p>{trades.length ? "Try a different status to see the rest of your archive." : "Completed, declined, and withdrawn offers will stay here as a clear record of your trading activity."}</p>
          {!trades.length && <Link className="secondary-action" to="/trades">Browse Market</Link>}
        </section>
      ) : (
        <section className="history-list">
          {visibleTrades.map((trade) => {
            const isSender = trade.sender_id === user?.id;
            const counterpartId = isSender ? trade.recipient_id : trade.sender_id;
            const counterpart = profiles[counterpartId];
            const counterpartName = counterpart?.lumio_display_name || counterpart?.discord_display_name || counterpart?.discord_username || "a licensed trader";
            const requested = requestedChampions(trade);
            const offered = trade.offered_champions || [];
            const leftLabel = isSender ? "You requested" : "You listed";
            const rightLabel = isSender ? "You offered" : "They offered";
            const archivedAt = trade.status === "completed" ? trade.completed_at || trade.updated_at : trade.updated_at || trade.created_at;

            return (
              <article className="history-trade-card" key={trade.id}>
                <div className="history-trade-heading">
                  <div>
                    <span className="trade-code">{trade.trade_code ? `#${trade.trade_code}` : "Trade record"}</span>
                    <h2>{historyTitle(trade, counterpartName, isSender)}</h2>
                    {counterpartId && counterpart && <Link className="trade-participant" to={`/trader/${counterpartId}`}>View {counterpartName}'s profile</Link>}
                  </div>
                  <span className={`trade-status status-${trade.status}`}>{STATUS_LABELS[trade.status] || trade.status}</span>
                </div>

                <div className="history-trade-snapshot">
                  <div><span>{leftLabel}</span><strong>{championSummary(requested, "Open direct offer")}</strong></div>
                  <div><span>{rightLabel}</span><strong>{championSummary(offered, "No champions offered")}</strong></div>
                </div>

                <footer className="history-trade-footer">
                  <span>{trade.status === "completed" ? "Completed" : "Closed"} {formatDateTime(archivedAt, datePreferences)}{trade.status === "completed" && trade.xp_awarded ? ` · +${trade.xp_awarded} XP` : ""}</span>
                  <button className="secondary-action" onClick={() => setDetailsTrade(trade)} type="button">View details</button>
                </footer>
              </article>
            );
          })}
        </section>
      )}

      {detailsTrade && (() => {
        const isSender = detailsTrade.sender_id === user?.id;
        const counterpartId = isSender ? detailsTrade.recipient_id : detailsTrade.sender_id;
        const counterpart = profiles[counterpartId];
        const counterpartName = counterpart?.lumio_display_name || counterpart?.discord_display_name || counterpart?.discord_username;
        return <TradeDetailsModal
          counterpartName={counterpartName}
          leftChampions={requestedChampions(detailsTrade)}
          leftLabel={isSender ? "You requested" : "You listed"}
          onClose={() => setDetailsTrade(null)}
          rightChampions={detailsTrade.offered_champions || []}
          rightLabel={isSender ? "You offered" : "They offered"}
          trade={detailsTrade}
          datePreferences={datePreferences}
        />;
      })()}
    </Layout>
  );
}

export default History;
