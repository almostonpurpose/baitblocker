const list = document.querySelector('#list');
const previous = document.querySelector('#previous');
const next = document.querySelector('#next');
const position = document.querySelector('#position');
let tactics = [];
let active = -1;
let tab;

function updateStepper() {
  const available = tactics.length > 0;
  previous.disabled = !available;
  next.disabled = !available;
  position.textContent = available && active >= 0 ? `${active + 1} / ${tactics.length}` : available ? `– / ${tactics.length}` : '— / —';
  list.querySelectorAll('.finding').forEach((button, index) => button.setAttribute('aria-current', String(index === active)));
}

function jump(index) {
  if (!tactics.length || !tab?.id) return;
  active = (index + tactics.length) % tactics.length;
  updateStepper();
  const finding = tactics[active];
  chrome.tabs.sendMessage(
    tab.id,
    { type: 'JUMP_TO_FINDING', index: finding.index, finding },
    { frameId: finding.frameId || 0 },
    response => {
      if (chrome.runtime.lastError || !response?.ok) {
        const button = list.querySelector(`[data-list-index="${active}"]`);
        if (button) button.querySelector('.finding-trigger').textContent = 'Page changed — rescanning…';
      }
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
  lens.textContent = `TELL ${String(index + 1).padStart(2, '0')} · ${finding.lens || 'cue'}`;
  const title = document.createElement('strong');
  title.className = 'finding-title';
  title.textContent = typeof finding === 'string' ? finding : finding.name;
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

chrome.tabs.query({ active: true, currentWindow: true }, ([activeTab]) => {
  tab = activeTab;
  chrome.runtime.sendMessage({ type: 'GET_TAB_SUMMARY', tabId: tab.id }, summary => {
    tactics = summary?.tactics || [];
    document.querySelector('#count').textContent = String(tactics.length);
    document.querySelector('#summary').textContent = tactics.length ? 'Choose a tell, or move through the seams one by one.' : 'Nothing on this page meets your current thresholds.';
    list.replaceChildren();
    if (tactics.length) tactics.forEach(addFinding);
    else {
      const empty = document.createElement('li');
      empty.className = 'empty';
      empty.textContent = 'No tells found. You keep reading.';
      list.append(empty);
    }
    document.title = summary?.pageTitle || tab.title;
    updateStepper();
  });
});

previous.addEventListener('click', () => jump(active < 0 ? tactics.length - 1 : active - 1));
next.addEventListener('click', () => jump(active < 0 ? 0 : active + 1));
document.querySelector('#controls').addEventListener('click', () => chrome.runtime.openOptionsPage());
