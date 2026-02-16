// Background service worker for Chrome Extension

// Initialize extension on install
chrome.runtime.onInstalled.addListener(() => {
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

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'toggleEnabled') {
    // Broadcast to all tabs
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, request).catch(() => {
          // Ignore errors for tabs without content script
        });
      });
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