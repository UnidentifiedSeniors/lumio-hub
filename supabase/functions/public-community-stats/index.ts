import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";

function corsHeaders(request: Request) {
  const origin = request.headers.get("Origin");
  const allowedOrigin = origin === "https://lumiohub.app" || origin === "http://localhost:5173" || origin === "http://127.0.0.1:5173"
    ? origin
    : "https://lumiohub.app";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Cache-Control": "public, max-age=60, s-maxage=300",
    "Content-Type": "application/json",
    Vary: "Origin",
  };
}

function jsonResponse(request: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(request) });
}

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(request) });
  }
  if (request.method !== "GET") {
    return jsonResponse(request, { error: "Method not allowed" }, 405);
  }

  try {
    // This public endpoint exposes only aggregate marketplace activity. It uses
    // the service role on the server so visitors cannot read the underlying rows.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const [traders, listings, completedTrades] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("trading_license_status", "licensed"),
      supabase.from("shelf_listings").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("trades").select("id", { count: "exact", head: true }).eq("status", "completed"),
    ]);

    const error = traders.error || listings.error || completedTrades.error;
    if (error) throw new Error(error.message);

    return jsonResponse(request, {
      licensedTraders: traders.count ?? 0,
      liveListings: listings.count ?? 0,
      completedTrades: completedTrades.count ?? 0,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load public activity";
    console.error("Public community stats error:", message);
    return jsonResponse(request, { error: "Unable to load public activity" }, 500);
  }
});
