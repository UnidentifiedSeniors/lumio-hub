import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

const STATUS_META: Record<string, { title: string; description: string }> = {
  pending: {
    title: "Pending trade",
    description: "A new offer is ready for review in Lumio Hub.",
  },
  accepted: {
    title: "Trade accepted",
    description: "The offer is reserved. Complete the actual champion exchange in Anime Fighting Simulator, then confirm it in Lumio.",
  },
  declined: {
    title: "Trade declined",
    description: "The recipient declined this offer. No champions were moved by Lumio Hub.",
  },
  completed: {
    title: "Trade completed",
    description: "The in-game champion exchange is confirmed and both traders received their trading XP.",
  },
  cancelled: {
    title: "Trade withdrawn",
    description: "The sender withdrew this pending offer before it was accepted.",
  },
};

type ChampionSnapshot = {
  name?: string;
  rarity?: string;
  trait?: string;
  traits?: string[];
  value?: number;
};

type TradeRecord = {
  id?: string;
  trade_code?: string;
  sender_id?: string;
  recipient_id?: string | null;
  requested_champion?: ChampionSnapshot | null;
  requested_champions?: ChampionSnapshot[] | null;
  offered_champions?: ChampionSnapshot[] | null;
  offer_value?: number | null;
  status?: string | null;
  xp_awarded?: number | null;
  created_at?: string | null;
  discord_message_id?: string | null;
  sender_confirmed_at?: string | null;
  recipient_confirmed_at?: string | null;
  admin_note?: string | null;
  admin_cancelled_at?: string | null;
};

type ProfileRecord = {
  id?: string;
  lumio_display_name?: string | null;
  discord_display_name?: string | null;
  discord_username?: string | null;
  discord_avatar?: string | null;
};

type WebhookPayload = {
  type?: "INSERT" | "UPDATE";
  record?: TradeRecord;
  old_record?: TradeRecord;
};

function truncate(value: string, limit = 1024) {
  return value.length <= limit ? value : `${value.slice(0, limit - 1)}…`;
}

function tradeChampions(trade: TradeRecord) {
  if (Array.isArray(trade.requested_champions) && trade.requested_champions.length) {
    return trade.requested_champions;
  }
  return trade.requested_champion ? [trade.requested_champion] : [];
}

function championLine(champion: ChampionSnapshot) {
  const rarity = champion.rarity || "Unknown rarity";
  const traits = Array.isArray(champion.traits) && champion.traits.length
    ? champion.traits
    : champion.trait && champion.trait !== "Standard"
      ? [champion.trait]
      : [];
  const value = Number(champion.value);
  const details = [rarity, traits.length ? traits.join(" · ") : "Standard"];
  if (Number.isFinite(value) && value > 0) details.push(`◈ ${Math.round(value).toLocaleString()}`);

  return `${RARITY_EMOJI[rarity] || "◆"} **${champion.name || "Unknown champion"}**\n${details.join(" · ")}`;
}

function championField(champions: ChampionSnapshot[], emptyCopy: string) {
  return truncate(champions.length ? champions.map(championLine).join("\n\n") : emptyCopy);
}

function traderIdentity(profile?: ProfileRecord) {
  const accountName = profile?.lumio_display_name || profile?.discord_display_name || "Licensed trader";
  const discordName = profile?.discord_display_name || "Discord member";
  const handle = profile?.discord_username ? `@${profile.discord_username}` : null;

  return truncate(discordName !== accountName || handle
    ? `**${accountName}**\nDiscord · ${discordName}${handle ? ` (${handle})` : ""}`
    : `**${accountName}**`);
}

function tradeCode(trade: TradeRecord) {
  return trade.trade_code ? `#${trade.trade_code}` : "Code pending";
}

function statusValue(trade: TradeRecord) {
  const status = trade.status || "pending";
  if (status !== "accepted" || (!Object.hasOwn(trade, "sender_confirmed_at") && !Object.hasOwn(trade, "recipient_confirmed_at"))) {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  const sender = trade.sender_confirmed_at ? "confirmed" : "waiting";
  const recipient = trade.recipient_confirmed_at ? "confirmed" : "waiting";
  return `Accepted · sender ${sender} · recipient ${recipient}`;
}

function buildEmbed(trade: TradeRecord, sender?: ProfileRecord, recipient?: ProfileRecord) {
  const requested = tradeChampions(trade);
  const offered = Array.isArray(trade.offered_champions) ? trade.offered_champions : [];
  const status = trade.status || "pending";
  const statusMeta = status === "cancelled" && trade.admin_cancelled_at
    ? {
      title: "Trade cancelled by Lumio",
      description: "A Lumio administrator closed this pending offer. No champions were moved and no XP was awarded.",
    }
    : STATUS_META[status] || {
      title: "Trade updated",
      description: "This Lumio trade was updated.",
    };
  const requestedRarity = requested[0]?.rarity;
  const progressionField = status === "completed" && trade.xp_awarded
    ? [{
      name: "Progression",
      value: `Both traders earned **${trade.xp_awarded} XP**.`,
      inline: false,
    }]
    : [];
  const resolutionField = trade.admin_cancelled_at
    ? [{
      name: "Resolution",
      value: truncate(trade.admin_note
        ? `Cancelled by Lumio moderation · ${trade.admin_note}`
        : "Cancelled by Lumio moderation."),
      inline: false,
    }]
    : [];

  return {
    embeds: [{
      title: statusMeta.title,
      description: statusMeta.description,
      color: RARITY_COLOR[requestedRarity || ""] || 0x6f72f1,
      thumbnail: sender?.discord_avatar ? { url: sender.discord_avatar } : undefined,
      fields: [
        { name: "Proposed by", value: traderIdentity(sender), inline: false },
        ...(recipient ? [{ name: "For", value: traderIdentity(recipient), inline: false }] : []),
        { name: "Requested champions", value: championField(requested, "Open direct offer — no specific champion requested."), inline: false },
        { name: "Offering", value: championField(offered, "No champions were included in this offer."), inline: false },
        { name: "Trade code", value: tradeCode(trade), inline: true },
        { name: "Status", value: statusValue(trade), inline: true },
        ...progressionField,
        ...resolutionField,
      ],
      footer: { text: "Lumio Hub · Trade coordination" },
      timestamp: trade.created_at || new Date().toISOString(),
    }],
  };
}

function requestUrl(webhookUrl: string, waitForMessage = false) {
  const url = new URL(webhookUrl);
  if (waitForMessage) url.searchParams.set("wait", "true");
  return url.toString();
}

async function sendDiscordMessage(webhookUrl: string, message: ReturnType<typeof buildEmbed>) {
  const response = await fetch(requestUrl(webhookUrl, true), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    const details = (await response.text()).slice(0, 240);
    throw new Error(`Discord create error (${response.status})${details ? `: ${details}` : ""}`);
  }

  return response.json();
}

async function editDiscordMessage(webhookUrl: string, messageId: string, message: ReturnType<typeof buildEmbed>) {
  const response = await fetch(`${webhookUrl.replace(/\/$/, "")}/messages/${messageId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message),
  });

  if (response.ok || response.status === 404) return response;

  const details = (await response.text()).slice(0, 240);
  throw new Error(`Discord edit error (${response.status})${details ? `: ${details}` : ""}`);
}

serve(async (request) => {
  try {
    const payload = await request.json() as WebhookPayload;
    const trade = payload.record;
    const eventType = payload.type;

    if (!trade?.sender_id) throw new Error("Trade webhook did not include a sender");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
    const webhookUrl = Deno.env.get("DISCORD_WEBHOOK")?.trim();
    if (!supabaseUrl || !serviceKey || !webhookUrl) throw new Error("Trade notifier secrets are not fully configured");

    const supabase = createClient(supabaseUrl, serviceKey);
    const profileIds = [...new Set([trade.sender_id, trade.recipient_id].filter((id): id is string => Boolean(id)))];
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .in("id", profileIds);

    if (profileError) throw new Error(`Unable to load trader profile: ${profileError.message}`);
    const sender = profiles?.find((profile) => profile.id === trade.sender_id) as ProfileRecord | undefined;
    const recipient = profiles?.find((profile) => profile.id === trade.recipient_id) as ProfileRecord | undefined;
    const message = buildEmbed(trade, sender, recipient);

    if (eventType === "INSERT") {
      const discordMessage = await sendDiscordMessage(webhookUrl, message);
      if (discordMessage?.id && trade.id) {
        const { error: updateError } = await supabase
          .from("trades")
          .update({ discord_message_id: discordMessage.id })
          .eq("id", trade.id);
        if (updateError) throw new Error(`Unable to store Discord message ID: ${updateError.message}`);
      }
      return new Response(JSON.stringify({ success: true, created: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (eventType === "UPDATE") {
      const statusChanged = payload.old_record?.status !== trade.status;
      const confirmationChanged = payload.old_record?.sender_confirmed_at !== trade.sender_confirmed_at
        || payload.old_record?.recipient_confirmed_at !== trade.recipient_confirmed_at;

      if (!statusChanged && !confirmationChanged) {
        return new Response(JSON.stringify({ success: true, skipped: "no trade lifecycle change" }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      const editResponse = trade.discord_message_id
        ? await editDiscordMessage(webhookUrl, trade.discord_message_id, message)
        : null;

      if (!editResponse || editResponse.status === 404) {
        const discordMessage = await sendDiscordMessage(webhookUrl, message);
        if (discordMessage?.id && trade.id) {
          const { error: updateError } = await supabase
            .from("trades")
            .update({ discord_message_id: discordMessage.id })
            .eq("id", trade.id);
          if (updateError) throw new Error(`Unable to store replacement Discord message ID: ${updateError.message}`);
        }
        return new Response(JSON.stringify({ success: true, recreated: true }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, edited: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, skipped: "unknown event" }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown trade notifier error";
    console.error("Trade notifier error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
