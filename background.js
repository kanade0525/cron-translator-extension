// Background service worker for Chrome Extension

// コンテキストメニューを作成する関数
async function createContextMenu() {
  // 既存のメニューをクリア
  await chrome.contextMenus.removeAll();

  // 新しいメニューを作成
  chrome.contextMenus.create({
    id: "translate-cron",
    title: "Cron式を翻訳",
    contexts: ["selection"]
  });
}

// 拡張機能インストール時
chrome.runtime.onInstalled.addListener(() => {
  createContextMenu();

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

// 拡張機能起動時（ブラウザ起動時）
chrome.runtime.onStartup.addListener(() => {
  createContextMenu();
});

// 右クリックメニューがクリックされた時
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "translate-cron") {
    // 選択されたテキストをcontent scriptに送信
    chrome.tabs.sendMessage(tab.id, {
      action: 'translateSelection'
    }, (response) => {
      // エラーハンドリング
      if (chrome.runtime.lastError) {
        console.log('Error:', chrome.runtime.lastError.message);
        // Content scriptが読み込まれていない場合、手動で注入
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        }, () => {
          // 再度メッセージを送信
          chrome.tabs.sendMessage(tab.id, {
            action: 'translateSelection'
          });
        });
      } else if (!response || !response.success) {
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