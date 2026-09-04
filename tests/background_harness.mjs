// Drives background.js against an in-memory chrome stub. No browser needed.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const settle = async () => { for (let i = 0; i < 12; i += 1) await tick(); };

const badge = { text: {}, colour: {}, textColour: {}, title: {} };
const listeners = { message: [], committed: [], removed: [], changed: [] };
const sync = { };
const local = { };
const session = { };
let frames = [{ frameId: 0 }];
let frameAnswers = {};

// chrome.storage accepts either a callback or a promise; background.js uses both.
function area(store) {
  return {
    get: (given, callback) => {
      const value = { ...given, ...store };
      if (callback) return callback(value);
      return Promise.resolve(value);
    },
    set: (value, callback) => {
      Object.assign(store, value);
      if (callback) return callback();
      return Promise.resolve();
    }
  };
}

globalThis.importScripts = (...files) =>
  files.forEach(file => (0, eval)(readFileSync(join(ROOT, file), 'utf8')));

globalThis.chrome = {
  action: {
    setBadgeText: ({ tabId, text }) => { badge.text[tabId] = text; },
    setBadgeBackgroundColor: ({ tabId, color }) => { badge.colour[tabId] = color; },
    setBadgeTextColor: ({ tabId, color }) => { badge.textColour[tabId] = color; },
    setTitle: ({ tabId, title }) => { badge.title[tabId] = title; }
  },
  runtime: {
    lastError: null,
    onMessage: { addListener: fn => listeners.message.push(fn) }
  },
  storage: {
    sync: area(sync),
    local: area(local),
    session: area(session),
    onChanged: { addListener: fn => listeners.changed.push(fn) }
  },
  tabs: {
    onRemoved: { addListener: fn => listeners.removed.push(fn) },
    sendMessage: (tabId, message, options, callback) =>
      callback(frameAnswers[options.frameId] ?? null)
  },
  webNavigation: {
    getAllFrames: (options, callback) => callback(frames),
    onCommitted: { addListener: fn => listeners.committed.push(fn) }
  }
};

(0, eval)(readFileSync(join(ROOT, 'background.js'), 'utf8'));

const send = message => new Promise(resolve => {
  const returned = listeners.message[0](message, { tab: { id: message.__tabId }, frameId: message.__frameId ?? 0 }, resolve);
  if (returned !== true) resolve(undefined);
});

const publish = (tabId, tactics, host = 'example.com', frameId = 0) =>
  send({ type: 'BAITBLOCKER_COUNT', tactics, host, pageTitle: 'Fixture', __tabId: tabId, __frameId: frameId });

const change = (values, previous = {}) => {
  Object.entries(values).forEach(([key, value]) => { sync[key] = value; });
  const record = Object.fromEntries(Object.entries(values)
    .map(([key, value]) => [key, { newValue: value, oldValue: previous[key] }]));
  listeners.changed.forEach(fn => fn(record, 'sync'));
};

const tell = lens => ({ lens, name: `${lens} thing`, why: 'because', trigger: 't', sample: 's' });

// --- badge -----------------------------------------------------------------
await publish(1, [tell('pressure'), tell('framing'), tell('framing')]);
await settle();
assert.equal(badge.text[1], '3', 'badge shows the count');
assert.equal(badge.colour[1], '#b82929');
assert.equal(badge.textColour[1], '#ffffff');
assert.equal(badge.title[1], 'BaitBlocker — 3 patterns: 1 pressure, 2 framing');

await publish(1, []);
await settle();
assert.equal(badge.text[1], '', 'a clean page carries no badge text');
assert.equal(badge.title[1], 'BaitBlocker — nothing found on this page');

await publish(1, Array.from({ length: 120 }, () => tell('pressure')));
await settle();
assert.equal(badge.text[1], '99+', 'the badge caps rather than overflowing');

// --- summary ---------------------------------------------------------------
frameAnswers = { 0: { tactics: [tell('pressure')], host: 'example.com', pageTitle: 'Fixture' } };
let summary = await send({ type: 'GET_TAB_SUMMARY', tabId: 1 });
assert.equal(summary.tactics.length, 1, 'the live page answer wins over the stored map');
assert.equal(summary.host, 'example.com');
assert.equal(summary.reachable, true);
assert.equal(summary.paused, false);

// Frames that no longer answer drop out.
frames = [{ frameId: 0 }, { frameId: 7 }];
frameAnswers = {
  0: { tactics: [tell('pressure')], host: 'example.com', pageTitle: 'Fixture' },
  7: { tactics: [tell('engagement')], host: 'example.com', pageTitle: 'Fixture' }
};
summary = await send({ type: 'GET_TAB_SUMMARY', tabId: 1 });
assert.equal(summary.tactics.length, 2, 'subframe findings are included');
assert.equal(summary.tactics.find(item => item.lens === 'engagement').frameId, 7, 'frame id is carried through');

// An unreachable page reports itself as unreachable, not as zero findings.
frameAnswers = {};
const unreachable = await send({ type: 'GET_TAB_SUMMARY', tabId: 99 });
assert.equal(unreachable.reachable, false);
assert.deepEqual(unreachable.tactics, []);

// --- per-site pause --------------------------------------------------------
await send({ type: 'SET_SITE_PAUSED', host: 'example.com', paused: true });
assert.deepEqual(sync.disabledSites, ['example.com']);
change({ disabledSites: ['example.com'] }, { disabledSites: [] });
await settle();
assert.equal(badge.text[1], 'off', 'a paused site says so on the badge');
assert.equal(badge.colour[1], '#655f72');
assert.equal(badge.title[1], 'BaitBlocker — paused on example.com');

frameAnswers = { 0: { tactics: [], host: 'example.com', pageTitle: 'Fixture' } };
frames = [{ frameId: 0 }];
summary = await send({ type: 'GET_TAB_SUMMARY', tabId: 1 });
assert.equal(summary.paused, true);
assert.equal(summary.disabledHere, true);

// --- stats -----------------------------------------------------------------
// The paused page must not bank the findings it had before the pause.
listeners.committed.forEach(fn => fn({ tabId: 1, frameId: 0, transitionQualifiers: [] }));
await settle();
assert.equal(local.stats.totalTells, 0, 'a paused page banks nothing');
assert.equal(local.stats.pagesScanned, 1);

change({ disabledSites: [] }, { disabledSites: ['example.com'] });
await settle();

await publish(2, [tell('pressure'), tell('framing')], 'news.example');
await settle();
await publish(2, [tell('pressure')], 'news.example');
await settle();

// Same-document navigation is not a new page.
listeners.committed.forEach(fn => fn({ tabId: 2, frameId: 0, transitionQualifiers: ['same_document'] }));
await settle();
assert.equal(local.stats.pagesScanned, 1, 'a pushState route change is not a page load');
assert.equal(badge.text[2], '1', 'and it does not blank the badge');

listeners.committed.forEach(fn => fn({ tabId: 2, frameId: 0, transitionQualifiers: [] }));
await settle();
assert.equal(local.stats.pagesScanned, 2);
assert.equal(local.stats.totalTells, 2, 'the peak count is banked, not the last count');
assert.equal(local.stats.byLens.pressure, 1);
assert.equal(local.stats.byLens.framing, 1);
assert.ok(local.stats.since, 'the first flush stamps a start date');

const stats = await send({ type: 'GET_STATS' });
assert.equal(stats.totalTells, 2);

// --- service worker restart ------------------------------------------------
await publish(3, [tell('influence')], 'live.example');
await new Promise(resolve => setTimeout(resolve, 350)); // persist() is debounced
assert.ok(session.tabs, 'tab state is mirrored into session storage');
assert.equal(session.tabs['3'].host, 'live.example', 'so a suspended worker keeps its tally');
assert.equal(session.tabs['3'].peakTotal, 1);
assert.equal(session.tabs['2'], undefined, 'and a navigated-away tab is dropped');

console.log('PASS background badge, summary, per-site pause and stats');
