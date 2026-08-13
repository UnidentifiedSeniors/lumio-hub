import { supabase } from "../lib/supabase";

// Maps a Supabase Auth user to a "profiles" row (creating if missing).
// Profile creation can be requested more than once during OAuth startup, so it is idempotent.
export default async function createProfile(user) {
  const userId = user.id;

  const { data: existingProfile, error: fetchError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (fetchError) {
    console.error("PROFILE FETCH ERROR:", fetchError.message);
    return null;
  }

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
  };

  const { error: createError } = await supabase
    .from("profiles")
    .upsert(newProfile, { onConflict: "id", ignoreDuplicates: true });

  if (createError) {
    console.error("PROFILE CREATION ERROR:", createError.message);
    return null;
  }

  const { data, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !data) {
    console.error("PROFILE READBACK ERROR:", profileError?.message || "No profile was returned");
    return null;
  }

  return { ...data, ...user.user_metadata };
}
