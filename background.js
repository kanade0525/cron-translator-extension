// Background service worker for Chrome Extension

// 右クリックメニューを作成
chrome.runtime.onInstalled.addListener(() => {
  // コンテキストメニューを作成
  chrome.contextMenus.create({
    id: "translate-cron",
    title: "Cron式を翻訳",
    contexts: ["selection"]
  });

  // Set default settings
  chrome.storage.sync.get({
    enabled: true,
    excludedDomains: [],
    showTooltip: true,
    showInline: false,
    translationDelay: 500,
    todayCount: 0,
    lastCountDate: new Date().toDateString()
  }, (items) => {
    chrome.storage.sync.set(items);
  });
});

// 右クリックメニューがクリックされた時
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "translate-cron") {
    // 選択されたテキストをcontent scriptに送信
    chrome.tabs.sendMessage(tab.id, {
      action: 'translateSelection'
    }, (response) => {
      if (!response || !response.success) {
        // エラーの場合、通知を表示
        console.log('Translation failed:', response?.message || 'Unknown error');
      }
    });
  }
});

// Reset daily count at midnight
function resetDailyCount() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const timeUntilMidnight = tomorrow - now;

  setTimeout(() => {
    chrome.storage.sync.set({ todayCount: 0, lastCountDate: new Date().toDateString() });
    resetDailyCount(); // Schedule next reset
  }, timeUntilMidnight);
}

// Start the daily reset timer
resetDailyCount();