import { useAuth } from "../context/AuthContext";

function DiscordLogin() {
  const { login } = useAuth();

  return (
    <button onClick={login}>
      Login with Discord
    </button>
  );
}

export default DiscordLogin;