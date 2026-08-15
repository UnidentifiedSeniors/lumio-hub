import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";

const DISCORD_API = "https://discord.com/api/v10";
const SUPPORTED_RANKS = new Set([
  "Rookie Trader",
  "Beginner Trader",
  "Skilled Trader",
  "Advanced Trader",
  "Elite Trader",
  "Master Trader",
  "Lumio Legend",
]);

type ProfileRecord = {
  id: string;
  discord_id: string | null;
  rank: string | null;
  trading_license_status: string | null;
};

type RankRoleMap = Record<string, string>;

function corsHeaders(request: Request) {
  const origin = request.headers.get("Origin");
  const allowedOrigin = origin === "https://lumiohub.app" || origin === "http://localhost:5173"
    ? origin
    : "https://lumiohub.app";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    Vary: "Origin",
  };
}

function jsonResponse(request: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders(request),
  });
}

function getRequiredSecret(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing ${name} secret`);
  return value;
}

function getRankRoleMap(): RankRoleMap {
  const rawMap = getRequiredSecret("DISCORD_RANK_ROLE_IDS");

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawMap);
  } catch {
    throw new Error("DISCORD_RANK_ROLE_IDS must be valid JSON");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("DISCORD_RANK_ROLE_IDS must be a JSON object");
  }

  const map = parsed as RankRoleMap;
  for (const [rank, roleId] of Object.entries(map)) {
    if (!SUPPORTED_RANKS.has(rank) || !/^\d{16,22}$/.test(String(roleId))) {
      throw new Error("DISCORD_RANK_ROLE_IDS contains an unsupported rank or invalid role ID");
    }
  }

  return map;
}

async function discordRequest(path: string, method: "PUT" | "DELETE", botToken: string) {
  const response = await fetch(`${DISCORD_API}${path}`, {
    method,
    headers: {
      Authorization: `Bot ${botToken}`,
      "X-Audit-Log-Reason": "Lumio%20rank%20synchronization",
    },
  });

  if (!response.ok) {
    const details = (await response.text()).slice(0, 240);
    throw new Error(`Discord role request failed (${response.status})${details ? `: ${details}` : ""}`);
  }
}

async function syncRank(profile: ProfileRecord) {
  if (profile.trading_license_status !== "licensed") {
    throw new Error("Pass the Trading License assessment before synchronizing Discord roles");
  }

  if (!profile.discord_id) {
    throw new Error("This Lumio profile is missing a Discord user ID");
  }

  const rank = profile.rank || "Rookie Trader";
  if (!SUPPORTED_RANKS.has(rank)) {
    throw new Error(`Unsupported Lumio rank: ${rank}`);
  }

  const botToken = getRequiredSecret("DISCORD_BOT_TOKEN");
  const guildId = getRequiredSecret("DISCORD_GUILD_ID");
  const roleMap = getRankRoleMap();
  const targetRoleId = roleMap[rank];

  if (!targetRoleId) {
    throw new Error(`No Discord role ID is configured for ${rank}`);
  }

  // Add the target before removing the other Lumio-managed rank roles so a
  // member never loses their visible rank during a promotion.
  await discordRequest(
    `/guilds/${guildId}/members/${profile.discord_id}/roles/${targetRoleId}`,
    "PUT",
    botToken,
  );

  const oldRoleIds = [...new Set(Object.values(roleMap))].filter(
    (roleId) => roleId !== targetRoleId,
  );

  for (const roleId of oldRoleIds) {
    await discordRequest(
      `/guilds/${guildId}/members/${profile.discord_id}/roles/${roleId}`,
      "DELETE",
      botToken,
    );
  }

  return { rank, roleId: targetRoleId };
}

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(request) });
  }

  if (request.method !== "POST") {
    return jsonResponse(request, { error: "Method not allowed" }, 405);
  }

  try {
    const payload = await request.json().catch(() => ({}));
    const webhookRecord = payload?.table === "profiles" ? payload.record as ProfileRecord : null;
    const oldRecord = payload?.table === "profiles" ? payload.old_record as ProfileRecord | null : null;

    // Database Webhooks pass the changed profile. Re-sync only when its rank
    // changed; XP gains within the same rank do not call Discord unnecessarily.
    if (webhookRecord) {
      if (payload.type !== "UPDATE") {
        return jsonResponse(request, { skipped: "profile event is not an update" });
      }
      if (oldRecord?.rank === webhookRecord.rank && oldRecord?.trading_license_status === webhookRecord.trading_license_status) {
        return jsonResponse(request, { skipped: "rank is unchanged" });
      }

      const result = await syncRank(webhookRecord);
      return jsonResponse(request, { synced: true, source: "webhook", ...result });
    }

    // A signed-in member can manually reconcile their current role from
    // Settings—for example after joining the Discord server after a promotion.
    const authorization = request.headers.get("Authorization");
    if (!authorization) {
      return jsonResponse(request, { error: "Missing authorization" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authorization } } },
    );
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return jsonResponse({ error: "Invalid user session" }, 401);
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, discord_id, rank, trading_license_status")
      .eq("id", authData.user.id)
      .maybeSingle();
    if (profileError || !profile) {
      throw new Error(profileError?.message || "Lumio profile not found");
    }

    const result = await syncRank(profile);
    return jsonResponse(request, { synced: true, source: "manual", ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Discord rank sync error";
    console.error("Discord rank sync error:", message);
    return jsonResponse(request, { error: message }, 500);
  }
});
