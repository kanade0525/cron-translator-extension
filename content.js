// Cron expression pattern - 最適化版
const CRON_REGEX = /\b(\*|\?|\d{1,2}|\d{1,2}-\d{1,2}|\d{1,2}\/\d{1,2}|\*\/\d{1,2}|[A-Z]{3})([\s\t]+(\*|\?|\d{1,2}|\d{1,2}-\d{1,2}|\d{1,2}\/\d{1,2}|\*\/\d{1,2}|[A-Z]{3})){4,6}\b/gi;

let settings = {
  enabled: true,
  excludedDomains: [],
  showTooltip: true,
  showInline: false,
  translationDelay: 500
};

let processedElements = new WeakSet();
let isProcessing = false;
let pendingMutations = [];

// Load settings
chrome.storage.sync.get(settings, (result) => {
  settings = { ...settings, ...result };
  if (settings.enabled && !isExcludedDomain()) {
    // 少し遅延させて初期化
    setTimeout(() => initializeTranslator(), 500);
  }
});

// Listen for settings changes
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
  // 初期スキャン - 表示領域のみ
  scanVisibleArea();

  // スクロール時に新しい領域をスキャン
  let scrollTimeout;
  window.addEventListener('scroll', () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => scanVisibleArea(), 200);
  }, { passive: true });

  // 動的コンテンツ用のオブザーバー
  setupMutationObserver();
}

function scanVisibleArea() {
  if (isProcessing) return;
  isProcessing = true;

  // ビューポート内の要素のみを処理
  const viewportHeight = window.innerHeight;
  const scrollTop = window.scrollY;
  const visibleBottom = scrollTop + viewportHeight;

  // 一般的なテキストコンテナを選択
  const elements = document.querySelectorAll('p, li, td, pre, code, span, div');
  let processed = 0;

  for (const element of elements) {
    if (processed >= 50) break; // 一度に処理する要素数を制限

    const rect = element.getBoundingClientRect();
    const absoluteTop = rect.top + scrollTop;

    // ビューポート内の要素のみ処理
    if (absoluteTop < visibleBottom && absoluteTop + rect.height > scrollTop) {
      if (!processedElements.has(element) && element.textContent && element.textContent.includes('*')) {
        processElement(element);
        processedElements.add(element);
        processed++;
      }
    }
  }

  isProcessing = false;
}

function setupMutationObserver() {
  let mutationTimeout;

  const observer = new MutationObserver((mutations) => {
    // デバウンス処理
    clearTimeout(mutationTimeout);
    mutationTimeout = setTimeout(() => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE && node.textContent && node.textContent.includes('*')) {
              if (!processedElements.has(node)) {
                processElement(node);
                processedElements.add(node);
              }
            }
          }
        }
      }
    }, 100);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

function processElement(element) {
  // すでに処理済みの要素はスキップ
  if (element.querySelector('.cron-wrapper')) return;

  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (parent.tagName === 'SCRIPT' ||
            parent.tagName === 'STYLE' ||
            parent.classList.contains('cron-wrapper') ||
            parent.classList.contains('cron-tooltip')) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  const nodesToProcess = [];
  let node;
  while (node = walker.nextNode()) {
    if (node.textContent && CRON_REGEX.test(node.textContent)) {
      nodesToProcess.push(node);
    }
  }

  nodesToProcess.forEach(node => highlightCronInNode(node));
}

function highlightCronInNode(textNode) {
  const text = textNode.textContent;
  const matches = [...text.matchAll(CRON_REGEX)];

  if (matches.length === 0) return;

  const parent = textNode.parentElement;
  const fragment = document.createDocumentFragment();
  let lastIndex = 0;

  for (const match of matches) {
    const cronExpression = match[0];
    const index = match.index;

    // Cron式の前のテキスト
    if (index > lastIndex) {
      fragment.appendChild(document.createTextNode(text.substring(lastIndex, index)));
    }

    // Cron式をラップ
    if (isCronExpression(cronExpression)) {
      const wrapper = createCronWrapper(cronExpression);
      fragment.appendChild(wrapper);
    } else {
      fragment.appendChild(document.createTextNode(cronExpression));
    }

    lastIndex = index + cronExpression.length;
  }

  // 残りのテキスト
  if (lastIndex < text.length) {
    fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
  }

  parent.replaceChild(fragment, textNode);
  updateTranslationCount();
}

function createCronWrapper(cronExpression) {
  const wrapper = document.createElement('span');
  wrapper.className = 'cron-wrapper';
  wrapper.style.cssText = `
    position: relative;
    background: linear-gradient(to bottom, transparent 60%, rgba(76, 175, 80, 0.2) 60%);
    padding: 0 2px;
    cursor: help;
    border-radius: 2px;
  `;
  wrapper.textContent = cronExpression;

  // ツールチップ
  const tooltip = document.createElement('span');
  tooltip.className = 'cron-tooltip';
  tooltip.style.cssText = `
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    background: #333;
    color: white;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 14px;
    white-space: nowrap;
    z-index: 10000;
    display: none;
    margin-bottom: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    max-width: 300px;
    pointer-events: none;
  `;

  // 矢印
  const arrow = document.createElement('span');
  arrow.style.cssText = `
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 6px solid transparent;
    border-top-color: #333;
    width: 0;
    height: 0;
  `;
  tooltip.appendChild(arrow);

  const translation = translateCron(cronExpression);
  tooltip.insertBefore(document.createTextNode(translation), arrow);
  wrapper.appendChild(tooltip);

  // ホバーイベント
  let hoverTimeout;
  wrapper.addEventListener('mouseenter', () => {
    hoverTimeout = setTimeout(() => {
      tooltip.style.display = 'block';
    }, settings.translationDelay);
  });

  wrapper.addEventListener('mouseleave', () => {
    clearTimeout(hoverTimeout);
    tooltip.style.display = 'none';
  });

  return wrapper;
}

function isCronExpression(text) {
  const parts = text.trim().split(/\s+/);
  if (parts.length < 5 || parts.length > 7) return false;

  return parts.every(part => {
    return part === '*' ||
           part === '?' ||
           /^\d+$/.test(part) ||
           /^\d+-\d+$/.test(part) ||
           /^\*\/\d+$/.test(part) ||
           /^\d+\/\d+$/.test(part) ||
           /^[A-Z]{3}$/i.test(part) ||
           /^\d+(,\d+)*$/.test(part);
  });
}

function translateCron(expression) {
  const parts = expression.trim().split(/\s+/);

  if (parts.length === 5) {
    return translateStandardCron(parts);
  } else if (parts.length === 6) {
    return translateCronWithSeconds(parts);
  } else if (parts.length === 7) {
    return translateCronWithYear(parts);
  }

  return '無効なCron式';
}

function translateStandardCron(parts) {
  const [minute, hour, day, month, weekday] = parts;
  let result = '';

  // Time
  if (minute === '*' && hour === '*') {
    result += '毎分';
  } else if (minute === '0' && hour === '*') {
    result += '毎時0分';
  } else if (minute === '*') {
    result += `${translateHour(hour)}の毎分`;
  } else if (hour === '*') {
    result += `毎時${minute}分`;
  } else {
    result += `${translateHour(hour)}時${minute.padStart(2, '0')}分`;
  }

  // Day and month
  if (day !== '*' && month !== '*') {
    result += ` ${translateMonth(month)}${day}日`;
  } else if (day !== '*') {
    result += ` 毎月${day}日`;
  } else if (month !== '*') {
    result += ` ${translateMonth(month)}`;
  }

  // Weekday
  if (weekday !== '*' && weekday !== '?') {
    result += ` ${translateWeekday(weekday)}`;
  }

  return result;
}

function translateCronWithSeconds(parts) {
  const [second, ...rest] = parts;
  let base = translateStandardCron(rest);

  if (second !== '*' && second !== '0') {
    base = `${second}秒 ` + base;
  }

  return base;
}

function translateCronWithYear(parts) {
  const base = translateCronWithSeconds(parts.slice(0, 6));
  const year = parts[6];

  if (year !== '*') {
    return base + ` ${year}年`;
  }

  return base;
}

function translateHour(hour) {
  if (hour === '*') return '毎時';
  if (hour.includes('/')) {
    const [start, interval] = hour.split('/');
    return `${start}時から${interval}時間ごと`;
  }
  if (hour.includes('-')) {
    const [start, end] = hour.split('-');
    return `${start}時〜${end}時`;
  }
  if (hour.includes(',')) {
    return hour.split(',').join(', ');
  }
  return hour;
}

function translateMonth(month) {
  const months = {
    '1': '1月', 'JAN': '1月',
    '2': '2月', 'FEB': '2月',
    '3': '3月', 'MAR': '3月',
    '4': '4月', 'APR': '4月',
    '5': '5月', 'MAY': '5月',
    '6': '6月', 'JUN': '6月',
    '7': '7月', 'JUL': '7月',
    '8': '8月', 'AUG': '8月',
    '9': '9月', 'SEP': '9月',
    '10': '10月', 'OCT': '10月',
    '11': '11月', 'NOV': '11月',
    '12': '12月', 'DEC': '12月'
  };

  if (month === '*') return '毎月';
  if (month.includes(',')) {
    return month.split(',').map(m => months[m.toUpperCase()] || m).join(', ');
  }

  return months[month.toUpperCase()] || month;
}

function translateWeekday(weekday) {
  const days = {
    '0': '日曜日', 'SUN': '日曜日',
    '1': '月曜日', 'MON': '月曜日',
    '2': '火曜日', 'TUE': '火曜日',
    '3': '水曜日', 'WED': '水曜日',
    '4': '木曜日', 'THU': '木曜日',
    '5': '金曜日', 'FRI': '金曜日',
    '6': '土曜日', 'SAT': '土曜日',
    '7': '日曜日'
  };

  if (weekday === '*') return '毎日';
  if (weekday.includes(',')) {
    return weekday.split(',').map(d => days[d.toUpperCase()] || d).join(', ');
  }

  return days[weekday.toUpperCase()] || weekday;
}

function updateTranslationCount() {
  const today = new Date().toDateString();
  chrome.storage.sync.get(['lastCountDate', 'todayCount'], (result) => {
    let count = result.todayCount || 0;

    if (result.lastCountDate !== today) {
      count = 0;
    }

    count++;

    chrome.storage.sync.set({
      lastCountDate: today,
      todayCount: count
    });
  });
}

function removeAllTranslations() {
  document.querySelectorAll('.cron-wrapper').forEach(wrapper => {
    const text = wrapper.textContent;
    const textNode = document.createTextNode(text);
    wrapper.parentNode.replaceChild(textNode, wrapper);
  });
  processedElements = new WeakSet();
}

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'toggleEnabled') {
    settings.enabled = request.enabled;
    if (settings.enabled && !isExcludedDomain()) {
      initializeTranslator();
    } else {
      removeAllTranslations();
    }
  }
});