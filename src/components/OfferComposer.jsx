import { useCallback, useEffect, useState } from "react";

import ListingArtwork from "./ListingArtwork";
import useAuth from "../context/useAuth";
import { supabase } from "../lib/supabase";
import { getChampionTraits, getOwnedChampionValue, toTradeChampion } from "../utils/marketplace";

const OFFER_LIMIT = 4;

function OfferChampionChoice({ champion, kind, onSelect, selected }) {
  const rarity = champion.rarity || "AFS Champion";
  const traits = getChampionTraits(champion);
  const selectionLabel = kind === "request"
    ? (selected ? "Requested" : "Request")
    : (selected ? "Included" : "Add to offer");

  return (
    <button aria-pressed={selected} className={`offer-champion-choice ${kind}${selected ? " selected" : ""}`} onClick={onSelect} type="button">
      <span className="offer-choice-indicator">{selected ? "✓" : "+"}</span>
      <ListingArtwork imageUrl={champion.image_url} name={champion.name} rarity={rarity} trait={traits[0] || "Standard"} />
      <span className="offer-champion-choice-copy">
        <span className={`rarity-badge rarity-${rarity.toLowerCase().replaceAll(" ", "-")}`}>{rarity}</span>
        <strong>{champion.name}</strong>
        <small>{traits.length ? traits.join(" · ") : "Standard trait"}</small>
        <em>◈ {getOwnedChampionValue(champion).toLocaleString()}</em>
      </span>
      <span className="offer-choice-label">{selectionLabel}</span>
    </button>
  );
}

function OfferComposer({ target, onClose, onSent }) {
  const { user } = useAuth();
  const userId = user?.id;
  const isDirectOffer = !target.listingId && !target.requestedChampion;
  const [ownedChampions, setOwnedChampions] = useState([]);
  const [recipientChampions, setRecipientChampions] = useState([]);
  const [offerIds, setOfferIds] = useState([]);
  const [requestedChampionId, setRequestedChampionId] = useState(null);
  const [offerNote, setOfferNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const loadOfferableChampions = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const [ownedResult, recipientResult] = await Promise.all([
      supabase
        .from("user_champions")
        .select("*")
        .eq("owner_id", userId)
        .order("updated_at", { ascending: false }),
      isDirectOffer
        ? supabase
          .from("user_champions")
          .select("*")
          .eq("owner_id", target.recipientId)
          .order("updated_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (ownedResult.error || recipientResult.error) {
      setError(ownedResult.error?.message || recipientResult.error?.message || "Unable to load the Collections for this offer.");
    } else {
      setOwnedChampions(ownedResult.data || []);
      setRecipientChampions(recipientResult.data || []);
    }
    setLoading(false);
  }, [isDirectOffer, target.recipientId, userId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadOfferableChampions();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadOfferableChampions]);

  const selectedOffer = ownedChampions.filter((champion) => offerIds.includes(champion.id));
  const offerValue = selectedOffer.reduce((total, champion) => total + getOwnedChampionValue(champion), 0);
  const selectedRequestedChampion = isDirectOffer
    ? recipientChampions.find((champion) => champion.id === requestedChampionId) || null
    : target.requestedChampion || null;
  const requestedChampion = selectedRequestedChampion ? toTradeChampion(selectedRequestedChampion) : null;
  const canSubmit = selectedOffer.length > 0;

  const toggleChampion = (championId) => {
    setOfferIds((current) => {
      if (current.includes(championId)) return current.filter((id) => id !== championId);
      if (current.length >= OFFER_LIMIT) return current;
      return [...current, championId];
    });
  };

  const submitOffer = async () => {
    if (!user || !canSubmit) return;
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
        requested_value: selectedRequestedChampion ? getOwnedChampionValue(selectedRequestedChampion) : null,
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
      <section aria-modal="true" className="trade-modal offer-modal" role="dialog" aria-labelledby="offer-composer-title">
        <p className="eyebrow">Private offer</p>
        <h2 id="offer-composer-title">{target.title}</h2>

        {isDirectOffer ? (
          <p className="offer-flow-copy">Build a private offer from your Collection. If this trader shares theirs publicly, you can also choose one optional champion to request.</p>
        ) : (
          <div className="offer-target">
            <span>You are requesting</span>
            <strong>{target.summary}</strong>
          </div>
        )}

        {error && <p className="form-error" role="alert">{error}</p>}

        {loading ? (
          <p className="loading-copy">Loading Collections...</p>
        ) : (
          <>
            {isDirectOffer && (
              <section className="offer-builder-section request-section">
                <div className="offer-builder-heading">
                  <span className="offer-step" aria-hidden="true">1</span>
                  <div><h3>Choose what you&apos;re requesting</h3><p>Optionally select one public Collection copy from this trader.</p></div>
                  <strong>{selectedRequestedChampion ? "1 selected" : "Optional"}</strong>
                </div>
                {recipientChampions.length === 0 ? (
                  <div className="offer-builder-empty"><strong>Collection unavailable</strong><span>This trader&apos;s Collection is private or empty. You can still send a private offer without choosing a requested champion.</span></div>
                ) : (
                  <div className="offer-champion-grid" aria-label="Champions to request">
                    {recipientChampions.map((champion) => <OfferChampionChoice champion={champion} key={champion.id} kind="request" onSelect={() => setRequestedChampionId((current) => current === champion.id ? null : champion.id)} selected={requestedChampionId === champion.id} />)}
                  </div>
                )}
              </section>
            )}

            <section className="offer-builder-section offer-section">
              <div className="offer-builder-heading">
                <span className="offer-step" aria-hidden="true">{isDirectOffer ? "2" : "1"}</span>
                <div><h3>Choose your offer</h3><p>Select up to {OFFER_LIMIT} champion copies from your Collection.</p></div>
                <strong>{selectedOffer.length}/{OFFER_LIMIT} selected</strong>
              </div>
              {ownedChampions.length === 0 ? (
                <div className="offer-builder-empty"><strong>Your Collection is empty</strong><span>Add at least one champion to your Collection before sending an offer.</span></div>
              ) : (
                <div className="offer-champion-grid" aria-label="Champions to offer">
                  {ownedChampions.map((champion) => <OfferChampionChoice champion={champion} key={champion.id} kind="offer" onSelect={() => toggleChampion(champion.id)} selected={offerIds.includes(champion.id)} />)}
                </div>
              )}
              <div className="offer-total"><span>{selectedOffer.length} champion{selectedOffer.length === 1 ? "" : "s"} selected</span><strong>Offer total ◈ {offerValue.toLocaleString()}</strong></div>
            </section>

            <label className="offer-note-field" htmlFor="offer-note">
              <span>Offer note <small>Optional</small></span>
              <textarea id="offer-note" maxLength="280" onChange={(event) => setOfferNote(event.target.value)} placeholder="Add context for this trader, such as what kinds of offers you are open to." rows="3" value={offerNote} />
              <small>{offerNote.length}/280</small>
            </label>
          </>
        )}
        <div className="modal-buttons offer-modal-actions">
          <button className="cancel-action" disabled={submitting} onClick={onClose} type="button">Cancel</button>
          {!loading && <button className="success-action" disabled={!canSubmit || submitting} onClick={submitOffer} type="button">{submitting ? "Sending…" : "Send trade offer"}</button>}
        </div>
      </section>
    </div>
  );
}

export default OfferComposer;
