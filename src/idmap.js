const fetch = require('node-fetch');

// Community-maintained mapping between AniList / MAL / Kitsu / IMDb / TMDB / TVDB ids.
// https://github.com/Fribb/anime-lists
const MAPPING_URL =
  'https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-full.json';

let cache = null; // raw array from the source
let byAnilist = new Map(); // anilist_id -> entry
let byKitsu = new Map(); // kitsu_id -> entry
let byImdb = new Map(); // imdb_id -> entry
let loadedAt = 0;
const TTL_MS = 24 * 60 * 60 * 1000; // refresh once a day

async function ensureLoaded() {
  const isStale = Date.now() - loadedAt > TTL_MS;
  if (cache && !isStale) return;

  const res = await fetch(MAPPING_URL);
  if (!res.ok) {
    if (cache) return; // keep serving the old cache if the refresh fails
    throw new Error(`Failed to fetch id mapping list: ${res.status}`);
  }
  const data = await res.json();

  byAnilist = new Map();
  byKitsu = new Map();
  byImdb = new Map();

  for (const entry of data) {
    if (entry.anilist_id) byAnilist.set(entry.anilist_id, entry);
    if (entry.kitsu_id) byKitsu.set(entry.kitsu_id, entry);
    if (entry.imdb_id) byImdb.set(entry.imdb_id, entry);
  }

  cache = data;
  loadedAt = Date.now();
}

// AniList id -> best Stremio-friendly id ("kitsu:<id>" preferred, falls back to imdb "tt...").
async function stremioIdFromAnilistId(anilistId) {
  await ensureLoaded();
  const entry = byAnilist.get(anilistId);
  if (!entry) return null;
  if (entry.kitsu_id) return { stremioId: `kitsu:${entry.kitsu_id}`, entry };
  if (entry.imdb_id) return { stremioId: entry.imdb_id, entry };
  return null;
}

// Reverse lookup used by the subtitles hook: a Stremio id -> the AniList media id.
async function anilistIdFromStremioId(stremioId) {
  await ensureLoaded();
  if (stremioId.startsWith('kitsu:')) {
    const kitsuId = Number(stremioId.split(':')[1]);
    const entry = byKitsu.get(kitsuId);
    return entry ? entry.anilist_id : null;
  }
  // imdb-style id, possibly with a trailing ":season:episode"
  const imdbId = stremioId.split(':')[0];
  const entry = byImdb.get(imdbId);
  return entry ? entry.anilist_id : null;
}

module.exports = { stremioIdFromAnilistId, anilistIdFromStremioId };
