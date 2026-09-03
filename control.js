const defaults = globalThis.BAITBLOCKER_DEFAULTS;
const ids = ['enabled', 'pressure', 'influence', 'engagement', 'framing'];
const levels = ['strict', 'balanced', 'sensitive'];

function render(data) {
  ids.forEach(id => {
    document.querySelector(`#${id}`).checked = data[id];
  });
  const range = document.querySelector('#sensitivity');
  range.value = levels.indexOf(data.sensitivity);
  document.querySelector('#sensitivity-label').textContent = data.sensitivity.toUpperCase();
}

function save() {
  const value = {};
  ids.forEach(id => {
    value[id] = document.querySelector(`#${id}`).checked;
  });
  value.sensitivity = levels[document.querySelector('#sensitivity').value];
  chrome.storage.sync.set(value, () => render({ ...defaults, ...value }));
}

chrome.storage.sync.get(defaults, render);
ids.forEach(id => document.querySelector(`#${id}`).addEventListener('change', save));
document.querySelector('#sensitivity').addEventListener('input', save);
document.querySelector('#reset').addEventListener('click', () => {
  chrome.storage.sync.set(defaults, () => render(defaults));
});
