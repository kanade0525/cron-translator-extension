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
  
  return 'Invalid cron expression';
}

function translateStandardCron(parts) {
  const [minute, hour, day, month, weekday] = parts;
  let result = 'Runs ';
  
  // Time
  if (minute === '*' && hour === '*') {
    result += 'every minute';
  } else if (minute === '0' && hour === '*') {
    result += 'every hour';
  } else if (minute === '*') {
    result += `every minute at ${translateHour(hour)}`;
  } else if (hour === '*') {
    result += `at minute ${minute} of every hour`;
  } else {
    result += `at ${translateHour(hour)}:${minute.padStart(2, '0')}`;
  }
  
  // Day and month
  if (day !== '*' && month !== '*') {
    result += ` on day ${day} of ${translateMonth(month)}`;
  } else if (day !== '*') {
    result += ` on day ${day} of every month`;
  } else if (month !== '*') {
    result += ` in ${translateMonth(month)}`;
  }
  
  // Weekday
  if (weekday !== '*' && weekday !== '?') {
    result += ` on ${translateWeekday(weekday)}`;
  }
  
  return result;
}

function translateCronWithSeconds(parts) {
  const [second, ...rest] = parts;
  let base = translateStandardCron(rest);
  
  if (second !== '*' && second !== '0') {
    base = base.replace('Runs ', `Runs at second ${second}, `);
  }
  
  return base;
}

function translateCronWithYear(parts) {
  const base = translateCronWithSeconds(parts.slice(0, 6));
  const year = parts[6];
  
  if (year !== '*') {
    return base + ` in ${year}`;
  }
  
  return base;
}

function translateHour(hour) {
  if (hour === '*') return 'every hour';
  if (hour.includes('/')) {
    const [start, interval] = hour.split('/');
    return `every ${interval} hours starting at ${start}`;
  }
  if (hour.includes('-')) {
    const [start, end] = hour.split('-');
    return `${start} to ${end}`;
  }
  if (hour.includes(',')) {
    return hour.split(',').join(', ');
  }
  return hour;
}

function translateMonth(month) {
  const months = {
    '1': 'January', 'JAN': 'January',
    '2': 'February', 'FEB': 'February',
    '3': 'March', 'MAR': 'March',
    '4': 'April', 'APR': 'April',
    '5': 'May', 'MAY': 'May',
    '6': 'June', 'JUN': 'June',
    '7': 'July', 'JUL': 'July',
    '8': 'August', 'AUG': 'August',
    '9': 'September', 'SEP': 'September',
    '10': 'October', 'OCT': 'October',
    '11': 'November', 'NOV': 'November',
    '12': 'December', 'DEC': 'December'
  };
  
  if (month === '*') return 'every month';
  if (month.includes(',')) {
    return month.split(',').map(m => months[m.toUpperCase()] || m).join(', ');
  }
  
  return months[month.toUpperCase()] || month;
}

function translateWeekday(weekday) {
  const days = {
    '0': 'Sunday', 'SUN': 'Sunday',
    '1': 'Monday', 'MON': 'Monday',
    '2': 'Tuesday', 'TUE': 'Tuesday',
    '3': 'Wednesday', 'WED': 'Wednesday',
    '4': 'Thursday', 'THU': 'Thursday',
    '5': 'Friday', 'FRI': 'Friday',
    '6': 'Saturday', 'SAT': 'Saturday',
    '7': 'Sunday'
  };
  
  if (weekday === '*') return 'every day';
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