globalThis.BAITBLOCKER_DEFAULTS = {
  enabled: true,
  pressure: true,
  influence: true,
  engagement: true,
  framing: true,
  sensitivity: 'balanced',
  disabledSites: []
};

globalThis.BAITBLOCKER_LENSES = ['pressure', 'influence', 'engagement', 'framing'];

// Stats live in chrome.storage.local under a single versioned key so the shape can
// grow (per-site history, date buckets) without migrating loose top-level keys.
globalThis.BAITBLOCKER_STATS_KEY = 'stats';
globalThis.BAITBLOCKER_EMPTY_STATS = {
  version: 1,
  since: null,
  pagesScanned: 0,
  totalTells: 0,
  byLens: { pressure: 0, influence: 0, engagement: 0, framing: 0 }
};
