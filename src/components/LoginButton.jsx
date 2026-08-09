import { supabase } from "../lib/supabase";

function LoginButton() {
  const login = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "discord",
    });
  };

  return <button onClick={login}>Login with Discord</button>;
}

export default LoginButton;
