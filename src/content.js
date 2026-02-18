import { isCronExpression, extractCronFromParentheses } from './validator.js';
import { translateCron } from './translator.js';
import { scanVisibleArea, setupMutationObserver, removeAllTranslations } from './dom.js';

// 設定
let settings = {
  enabled: true,
  excludedDomains: [],
  showTooltip: true,
  showInline: false,
  translationDelay: 500,
};

// 設定の読み込み
chrome.storage.sync.get(settings, (result) => {
  settings = { ...settings, ...result };
  if (settings.enabled && !isExcludedDomain()) {
    setTimeout(() => initializeTranslator(), 500);
  }
});

// 設定変更の監視
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync') {
    Object.keys(changes).forEach(key => {
      settings[key] = changes[key].newValue;
    });

    if (settings.enabled && !isExcludedDomain()) {
      initializeTranslator();
    } else {
      removeAllTranslations();
    }
  }
});

function isExcludedDomain() {
  const currentDomain = window.location.hostname.toLowerCase();
  return settings.excludedDomains.some(domain =>
    currentDomain.includes(domain.toLowerCase())
  );
}

function initializeTranslator() {
  scanVisibleArea();

  let scrollTimeout;
  window.addEventListener('scroll', () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => scanVisibleArea(), 200);
  }, { passive: true });

  setupMutationObserver();
}

// popup/background からのメッセージ処理
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'toggleEnabled') {
    settings.enabled = request.enabled;
    if (settings.enabled && !isExcludedDomain()) {
      initializeTranslator();
    } else {
      removeAllTranslations();
    }
  } else if (request.action === 'translateSelection') {
    const selection = window.getSelection().toString().trim();
    if (selection) {
      const { expression: expressionToTranslate } = extractCronFromParentheses(selection);

      if (isCronExpression(expressionToTranslate)) {
        const translation = translateCron(expressionToTranslate);
        alert(`Cron式: ${selection}\n翻訳: ${translation}`);
        sendResponse({ success: true });
      } else {
        alert('選択されたテキストは有効なCron式ではありません');
        sendResponse({ success: false, message: 'Not a valid cron expression' });
      }
    } else {
      sendResponse({ success: false, message: 'No selection' });
    }
    return true;
  }
});
