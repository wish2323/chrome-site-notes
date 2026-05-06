// 탭의 URL을 기준으로 storage를 직접 조회해 뱃지 업데이트
// (service worker 비활성 시 메시지 유실 문제를 방지)
function updateTabBadge(tabId, tabUrl) {
  try {
    const url = new URL(tabUrl);
    if (!url.hostname) return;
    const path = url.pathname.replace(/\/$/, '') || '/';
    const key = `pn:${url.hostname}${path}`;
    chrome.storage.sync.get(key, (result) => {
      const has = !!(result[key]?.trim());
      chrome.action.setBadgeText({ text: has ? '●' : '', tabId });
      if (has) chrome.action.setBadgeBackgroundColor({ color: '#6366f1', tabId });
    });
  } catch (_) {}
}

// 아이콘 클릭 → 토글
chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.sendMessage(tab.id, { type: 'toggle' });
});

// 키보드 단축키 → 토글
chrome.commands.onCommand.addListener((command) => {
  if (command !== 'toggle') return;
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: 'toggle' });
  });
});

// 페이지 로드 완료 시 뱃지 갱신 (메시지 없이 직접 조회)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    updateTabBadge(tabId, tab.url);
  }
});

// 탭 전환 시 뱃지 갱신
chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId, (tab) => {
    if (!chrome.runtime.lastError && tab.url) {
      updateTabBadge(tabId, tab.url);
    }
  });
});

// content script에서 실시간 뱃지 업데이트 (타이핑 중)
chrome.runtime.onMessage.addListener((msg, sender) => {
  const tabId = sender.tab?.id;
  if (msg.type !== 'badge' || !tabId) return;
  chrome.action.setBadgeText({ text: msg.has ? '●' : '', tabId });
  if (msg.has) chrome.action.setBadgeBackgroundColor({ color: '#6366f1', tabId });
});
