document.addEventListener('DOMContentLoaded', async () => {
  const enableToggle = document.getElementById('enableToggle');
  const translationCount = document.getElementById('translationCount');
  const settingsBtn = document.getElementById('settingsBtn');
  const coffeeBtn = document.getElementById('coffeeBtn');

  // Load current state
  const result = await chrome.storage.sync.get(['enabled', 'todayCount']);
  enableToggle.checked = result.enabled !== false;
  translationCount.textContent = result.todayCount || 0;

  // Toggle enable/disable
  enableToggle.addEventListener('change', async () => {
    await chrome.storage.sync.set({ enabled: enableToggle.checked });

    // Send message to all tabs
    const tabs = await chrome.tabs.query({});
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, {
        action: 'toggleEnabled',
        enabled: enableToggle.checked
      }).catch(() => {
        // Ignore errors for tabs without content script
      });
    });
  });

  // Open settings
  settingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Buy Me a Coffee
  coffeeBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://www.buymeacoffee.com/kanade0525' });
  });
});