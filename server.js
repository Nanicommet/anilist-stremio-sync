const express = require('express');
const path = require('path');

const { buildManifest } = require('./src/manifest');
const { encodeConfig, decodeConfig } = require('./src/config');
const anilist = require('./src/anilist');
const idmap = require('./src/idmap');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 7050;

// ---- configure-page helpers --------------------------------------------

app.get('/api/viewer', async (req, res) => {
  try {
    const viewer = await anilist.getViewer(req.query.token);
    res.json(viewer);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/make-config', (req, res) => {
  const { accessToken, userId, username } = req.body || {};
  if (!accessToken || !userId) {
    return res.status(400).json({ error: 'accessToken and userId are required' });
  }
  const config = encodeConfig({ accessToken, userId, username });
  res.json({ config });
});

app.get('/configure', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'configure.html'));
});

// ---- unconfigured manifest (Stremio shows "Configure" before install) --

app.get('/manifest.json', (req, res) => {
  res.json(buildManifest({ configured: false }));
});

// ---- configured, per-user addon -----------------------------------------

function loadConfigOr404(req, res) {
  const cfg = decodeConfig(req.params.config);
  if (!cfg || !cfg.accessToken || !cfg.userId) {
    res.status(404).json({ error: 'Invalid or missing configuration. Visit /configure first.' });
    return null;
  }
  return cfg;
}

app.get('/:config/manifest.json', (req, res) => {
  const cfg = loadConfigOr404(req, res);
  if (!cfg) return;
  res.json(buildManifest({ configured: true, username: cfg.username }));
});

const STATUS_BY_CATALOG_ID = {
  'anilist-current': 'CURRENT',
  'anilist-planning': 'PLANNING',
  'anilist-completed': 'COMPLETED',
};

app.get('/:config/catalog/:type/:id.json', async (req, res) => {
  const cfg = loadConfigOr404(req, res);
  if (!cfg) return;

  const wantedStatus = STATUS_BY_CATALOG_ID[req.params.id];
  if (!wantedStatus) return res.json({ metas: [] });

  try {
    const lists = await anilist.getAnimeList(cfg.userId, cfg.accessToken);
    const list = lists.find((l) => l.status === wantedStatus);
    const entries = list ? list.entries : [];

    const metas = [];
    for (const entry of entries) {
      const mapped = await idmap.stremioIdFromAnilistId(entry.media.id);
      if (!mapped) continue; // no known Stremio-compatible id for this title yet
      metas.push({
        id: mapped.stremioId,
        type: 'series',
        name: entry.media.title.english || entry.media.title.romaji,
        poster: entry.media.coverImage.large,
      });
    }
    res.json({ metas });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- the "playback = watch signal" hook ----------------------------------
// Stremio calls this whenever the user hits play, asking for subtitles.
// We use that call as our best available watch signal and push it to AniList,
// then return an empty subtitle list (this addon doesn't provide subtitles).
app.get('/:config/subtitles/:type/:id/:extra?.json', async (req, res) => {
  const cfg = loadConfigOr404(req, res);
  if (!cfg) return;

  try {
    // Stremio sends ids like "kitsu:12345:1:3" or "tt1234567:1:3" (id[:kitsuId]:season:episode).
    const parts = req.params.id.split(':');
    const isKitsu = parts[0] === 'kitsu';
    const baseId = isKitsu ? `${parts[0]}:${parts[1]}` : parts[0];
    const episodeStr = isKitsu ? parts[3] : parts[2];
    const episode = episodeStr ? Number(episodeStr) : null;

    const anilistId = await idmap.anilistIdFromStremioId(baseId);

    if (anilistId) {
      await anilist.saveMediaListEntry(
        {
          mediaId: anilistId,
          progress: episode || undefined,
          status: 'CURRENT',
        },
        cfg.accessToken
      );
    }
  } catch (err) {
    // Never break playback just because the sync call failed.
    console.error('Sync-on-play failed:', err.message);
  }

  res.json({ subtitles: [] });
});

app.listen(PORT, () => {
  console.log(`AniList Stremio Sync addon listening on http://localhost:${PORT}`);
  console.log(`Configure page: http://localhost:${PORT}/configure`);
});
