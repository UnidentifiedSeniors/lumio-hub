import { supabase } from "../lib/supabase";

// Maps a Supabase Auth user to a "profiles" row (creating if missing).
// Returns { ...profile, trades_completed, badges, xp, rank } merged with auth metadata.
export default async function createProfile(user) {
  const userId = user.id;

  // 1. Check the DB profiles table
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (existingProfile) {
    return { ...existingProfile, ...user.user_metadata };
  }

  // 2. Create the profile row
  const newProfile = {
    id: userId,

    discord_id:
      user.user_metadata?.provider_id ||
      user.id,

    discord_username:
      user.user_metadata?.user_name ||
      user.user_metadata?.preferred_username ||
      user.user_metadata?.full_name ||
      user.email ||
      "trader",

    discord_display_name:
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      "Trader",

    discord_avatar:
      user.user_metadata?.avatar_url ||
      null,

    roblox_id: null,
    roblox_username: null,

    xp: 0,
    rank: "Rookie Trader",

    badges: [],
  };

  const { data, error } = await supabase
    .from("profiles")
    .insert(newProfile)
    .select()
    .single();

  if (error) {
    console.error("PROFILE CREATION ERROR:", error);
    return null;
  }

  return { ...data, ...user.user_metadata };
}
