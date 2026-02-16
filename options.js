document.addEventListener('DOMContentLoaded', async () => {
  // Load saved settings
  const settings = await chrome.storage.sync.get({
    excludedDomains: [],
    showTooltip: true,
    showInline: false,
    translationDelay: 500
  });

  // Populate excluded domains
  const domainList = document.getElementById('domainList');
  settings.excludedDomains.forEach(domain => {
    addDomainToList(domain);
  });

  // Set checkbox states
  document.getElementById('showTooltip').checked = settings.showTooltip;
  document.getElementById('showInline').checked = settings.showInline;
  document.getElementById('translationDelay').value = settings.translationDelay;

  // Add domain
  document.getElementById('addDomainBtn').addEventListener('click', () => {
    const input = document.getElementById('domainInput');
    const domain = input.value.trim().toLowerCase();
    
    if (domain && !settings.excludedDomains.includes(domain)) {
      settings.excludedDomains.push(domain);
      addDomainToList(domain);
      input.value = '';
    }
  });

  // Save settings
  document.getElementById('saveBtn').addEventListener('click', async () => {
    const newSettings = {
      excludedDomains: settings.excludedDomains,
      showTooltip: document.getElementById('showTooltip').checked,
      showInline: document.getElementById('showInline').checked,
      translationDelay: parseInt(document.getElementById('translationDelay').value)
    };

    await chrome.storage.sync.set(newSettings);
    
    // Show save confirmation
    const status = document.getElementById('saveStatus');
    status.textContent = 'Settings saved!';
    status.classList.add('show');
    setTimeout(() => {
      status.classList.remove('show');
    }, 2000);
  });

  // Buy Me a Coffee
  document.getElementById('coffeeBtn').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://www.buymeacoffee.com/YOUR_USERNAME' });
  });

  // Helper function to add domain to list
  function addDomainToList(domain) {
    const li = document.createElement('li');
    li.className = 'domain-item';
    li.innerHTML = `
      <span>${domain}</span>
      <button data-domain="${domain}">Remove</button>
    `;
    
    li.querySelector('button').addEventListener('click', (e) => {
      const domainToRemove = e.target.dataset.domain;
      const index = settings.excludedDomains.indexOf(domainToRemove);
      if (index > -1) {
        settings.excludedDomains.splice(index, 1);
        li.remove();
      }
    });
    
    domainList.appendChild(li);
  }
});