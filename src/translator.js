import { MONTH_MAP, WEEKDAY_MAP } from './constants.js';

// ============================================================
// ユーティリティ
// ============================================================

function lookup(map, key) {
  return map[key.toUpperCase()] || map[key] || key;
}

// ============================================================
// フィールド単位の翻訳
// ============================================================

export function translateHour(hour) {
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

export function translateMonth(month) {
  if (month === '*') return '毎月';
  if (month === '?') return '';

  if (month.includes('-')) {
    const [start, end] = month.split('-');
    return `${lookup(MONTH_MAP, start)}から${lookup(MONTH_MAP, end)}`;
  }
  if (month.includes(',')) {
    return month.split(',').map(m => translateMonth(m.trim())).join('と');
  }
  if (month.includes('/')) {
    const [start, interval] = month.split('/');
    if (start === '*') {
      return `${interval}ヶ月ごと`;
    }
    return `${lookup(MONTH_MAP, start)}から${interval}ヶ月ごと`;
  }
  return lookup(MONTH_MAP, month);
}

export function translateWeekday(weekday) {
  if (weekday === '*') return '毎日';
  if (weekday === '?') return '';

  if (weekday.includes('-')) {
    const [start, end] = weekday.split('-');
    return `${lookup(WEEKDAY_MAP, start)}から${lookup(WEEKDAY_MAP, end)}`;
  }
  if (weekday.includes(',')) {
    return weekday.split(',').map(d => translateWeekday(d.trim())).join('と');
  }
  if (weekday.includes('#')) {
    const [day, occurrence] = weekday.split('#');
    return `第${occurrence}${lookup(WEEKDAY_MAP, day)}`;
  }
  if (weekday.includes('L')) {
    const day = weekday.replace('L', '');
    if (day) {
      return `最終${lookup(WEEKDAY_MAP, day)}`;
    }
    return '最終日';
  }
  return lookup(WEEKDAY_MAP, weekday);
}

// ============================================================
// 時刻翻訳（分 + 時の組み合わせ）
// ============================================================

export function translateTime(minute, hour) {
  if (minute === '*' && hour === '*') return '毎分';
  if (minute === '0' && hour === '*') return '毎時0分';

  if (minute.includes('/')) {
    return translateMinuteInterval(minute, hour);
  }
  if (hour.startsWith('*/')) {
    return translateHourInterval(minute, hour);
  }
  if (minute === '*') {
    return `${translateHour(hour)}時台の毎分`;
  }
  if (hour === '*') {
    return translateMinuteEveryHour(minute);
  }
  return translateSpecificTime(minute, hour);
}

function translateMinuteInterval(minute, hour) {
  const [start, interval] = minute.split('/');
  let timeStr = start === '*'
    ? `${interval}分ごと`
    : `${start}分から${interval}分ごと`;

  if (hour !== '*') {
    if (hour.includes('-')) {
      const [startHour, endHour] = hour.split('-');
      timeStr = `${startHour}時から${endHour}時の間、${timeStr}`;
    } else {
      timeStr += ` (${translateHour(hour)}時台)`;
    }
  }
  return timeStr;
}

function translateHourInterval(minute, hour) {
  const interval = hour.substring(2);
  if (minute === '0') return `${interval}時間ごと（各時間の0分）`;
  if (minute === '*') return `${interval}時間ごとの毎分`;
  return `${interval}時間ごと（各時間の${minute}分）`;
}

function translateMinuteEveryHour(minute) {
  if (minute.includes(',')) {
    const mins = minute.split(',').map(m => `${m}分`).join('、');
    return `毎時${mins}`;
  }
  return `毎時${minute}分`;
}

// Bug #3 修正: カンマ区切りの分に padStart を個別適用
function padMinute(minute) {
  if (minute.includes(',')) {
    return minute.split(',').map(m => m.padStart(2, '0')).join(',');
  }
  return minute.padStart(2, '0');
}

function translateSpecificTime(minute, hour) {
  if (hour.includes(',')) {
    const hours = hour.split(',').map(h => `${h}時`).join('、');
    return `${hours}の${padMinute(minute)}分`;
  }
  if (hour.includes('-')) {
    const [startHour, endHour] = hour.split('-');
    if (minute === '*') return `${startHour}時から${endHour}時の毎分`;
    if (minute.includes(',')) {
      const mins = minute.split(',').map(m => `${m}分`).join('、');
      return `${startHour}時から${endHour}時の毎時${mins}`;
    }
    return `${startHour}時から${endHour}時の毎時${minute}分`;
  }
  const h = parseInt(hour);
  return `${h}時${padMinute(minute)}分`;
}

// ============================================================
// スケジュール翻訳（日 + 月 + 曜日の組み立て）
// ============================================================

export function translateSchedule(day, month, weekday) {
  let monthStr = '';
  let dayStr = '';
  let weekdayStr = '';

  // 月
  if (month !== '*') {
    if (month.startsWith('*/')) {
      monthStr = `${month.substring(2)}ヶ月ごと`;
    } else {
      monthStr = translateMonth(month);
    }
  }

  // 日
  if (day !== '*' && day !== '?') {
    if (day === 'L') {
      dayStr = '月末';
    } else if (day.startsWith('*/')) {
      dayStr = `${day.substring(2)}日ごと`;
    } else if (day.endsWith('W')) {
      const dayNum = day.slice(0, -1);
      dayStr = `${dayNum}日に最も近い平日`;
    } else {
      dayStr = `${day}日`;
    }
  }

  // 曜日
  if (weekday !== '*' && weekday !== '?') {
    weekdayStr = translateWeekday(weekday);
  }

  return assembleSchedule(monthStr, dayStr, weekdayStr, day, month, weekday);
}

function assembleSchedule(monthStr, dayStr, weekdayStr, day, month, weekday) {
  let scheduleStr = '';

  if (monthStr && dayStr) {
    scheduleStr = `${monthStr}の${dayStr}`;
  } else if (dayStr) {
    scheduleStr = `毎月${dayStr}`;
  } else if (monthStr) {
    scheduleStr = monthStr;
  }

  if (weekdayStr) {
    if (scheduleStr) {
      scheduleStr = `${weekdayStr}（${scheduleStr}）`;
    } else {
      scheduleStr = weekdayStr;
    }
  }

  if (!scheduleStr && (day === '*' || day === '?') && month === '*' && (weekday === '*' || weekday === '?')) {
    scheduleStr = '毎日';
  }

  return scheduleStr;
}

// ============================================================
// トップレベル翻訳関数
// ============================================================

export function translateStandardCron(parts) {
  const [minute, hour, day, month, weekday] = parts;
  const timeStr = translateTime(minute, hour);
  const scheduleStr = translateSchedule(day, month, weekday);

  if (scheduleStr) {
    return `${scheduleStr}の${timeStr}に実行`;
  }
  return `${timeStr}に実行`;
}

export function translateSixFieldCron(parts) {
  const firstField = parts[0];
  const secondField = parts[1];
  const fifthField = parts[4];
  const lastField = parts[5];

  // 最後のフィールドが4桁の年なら確実にAWS形式
  if (/^\d{4}$/.test(lastField)) {
    return translateAWSCron(parts);
  }

  // ? はAWS EventBridge特有の記号 — 含まれていればAWS形式
  const hasQuestionMark = parts.some(p => p === '?');
  if (hasQuestionMark) {
    return translateAWSCron(parts);
  }

  // AWS EventBridge形式の判定（年以外の手がかり）
  const isAWSFormat =
    (/^[A-Z]{3}/i.test(fifthField) ||
      /^\d+#\d+$/.test(fifthField) ||
      /^\d+L$/.test(fifthField)) &&
    !/^\*\/\d+$/.test(secondField);

  // 秒付き形式の判定
  const isSecondsFormat =
    (/^\d+$/.test(firstField) && parseInt(firstField) <= 59) ||
    firstField === '*' ||
    /^\*\/\d+$/.test(firstField) ||
    /^\*\/\d+$/.test(secondField);

  if (isAWSFormat && !isSecondsFormat) {
    return translateAWSCron(parts);
  }
  return translateCronWithSeconds(parts);
}

export function translateAWSCron(parts) {
  const [minute, hour, day, month, weekday, year] = parts;
  let base = translateStandardCron([minute, hour, day, month, weekday]);

  // Bug #5 修正: 全置換にする
  if (year && year !== '*' && /^\d{4}$/.test(year)) {
    base = base.replace(/に実行/g, `（${year}年）に実行`);
  }
  return base;
}

export function translateCronWithSeconds(parts) {
  const [second, minute, hour, day, month, weekday] = parts;
  let base = translateStandardCron([minute, hour, day, month, weekday]);

  // Bug #6 修正: 秒の間隔式を翻訳
  if (second !== '*' && second !== '0') {
    if (second.includes('/')) {
      const [start, interval] = second.split('/');
      const secStr = start === '*'
        ? `${interval}秒ごと`
        : `${start}秒から${interval}秒ごと`;
      base = `${secStr} ${base}`;
    } else {
      base = `${second}秒 ${base}`;
    }
  }
  return base;
}

export function translateCronWithYear(parts) {
  const base = translateCronWithSeconds(parts.slice(0, 6));
  const year = parts[6];

  if (year !== '*') {
    return base + ` ${year}年`;
  }
  return base;
}

export function translateCron(expression) {
  const parts = expression.trim().split(/\s+/);

  if (parts.length === 5) return translateStandardCron(parts);
  if (parts.length === 6) return translateSixFieldCron(parts);
  if (parts.length === 7) return translateCronWithYear(parts);

  return '無効なCron式';
}
