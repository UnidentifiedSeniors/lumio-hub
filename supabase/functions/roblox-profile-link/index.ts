import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";

const ROBLOX_USERNAME_LOOKUP = "https://users.roblox.com/v1/usernames/users";

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
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(request) });
}

async function currentUser(request: Request) {
  const authorization = request.headers.get("Authorization");
  if (!authorization) throw new Error("Missing authorization");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authorization } } },
  );
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Invalid user session");

  return { supabase, user: data.user };
}

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(request) });
  }
  if (request.method !== "POST") {
    return jsonResponse(request, { error: "Method not allowed" }, 405);
  }

  try {
    const payload = await request.json().catch(() => ({})) as { action?: string; username?: unknown };
    const { supabase, user } = await currentUser(request);

    if (payload.action === "unlink") {
      const { error } = await supabase
        .from("profiles")
        .update({ roblox_id: null, roblox_username: null })
        .eq("id", user.id);
      if (error) throw new Error(error.message);

      return jsonResponse(request, { unlinked: true });
    }

    const username = typeof payload.username === "string" ? payload.username.trim() : "";
    if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
      return jsonResponse(request, { error: "Enter a valid Roblox username (3–20 letters, numbers, or underscores)." }, 400);
    }

    const lookupResponse = await fetch(ROBLOX_USERNAME_LOOKUP, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
      signal: AbortSignal.timeout(7000),
    });
    if (lookupResponse.status === 429) {
      return jsonResponse(request, { error: "Roblox is rate-limiting lookups. Try again in a moment." }, 429);
    }
    if (!lookupResponse.ok) {
      throw new Error("Roblox could not look up that username right now");
    }

    const lookup = await lookupResponse.json();
    const robloxUser = lookup?.data?.[0];
    if (!robloxUser?.id || !robloxUser?.name) {
      return jsonResponse(request, { error: "No Roblox account was found for that username." }, 404);
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ roblox_id: String(robloxUser.id), roblox_username: robloxUser.name })
      .eq("id", user.id);
    if (updateError) throw new Error(updateError.message);

    return jsonResponse(request, {
      linked: true,
      roblox: {
        id: String(robloxUser.id),
        username: robloxUser.name,
        displayName: robloxUser.displayName || robloxUser.name,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to link Roblox right now";
    console.error("Roblox profile link error:", message);
    return jsonResponse(request, { error: message }, 500);
  }
});
