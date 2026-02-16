// 超軽量版 - 右クリックメニューからのみ動作
// ページ読み込み時は何もしない - イベントリスナーも最小限

let currentTooltip = null;

// 右クリックメニューから呼ばれた時のみ実行
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'translateSelection') {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    if (selectedText && isCronExpression(selectedText)) {
      const translation = translateCron(selectedText);
      showTooltip(translation);

      // 翻訳カウントを更新
      updateTranslationCount();

      sendResponse({success: true, translation: translation});
    } else {
      sendResponse({success: false, message: '有効なCron式ではありません'});
    }
  }
  return true;
});

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

function showTooltip(text) {
  // 既存のツールチップを削除
  if (currentTooltip) {
    currentTooltip.remove();
  }

  currentTooltip = document.createElement('div');
  currentTooltip.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: #333;
    color: white;
    padding: 16px 20px;
    border-radius: 8px;
    font-size: 16px;
    z-index: 999999;
    box-shadow: 0 4px 16px rgba(0,0,0,0.4);
    max-width: 400px;
    text-align: center;
    cursor: pointer;
  `;
  currentTooltip.textContent = text;
  currentTooltip.title = 'クリックで閉じる';

  // クリックで閉じる
  currentTooltip.addEventListener('click', () => {
    if (currentTooltip) {
      currentTooltip.remove();
      currentTooltip = null;
    }
  });

  document.body.appendChild(currentTooltip);

  // 5秒後に自動削除
  setTimeout(() => {
    if (currentTooltip) {
      currentTooltip.remove();
      currentTooltip = null;
    }
  }, 5000);
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