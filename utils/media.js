const ASSET_PREFIX = '/assets/';
const UUID_REGEX = /^[0-9a-fA-F-]{36}$/;

function extractFileId(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('/assets/')) return trimmed.slice('/assets/'.length);
    if (trimmed.startsWith('assets/')) return trimmed.slice('assets/'.length);
    return trimmed;
  }
  if (Array.isArray(value)) return extractFileId(value[0]);
  if (typeof value === 'object') {
    if (typeof value.url === 'string' && value.url.trim()) return value.url.trim();
    if (typeof value.id === 'string') return value.id.trim();
    if (typeof value.filename_disk === 'string') return value.filename_disk.trim();
    if (typeof value.filename_download === 'string') return value.filename_download.trim();
  }
  return null;
}

function normalizeMediaUrl(mediaValue, options = {}) {
  const baseUrl = typeof options.baseUrl === 'string'
    ? options.baseUrl.replace(/\/$/, '')
    : '';
  const raw = extractFileId(mediaValue);

  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (UUID_REGEX.test(raw)) {
    const path = `${ASSET_PREFIX}${raw}`;
    return baseUrl ? `${baseUrl}${path}` : path;
  }

  // Allow filename_disk/filename_download values for the local uploads fallback.
  if (/[.][a-z0-9]{2,5}$/i.test(raw)) {
    const path = `${ASSET_PREFIX}${raw}`;
    return baseUrl ? `${baseUrl}${path}` : path;
  }

  return null;
}

module.exports = {
  extractFileId,
  normalizeMediaUrl,
};
