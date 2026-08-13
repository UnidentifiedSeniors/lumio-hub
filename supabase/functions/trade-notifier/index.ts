import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Emoji map for rarity tiers (keeps embeds color-coordinated)
const RARITY_EMOJI: Record<string, string> = {
  Common: "⚪",
  Uncommon: "🟢",
  Rare: "🔵",
  Epic: "🟣",
  Legendary: "🟡",
  Mythic: "🟠",
  Secret: "🟤",
  "Shiny Secret": "🤍",
  Exclusive: "🖤",
  Sovereign: "🔥",
};

const STATUS_EMOJI: Record<string, string> = {
  pending: "⏳ Pending Trade",
  accepted: "🤝 Trade Accepted",
  declined: "↩️ Trade Declined",
  completed: "✅ Completed Trade",
  cancelled: "❌ Cancelled Trade",
};

const STATUS_DESCRIPTION: Record<string, string> = {
  pending: "A new trade request has been created.",
  accepted: "This offer has been accepted. Coordinate the actual champion exchange inside Anime Fighting Simulator, then mark it completed in Lumio.",
  declined: "This offer was declined, or its Shelf listing was reserved for another trade.",
  completed: "The traders recorded their in-game champion exchange as completed.",
  cancelled: "This trade has been cancelled by the trader.",
};

const RARITY_COLOR: Record<string, number> = {
  Common: 0x95a5a6,
  Uncommon: 0x2ecc71,
  Rare: 0x3498db,
  Epic: 0x9b59b6,
  Legendary: 0xf1c40f,
  Mythic: 0xe67e22,
  Secret: 0x8e44ad,
  "Shiny Secret": 0xecf0f1,
  Exclusive: 0x1abc9c,
  Sovereign: 0xe74c3c,
};

function champLine(item: any): string {
  const rarity = item?.rarity || "Unknown";
  const emoji = RARITY_EMOJI[rarity] || "🔹";
  const traitStr = Array.isArray(item?.traits) && item.traits.length > 0
    ? "\n✨ " + item.traits.join(", ")
    : "";
  return emoji + " **" + (item?.name || "Unknown") + "**\n⭐ " + rarity + traitStr;
}

serve(async (req) => {
  try {
    const payload = await req.json();
    const trade = payload.record;
    const eventType = payload.type; // 'INSERT' or 'UPDATE'

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const webhookUrl = Deno.env.get("DISCORD_WEBHOOK")!;

    if (!webhookUrl) {
      throw new Error("Missing DISCORD_WEBHOOK secret");
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Profile lookup (display name + @username + avatar)
    const { data: profile } = await supabase
      .from("profiles")
      .select("discord_username, discord_display_name, discord_avatar")
      .eq("id", trade.sender_id)
      .single();

    const traderName = profile?.discord_display_name || "Unknown";
    const traderUsername = profile?.discord_username
      ? "@" + profile.discord_username
      : "Unknown";
    const trader = traderName + "\n" + traderUsername;

    // Requested champion block
    const requestedChampion = trade.requested_champion || {};
    const requestedName = requestedChampion.name || "Open direct offer";
    const requestedRarity = requestedChampion.rarity || "No specific champion requested";
    const requestedTraits = Array.isArray(requestedChampion.traits)
      ? requestedChampion.traits.join(", ")
      : "";
    const requestedValue = "🔥 " + requestedName + "\n⭐ " + requestedRarity +
      (requestedTraits ? "\n✨ " + requestedTraits : "");

    // Offered champions block
    const offered = Array.isArray(trade.offered_champions) ? trade.offered_champions : [];
    const offeredValue = offered.length > 0
      ? offered.map(champLine).join("\n\n")
      : "No items offered";

    const requestedRarityValue = RARITY_COLOR[requestedRarity] || 0x3498db;
    const embedColor = requestedRarityValue;

    const tradeCode = trade.trade_code
      ? "#" + trade.trade_code
      : (eventType === "INSERT" ? "Trade #" + (trade.id || "").slice(0, 8) : "—");

    // ---- INSERT : create a new Discord message ----
    if (eventType === "INSERT") {
      const message = {
        embeds: [
          {
            title: STATUS_EMOJI[trade.status || "pending"] || "⏳ Pending Trade",
            description: STATUS_DESCRIPTION[trade.status || "pending"],
            color: embedColor,
            thumbnail: profile?.discord_avatar
              ? { url: profile.discord_avatar }
              : undefined,
            fields: [
              { name: "👤 Trader", value: trader, inline: false },
              { name: "🎯 Requested Champion", value: requestedValue, inline: false },
              { name: "📦 Offering", value: offeredValue, inline: false },
              { name: "🆔 Trade Code", value: tradeCode, inline: true },
              {
                name: "⏳ Status",
                                value: trade.status || "Pending",
                inline: true,
              },
            ],
            timestamp: trade.created_at || new Date().toISOString(),
          },
        ],
      };

      const response = await fetch(webhookUrl + "?wait=true", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        throw new Error("Discord error: " + response.status);
      }

      // Capture the message id so we can edit it later (cancel / complete)
      const discordMsg = await response.json();
      const messageId = discordMsg?.id;

      if (messageId && trade.id) {
        await supabase
          .from("trades")
          .update({ discord_message_id: messageId })
          .eq("id", trade.id);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // ---- UPDATE : edit the existing Discord message ----
    if (eventType === "UPDATE") {
      const messageId = trade.discord_message_id;
      const prevRecord = payload.old_record || {};

      // Only re-notify if status actually changed
      if (prevRecord.status === trade.status) {
        return new Response(
          JSON.stringify({ success: true, skipped: "no status change" }),
          { headers: { "Content-Type": "application/json" } }
        );
      }

      if (!messageId) {
        throw new Error("Cannot update: missing discord_message_id for trade " + (trade.id || ""));
      }

      const editPayload = {
        embeds: [
          {
            title: STATUS_EMOJI[trade.status || "pending"] || "⏳ Pending Trade",
            description: STATUS_DESCRIPTION[trade.status || "pending"] || "This trade has been updated.",
            color: embedColor,
            thumbnail: profile?.discord_avatar
              ? { url: profile.discord_avatar }
              : undefined,
            fields: [
              { name: "👤 Trader", value: trader, inline: false },
              { name: "🎯 Requested Champion", value: requestedValue, inline: false },
              { name: "📦 Offering", value: offeredValue, inline: false },
              { name: "🆔 Trade Code", value: tradeCode, inline: true },
              {
                name: "⏳ Status",
                value: STATUS_EMOJI[trade.status || "pending"] || trade.status,
                inline: true,
              },
            ],
            timestamp: trade.created_at || new Date().toISOString(),
          },
        ],
      };

      // PATCH the message via webhook: {webhookUrl}/messages/{messageId}
      const editResponse = await fetch(webhookUrl + "/messages/" + messageId, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editPayload),
      });

      if (!editResponse.ok) {
        throw new Error("Discord edit error: " + editResponse.status);
      }

      return new Response(JSON.stringify({ success: true, edited: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Unknown event type
    return new Response(
      JSON.stringify({ success: true, skipped: "unknown event" }),
      { headers: { "Content-Type": "application/json" } }
    );

  } catch (error) {
    const err: any = error;
    console.error("Trade notifier error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
