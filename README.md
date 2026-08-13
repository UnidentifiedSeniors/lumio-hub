# Lumio Hub

Lumio Hub is the licensed-trader marketplace for Anime Fighting Simulator champions. It helps players discover, propose, and coordinate trades; the actual champion exchange happens inside Roblox.

## Local development

1. Copy `.env.example` to `.env` and add the Supabase project URL plus its **anon** key.
2. Run `npm install` and `npm run dev`.

Never expose a Supabase service-role key, a Discord client secret, or a Discord webhook URL in Vite variables or browser code.

## Discord OAuth redirect setup

The website always asks Supabase to return OAuth users to `window.location.origin`. This yields `https://lumiohub.app` in production and `http://localhost:5173` during normal Vite development.

Configure the hosted Supabase project (**Authentication → URL Configuration**) with:

- Site URL: `https://lumiohub.app`
- Redirect URLs: `https://lumiohub.app`, `http://localhost:5173`, and `http://127.0.0.1:5173`

The checked-in `supabase/config.toml` mirrors this allow-list for local Supabase development; it does not automatically update the hosted project.

In the Discord Developer Portal, keep this OAuth2 redirect URI exactly as shown:

`https://ioxqdrnqwljdnjjofyhh.supabase.co/auth/v1/callback`

## Production check

Deploy the frontend, open `https://lumiohub.app`, and choose **Login with Discord**. After authorizing Discord, the browser should land back at `https://lumiohub.app`; it must never navigate to localhost.

## Discord rank-role sync

Lumio can keep Discord roles aligned with the rank stored in `profiles.rank`. The server-side `discord-rank-sync` function supports the current progression labels: `Rookie Trader`, `Beginner Trader`, `Skilled Trader`, `Advanced Trader`, `Elite Trader`, `Master Trader`, and `Lumio Legend`.

Before enabling the Database Webhook, create a Discord bot, invite it to the Lumio server with **Manage Roles**, and place its highest role above every Lumio rank role. Then add these **Supabase Edge Function secrets**—never Vite variables or committed files:

- `DISCORD_BOT_TOKEN`
- `DISCORD_GUILD_ID`
- `DISCORD_RANK_ROLE_IDS`, a JSON object such as `{"Rookie Trader":"123...","Beginner Trader":"456..."}`

In **Database → Webhooks**, create an `UPDATE` webhook for `public.profiles`, choose the `discord-rank-sync` Edge Function, and use **Add auth header with service key**. The function ignores profile updates where the rank has not changed. Members can also use **Settings → Sync my Discord rank** after the server configuration is complete.

The function only adds/removes role IDs listed in `DISCORD_RANK_ROLE_IDS`; it does not touch any other server roles.

## Roblox profile link

The Settings page validates a public Roblox username through Roblox's user lookup API and stores its stable Roblox user ID plus canonical username in `profiles`. It never requests Roblox credentials and is not ownership verification; use Roblox OAuth later if Lumio needs proof that a member controls the linked account.
