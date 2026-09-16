// Static-ish manifest. Catalog ids map to AniList list statuses.
function buildManifest({ configured, username } = {}) {
  return {
    id: 'com.mouadh.anilist-stremio-sync',
    version: '0.1.0',
    name: configured ? `AniList Sync (${username})` : 'AniList Sync',
    description:
      'Browse your AniList lists inside Stremio and push watch progress back to AniList.',
    logo: 'https://anilist.co/img/icons/icon.svg',
    resources: ['catalog', 'subtitles'],
    types: ['series', 'movie'],
    idPrefixes: ['kitsu', 'tt'],
    catalogs: configured
      ? [
          { type: 'series', id: 'anilist-current', name: 'AniList: Watching' },
          { type: 'series', id: 'anilist-planning', name: 'AniList: Planning' },
          { type: 'series', id: 'anilist-completed', name: 'AniList: Completed' },
        ]
      : [],
    behaviorHints: {
      configurable: true,
      configurationRequired: !configured,
    },
  };
}

module.exports = { buildManifest };
