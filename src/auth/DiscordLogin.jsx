import { useAuth } from "../context/AuthContext";

function DiscordLogin() {
  const { login, authError, isSigningIn } = useAuth();

  return (
    <>
      <button onClick={login} disabled={isSigningIn}>
        {isSigningIn ? "Opening Discord…" : "Login with Discord"}
      </button>
      {authError && <p role="alert">{authError}</p>}
    </>
  );
}

export default DiscordLogin;
