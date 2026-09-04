const LENSES = globalThis.BAITBLOCKER_LENSES;
const LENS_LABELS = { pressure: 'PRESSURE', influence: 'INFLUENCE', engagement: 'BAIT', framing: 'FRAMING' };

const list = document.querySelector('#list');
const previous = document.querySelector('#previous');
const next = document.querySelector('#next');
const position = document.querySelector('#position');
const countEl = document.querySelector('#count');
const countLabel = document.querySelector('#count-label');
const summaryEl = document.querySelector('#summary');
const lensStrip = document.querySelector('#lens-strip');
const pauseRow = document.querySelector('#site-pause');
const pauseInput = document.querySelector('#paused');
const hostEl = document.querySelector('#site-host');
const noteEl = document.querySelector('#site-note');
const statsEl = document.querySelector('#stats');
const reloadButton = document.querySelector('#reload');

let tab;
let host = '';
let all = [];
let shown = [];
let lensFilter = null;
let active = -1;

const send = (message) => new Promise(resolve =>
  chrome.runtime.sendMessage(message, response =>
    resolve(chrome.runtime.lastError ? null : response)));

function updateStepper() {
  const available = shown.length > 0;
  previous.disabled = !available;
  next.disabled = !available;
  position.textContent = available && active >= 0
    ? `${active + 1} / ${shown.length}`
    : available ? `– / ${shown.length}` : '— / —';
  list.querySelectorAll('.finding').forEach((button, index) =>
    button.setAttribute('aria-current', String(index === active)));
}

function jump(index) {
  if (!shown.length || !tab?.id) return;
  active = (index + shown.length) % shown.length;
  updateStepper();
  const finding = shown[active];
  chrome.tabs.sendMessage(
    tab.id,
    { type: 'JUMP_TO_FINDING', index: finding.index, finding },
    { frameId: finding.frameId || 0 },
    response => {
      if (chrome.runtime.lastError || !response?.ok) load({ quiet: true });
    }
  );
}

function addFinding(finding, index) {
  const item = document.createElement('li');
  const button = document.createElement('button');
  button.className = 'finding';
  button.dataset.listIndex = String(index);

  const tell = document.createElement('span');
  tell.className = 'tell-mark';
  tell.setAttribute('aria-hidden', 'true');

  const copy = document.createElement('span');
  copy.className = 'finding-copy';
  const lens = document.createElement('span');
  lens.className = 'finding-lens';
  lens.textContent = `${String(index + 1).padStart(2, '0')} · ${finding.lens || 'pattern'}`;
  const title = document.createElement('strong');
  title.className = 'finding-title';
  title.textContent = finding.name;
  const trigger = document.createElement('em');
  trigger.className = 'finding-trigger';
  trigger.textContent = finding.trigger ? `“${finding.trigger}”` : finding.sample || 'Show this cue on the page';
  copy.append(lens, title, trigger);

  const arrow = document.createElement('span');
  arrow.className = 'finding-arrow';
  arrow.setAttribute('aria-hidden', 'true');
  arrow.textContent = '↘';

  button.append(tell, copy, arrow);
  button.addEventListener('click', () => jump(index));
  item.append(button);
  list.append(item);
}

function renderLensStrip() {
  lensStrip.replaceChildren();
  if (!all.length) return;
  LENSES.forEach(lens => {
    const total = all.filter(item => item.lens === lens).length;
    const chip = document.createElement('button');
    chip.className = 'lens-chip';
    chip.dataset.lens = lens;
    chip.disabled = total === 0;
    chip.setAttribute('aria-pressed', String(lensFilter === lens));
    const name = document.createElement('b');
    name.textContent = LENS_LABELS[lens] || lens.toUpperCase();
    const value = document.createElement('span');
    value.textContent = String(total);
    chip.append(name, value);
    chip.addEventListener('click', () => {
      lensFilter = lensFilter === lens ? null : lens;
      renderList();
    });
    lensStrip.append(chip);
  });
}

function renderList() {
  shown = lensFilter ? all.filter(item => item.lens === lensFilter) : all;
  active = -1;
  list.replaceChildren();
  if (shown.length) shown.forEach(addFinding);
  else {
    const empty = document.createElement('li');
    empty.className = 'empty';
    empty.textContent = lensFilter ? 'Nothing in this category on this page.' : 'Nothing found on this page.';
    list.append(empty);
  }
  lensStrip.querySelectorAll('.lens-chip').forEach(chip =>
    chip.setAttribute('aria-pressed', String(chip.dataset.lens === lensFilter)));
  updateStepper();
}

function renderState(summary) {
  const reachable = Boolean(summary?.reachable);
  const paused = Boolean(summary?.paused);
  all = summary?.tactics || [];
  host = summary?.host || '';

  hostEl.textContent = host || 'this site';
  pauseInput.checked = Boolean(host) && (summary?.disabledHere ?? paused) && summary?.enabled !== false;
  pauseRow.classList.toggle('unavailable', !host || summary?.enabled === false);
  pauseInput.disabled = !host || summary?.enabled === false;

  if (!reachable) {
    countEl.textContent = '—';
    countLabel.innerHTML = 'NOT<br>RUNNING';
    summaryEl.textContent = 'BaitBlocker did not answer on this page. Either the browser blocks extensions here — its own pages, the PDF viewer, the extensions gallery — or the page loaded before the extension was ready.';
    reloadButton.hidden = false;
    noteEl.textContent = 'Not running here';
    lensStrip.replaceChildren();
    all = [];
    renderList();
    return;
  }

  reloadButton.hidden = true;

  if (summary.enabled === false) {
    countEl.textContent = '—';
    countLabel.innerHTML = 'SCAN<br>IS OFF';
    summaryEl.textContent = 'Annotations are switched off everywhere. Turn them back on in Settings.';
    noteEl.textContent = 'Scanning is off everywhere';
    lensStrip.replaceChildren();
    all = [];
    renderList();
    return;
  }

  if (paused) {
    countEl.textContent = '—';
    countLabel.innerHTML = 'PAUSED<br>HERE';
    summaryEl.textContent = `BaitBlocker is leaving ${host} alone. Switch the pause off below to start marking again.`;
    noteEl.textContent = 'Marking is paused here';
    lensStrip.replaceChildren();
    all = [];
    renderList();
    return;
  }

  countEl.textContent = String(all.length);
  countLabel.innerHTML = all.length === 1 ? 'PATTERN<br>FOUND' : 'PATTERNS<br>FOUND';
  summaryEl.textContent = all.length
    ? 'Select one, or step through them in order.'
    : 'Nothing on this page matched at your current sensitivity.';
  noteEl.textContent = 'BaitBlocker stops marking here';
  renderLensStrip();
  renderList();
}

function renderStats(stats) {
  if (!stats?.pagesScanned) {
    statsEl.textContent = 'NO PAGES SCANNED YET';
    return;
  }
  const pages = stats.pagesScanned.toLocaleString();
  const found = stats.totalTells.toLocaleString();
  statsEl.textContent = `${found} PATTERNS ACROSS ${pages} PAGES`;
}

async function load({ quiet = false } = {}) {
  if (!quiet) summaryEl.textContent = 'Checking this page…';
  const summary = await send({ type: 'GET_TAB_SUMMARY', tabId: tab.id });
  renderState(summary);
  document.title = summary?.pageTitle || 'BaitBlocker';
}

chrome.tabs.query({ active: true, currentWindow: true }, async ([activeTab]) => {
  tab = activeTab;
  await load();
  renderStats(await send({ type: 'GET_STATS' }));
});

previous.addEventListener('click', () => jump(active < 0 ? shown.length - 1 : active - 1));
next.addEventListener('click', () => jump(active < 0 ? 0 : active + 1));
document.querySelector('#controls').addEventListener('click', () => chrome.runtime.openOptionsPage());

reloadButton.addEventListener('click', () => {
  if (tab?.id) chrome.tabs.reload(tab.id);
  window.close();
});

pauseInput.addEventListener('change', async () => {
  if (!host) return;
  await send({ type: 'SET_SITE_PAUSED', host, paused: pauseInput.checked });
  await load({ quiet: true });
});

document.addEventListener('keydown', event => {
  if (event.target.matches('input, [role="textbox"]')) return;
  if (event.key === 'j' || event.key === 'ArrowDown') { event.preventDefault(); next.click(); }
  if (event.key === 'k' || event.key === 'ArrowUp') { event.preventDefault(); previous.click(); }
});
