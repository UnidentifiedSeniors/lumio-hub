import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { signInWithDiscord, signOut } from "../lib/auth";
import createProfile from "../utils/createProfile";
import AuthContext from "./auth-context";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  async function login() {
    setAuthError(null);
    setIsSigningIn(true);

    const { error } = await signInWithDiscord();

    if (error) {
      setAuthError(error.message);
      setIsSigningIn(false);
    }

    return { error };
  }

  async function logout() {
    const { error } = await signOut();

    if (error) {
      setAuthError(error.message);
    }

    return { error };
  }

  async function handleUser(sessionUser) {
    setUser(sessionUser);

    const userProfile = await createProfile(sessionUser);
    setProfile(userProfile);
  }

  async function refreshProfile() {
    if (!user) return null;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      setAuthError(error.message);
      return null;
    }

    setProfile(data);
    return data;
  }

  useEffect(() => {
    const setupAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        await handleUser(session.user);
      }

      setLoading(false);
    };

    setupAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await handleUser(session.user);
      } else {
        setUser(null);
        setProfile(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        login,
        logout,
        refreshProfile,
        authError,
        isSigningIn,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
