const fetch = require('node-fetch');

const ANILIST_API = 'https://graphql.anilist.co';

async function anilistRequest(query, variables, accessToken) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(ANILIST_API, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json();
  if (json.errors) {
    const msg = json.errors.map((e) => e.message).join('; ');
    throw new Error(`AniList API error: ${msg}`);
  }
  return json.data;
}

// Who does this token belong to?
async function getViewer(accessToken) {
  const query = `
    query {
      Viewer { id name avatar { medium } }
    }
  `;
  const data = await anilistRequest(query, {}, accessToken);
  return data.Viewer;
}

// Pull the user's full anime list, grouped by status (CURRENT, PLANNING, COMPLETED, PAUSED, DROPPED, REPEATING).
async function getAnimeList(userId, accessToken) {
  const query = `
    query ($userId: Int) {
      MediaListCollection(userId: $userId, type: ANIME) {
        lists {
          name
          status
          entries {
            id
            status
            progress
            media {
              id
              idMal
              title { romaji english }
              coverImage { large }
              format
              episodes
            }
          }
        }
      }
    }
  `;
  const data = await anilistRequest(query, { userId }, accessToken);
  return data.MediaListCollection.lists;
}

// Create/update a list entry's progress + status (this is the "push watch state to AniList" call).
async function saveMediaListEntry({ mediaId, progress, status }, accessToken) {
  const mutation = `
    mutation ($mediaId: Int, $progress: Int, $status: MediaListStatus) {
      SaveMediaListEntry(mediaId: $mediaId, progress: $progress, status: $status) {
        id
        status
        progress
      }
    }
  `;
  const data = await anilistRequest(mutation, { mediaId, progress, status }, accessToken);
  return data.SaveMediaListEntry;
}

module.exports = { getViewer, getAnimeList, saveMediaListEntry };

