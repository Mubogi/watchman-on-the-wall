/**
 * Resolve a request path from the `app://` protocol handler to a file inside
 * the bundled `www/` directory.
 *
 * Kept separate from main.js so the containment logic can be unit tested
 * without booting Electron.
 */
const path = require("node:path");

/**
 * @param {string} wwwDir Absolute path of the bundle root.
 * @param {string} pathname Request pathname, e.g. "/js/main.js".
 * @returns {string|null} Absolute file path, or null if it escapes the bundle.
 */
function resolveAssetPath(wwwDir, pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname || "/");
  } catch {
    return null;
  }
  if (decoded === "/" || decoded === "") decoded = "/index.html";

  // Strip leading slashes so path.join treats it as relative, then normalise
  // to collapse any ".." segments before the containment check.
  const rel = path.normalize(decoded.replace(/^\/+/, ""));
  const target = path.join(wwwDir, rel);

  if (target !== wwwDir && !target.startsWith(wwwDir + path.sep)) return null;
  return target;
}

module.exports = { resolveAssetPath };
