// Stremio addons are configured per-user by baking a config blob into the manifest URL,
// e.g. https://host/<CONFIG>/manifest.json. We base64url-encode a small JSON object
// (just the AniList access token + user id) so the addon stays stateless server-side.

function encodeConfig(config) {
  const json = JSON.stringify(config);
  return Buffer.from(json, 'utf8').toString('base64url');
}

function decodeConfig(configStr) {
  try {
    const json = Buffer.from(configStr, 'base64url').toString('utf8');
    return JSON.parse(json);
  } catch (err) {
    return null;
  }
}

module.exports = { encodeConfig, decodeConfig };
