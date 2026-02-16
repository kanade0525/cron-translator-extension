// Cron expression pattern
const CRON_REGEX = /\b(\*|\?|\d{1,2}|\d{1,2}-\d{1,2}|\d{1,2}\/\d{1,2}|\*\/\d{1,2}|[A-Z]{3})([\s\t]+(\*|\?|\d{1,2}|\d{1,2}-\d{1,2}|\d{1,2}\/\d{1,2}|\*\/\d{1,2}|[A-Z]{3})){4,6}\b/gi;

let settings = {
  enabled: true,
  excludedDomains: [],
  showTooltip: true,
  showInline: false,
  translationDelay: 500
};

let translationCount = 0;

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
  // Scan the page initially
  scanAndTranslate();
  
  // Set up mutation observer for dynamic content
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            processTextNode(node);
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            scanElement(node);
          }
        });
      }
    });
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

function scanAndTranslate() {
  scanElement(document.body);
}

function scanElement(element) {
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        // Skip script and style tags
        if (node.parentElement.tagName === 'SCRIPT' || 
            node.parentElement.tagName === 'STYLE' ||
            node.parentElement.classList.contains('cron-translation')) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );
  
  let node;
  while (node = walker.nextNode()) {
    processTextNode(node);
  }
}

function processTextNode(textNode) {
  const text = textNode.textContent;
  const matches = text.matchAll(CRON_REGEX);
  
  for (const match of matches) {
    const cronExpression = match[0];
    if (isCronExpression(cronExpression)) {
      highlightCronExpression(textNode, cronExpression);
    }
  }
}

function isCronExpression(text) {
  const parts = text.trim().split(/\s+/);
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

function highlightCronExpression(textNode, cronExpression) {
  const parent = textNode.parentElement;
  if (parent.classList && parent.classList.contains('cron-wrapper')) {
    return; // Already processed
  }
  
  const text = textNode.textContent;
  const index = text.indexOf(cronExpression);
  
  if (index !== -1) {
    const before = text.substring(0, index);
    const after = text.substring(index + cronExpression.length);
    
    const wrapper = document.createElement('span');
    wrapper.className = 'cron-wrapper';
    
    if (before) {
      parent.insertBefore(document.createTextNode(before), textNode);
    }
    
    const cronElement = createCronElement(cronExpression);
    parent.insertBefore(cronElement, textNode);
    
    if (after) {
      parent.insertBefore(document.createTextNode(after), textNode);
    }
    
    parent.removeChild(textNode);
    
    // Increment translation count
    translationCount++;
    updateTranslationCount();
  }
}

function createCronElement(cronExpression) {
  const wrapper = document.createElement('span');
  wrapper.className = 'cron-wrapper';
  wrapper.setAttribute('data-cron', cronExpression);
  
  const cronSpan = document.createElement('span');
  cronSpan.className = 'cron-expression';
  cronSpan.textContent = cronExpression;
  wrapper.appendChild(cronSpan);
  
  const translation = translateCron(cronExpression);
  
  if (settings.showTooltip) {
    const tooltip = document.createElement('span');
    tooltip.className = 'cron-tooltip';
    tooltip.textContent = translation;
    wrapper.appendChild(tooltip);
    
    // Show tooltip on hover
    wrapper.addEventListener('mouseenter', () => {
      setTimeout(() => {
        tooltip.style.display = 'block';
      }, settings.translationDelay);
    });
    
    wrapper.addEventListener('mouseleave', () => {
      tooltip.style.display = 'none';
    });
  }
  
  if (settings.showInline) {
    const inline = document.createElement('span');
    inline.className = 'cron-inline';
    inline.textContent = ` (${translation})`;
    wrapper.appendChild(inline);
  }
  
  return wrapper;
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
    const cronText = wrapper.querySelector('.cron-expression').textContent;
    const textNode = document.createTextNode(cronText);
    wrapper.parentNode.replaceChild(textNode, wrapper);
  });
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