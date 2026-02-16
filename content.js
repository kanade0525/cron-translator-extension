// Cron expression pattern
const CRON_REGEX = /\b(\*|\?|\d{1,2}|\d{1,2}-\d{1,2}|\d{1,2}\/\d{1,2}|\*\/\d{1,2}|[A-Z]{3})([\s\t]+(\*|\?|\d{1,2}|\d{1,2}-\d{1,2}|\d{1,2}\/\d{1,2}|\*\/\d{1,2}|[A-Z]{3})){4,6}\b/gi;

let settings = {
  enabled: true,
  excludedDomains: [],
  showTooltip: true,
  showInline: false,
  translationDelay: 500
};

let currentTooltip = null;

// Load settings
chrome.storage.sync.get(settings, (result) => {
  settings = { ...settings, ...result };
  if (settings.enabled && !isExcludedDomain()) {
    initializeTranslator();
  }
});

// Listen for settings changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync') {
    Object.keys(changes).forEach(key => {
      settings[key] = changes[key].newValue;
    });

    if (!settings.enabled || isExcludedDomain()) {
      removeTooltip();
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
  // マウス選択時のみ翻訳を表示
  document.addEventListener('mouseup', handleTextSelection);
  document.addEventListener('selectionchange', handleSelectionChange);

  // クリックで翻訳を隠す
  document.addEventListener('mousedown', removeTooltip);
}

function handleTextSelection(e) {
  if (!settings.enabled || isExcludedDomain()) return;

  const selection = window.getSelection();
  const selectedText = selection.toString().trim();

  if (selectedText && isCronExpression(selectedText)) {
    showTranslation(selectedText, e.clientX, e.clientY);
    updateTranslationCount();
  }
}

function handleSelectionChange() {
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();

  if (!selectedText || !isCronExpression(selectedText)) {
    removeTooltip();
  }
}

function isCronExpression(text) {
  const trimmed = text.trim();
  const parts = trimmed.split(/\s+/);

  if (parts.length < 5 || parts.length > 7) return false;

  // Basic validation
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

function showTranslation(cronExpression, x, y) {
  removeTooltip();

  const translation = translateCron(cronExpression);

  currentTooltip = document.createElement('div');
  currentTooltip.style.cssText = `
    position: fixed;
    background: #333;
    color: white;
    padding: 10px 14px;
    border-radius: 6px;
    font-size: 14px;
    z-index: 999999;
    box-shadow: 0 2px 12px rgba(0,0,0,0.3);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.4;
    max-width: 300px;
    pointer-events: none;
  `;

  currentTooltip.textContent = translation;
  document.body.appendChild(currentTooltip);

  // Position tooltip
  const rect = currentTooltip.getBoundingClientRect();
  let top = y - rect.height - 10;
  let left = x - rect.width / 2;

  // Keep tooltip in viewport
  if (top < 10) top = y + 20;
  if (left < 10) left = 10;
  if (left + rect.width > window.innerWidth - 10) {
    left = window.innerWidth - rect.width - 10;
  }

  currentTooltip.style.top = top + 'px';
  currentTooltip.style.left = left + 'px';
}

function removeTooltip() {
  if (currentTooltip) {
    currentTooltip.remove();
    currentTooltip = null;
  }
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

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'toggleEnabled') {
    settings.enabled = request.enabled;
    if (!settings.enabled) {
      removeTooltip();
    }
  }
});