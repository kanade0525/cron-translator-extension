import { describe, it, expect } from 'vitest';
import {
  translateTime,
  translateSchedule,
  translateHour,
  translateMonth,
  translateWeekday,
  translateStandardCron,
  translateSixFieldCron,
  translateAWSCron,
  translateCronWithSeconds,
  translateCronWithYear,
  translateCron,
} from '../src/translator.js';

// ============================================================
// translateTime
// ============================================================
describe('translateTime', () => {
  it('毎分', () => {
    expect(translateTime('*', '*')).toBe('毎分');
  });

  it('毎時0分', () => {
    expect(translateTime('0', '*')).toBe('毎時0分');
  });

  it('分間隔', () => {
    expect(translateTime('*/5', '*')).toBe('5分ごと');
    expect(translateTime('10/15', '*')).toBe('10分から15分ごと');
  });

  it('分間隔 + 時間範囲', () => {
    expect(translateTime('*/5', '9-17')).toBe('9時から17時の間、5分ごと');
  });

  it('分間隔 + 特定時間', () => {
    expect(translateTime('*/5', '9')).toBe('5分ごと (9時台)');
  });

  it('時間間隔', () => {
    expect(translateTime('0', '*/2')).toBe('2時間ごと（各時間の0分）');
    expect(translateTime('*', '*/2')).toBe('2時間ごとの毎分');
    expect(translateTime('30', '*/2')).toBe('2時間ごと（各時間の30分）');
  });

  it('特定時間の毎分', () => {
    expect(translateTime('*', '9')).toBe('9時台の毎分');
  });

  it('毎時の特定分', () => {
    expect(translateTime('30', '*')).toBe('毎時30分');
    expect(translateTime('15,30', '*')).toBe('毎時15分、30分');
  });

  it('具体的な時刻', () => {
    expect(translateTime('30', '9')).toBe('9時30分');
    expect(translateTime('0', '0')).toBe('0時00分');
    expect(translateTime('5', '14')).toBe('14時05分');
  });

  it('複数時間 + 具体的な分', () => {
    expect(translateTime('0', '9,14,18')).toBe('9時、14時、18時の00分');
  });

  it('時間範囲 + 具体的な分', () => {
    expect(translateTime('0', '9-17')).toBe('9時から17時の毎時0分');
    expect(translateTime('15,30', '9-17')).toBe('9時から17時の毎時15分、30分');
  });

  it('カンマ区切りの分 + 複数時間（Bug #3 回帰）', () => {
    expect(translateTime('15,30', '8,12')).toBe('8時、12時の15,30分');
  });
});

// ============================================================
// translateSchedule
// ============================================================
describe('translateSchedule', () => {
  it('毎日（全ワイルドカード）', () => {
    expect(translateSchedule('*', '*', '*')).toBe('毎日');
    expect(translateSchedule('?', '*', '?')).toBe('毎日');
  });

  it('特定の日', () => {
    expect(translateSchedule('15', '*', '?')).toBe('毎月15日');
    expect(translateSchedule('1', '*', '*')).toBe('毎月1日');
  });

  it('月末 (L)', () => {
    expect(translateSchedule('L', '*', '?')).toBe('毎月月末');
  });

  it('日の間隔 (*/N)', () => {
    expect(translateSchedule('*/2', '*', '*')).toBe('毎月2日ごと');
  });

  it('最寄りの平日 (W)（Bug #4 回帰）', () => {
    expect(translateSchedule('15W', '*', '?')).toBe('毎月15日に最も近い平日');
  });

  it('特定の曜日', () => {
    expect(translateSchedule('?', '*', 'MON')).toBe('月曜日');
    expect(translateSchedule('?', '*', '1')).toBe('月曜日');
  });

  it('曜日範囲', () => {
    expect(translateSchedule('?', '*', 'MON-FRI')).toBe('月曜日から金曜日');
  });

  it('特定の月 + 日', () => {
    expect(translateSchedule('15', '6', '*')).toBe('6月の15日');
  });

  it('曜日 + 日（両方指定）', () => {
    expect(translateSchedule('15', '*', 'MON')).toBe('月曜日（毎月15日）');
  });

  it('月間隔', () => {
    expect(translateSchedule('1', '*/3', '*')).toBe('3ヶ月ごとの1日');
  });

  it('第N曜日 (#)', () => {
    expect(translateSchedule('?', '*', '1#2')).toBe('第2月曜日');
  });

  it('最終曜日 (L)', () => {
    expect(translateSchedule('?', '*', '5L')).toBe('最終金曜日');
  });

  it('カンマ区切りの第N曜日', () => {
    expect(translateSchedule('?', '*', '1#1,3#1')).toBe('第1月曜日と第1水曜日');
  });
});

// ============================================================
// translateHour
// ============================================================
describe('translateHour', () => {
  it('ワイルドカード', () => {
    expect(translateHour('*')).toBe('毎時');
  });

  it('インターバル', () => {
    expect(translateHour('*/2')).toBe('2時間ごと');
    expect(translateHour('8/4')).toBe('8時から4時間ごと');
  });

  it('範囲', () => {
    expect(translateHour('9-17')).toBe('9時〜17時');
  });

  it('リスト', () => {
    expect(translateHour('9,14,18')).toBe('9時と14時と18時');
  });

  it('単一値', () => {
    expect(translateHour('9')).toBe('9');
  });
});

// ============================================================
// translateMonth
// ============================================================
describe('translateMonth', () => {
  it('ワイルドカード', () => {
    expect(translateMonth('*')).toBe('毎月');
  });

  it('数値指定', () => {
    expect(translateMonth('1')).toBe('1月');
    expect(translateMonth('12')).toBe('12月');
  });

  it('英語略称', () => {
    expect(translateMonth('JAN')).toBe('1月');
    expect(translateMonth('DEC')).toBe('12月');
  });

  it('範囲', () => {
    expect(translateMonth('1-6')).toBe('1月から6月');
    expect(translateMonth('JAN-JUN')).toBe('1月から6月');
  });

  it('リスト', () => {
    expect(translateMonth('1,4,7')).toBe('1月と4月と7月');
  });

  it('インターバル', () => {
    expect(translateMonth('*/3')).toBe('3ヶ月ごと');
    expect(translateMonth('1/3')).toBe('1月から3ヶ月ごと');
  });
});

// ============================================================
// translateWeekday
// ============================================================
describe('translateWeekday', () => {
  it('ワイルドカード', () => {
    expect(translateWeekday('*')).toBe('毎日');
  });

  it('? は空文字', () => {
    expect(translateWeekday('?')).toBe('');
  });

  it('数値指定', () => {
    expect(translateWeekday('0')).toBe('日曜日');
    expect(translateWeekday('1')).toBe('月曜日');
    expect(translateWeekday('7')).toBe('日曜日');
  });

  it('英語略称', () => {
    expect(translateWeekday('MON')).toBe('月曜日');
    expect(translateWeekday('FRI')).toBe('金曜日');
  });

  it('範囲', () => {
    expect(translateWeekday('MON-FRI')).toBe('月曜日から金曜日');
    expect(translateWeekday('1-5')).toBe('月曜日から金曜日');
  });

  it('リスト', () => {
    expect(translateWeekday('MON,WED,FRI')).toBe('月曜日と水曜日と金曜日');
  });

  it('第N曜日 (#)', () => {
    expect(translateWeekday('1#2')).toBe('第2月曜日');
    expect(translateWeekday('5#3')).toBe('第3金曜日');
  });

  it('最終曜日 (L)', () => {
    expect(translateWeekday('5L')).toBe('最終金曜日');
    expect(translateWeekday('L')).toBe('最終日');
  });

  it('カンマ区切りの第N曜日', () => {
    expect(translateWeekday('1#1,3#1')).toBe('第1月曜日と第1水曜日');
  });

  it('カンマ区切りの最終曜日', () => {
    expect(translateWeekday('1L,5L')).toBe('最終月曜日と最終金曜日');
  });
});

// ============================================================
// translateStandardCron（結合テスト）
// ============================================================
describe('translateStandardCron', () => {
  it('毎分実行', () => {
    expect(translateStandardCron(['*', '*', '*', '*', '*'])).toBe('毎日の毎分に実行');
  });

  it('毎日0時0分', () => {
    expect(translateStandardCron(['0', '0', '*', '*', '*'])).toBe('毎日の0時00分に実行');
  });

  it('5分ごと', () => {
    expect(translateStandardCron(['*/5', '*', '*', '*', '*'])).toBe('毎日の5分ごとに実行');
  });

  it('平日9時0分', () => {
    expect(translateStandardCron(['0', '9', '*', '*', 'MON-FRI'])).toBe('月曜日から金曜日の9時00分に実行');
  });

  it('毎月1日0時0分', () => {
    expect(translateStandardCron(['0', '0', '1', '*', '*'])).toBe('毎月1日の0時00分に実行');
  });

  it('月末の18時0分', () => {
    expect(translateStandardCron(['0', '18', 'L', '*', '?'])).toBe('毎月月末の18時00分に実行');
  });

  it('毎月15日の最寄り平日', () => {
    expect(translateStandardCron(['0', '9', '15W', '*', '?'])).toBe('毎月15日に最も近い平日の9時00分に実行');
  });

  it('第2月曜日', () => {
    expect(translateStandardCron(['0', '10', '?', '*', '1#2'])).toBe('第2月曜日の10時00分に実行');
  });
});

// ============================================================
// translateSixFieldCron（6フィールド判定）
// ============================================================
describe('translateSixFieldCron', () => {
  it('AWS形式（年指定あり）', () => {
    expect(translateSixFieldCron(['0', '9', '*', '*', '?', '2024'])).toBe('毎日の9時00分（2024年）に実行');
  });

  it('AWS形式（?あり、年ワイルドカード）', () => {
    expect(translateSixFieldCron(['0', '9', '*', '*', '?', '*'])).toBe('毎日の9時00分に実行');
  });

  it('秒付き形式', () => {
    expect(translateSixFieldCron(['30', '0', '0', '*', '*', '*'])).toBe('30秒 毎日の0時00分に実行');
  });
});

// ============================================================
// translateAWSCron
// ============================================================
describe('translateAWSCron', () => {
  it('年付きAWS形式', () => {
    expect(translateAWSCron(['0', '9', '*', '*', '?', '2024'])).toBe('毎日の9時00分（2024年）に実行');
  });

  it('年がワイルドカードの場合は表示しない', () => {
    expect(translateAWSCron(['0', '9', '*', '*', '?', '*'])).toBe('毎日の9時00分に実行');
  });
});

// ============================================================
// translateCronWithSeconds
// ============================================================
describe('translateCronWithSeconds', () => {
  it('秒が0の場合は表示しない', () => {
    expect(translateCronWithSeconds(['0', '0', '0', '*', '*', '*'])).toBe('毎日の0時00分に実行');
  });

  it('秒が*の場合は表示しない', () => {
    expect(translateCronWithSeconds(['*', '0', '0', '*', '*', '*'])).toBe('毎日の0時00分に実行');
  });

  it('具体的な秒を表示', () => {
    expect(translateCronWithSeconds(['30', '0', '0', '*', '*', '*'])).toBe('30秒 毎日の0時00分に実行');
  });

  it('秒のインターバル（Bug #6 回帰）', () => {
    expect(translateCronWithSeconds(['*/30', '0', '0', '*', '*', '*'])).toBe('30秒ごと 毎日の0時00分に実行');
  });

  it('秒のインターバル（開始指定あり）', () => {
    expect(translateCronWithSeconds(['10/30', '0', '0', '*', '*', '*'])).toBe('10秒から30秒ごと 毎日の0時00分に実行');
  });
});

// ============================================================
// translateCronWithYear
// ============================================================
describe('translateCronWithYear', () => {
  it('年が指定されている場合', () => {
    expect(translateCronWithYear(['0', '0', '0', '*', '*', '*', '2024'])).toBe('毎日の0時00分に実行 2024年');
  });

  it('年がワイルドカードの場合', () => {
    expect(translateCronWithYear(['0', '0', '0', '*', '*', '*', '*'])).toBe('毎日の0時00分に実行');
  });
});

// ============================================================
// translateCron（トップレベル — 完全一致テスト）
// ============================================================
describe('translateCron', () => {
  it('無効なフィールド数', () => {
    expect(translateCron('0 0 * *')).toBe('無効なCron式');
    expect(translateCron('0 0 0 * * * * 2024')).toBe('無効なCron式');
  });

  // ==========================================================
  // test_all.html 全パターン網羅
  // ==========================================================

  describe('基本パターン（5フィールド）', () => {
    it('0 0 * * *', () => {
      expect(translateCron('0 0 * * *')).toBe('毎日の0時00分に実行');
    });

    it('*/5 * * * *', () => {
      expect(translateCron('*/5 * * * *')).toBe('毎日の5分ごとに実行');
    });

    it('0 */2 * * *', () => {
      expect(translateCron('0 */2 * * *')).toBe('毎日の2時間ごと（各時間の0分）に実行');
    });

    it('30 8 * * MON-FRI', () => {
      expect(translateCron('30 8 * * MON-FRI')).toBe('月曜日から金曜日の8時30分に実行');
    });

    it('0 9 * * 1-5', () => {
      expect(translateCron('0 9 * * 1-5')).toBe('月曜日から金曜日の9時00分に実行');
    });

    it('15 10,14,18 * * *', () => {
      expect(translateCron('15 10,14,18 * * *')).toBe('毎日の10時、14時、18時の15分に実行');
    });

    it('0 0 1 */3 *', () => {
      expect(translateCron('0 0 1 */3 *')).toBe('3ヶ月ごとの1日の0時00分に実行');
    });

    it('0 0 15 * *', () => {
      expect(translateCron('0 0 15 * *')).toBe('毎月15日の0時00分に実行');
    });
  });

  describe('AWS EventBridge形式（6フィールド）', () => {
    it('0 9 * * ? *', () => {
      expect(translateCron('0 9 * * ? *')).toBe('毎日の9時00分に実行');
    });

    it('15 10 ? * MON-FRI *', () => {
      expect(translateCron('15 10 ? * MON-FRI *')).toBe('月曜日から金曜日の10時15分に実行');
    });

    it('0 18 ? * MON-FRI 2024', () => {
      expect(translateCron('0 18 ? * MON-FRI 2024')).toBe('月曜日から金曜日の18時00分（2024年）に実行');
    });
  });

  describe('複雑なパターン', () => {
    it('0/15 9-18 * * 1-5', () => {
      expect(translateCron('0/15 9-18 * * 1-5')).toBe('月曜日から金曜日の9時から18時の間、0分から15分ごとに実行');
    });

    it('0 9-17 * * MON,WED,FRI', () => {
      expect(translateCron('0 9-17 * * MON,WED,FRI')).toBe('月曜日と水曜日と金曜日の9時から17時の毎時0分に実行');
    });

    it('30 */3 * * SAT,SUN', () => {
      expect(translateCron('30 */3 * * SAT,SUN')).toBe('土曜日と日曜日の3時間ごと（各時間の30分）に実行');
    });

    it('*/10 * 1-7 * *', () => {
      expect(translateCron('*/10 * 1-7 * *')).toBe('毎月1-7日の10分ごとに実行');
    });

    it('0 0 */2 * *', () => {
      expect(translateCron('0 0 */2 * *')).toBe('毎月2日ごとの0時00分に実行');
    });

    it('0 8-10,14-16 * * *', () => {
      expect(translateCron('0 8-10,14-16 * * *')).toBe('毎日の8-10時、14-16時の00分に実行');
    });
  });

  describe('特殊パターン', () => {
    it('0 0 L * *', () => {
      expect(translateCron('0 0 L * *')).toBe('毎月月末の0時00分に実行');
    });

    it('0 0 * * 1#2', () => {
      expect(translateCron('0 0 * * 1#2')).toBe('第2月曜日の0時00分に実行');
    });

    it('0 0 15W * *', () => {
      expect(translateCron('0 0 15W * *')).toBe('毎月15日に最も近い平日の0時00分に実行');
    });

    it('0 0 * * 5L', () => {
      expect(translateCron('0 0 * * 5L')).toBe('最終金曜日の0時00分に実行');
    });

    it('0 0 * * 1#1,3#1', () => {
      expect(translateCron('0 0 * * 1#1,3#1')).toBe('第1月曜日と第1水曜日の0時00分に実行');
    });

    it('0 12 * * ?', () => {
      expect(translateCron('0 12 * * ?')).toBe('毎日の12時00分に実行');
    });
  });

  describe('実用例', () => {
    it('0 2 * * * — 日次バックアップ', () => {
      expect(translateCron('0 2 * * *')).toBe('毎日の2時00分に実行');
    });

    it('0 3 * * 0 — 週次バックアップ', () => {
      expect(translateCron('0 3 * * 0')).toBe('日曜日の3時00分に実行');
    });

    it('0 4 1 * * — 月次バックアップ', () => {
      expect(translateCron('0 4 1 * *')).toBe('毎月1日の4時00分に実行');
    });

    it('0 */6 * * * — データ同期', () => {
      expect(translateCron('0 */6 * * *')).toBe('毎日の6時間ごと（各時間の0分）に実行');
    });

    it('0 0 * * MON — 週次レポート', () => {
      expect(translateCron('0 0 * * MON')).toBe('月曜日の0時00分に実行');
    });

    it('0 8,12,17 * * 1-5 — 定時通知', () => {
      expect(translateCron('0 8,12,17 * * 1-5')).toBe('月曜日から金曜日の8時、12時、17時の00分に実行');
    });

    it('0 0 1 1 * — 毎年1月1日', () => {
      expect(translateCron('0 0 1 1 *')).toBe('1月の1日の0時00分に実行');
    });

    it('0 0 1,15 * * — 毎月1日と15日', () => {
      expect(translateCron('0 0 1,15 * *')).toBe('毎月1,15日の0時00分に実行');
    });
  });

  describe('6フィールド秒付き形式', () => {
    it('0 0 9 * * *', () => {
      expect(translateCron('0 0 9 * * *')).toBe('毎日の9時00分に実行');
    });

    it('30 15 10 * * *', () => {
      expect(translateCron('30 15 10 * * *')).toBe('30秒 毎日の10時15分に実行');
    });

    it('0 */5 * * * *', () => {
      expect(translateCron('0 */5 * * * *')).toBe('毎日の5分ごとに実行');
    });

    it('*/30 * * * * *', () => {
      expect(translateCron('*/30 * * * * *')).toBe('30秒ごと 毎日の毎分に実行');
    });
  });
});
