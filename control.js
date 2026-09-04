const defaults = globalThis.BAITBLOCKER_DEFAULTS;
const LENSES = globalThis.BAITBLOCKER_LENSES;
const STATS_KEY = globalThis.BAITBLOCKER_STATS_KEY;
const EMPTY_STATS = globalThis.BAITBLOCKER_EMPTY_STATS;

const ids = ['enabled', ...LENSES];
const levels = ['strict', 'balanced', 'sensitive'];

const $ = selector => document.querySelector(selector);

function renderPaused(sites) {
  const list = $('#paused-list');
  list.replaceChildren();
  $('#paused-count').textContent = sites.length ? `${sites.length} SITE${sites.length === 1 ? '' : 'S'}` : 'NONE';
  if (!sites.length) {
    const empty = document.createElement('li');
    empty.className = 'paused-empty';
    empty.textContent = 'BaitBlocker is running everywhere. Pause a site from the toolbar popup.';
    list.append(empty);
    return;
  }
  sites.forEach(host => {
    const item = document.createElement('li');
    const name = document.createElement('span');
    name.textContent = host;
    const button = document.createElement('button');
    button.className = 'resume';
    button.textContent = 'RESUME';
    button.setAttribute('aria-label', `Resume BaitBlocker on ${host}`);
    button.addEventListener('click', () => {
      chrome.storage.sync.get(defaults, data => {
        const next = (data.disabledSites || []).filter(entry => entry !== host);
        chrome.storage.sync.set({ disabledSites: next }, () => renderPaused(next));
      });
    });
    item.append(name, button);
    list.append(item);
  });
}

function renderStats(stats) {
  const box = $('#stats');
  box.replaceChildren();
  const since = stats.since ? new Date(stats.since) : null;
  $('#stats-since').textContent = since
    ? `SINCE ${since.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase()}`
    : 'SINCE INSTALL';

  const cells = [
    ['Pages read', stats.pagesScanned],
    ['Patterns found', stats.totalTells],
    ...LENSES.map(lens => [lens === 'engagement' ? 'Engagement bait' : lens[0].toUpperCase() + lens.slice(1), stats.byLens?.[lens] || 0])
  ];

  cells.forEach(([label, value], index) => {
    const cell = document.createElement('div');
    cell.className = index < 2 ? 'stat lead' : 'stat';
    const number = document.createElement('b');
    number.textContent = Number(value || 0).toLocaleString();
    const name = document.createElement('small');
    name.textContent = label;
    cell.append(number, name);
    box.append(cell);
  });
}

function render(data) {
  ids.forEach(id => { $(`#${id}`).checked = data[id]; });
  const range = $('#sensitivity');
  range.value = levels.indexOf(data.sensitivity);
  $('#sensitivity-label').textContent = data.sensitivity.toUpperCase();
  renderPaused(data.disabledSites || []);
}

function save() {
  const value = {};
  ids.forEach(id => { value[id] = $(`#${id}`).checked; });
  value.sensitivity = levels[$('#sensitivity').value];
  chrome.storage.sync.get(defaults, current => {
    const merged = { ...current, ...value };
    chrome.storage.sync.set(value, () => render(merged));
  });
}

$('#version').textContent = `SETTINGS · V${chrome.runtime.getManifest().version}`;
chrome.storage.sync.get(defaults, render);
chrome.storage.local.get({ [STATS_KEY]: EMPTY_STATS }, data => renderStats(data[STATS_KEY]));

ids.forEach(id => $(`#${id}`).addEventListener('change', save));
$('#sensitivity').addEventListener('input', save);
// Paused sites are managed in their own section, so a defaults restore leaves them alone.
$('#reset').addEventListener('click', () => {
  chrome.storage.sync.get(defaults, current => {
    const next = { ...defaults, disabledSites: current.disabledSites || [] };
    chrome.storage.sync.set(next, () => render(next));
  });
});
