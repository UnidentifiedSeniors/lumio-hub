import { useCallback, useEffect, useState } from "react";

const PROMPT_PREFERENCE_KEY = "lumio-discord-community-prompt-v1";

function DiscordCommunityPrompt() {
  const discordInviteUrl = import.meta.env.VITE_DISCORD_INVITE_URL?.trim();
  const [open, setOpen] = useState(false);

  const dismissPrompt = useCallback(() => {
    try {
      window.localStorage.setItem(PROMPT_PREFERENCE_KEY, "dismissed");
    } catch {
      // The prompt closes for this session even if the preference cannot persist.
    }
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!discordInviteUrl) return undefined;

    try {
      if (window.localStorage.getItem(PROMPT_PREFERENCE_KEY)) return undefined;
    } catch {
      // If browser storage is unavailable, showing a single session prompt is still useful.
    }

    const timer = window.setTimeout(() => setOpen(true), 700);
    return () => window.clearTimeout(timer);
  }, [discordInviteUrl]);

  useEffect(() => {
    if (!open) return undefined;

    const dismissOnEscape = (event) => {
      if (event.key === "Escape") dismissPrompt();
    };

    document.addEventListener("keydown", dismissOnEscape);
    return () => document.removeEventListener("keydown", dismissOnEscape);
  }, [dismissPrompt, open]);

  if (!open || !discordInviteUrl) return null;

  return (
    <div className="community-prompt-overlay" role="presentation">
      <section aria-describedby="community-prompt-copy" aria-labelledby="community-prompt-title" aria-modal="true" className="community-prompt" role="dialog">
        <div className="community-prompt-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M7.2 8.2A14.1 14.1 0 0 1 12 7c1.7 0 3.3.4 4.8 1.2L18 16.8c-1.2.9-2.5 1.4-3.8 1.7l-.8-1.1h-2.8l-.8 1.1c-1.3-.3-2.6-.8-3.8-1.7z" /><path d="M9.5 12h.01" /><path d="M14.5 12h.01" /><path d="M9 15.1c1.8.8 4.2.8 6 0" /></svg>
        </div>
        <p className="eyebrow">Lumio community</p>
        <h2 id="community-prompt-title">Trade better together.</h2>
        <p id="community-prompt-copy">Join the Lumio Discord to share ideas, get help with offers, and help shape the hub as the community grows.</p>
        <div className="community-prompt-actions">
          <button className="secondary-action" onClick={dismissPrompt} type="button">Continue to Lumio</button>
          <a className="success-action" href={discordInviteUrl} onClick={dismissPrompt} rel="noreferrer" target="_blank">Join Discord <span aria-hidden="true">↗</span></a>
        </div>
      </section>
    </div>
  );
}

export default DiscordCommunityPrompt;
