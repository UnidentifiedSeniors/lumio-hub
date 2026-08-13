import { supabase } from "./supabase";

/**
 * Sends OAuth users back to the exact origin from which they started login.
 * Supabase must allow this origin in Authentication > URL Configuration.
 */
export function getAuthRedirectUrl() {
  return window.location.origin;
}

export function signInWithDiscord() {
  return supabase.auth.signInWithOAuth({
    provider: "discord",
    options: {
      redirectTo: getAuthRedirectUrl(),
    },
  });
}

export function signOut() {
  return supabase.auth.signOut();
}
