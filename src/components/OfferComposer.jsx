import { useCallback, useEffect, useState } from "react";

import useAuth from "../context/useAuth";
import { supabase } from "../lib/supabase";
import { getOwnedChampionValue, toTradeChampion } from "../utils/marketplace";

const OFFER_LIMIT = 4;

function OfferComposer({ target, onClose, onSent }) {
  const { user } = useAuth();
  const [ownedChampions, setOwnedChampions] = useState([]);
  const [offerIds, setOfferIds] = useState([]);
  const [offerNote, setOfferNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const loadOfferableChampions = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from("user_champions")
      .select("*")
      .eq("owner_id", user.id)
      .order("updated_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setOwnedChampions(data || []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadOfferableChampions();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadOfferableChampions]);

  const selectedOffer = ownedChampions.filter((champion) => offerIds.includes(champion.id));
  const offerValue = selectedOffer.reduce((total, champion) => total + getOwnedChampionValue(champion), 0);
  const requestedChampion = target.requestedChampion ? toTradeChampion(target.requestedChampion) : null;

  const toggleChampion = (championId) => {
    setOfferIds((current) => {
      if (current.includes(championId)) return current.filter((id) => id !== championId);
      if (current.length >= OFFER_LIMIT) return current;
      return [...current, championId];
    });
  };

  const submitOffer = async () => {
    if (!user || selectedOffer.length === 0) return;
    setSubmitting(true);
    setError(null);

    const { data, error: insertError } = await supabase
      .from("trades")
      .insert({
        sender_id: user.id,
        recipient_id: target.recipientId,
        listing_id: target.listingId || null,
        requested_champion: requestedChampion,
        requested_champions: requestedChampion ? [requestedChampion] : [],
        offered_champions: selectedOffer.map(toTradeChampion),
        offer_value: offerValue,
        requested_value: requestedChampion ? getOwnedChampionValue(target.requestedChampion) : null,
        offer_note: offerNote.trim() || null,
        status: "pending",
      })
      .select("trade_code")
      .single();

    if (insertError) {
      setError(insertError.message);
      setSubmitting(false);
      return;
    }

    onSent(data?.trade_code);
    setSubmitting(false);
  };

  return (
    <div className="modal-overlay" role="presentation">
      <section aria-modal="true" className="trade-modal offer-modal" role="dialog">
        <p className="eyebrow">Private offer</p>
        <h2>{target.title}</h2>
        <div className="offer-target">
          <span>{target.requestedChampion ? "You are requesting" : "You are opening a direct trade"}</span>
          <strong>{target.summary}</strong>
        </div>

        {error && <p className="form-error" role="alert">{error}</p>}

        {loading ? (
          <p className="loading-copy">Loading your Collection...</p>
        ) : ownedChampions.length === 0 ? (
          <p className="modal-copy">Add at least one champion to your Collection before sending an offer.</p>
        ) : (
          <>
            <p className="modal-copy">Choose up to {OFFER_LIMIT} champions from your Collection. The recipient will see each copy before accepting or declining.</p>
            <div className="offer-picker">
              {ownedChampions.map((champion) => {
                const selected = offerIds.includes(champion.id);
                return (
                  <button className={`offer-choice${selected ? " selected" : ""}`} key={champion.id} onClick={() => toggleChampion(champion.id)} type="button">
                    <span className="offer-choice-check">{selected ? "✓" : "+"}</span>
                    <span><strong>{champion.name}</strong><small>{champion.rarity} · {champion.trait || "Standard"}</small></span>
                    <em>◈ {getOwnedChampionValue(champion).toLocaleString()}</em>
                  </button>
                );
              })}
            </div>
            <div className="offer-total"><span>{selectedOffer.length} selected</span><strong>Offer total ◈ {offerValue.toLocaleString()}</strong></div>
            <label className="offer-note-field" htmlFor="offer-note">
              <span>Offer note <small>Optional</small></span>
              <textarea id="offer-note" maxLength="280" onChange={(event) => setOfferNote(event.target.value)} placeholder="Add context for this trader, such as what kinds of offers you are open to." rows="3" value={offerNote} />
              <small>{offerNote.length}/280</small>
            </label>
          </>
        )}
        <div className="modal-buttons">
          <button className="secondary-action" onClick={onClose} type="button">Cancel</button>
          {!loading && ownedChampions.length > 0 && <button className="primary-action" disabled={selectedOffer.length === 0 || submitting} onClick={submitOffer} type="button">{submitting ? "Sending…" : "Send trade offer"}</button>}
        </div>
      </section>
    </div>
  );
}

export default OfferComposer;
