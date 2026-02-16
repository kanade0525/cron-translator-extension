document.addEventListener('DOMContentLoaded', async () => {
  const translationCount = document.getElementById('translationCount');
  const settingsBtn = document.getElementById('settingsBtn');
  const coffeeBtn = document.getElementById('coffeeBtn');

  // Load current state
  const result = await chrome.storage.sync.get(['todayCount']);
  translationCount.textContent = result.todayCount || 0;

  // Open settings
  settingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Buy Me a Coffee
  coffeeBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://www.buymeacoffee.com/kanade0525' });
  });
});