// Chrome runs this as a service worker, where importScripts is how config.js gets in.
// Firefox runs it as an event page, which has no importScripts — its manifest lists
// config.js as a script ahead of this one instead.
if (typeof importScripts === 'function') importScripts('config.js');

const DEFAULTS = globalThis.BAITBLOCKER_DEFAULTS;
const LENSES = globalThis.BAITBLOCKER_LENSES;
const STATS_KEY = globalThis.BAITBLOCKER_STATS_KEY;
const EMPTY_STATS = globalThis.BAITBLOCKER_EMPTY_STATS;

const BADGE_RED = '#b82929';
const BADGE_MUTED = '#655f72';
const REPUBLISH_TIMEOUT = 400;

// tabId -> { host, title, counted, frames: { frameId: tactics[] }, peak: {lens: n}, peakTotal }
let tabs = null;
let settings = null;
let persistTimer;

function blankPeak() {
  return LENSES.reduce((peak, lens) => ({ ...peak, [lens]: 0 }), {});
}

async function state() {
  if (tabs) return tabs;
  const stored = await chrome.storage.session.get({ tabs: {} });
  tabs = tabs || stored.tabs || {};
  return tabs;
}

function persist() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => { if (tabs) chrome.storage.session.set({ tabs }); }, 250);
}

async function currentSettings() {
  if (settings) return settings;
  settings = await chrome.storage.sync.get(DEFAULTS);
  return settings;
}

function entryFor(store, tabId) {
  store[tabId] ||= { host: '', title: '', counted: false, frames: {}, peak: blankPeak(), peakTotal: 0 };
  return store[tabId];
}

function allTactics(entry) {
  if (!entry) return [];
  return Object.entries(entry.frames).flatMap(([frameId, tactics]) =>
    tactics.map(item => ({ ...item, frameId: Number(frameId) })));
}

function recordPeak(entry) {
  const tactics = allTactics(entry);
  entry.peakTotal = Math.max(entry.peakTotal, tactics.length);
  LENSES.forEach(lens => {
    const seen = tactics.filter(item => item.lens === lens).length;
    entry.peak[lens] = Math.max(entry.peak[lens] || 0, seen);
  });
}

function isPaused(config, host) {
  if (!config.enabled) return true;
  return Boolean(host) && (config.disabledSites || []).includes(host);
}

function titleFor(count, tactics) {
  if (!count) return 'BaitBlocker — nothing found on this page';
  const breakdown = LENSES
    .map(lens => [lens, tactics.filter(item => item.lens === lens).length])
    .filter(([, n]) => n > 0)
    .map(([lens, n]) => `${n} ${lens}`)
    .join(', ');
  return `BaitBlocker — ${count} pattern${count === 1 ? '' : 's'}: ${breakdown}`;
}

async function paintBadge(tabId) {
  const store = await state();
  const config = await currentSettings();
  const entry = store[tabId];
  const apply = (calls) => calls.forEach(call => { try { call(); } catch { /* tab closed */ } });

  if (isPaused(config, entry?.host)) {
    apply([
      () => chrome.action.setBadgeText({ tabId, text: 'off' }),
      () => chrome.action.setBadgeBackgroundColor({ tabId, color: BADGE_MUTED }),
      () => chrome.action.setBadgeTextColor?.({ tabId, color: '#ffffff' }),
      () => chrome.action.setTitle({ tabId, title: config.enabled
        ? `BaitBlocker — paused on ${entry?.host || 'this site'}`
        : 'BaitBlocker — annotations are off' })
    ]);
    return;
  }

  const tactics = allTactics(entry);
  const count = tactics.length;
  apply([
    () => chrome.action.setBadgeText({ tabId, text: count ? (count > 99 ? '99+' : String(count)) : '' }),
    () => chrome.action.setBadgeBackgroundColor({ tabId, color: BADGE_RED }),
    () => chrome.action.setBadgeTextColor?.({ tabId, color: '#ffffff' }),
    () => chrome.action.setTitle({ tabId, title: titleFor(count, tactics) })
  ]);
}

async function repaintAll() {
  const store = await state();
  await Promise.all(Object.keys(store).map(tabId => paintBadge(Number(tabId))));
}

async function flushStats(tabId) {
  const store = await state();
  const entry = store[tabId];
  if (!entry?.counted) return;
  const { [STATS_KEY]: stats } = await chrome.storage.local.get({ [STATS_KEY]: EMPTY_STATS });
  const next = {
    ...EMPTY_STATS,
    ...stats,
    byLens: { ...EMPTY_STATS.byLens, ...(stats.byLens || {}) }
  };
  next.since ||= new Date().toISOString();
  next.pagesScanned += 1;
  next.totalTells += entry.peakTotal;
  LENSES.forEach(lens => { next.byLens[lens] += entry.peak[lens] || 0; });
  await chrome.storage.local.set({ [STATS_KEY]: next });
}

function getAllFrames(tabId) {
  return new Promise(resolve => {
    if (!chrome.webNavigation?.getAllFrames) return resolve(null);
    chrome.webNavigation.getAllFrames({ tabId }, frames =>
      resolve(chrome.runtime.lastError ? null : frames));
  });
}

function askFrame(tabId, frameId) {
  return new Promise(resolve => {
    let settled = false;
    const finish = value => { if (!settled) { settled = true; resolve(value); } };
    setTimeout(() => finish(null), REPUBLISH_TIMEOUT);
    try {
      chrome.tabs.sendMessage(tabId, { type: 'REPUBLISH' }, { frameId }, response =>
        finish(chrome.runtime.lastError ? null : response));
    } catch {
      finish(null);
    }
  });
}

// The service worker's map can outlive the DOM it describes, so the popup always
// asks the live frames first and lets that answer win.
async function refreshFromPage(tabId) {
  const store = await state();
  const frames = await getAllFrames(tabId);
  const ids = frames ? frames.map(frame => frame.frameId) : [0];
  const answers = await Promise.all(ids.map(async frameId => [frameId, await askFrame(tabId, frameId)]));
  const live = answers.filter(([, answer]) => answer && Array.isArray(answer.tactics));
  if (!live.length) return store[tabId] || null;

  const entry = entryFor(store, tabId);
  entry.frames = {};
  live.forEach(([frameId, answer]) => { entry.frames[frameId] = answer.tactics; });
  const top = live.find(([frameId]) => frameId === 0)?.[1] || live[0][1];
  entry.host = top.host || entry.host;
  entry.title = top.pageTitle || entry.title;
  entry.counted = true;
  recordPeak(entry);
  persist();
  return entry;
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message.type === 'BAITBLOCKER_COUNT' && sender.tab?.id !== undefined) {
    (async () => {
      const store = await state();
      const tabId = sender.tab.id;
      const entry = entryFor(store, tabId);
      entry.frames[sender.frameId || 0] = message.tactics || [];
      if ((sender.frameId || 0) === 0) {
        entry.host = message.host || entry.host;
        entry.title = message.pageTitle || sender.tab.title || entry.title;
      }
      entry.counted = true;
      recordPeak(entry);
      persist();
      paintBadge(tabId);
    })();
    return false;
  }

  if (message.type === 'GET_TAB_SUMMARY') {
    (async () => {
      // Never leave the popup waiting: any failure below answers "unreachable".
      let entry = null;
      let config = DEFAULTS;
      try {
        entry = await refreshFromPage(message.tabId);
        config = await currentSettings();
        await paintBadge(message.tabId);
      } catch {
        entry = (await state().catch(() => ({})))[message.tabId] || null;
      }
      respond({
        tactics: allTactics(entry),
        host: entry?.host || '',
        pageTitle: entry?.title || '',
        reachable: Boolean(entry),
        enabled: config.enabled,
        paused: isPaused(config, entry?.host),
        disabledHere: Boolean(entry?.host) && (config.disabledSites || []).includes(entry.host)
      });
    })();
    return true;
  }

  if (message.type === 'GET_STATS') {
    chrome.storage.local.get({ [STATS_KEY]: EMPTY_STATS }, data => respond(data[STATS_KEY]));
    return true;
  }

  if (message.type === 'SET_SITE_PAUSED') {
    (async () => {
      const config = await currentSettings();
      const list = new Set(config.disabledSites || []);
      if (message.paused) list.add(message.host);
      else list.delete(message.host);
      await chrome.storage.sync.set({ disabledSites: [...list] });
      respond({ ok: true });
    })();
    return true;
  }

  return false;
});

chrome.webNavigation?.onCommitted.addListener(async details => {
  if ((details.transitionQualifiers || []).includes('same_document')) return;
  const store = await state();
  if (details.frameId === 0) {
    await flushStats(details.tabId);
    delete store[details.tabId];
  } else if (store[details.tabId]) {
    delete store[details.tabId].frames[details.frameId];
  }
  persist();
  paintBadge(details.tabId);
});

chrome.tabs.onRemoved.addListener(async tabId => {
  const store = await state();
  await flushStats(tabId);
  delete store[tabId];
  persist();
});

async function forgetPausedTabs(hosts) {
  if (!hosts.length) return;
  const store = await state();
  Object.values(store).forEach(entry => {
    if (!hosts.includes(entry.host)) return;
    entry.frames = {};
    entry.peak = blankPeak();
    entry.peakTotal = 0;
  });
  persist();
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return;
  if (!Object.keys(changes).some(key => key in DEFAULTS)) return;
  settings = null;
  const added = (changes.disabledSites?.newValue || [])
    .filter(host => !(changes.disabledSites?.oldValue || []).includes(host));
  forgetPausedTabs(added).then(repaintAll);
});
