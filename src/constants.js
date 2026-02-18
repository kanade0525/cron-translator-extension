// 月の数値・英名 → 日本語マッピング
export const MONTH_MAP = {
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
  '12': '12月', 'DEC': '12月',
};

// 曜日の数値・英名 → 日本語マッピング
export const WEEKDAY_MAP = {
  '0': '日曜日', 'SUN': '日曜日',
  '1': '月曜日', 'MON': '月曜日',
  '2': '火曜日', 'TUE': '火曜日',
  '3': '水曜日', 'WED': '水曜日',
  '4': '木曜日', 'THU': '木曜日',
  '5': '金曜日', 'FRI': '金曜日',
  '6': '土曜日', 'SAT': '土曜日',
  '7': '日曜日',
};

// 正規表現パターン（ソース定義）
const STANDARD_CRON_SOURCE =
  '([\\d\\*\\?\\/\\-,]+)\\s+([\\d\\*\\?\\/\\-,]+)\\s+([\\d\\*\\?\\/\\-,LW]+)\\s+([\\d\\*\\?\\/\\-,]+|[A-Z]{3}(?:[,-][A-Z]{3})*)\\s+([\\d\\*\\?\\/\\-,#L]+|[A-Z]{3}(?:[,-][A-Z]{3})*)(?:\\s+([\\d\\*\\?\\/\\-,]+))?(?:\\s+([\\d\\*\\?\\/\\-,]+))?';

const PARENTHESES_CRON_SOURCE = 'cron\\s*\\(([^)]+)\\)';

const COMBINED_SOURCE = `(?:${PARENTHESES_CRON_SOURCE})|(?:${STANDARD_CRON_SOURCE})`;

// .test() 用 — グローバルフラグなし（lastIndex問題を回避）
export function createCronTestRegex() {
  return new RegExp(COMBINED_SOURCE, 'i');
}

// .matchAll() 用 — グローバルフラグあり、毎回新規インスタンス
export function createCronMatchRegex() {
  return new RegExp(COMBINED_SOURCE, 'gi');
}
