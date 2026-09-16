# AniList ⇄ Stremio Sync (starter)

A Stremio addon that:
- shows your AniList "Watching / Planning / Completed" lists as catalogs inside Stremio
- pushes progress back to AniList when you hit play on an episode (the only watch-signal Stremio's SDK exposes — see caveat below)

## 1. Register an AniList API client (one-time)

1. Go to https://anilist.co/settings/developer
2. Create a client, name it whatever you like
3. Redirect URL: the URL where `/configure` will be hosted, e.g. `http://localhost:7050/configure`
   (update this later to your real domain once deployed)
4. Copy the **Client ID** — you'll paste it into the configure page

## 2. Run it locally

```bash
npm install
npm start
```

Then open **http://localhost:7050/configure**, paste your Client ID, click
"Connect to AniList", approve access, and you'll get a personal install link
(`http://localhost:7050/<CONFIG>/manifest.json`) plus an "Install in Stremio" button.

## 3. Deploy it somewhere reachable (required for real use)

Stremio (mobile/desktop) needs to reach this server over the internet, so `localhost`
only works for testing in Stremio Web on the same machine. Good free/cheap options:
Render, Railway, Fly.io, or a small VPS. Once deployed, update the AniList client's
redirect URL to match your deployed `/configure` URL.

## How the sync actually works (read this before you rely on it)

Stremio's public addon SDK does **not** expose a "user added something to their
Library" event, and there's no API for an addon to inject items into Stremio's
Library automatically. Two consequences:

- **AniList → Stremio**: your AniList lists appear as *catalogs* you can browse.
  You still tap the heart/"+ Library" icon in Stremio yourself to add a title —
  there's no way to silently bulk-import into Library.
- **Stremio → AniList**: there's no "watched" event either. This addon uses the
  same workaround as the community MAL/Simkl addons: Stremio calls the addon's
  `subtitles` endpoint every time you hit play, so that call is repurposed as the
  watch signal and used to update your AniList progress. It fires on *play*, not
  on completion, so it's an approximation, not a perfect watch-tracker.

If you want to look at how far a similar project got, see
[aliyss/syncribullet](https://github.com/aliyss/syncribullet) (archived, AniList +
Simkl) — it hit the same ceiling: true "add to Stremio Library → auto-appears on
AniList" was never fully solved because Stremio doesn't expose that event.

## ID mapping

Anime in Stremio is usually addressed by Kitsu or IMDb id (via the Kitsu/Cinemeta
addons), while AniList uses its own numeric ids. This project resolves between them
using the community-maintained [Fribb/anime-lists](https://github.com/Fribb/anime-lists)
mapping, fetched and cached in memory (refreshed daily). Titles with no mapping entry
are silently skipped from catalogs — that's the main source of "missing" titles.

## Project layout

```
server.js          Express app: routes for configure, manifest, catalog, subtitles hook
src/anilist.js      AniList GraphQL calls (viewer, list, save progress)
src/idmap.js        AniList <-> Kitsu/IMDb id mapping (Fribb/anime-lists)
src/config.js        base64url encode/decode of the per-user config blob
src/manifest.js      addon manifest builder
public/configure.html  the configuration / OAuth-connect page
```

## Known limitations / next steps

- Only anime `series` are wired up end to end; movies are declared in the manifest
  but not yet populated in the catalog handler.
- No persistence — the AniList access token lives inside your install URL. Treat
  that URL as a secret; anyone with it can read/write your AniList list.
- AniList's implicit-grant tokens expire (~1 year); there's no refresh flow yet,
  so you'll eventually need to reconnect via `/configure`.
- No episode-level "mark as completed on last episode" logic yet — every play just
  sets `progress` to that episode number.
