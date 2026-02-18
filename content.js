// Cron expression patterns
// 標準形式: 5-7フィールドのCron式
const STANDARD_CRON_REGEX = /([\d\*\?\/\-,]+)\s+([\d\*\?\/\-,]+)\s+([\d\*\?\/\-,LW]+)\s+([\d\*\?\/\-,]+|[A-Z]{3})\s+([\d\*\?\/\-,#]+|[A-Z]{3}(?:-[A-Z]{3})?)(?:\s+([\d\*\?\/\-,]+))?(?:\s+([\d\*\?\/\-,]+))?/gi;

// 括弧付き形式: cron(expression) - AWS EventBridge, Jenkins等で使用
const PARENTHESES_CRON_REGEX = /cron\s*\(([^)]+)\)/gi;

// 統合パターン
const CRON_REGEX = new RegExp(
  `(?:${PARENTHESES_CRON_REGEX.source})|(?:${STANDARD_CRON_REGEX.source})`,
  'gi'
);

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
    let cronExpression = match[0];
    const index = match.index;

    // Cron式の前のテキスト
    if (index > lastIndex) {
      fragment.appendChild(document.createTextNode(text.substring(lastIndex, index)));
    }

    // 括弧付き形式の場合、括弧内の式を抽出
    let actualExpression = cronExpression;
    let isParenthesesFormat = false;
    if (cronExpression.startsWith('cron')) {
      const parenMatch = cronExpression.match(/cron\s*\(([^)]+)\)/);
      if (parenMatch) {
        actualExpression = parenMatch[1].trim();
        isParenthesesFormat = true;
      }
    }

    // Cron式をラップ
    if (isCronExpression(actualExpression)) {
      const wrapper = createCronWrapper(cronExpression, actualExpression);
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

function createCronWrapper(displayExpression, actualExpression) {
  // displayExpressionは表示用（cron(...)を含む）
  // actualExpressionは翻訳用（括弧内の実際の式）
  const expressionToTranslate = actualExpression || displayExpression;

  const wrapper = document.createElement('span');
  wrapper.className = 'cron-wrapper';
  wrapper.style.cssText = `
    position: relative;
    background: linear-gradient(to bottom, transparent 60%, rgba(76, 175, 80, 0.2) 60%);
    padding: 0 2px;
    cursor: help;
    border-radius: 2px;
  `;
  wrapper.textContent = displayExpression;

  // ツールチップ（固定位置で表示）
  const tooltip = document.createElement('div');
  tooltip.className = 'cron-tooltip';
  tooltip.style.cssText = `
    position: fixed;
    background: #333;
    color: white;
    padding: 10px 14px;
    border-radius: 6px;
    font-size: 14px;
    white-space: normal;
    z-index: 2147483647;
    display: none;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    max-width: 500px;
    min-width: 200px;
    pointer-events: none;
    line-height: 1.5;
    word-wrap: break-word;
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

  const translation = translateCron(expressionToTranslate);
  tooltip.insertBefore(document.createTextNode(translation), arrow);

  // ホバーイベント
  let hoverTimeout;
  wrapper.addEventListener('mouseenter', (e) => {
    hoverTimeout = setTimeout(() => {
      // ツールチップをbodyに追加（まだ追加されていない場合）
      if (!document.body.contains(tooltip)) {
        document.body.appendChild(tooltip);
      }

      // 要素の位置を取得
      const rect = wrapper.getBoundingClientRect();
      const tooltipHeight = 50; // 推定高さ

      // 位置を計算
      let top = rect.top - tooltipHeight - 10;
      let left = rect.left + rect.width / 2;

      // 画面上部からはみ出る場合は下に表示
      if (top < 10) {
        top = rect.bottom + 10;
        arrow.style.borderTopColor = 'transparent';
        arrow.style.borderBottomColor = '#333';
        arrow.style.top = '-12px';
      } else {
        arrow.style.borderBottomColor = 'transparent';
        arrow.style.borderTopColor = '#333';
        arrow.style.top = '100%';
      }

      tooltip.style.display = 'block';

      // 実際の幅を取得して中央揃え
      const tooltipRect = tooltip.getBoundingClientRect();
      left = rect.left + rect.width / 2 - tooltipRect.width / 2;

      // 画面端からはみ出ないように調整
      const margin = 10;
      if (left < margin) {
        left = margin;
      } else if (left + tooltipRect.width > window.innerWidth - margin) {
        left = window.innerWidth - tooltipRect.width - margin;
      }

      tooltip.style.top = `${top}px`;
      tooltip.style.left = `${left}px`;
    }, settings.translationDelay);
  });

  wrapper.addEventListener('mouseleave', () => {
    clearTimeout(hoverTimeout);
    if (tooltip) {
      tooltip.style.display = 'none';
    }
  });

  // スクロール時にツールチップを非表示
  window.addEventListener('scroll', () => {
    if (tooltip && tooltip.style.display === 'block') {
      tooltip.style.display = 'none';
    }
  }, { passive: true });

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
           /^\d+(,\d+)+$/.test(part) ||
           /^\*\/\d+$/.test(part) ||
           /^\d+\/\d+$/.test(part) ||
           /^[A-Z]{3}$/i.test(part) ||
           /^[A-Z]{3}-[A-Z]{3}$/i.test(part) ||
           /^\d+L?W?$/.test(part) ||
           /^L$/.test(part) ||
           /^\d+#\d+$/.test(part);
  });
}

function translateCron(expression) {
  const parts = expression.trim().split(/\s+/);

  if (parts.length === 5) {
    return translateStandardCron(parts);
  } else if (parts.length === 6) {
    // 6フィールドの場合、AWS形式か秒付き形式かを判定
    return translateSixFieldCron(parts);
  } else if (parts.length === 7) {
    return translateCronWithYear(parts);
  }

  return '無効なCron式';
}

function translateStandardCron(parts) {
  const [minute, hour, day, month, weekday] = parts;
  let timeStr = '';
  let scheduleStr = '';

  // 時刻の翻訳 - より親切に
  if (minute === '*' && hour === '*') {
    timeStr = '毎分';
  } else if (minute === '0' && hour === '*') {
    timeStr = '毎時0分';
  } else if (minute.includes('/')) {
    const [start, interval] = minute.split('/');
    if (start === '*') {
      timeStr = `${interval}分ごと`;
    } else {
      timeStr = `${start}分から${interval}分ごと`;
    }
    if (hour !== '*') {
      if (hour.includes('-')) {
        const [startHour, endHour] = hour.split('-');
        timeStr = `${startHour}時から${endHour}時の間、${timeStr}`;
      } else {
        timeStr += ` (${translateHour(hour)}時台)`;
      }
    }
  } else if (hour.startsWith('*/')) {
    const interval = hour.substring(2);
    if (minute === '0') {
      timeStr = `${interval}時間ごと（各時間の0分）`;
    } else if (minute === '*') {
      timeStr = `${interval}時間ごとの毎分`;
    } else {
      timeStr = `${interval}時間ごと（各時間の${minute}分）`;
    }
  } else if (minute === '*') {
    timeStr = `${translateHour(hour)}時台の毎分`;
  } else if (hour === '*') {
    if (minute.includes(',')) {
      const mins = minute.split(',').map(m => `${m}分`).join('、');
      timeStr = `毎時${mins}`;
    } else {
      timeStr = `毎時${minute}分`;
    }
  } else {
    // 具体的な時刻指定
    if (hour.includes(',')) {
      const hours = hour.split(',').map(h => `${h}時`).join('、');
      timeStr = `${hours}の${minute.padStart(2, '0')}分`;
    } else if (hour.includes('-')) {
      // 時間範囲の場合
      const [startHour, endHour] = hour.split('-');
      if (minute === '*') {
        timeStr = `${startHour}時から${endHour}時の毎分`;
      } else if (minute.includes(',')) {
        const mins = minute.split(',').map(m => `${m}分`).join('、');
        timeStr = `${startHour}時から${endHour}時の毎時${mins}`;
      } else {
        timeStr = `${startHour}時から${endHour}時の毎時${minute}分`;
      }
    } else {
      const h = parseInt(hour);
      const m = minute.padStart(2, '0');
      timeStr = `${h}時${m}分`;
    }
  }

  // 日付と月の翻訳
  let dayStr = '';
  let monthStr = '';
  let weekdayStr = '';

  // 月の処理
  if (month !== '*') {
    if (month.startsWith('*/')) {
      const interval = month.substring(2);
      monthStr = `${interval}ヶ月ごと`;
    } else {
      monthStr = translateMonth(month);
    }
  }

  // 日の処理
  if (day !== '*' && day !== '?') {
    if (day === 'L') {
      dayStr = '月末';
    } else if (day.includes('W')) {
      const dayNum = day.replace('W', '');
      dayStr = `${dayNum}日に最も近い平日`;
    } else {
      dayStr = `${day}日`;
    }
  }

  // 曜日の処理
  if (weekday !== '*' && weekday !== '?') {
    weekdayStr = translateWeekday(weekday);
  }

  // スケジュール文字列の組み立て
  if (monthStr && dayStr) {
    scheduleStr = `${monthStr}の${dayStr}`;
  } else if (dayStr) {
    scheduleStr = `毎月${dayStr}`;
  } else if (monthStr) {
    scheduleStr = monthStr;
  }

  // 曜日の追加
  if (weekdayStr) {
    if (scheduleStr) {
      scheduleStr = `${weekdayStr}（${scheduleStr}）`;
    } else {
      scheduleStr = weekdayStr;
    }
  }

  // 最終的な結果の組み立て
  if (!scheduleStr && (day === '*' || day === '?') && month === '*' && (weekday === '*' || weekday === '?')) {
    // 毎日実行
    scheduleStr = '毎日';
  }

  // 時刻とスケジュールを組み合わせ
  if (scheduleStr) {
    return `${scheduleStr}の${timeStr}に実行`;
  } else {
    return `${timeStr}に実行`;
  }
}

function translateSixFieldCron(parts) {
  // 6フィールドの判定：
  // AWS EventBridge形式: 分 時 日 月 曜日 年
  // 秒付き形式: 秒 分 時 日 月 曜日

  const firstField = parts[0];
  const secondField = parts[1];
  const thirdField = parts[2];
  const fifthField = parts[4];
  const lastField = parts[5];

  // AWS EventBridge形式の判定条件
  // 1. 最後のフィールドが4桁の年
  // 2. 5番目のフィールドが曜日を示す（?, 曜日名, #記号）
  // 3. 2番目のフィールドが時間として妥当（0-23または*）
  const isAWSFormat =
    /^\d{4}$/.test(lastField) || // 年が指定されている
    (fifthField === '?' || // 曜日の指定なし
     /^[A-Z]{3}/i.test(fifthField) || // 曜日名（MON, TUEなど）
     /^\d+#\d+$/.test(fifthField) || // 第N曜日（1#2など）
     /^\d+L$/.test(fifthField)) && // 最終曜日（5Lなど）
    !/^\*\/\d+$/.test(secondField); // 2番目が*/数字でない（時間として不自然）

  // 秒付き形式の判定条件
  // 1. 最初のフィールドが秒として妥当（0-59, *, */数字）
  // 2. 2番目のフィールドが*/数字の形式（時間フィールドとしては不自然）
  const isSecondsFormat =
    (/^\d+$/.test(firstField) && parseInt(firstField) <= 59) || // 0-59の数字
    firstField === '*' || // アスタリスク
    /^\*\/\d+$/.test(firstField) || // */数字の間隔
    /^\*\/\d+$/.test(secondField); // 2番目が*/数字（時間としては不自然）

  if (isAWSFormat && !isSecondsFormat) {
    // AWS形式: 分 時 日 月 曜日 年
    return translateAWSCron(parts);
  } else {
    // 秒付き形式: 秒 分 時 日 月 曜日
    return translateCronWithSeconds(parts);
  }
}

function translateAWSCron(parts) {
  const [minute, hour, day, month, weekday, year] = parts;

  // 標準5フィールド形式として翻訳（年は無視）
  let base = translateStandardCron([minute, hour, day, month, weekday]);

  if (year && year !== '*' && /^\d{4}$/.test(year)) {
    base = base.replace('に実行', `（${year}年）に実行`);
  }

  return base;
}

function translateCronWithSeconds(parts) {
  const [second, minute, hour, day, month, weekday] = parts;

  // 秒付き形式：秒 分 時 日 月 曜日
  let base = translateStandardCron([minute, hour, day, month, weekday]);

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
    if (start === '*') {
      return `${interval}時間ごと`;
    }
    return `${start}時から${interval}時間ごと`;
  }
  if (hour.includes('-')) {
    const [start, end] = hour.split('-');
    return `${start}時〜${end}時`;
  }
  if (hour.includes(',')) {
    return hour.split(',').map(h => `${h}時`).join('と');
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
  if (month === '?') return '';

  // 範囲指定
  if (month.includes('-')) {
    const [start, end] = month.split('-');
    const startMonth = months[start.toUpperCase()] || months[start] || start;
    const endMonth = months[end.toUpperCase()] || months[end] || end;
    return `${startMonth}から${endMonth}`;
  }

  // カンマ区切り
  if (month.includes(',')) {
    return month.split(',').map(m => months[m.toUpperCase()] || months[m] || m).join('と');
  }

  // インターバル
  if (month.includes('/')) {
    const [start, interval] = month.split('/');
    if (start === '*') {
      return `${interval}ヶ月ごと`;
    }
    const startMonth = months[start] || start;
    return `${startMonth}から${interval}ヶ月ごと`;
  }

  return months[month.toUpperCase()] || months[month] || month;
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
  if (weekday === '?') return '';

  // 範囲指定（例: MON-FRI, 1-5）
  if (weekday.includes('-')) {
    const [start, end] = weekday.split('-');
    const startDay = days[start.toUpperCase()] || days[start] || start;
    const endDay = days[end.toUpperCase()] || days[end] || end;
    return `${startDay}から${endDay}`;
  }

  // カンマ区切り
  if (weekday.includes(',')) {
    return weekday.split(',').map(d => {
      const trimmed = d.trim();
      return days[trimmed.toUpperCase()] || days[trimmed] || trimmed;
    }).join('と');
  }

  // 特殊記号
  if (weekday.includes('#')) {
    const [day, occurrence] = weekday.split('#');
    const dayName = days[day.toUpperCase()] || days[day] || day;
    return `第${occurrence}${dayName}`;
  }

  if (weekday.includes('L')) {
    const day = weekday.replace('L', '');
    if (day) {
      const dayName = days[day.toUpperCase()] || days[day] || day;
      return `最終${dayName}`;
    }
    return '最終日';
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
  } else if (request.action === 'translateSelection') {
    // 選択されたテキストを取得して翻訳
    const selection = window.getSelection().toString().trim();
    if (selection) {
      // 括弧付き形式の場合、括弧内の式を抽出
      let expressionToTranslate = selection;
      if (selection.startsWith('cron')) {
        const parenMatch = selection.match(/cron\s*\(([^)]+)\)/);
        if (parenMatch) {
          expressionToTranslate = parenMatch[1].trim();
        }
      }

      // Cron式かチェック
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
    return true; // Async response
  }
});