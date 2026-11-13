// Download mirror helpers (runtime / main process).
//
// Some download sources (huggingface.co, github.com) are slow or blocked on
// certain networks (e.g. mainland China). The ORIGINAL host is always kept in
// the candidate list and re-tried on every retry, so networks where the origin
// works fine see zero behavior change. Mirrors are appended as additional
// fallbacks, or moved to the front when the corresponding env var is set:
//
//   SUPERTING_HF_MIRROR       — HuggingFace mirror base (default: https://hf-mirror.com).
//                               Comma-separated list to try several.
//   SUPERTING_GITHUB_MIRROR   — GitHub proxy prefix (default: https://ghfast.top/).
//                               The original URL is appended to the prefix.
//
// Set either var to "off" / "none" to disable that mirror entirely.

const DEFAULT_HF_MIRROR = "https://hf-mirror.com";
const DEFAULT_GH_PREFIX = "https://ghfast.top/";

function parseList(raw, fallback) {
  const value = (raw ?? fallback ?? "").trim();
  if (!value || /^(off|none|disabled?)$/i.test(value)) return [];
  return value
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
}

const HF_MIRROR_URLS = parseList(process.env.SUPERTING_HF_MIRROR, DEFAULT_HF_MIRROR);
const GH_MIRROR_URLS = parseList(process.env.SUPERTING_GITHUB_MIRROR, DEFAULT_GH_PREFIX);

// e.g. "https://hf-mirror.com/sentence-transformers/all-MiniLM-L6-v2/resolve/main/model.onnx"
function toHfMirrorUrl(url, mirrorBase) {
  const m = String(url).match(/^https?:\/\/(?:www\.)?huggingface\.co(\/.*)$/i);
  return m ? mirrorBase.replace(/\/+$/, "") + m[1] : url;
}

// e.g. "https://ghfast.top/https://github.com/k2-fsa/sherpa-onnx/releases/..."
function toGhMirrorUrl(url, mirrorBase) {
  const base = mirrorBase.replace(/\/+$/, "");
  if (/^https?:\/\//i.test(base)) {
    return `${base}/${url}`;
  }
  // A bare host (e.g. "gh-proxy.com") proxies via https://<host>/
  return `https://${base.replace(/^\/+/, "")}/${url}`;
}

/**
 * Ordered candidate URLs for a download/fetch: the original URL plus any
 * configured mirrors. Original-first by default; mirror-first when the user
 * explicitly set the env var.
 * @param {string} url
 * @returns {string[]} unique candidate URLs, original always included
 */
function variantsFor(url) {
  const u = String(url);
  const isHf = /^https?:\/\/(?:www\.)?huggingface\.co\//i.test(u);
  const isGh = /^https?:\/\/(?:www\.)?github\.com\//i.test(u);
  const isGhApi = /^https?:\/\/api\.github\.com\//i.test(u);

  let mirrors = [];
  if (isHf) mirrors = HF_MIRROR_URLS.map((b) => toHfMirrorUrl(u, b));
  if (isGh || isGhApi) mirrors = GH_MIRROR_URLS.map((b) => toGhMirrorUrl(u, b));

  const forced = isHf
    ? !!process.env.SUPERTING_HF_MIRROR
    : (isGh || isGhApi) && !!process.env.SUPERTING_GITHUB_MIRROR;

  const ordered = forced ? [...mirrors, u] : [u, ...mirrors];
  return [...new Set(ordered)];
}

module.exports = { variantsFor, toHfMirrorUrl, toGhMirrorUrl };
