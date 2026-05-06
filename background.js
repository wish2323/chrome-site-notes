// 프리미엄 여부에 따라 올바른 스토리지에서 뱃지 업데이트
function updateTabBadge(tabId, tabUrl) {
  try {
    const url = new URL(tabUrl);
    if (!url.hostname) return;
    const path = url.pathname.replace(/\/$/, '') || '/';
    const key = `pn:${url.hostname}${path}`;

    chrome.storage.local.get('pn_premium', (r) => {
      const store = r.pn_premium ? chrome.storage.sync : chrome.storage.local;
      store.get(key, (result) => {
        const has = !!(result[key]?.trim());
        chrome.action.setBadgeText({ text: has ? '●' : '', tabId });
        if (has) chrome.action.setBadgeBackgroundColor({ color: '#6366f1', tabId });
      });
    });
  } catch (_) {}
}

chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.sendMessage(tab.id, { type: 'toggle' });
});

chrome.commands.onCommand.addListener((command) => {
  if (command !== 'toggle') return;
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: 'toggle' });
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    updateTabBadge(tabId, tab.url);
  }
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId, (tab) => {
    if (!chrome.runtime.lastError && tab.url) updateTabBadge(tabId, tab.url);
  });
});

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === 'open-options') {
    chrome.runtime.openOptionsPage();
    return;
  }
  const tabId = sender.tab?.id;
  if (msg.type !== 'badge' || !tabId) return;
  chrome.action.setBadgeText({ text: msg.has ? '●' : '', tabId });
  if (msg.has) chrome.action.setBadgeBackgroundColor({ color: '#6366f1', tabId });
});
