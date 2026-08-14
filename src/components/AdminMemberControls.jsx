import { useMemo, useState } from "react";

import ConfirmDialog from "./ConfirmDialog";
import { supabase } from "../lib/supabase";
import { formatLumioDate } from "../utils/datePreferences";

function memberName(member) {
  return member?.lumio_display_name || member?.discord_display_name || member?.discord_username || "Licensed trader";
}

function auditSummary(event) {
  const details = event.details || {};

  if (event.action === "member_xp_adjusted") {
    const direction = Number(details.delta) >= 0 ? "awarded" : "removed";
    return `${Math.abs(Number(details.delta || 0)).toLocaleString()} XP ${direction} for ${details.member_name || "a member"}.`;
  }
  if (event.action === "market_listing_removed") return "A marketplace listing was removed.";
  if (event.action === "pending_trade_cancelled") return `Pending trade ${details.trade_code ? `#${details.trade_code}` : "offer"} cancelled by moderation.`;
  if (event.action === "campaign_created") return `Campaign “${details.title || details.slug || "Untitled"}” created.`;
  if (event.action === "campaign_updated") return `Campaign “${details.title || details.slug || "Untitled"}” updated.`;
  if (event.action === "campaign_deleted") return `Campaign “${details.title || details.slug || "Untitled"}” deleted.`;
  return "Administrator action recorded.";
}

function AdminMemberControls({ auditEvents, datePreferences, members, onUpdated }) {
  const [search, setSearch] = useState("");
  const [selectedMember, setSelectedMember] = useState(null);
  const [xpAmount, setXpAmount] = useState("100");
  const [reason, setReason] = useState("");
  const [pendingAdjustment, setPendingAdjustment] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const visibleMembers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return members.slice(0, 12);
    return members.filter((member) => [member.lumio_display_name, member.discord_display_name, member.discord_username, member.rank]
      .some((value) => String(value || "").toLowerCase().includes(query))).slice(0, 30);
  }, [members, search]);

  const selectMember = (member) => {
    setSelectedMember(member);
    setMessage(null);
  };

  const requestAdjustment = (direction) => {
    const amount = Number(xpAmount);
    if (!selectedMember || !Number.isInteger(amount) || amount < 1 || amount > 100000) {
      setMessage({ type: "error", text: "Enter a whole XP amount from 1 to 100,000." });
      return;
    }
    setPendingAdjustment({ member: selectedMember, delta: direction * amount });
  };

  const applyAdjustment = async () => {
    if (!pendingAdjustment) return;
    setBusy(true);
    const { error } = await supabase.rpc("admin_adjust_member_xp", {
      target_user_id: pendingAdjustment.member.id,
      xp_delta: pendingAdjustment.delta,
      adjustment_reason: reason.trim() || null,
    });
    if (error) {
      setMessage({ type: "error", text: error.message || "Unable to adjust member XP." });
    } else {
      const verb = pendingAdjustment.delta > 0 ? "awarded to" : "removed from";
      setMessage({ type: "success", text: `${Math.abs(pendingAdjustment.delta).toLocaleString()} XP ${verb} ${memberName(pendingAdjustment.member)}. Their rank was recalculated.` });
      setReason("");
      await onUpdated();
    }
    setBusy(false);
    setPendingAdjustment(null);
  };

  return (
    <section className="admin-panel admin-member-controls">
      <div className="admin-panel-heading">
        <div><p className="eyebrow">Member operations</p><h2>Progression controls</h2></div>
        <span className="admin-member-count">{members.length} members</span>
      </div>
      <p className="admin-panel-copy">Search licensed traders, review their trading activity, and correct XP with a clear audit record. Rank is recalculated automatically for Discord synchronization.</p>

      <div className="admin-member-layout">
        <div className="admin-member-directory">
          <label className="admin-member-search"><span>Find a trader</span><input onChange={(event) => setSearch(event.target.value)} placeholder="Display name, Discord name, or rank" type="search" value={search} /></label>
          <div className="admin-member-list">
            {visibleMembers.length ? visibleMembers.map((member) => <button aria-pressed={selectedMember?.id === member.id} key={member.id} onClick={() => selectMember(member)} type="button"><span className="admin-member-avatar">{memberName(member).charAt(0).toUpperCase()}</span><span><strong>{memberName(member)}</strong><small>{member.discord_username ? `@${member.discord_username}` : "Discord member"} · {member.rank || "Rookie Trader"}</small></span><em>{Number(member.xp || 0).toLocaleString()} XP</em></button>) : <p className="admin-empty-copy">No members match that search.</p>}
          </div>
        </div>

        <div className="admin-member-detail">
          {selectedMember ? <>
            <div className="admin-member-detail-heading"><span className="admin-member-avatar large">{memberName(selectedMember).charAt(0).toUpperCase()}</span><div><strong>{memberName(selectedMember)}</strong><span>{selectedMember.discord_username ? `@${selectedMember.discord_username}` : "Discord member"}</span></div></div>
            <div className="admin-member-stat-grid"><span><small>Rank</small><strong>{selectedMember.rank || "Rookie Trader"}</strong></span><span><small>XP</small><strong>{Number(selectedMember.xp || 0).toLocaleString()}</strong></span><span><small>Collection</small><strong>{Number(selectedMember.collection_count || 0).toLocaleString()}</strong></span><span><small>Completed</small><strong>{Number(selectedMember.completed_trade_count || 0).toLocaleString()}</strong></span></div>
            <div className="admin-xp-adjustment"><strong>Adjust progression</strong><label><span>XP amount</span><input max="100000" min="1" onChange={(event) => setXpAmount(event.target.value)} type="number" value={xpAmount} /></label><label><span>Reason <em>optional</em></span><input maxLength="300" onChange={(event) => setReason(event.target.value)} placeholder="Correction, reward, event…" value={reason} /></label><div><button className="success-action" onClick={() => requestAdjustment(1)} type="button">Award XP</button><button className="danger-action" onClick={() => requestAdjustment(-1)} type="button">Remove XP</button></div></div>
          </> : <div className="admin-member-empty"><strong>Select a trader</strong><p>Choose a member to inspect their current progression and make an audited XP correction.</p></div>}
          {message && <p className={message.type === "success" ? "inline-success" : "inline-error"} role={message.type === "success" ? "status" : "alert"}>{message.text}</p>}
        </div>
      </div>

      <div className="admin-audit-section"><div><p className="eyebrow">Audit trail</p><h3>Recent administrator activity</h3></div>{auditEvents.length ? <div className="admin-audit-list">{auditEvents.slice(0, 6).map((event) => <article key={event.id}><span>{auditSummary(event)}</span><time dateTime={event.created_at}>{formatLumioDate(event.created_at, datePreferences)}</time></article>)}</div> : <p className="admin-empty-copy">Administrator actions will be recorded here.</p>}</div>

      {pendingAdjustment && <ConfirmDialog busy={busy} cancelLabel="Keep XP unchanged" confirmLabel={pendingAdjustment.delta > 0 ? "Award XP" : "Remove XP"} danger={pendingAdjustment.delta < 0} description={`${pendingAdjustment.delta > 0 ? "Award" : "Remove"} ${Math.abs(pendingAdjustment.delta).toLocaleString()} XP ${pendingAdjustment.delta > 0 ? "to" : "from"} ${memberName(pendingAdjustment.member)}? Their Lumio rank will update automatically.`} onCancel={() => setPendingAdjustment(null)} onConfirm={() => void applyAdjustment()} title="Confirm XP adjustment" />}
    </section>
  );
}

export default AdminMemberControls;
