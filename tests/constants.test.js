import { describe, it, expect } from 'vitest';
import { MONTH_MAP, WEEKDAY_MAP, createCronTestRegex, createCronMatchRegex } from '../src/constants.js';

describe('MONTH_MAP', () => {
  it('数値キーで全12ヶ月がマッピングされている', () => {
    for (let i = 1; i <= 12; i++) {
      expect(MONTH_MAP[String(i)]).toBe(`${i}月`);
    }
  });

  it('英語略称で全12ヶ月がマッピングされている', () => {
    const abbrs = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    abbrs.forEach((abbr, i) => {
      expect(MONTH_MAP[abbr]).toBe(`${i + 1}月`);
    });
  });
});

describe('WEEKDAY_MAP', () => {
  it('数値キー 0-7 がマッピングされている', () => {
    expect(WEEKDAY_MAP['0']).toBe('日曜日');
    expect(WEEKDAY_MAP['1']).toBe('月曜日');
    expect(WEEKDAY_MAP['2']).toBe('火曜日');
    expect(WEEKDAY_MAP['3']).toBe('水曜日');
    expect(WEEKDAY_MAP['4']).toBe('木曜日');
    expect(WEEKDAY_MAP['5']).toBe('金曜日');
    expect(WEEKDAY_MAP['6']).toBe('土曜日');
    expect(WEEKDAY_MAP['7']).toBe('日曜日');
  });

  it('英語略称で全曜日がマッピングされている', () => {
    expect(WEEKDAY_MAP['SUN']).toBe('日曜日');
    expect(WEEKDAY_MAP['MON']).toBe('月曜日');
    expect(WEEKDAY_MAP['TUE']).toBe('火曜日');
    expect(WEEKDAY_MAP['WED']).toBe('水曜日');
    expect(WEEKDAY_MAP['THU']).toBe('木曜日');
    expect(WEEKDAY_MAP['FRI']).toBe('金曜日');
    expect(WEEKDAY_MAP['SAT']).toBe('土曜日');
  });
});

describe('createCronTestRegex', () => {
  it('グローバルフラグを持たない', () => {
    const regex = createCronTestRegex();
    expect(regex.global).toBe(false);
  });

  it('標準的なcron式にマッチする', () => {
    const regex = createCronTestRegex();
    expect(regex.test('0 0 * * *')).toBe(true);
    expect(regex.test('*/5 * * * *')).toBe(true);
    expect(regex.test('0 9 * * MON-FRI')).toBe(true);
  });

  it('括弧付き形式にマッチする', () => {
    const regex = createCronTestRegex();
    expect(regex.test('cron(0 0 * * *)')).toBe(true);
    expect(regex.test('cron(0 9 ? * MON)')).toBe(true);
  });

  it('連続して呼び出してもlastIndexに影響されない', () => {
    const regex = createCronTestRegex();
    expect(regex.test('0 0 * * *')).toBe(true);
    expect(regex.test('*/5 * * * *')).toBe(true);
    expect(regex.test('0 9 * * MON-FRI')).toBe(true);
  });
});

describe('createCronMatchRegex', () => {
  it('グローバルフラグを持つ', () => {
    const regex = createCronMatchRegex();
    expect(regex.global).toBe(true);
  });

  it('毎回新しいインスタンスを返す', () => {
    const regex1 = createCronMatchRegex();
    const regex2 = createCronMatchRegex();
    expect(regex1).not.toBe(regex2);
  });

  it('matchAllで複数マッチを取得できる', () => {
    const text = 'ジョブA: 0 0 * * * ジョブB: */5 * * * *';
    const regex = createCronMatchRegex();
    const matches = [...text.matchAll(regex)];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
});
