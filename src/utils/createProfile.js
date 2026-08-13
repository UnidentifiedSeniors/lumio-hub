import { supabase } from "../lib/supabase";
import { getDiscordIdentity } from "./discordIdentity";

// Maps a Supabase Auth user to a "profiles" row (creating if missing).
// Profile creation can be requested more than once during OAuth startup, so it is idempotent.
export default async function createProfile(user) {
  const userId = user.id;
  const identity = getDiscordIdentity(user);

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
    const identityUpdate = {
      discord_id: identity.discordId,
      discord_username: identity.username,
      discord_display_name: identity.displayName,
      discord_avatar: identity.avatar,
    };
    const hasChanged = Object.entries(identityUpdate).some(
      ([field, value]) => value && existingProfile[field] !== value,
    );

    if (hasChanged) {
      const { data: refreshedProfile, error: updateError } = await supabase
        .from("profiles")
        .update(identityUpdate)
        .eq("id", userId)
        .select("*")
        .maybeSingle();

      if (!updateError && refreshedProfile) return refreshedProfile;
      if (updateError) console.error("PROFILE IDENTITY UPDATE ERROR:", updateError.message);
    }

    return existingProfile;
  }

  // 2. Create the profile row
  const newProfile = {
    id: userId,

    discord_id: identity.discordId,
    discord_username: identity.username,
    discord_display_name: identity.displayName,
    discord_avatar: identity.avatar,

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

  return data;
}
