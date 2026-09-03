const tabFrames = new Map();

function allTactics(tabId) {
  const frames = tabFrames.get(tabId);
  return frames ? [...frames.values()].flatMap(item => item.tactics) : [];
}

function setBadge(tabId) {
  const count = allTactics(tabId).length;
  chrome.action.setBadgeText({ tabId, text: count ? String(count) : '' });
  chrome.action.setBadgeBackgroundColor({ tabId, color: '#dd3c3c' });
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message.type === 'BAITBLOCKER_COUNT' && sender.tab?.id !== undefined) {
    const tabId = sender.tab.id;
    const frameId = sender.frameId || 0;
    const frames = tabFrames.get(tabId) || new Map();
    frames.set(frameId, {
      tactics: (message.tactics || []).map(item => ({ ...item, frameId })),
      pageTitle: message.pageTitle || sender.tab.title || ''
    });
    tabFrames.set(tabId, frames);
    setBadge(tabId);
  }

  if (message.type === 'GET_TAB_SUMMARY') {
    const finish = liveFrames => {
      const frames = tabFrames.get(message.tabId);
      if (frames && liveFrames) {
        const activeIds = new Set(liveFrames.map(frame => frame.frameId));
        [...frames.keys()].forEach(frameId => { if (!activeIds.has(frameId)) frames.delete(frameId); });
        setBadge(message.tabId);
      }
      const values = frames ? [...frames.values()] : [];
      respond({ tactics: values.flatMap(item => item.tactics), pageTitle: values[0]?.pageTitle || '' });
    };
    if (chrome.webNavigation?.getAllFrames) {
      chrome.webNavigation.getAllFrames({ tabId: message.tabId }, frames => finish(chrome.runtime.lastError ? null : frames));
      return true;
    }
    finish(null);
  }
});

chrome.webNavigation?.onCommitted.addListener(details => {
  if (details.frameId === 0) tabFrames.delete(details.tabId);
  else tabFrames.get(details.tabId)?.delete(details.frameId);
  setBadge(details.tabId);
});

chrome.tabs.onRemoved.addListener(tabId => tabFrames.delete(tabId));
chrome.storage.onChanged.addListener(changes => {
  if (changes.enabled && !changes.enabled.newValue) chrome.action.setBadgeText({ text: '' });
});
