import { useState } from "react";

import Layout from "../components/Layout";
import TradeCard from "../components/TradeCard";
import TradeConfirmation from "../components/TradeConfirmation";

import champions from "../data/champions";
import validateTrade from "../utils/tradeValidator";
import { calculateChampionValue, calculateTradeValue } from "../utils/valueCalculator";

import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

const OFFER_LIMIT = 8;

function Trading() {
  const { user, profile } = useAuth();

  const [selected, setSelected] = useState(null);
  const [offer, setOffer] = useState([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const addToOffer = (champion) => {
    if (champion.stock <= 0) return;
    if (selected?.id === champion.id) return;
    if (offer.some((item) => item.id === champion.id)) return;
    if (offer.length >= OFFER_LIMIT) return;
    setOffer([...offer, champion]);
  };

  const removeFromOffer = (champion) => {
    setOffer(offer.filter((c) => c.id !== champion.id));
  };

  const selectChampion = (champion) => {
    setSelected(champion);
    setOffer([]);
    setShowConfirm(false);
  };

  const resetTrade = () => {
    setSelected(null);
    setOffer([]);
    setShowConfirm(false);
    setSubmitting(false);
    setSubmitError(null);
  };

  // value calculator (replaces fixed champion.value)
  const offerValue = calculateTradeValue(offer);
  const requestedValue = selected ? calculateChampionValue(selected) : 0;
  const tradeResult = selected ? validateTrade(selected, offer) : null;

  const submitTrade = async () => {
    if (!tradeResult?.valid) return;
    if (!user) {
      console.error("User is not logged in");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    // Build lightweight champion payload objects { id, name, rarity, traits }
    const pick = (c) => ({
      id: c.id,
      name: c.name,
      rarity: c.rarity,
      traits: c.traits || [],
    });

    const trade = {
      sender_id: profile?.id || user.id,
      requested_champion: pick(selected),
      offered_champions: offer.map(pick),
      offer_value: offerValue,
      requested_value: requestedValue,
      status: "pending",
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("trades").insert(trade);

    if (error) {
      console.error(error);
      setSubmitError(error.message);
      setSubmitting(false);
      return;
    }

    // Trade saved -> DB trigger assigns a 4-digit trade_code.
    // Discord notification fires automatically via the edge function.
    resetTrade();
    setSubmitting(false);
  };

  return (
    <>
      {showConfirm && selected && (
        <TradeConfirmation
          selected={selected}
          offer={offer}
          onRemove={removeFromOffer}
          onConfirm={submitTrade}
          onCancel={() => setShowConfirm(false)}
          offerValue={offerValue}
          requestedValue={requestedValue}
          tradeResult={tradeResult}
        />
      )}

      <Layout>
        <h1>🤝 Trade Terminal</h1>

        {submitError && <p style={{ color: "#ff6b6b" }}>⚠️ {submitError}</p>}

        <div className="trade-container">
          <section className="trade-panel">
            <h2>Available Champions</h2>

            {champions
              .filter((champion) => champion.stock > 0)
              .map((champion) => (
                <TradeCard
                  key={champion.id}
                  champion={champion}
                  value={calculateChampionValue(champion)}
                  label={selected ? "Offer" : "Select"}
                  action={() =>
                    selected ? addToOffer(champion) : selectChampion(champion)
                  }
                />
              ))}
          </section>

          <section className="trade-panel">
            <h2>Your Trade</h2>

            {selected ? (
              <>
                <div className="wanted-box">
                  <h3>You Receive:</h3>

                  <p>{selected.name}</p>

                  <p>💎 {calculateChampionValue(selected)}</p>
                </div>

                <h3>Your Offer</h3>

                {offer.length === 0 ? (
                  <p>No champions added.</p>
                ) : (
                  offer.map((champion, index) => (
                    <div className="offer-item" key={index}>
                      {champion.name} ({champion.rarity}) — 💎{calculateChampionValue(champion)}
                      <button
                        className="remove-offer-btn"
                        onClick={() => removeFromOffer(champion)}
                        style={{ float: "right", fontSize: "12px", padding: "4px 10px" }}
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}

                <h2>Offer Value: 💎 {offerValue}</h2>

                {tradeResult && (
                  <h2 style={{ color: tradeResult.valid ? "#4caf50" : "#ff6b6b" }}>
                    {tradeResult.valid ? "✅ " + tradeResult.message : "❌ " + tradeResult.message}
                  </h2>
                )}

                {tradeResult?.valid && (
                  <button
                    onClick={() => setShowConfirm(true)}
                    disabled={submitting}
                  >
                    Confirm Offer
                  </button>
                )}

                <button onClick={resetTrade}>Cancel</button>
              </>
            ) : (
              <p>Choose a champion.</p>
            )}
          </section>
        </div>
      </Layout>
    </>
  );
}

export default Trading;
