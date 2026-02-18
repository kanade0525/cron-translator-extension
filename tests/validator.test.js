import { describe, it, expect } from 'vitest';
import { isCronExpression, extractCronFromParentheses } from '../src/validator.js';

describe('isCronExpression', () => {
  describe('有効なcron式', () => {
    it('基本的な5フィールドcron式', () => {
      expect(isCronExpression('0 0 * * *')).toBe(true);
      expect(isCronExpression('* * * * *')).toBe(true);
      expect(isCronExpression('30 9 * * *')).toBe(true);
    });

    it('インターバル指定', () => {
      expect(isCronExpression('*/5 * * * *')).toBe(true);
      expect(isCronExpression('0 */2 * * *')).toBe(true);
      expect(isCronExpression('10/15 * * * *')).toBe(true);
    });

    it('範囲指定', () => {
      expect(isCronExpression('0 9-17 * * *')).toBe(true);
      expect(isCronExpression('0 0 * * 1-5')).toBe(true);
    });

    it('リスト指定', () => {
      expect(isCronExpression('0 9,14,18 * * *')).toBe(true);
      expect(isCronExpression('0,30 * * * *')).toBe(true);
    });

    it('英語略称（月・曜日）', () => {
      expect(isCronExpression('0 9 * * MON')).toBe(true);
      expect(isCronExpression('0 9 * JAN *')).toBe(true);
      expect(isCronExpression('0 9 * * MON-FRI')).toBe(true);
    });

    it('特殊文字 L, W, #', () => {
      expect(isCronExpression('0 0 L * *')).toBe(true);
      expect(isCronExpression('0 0 15W * *')).toBe(true);
      expect(isCronExpression('0 0 * * 1#2')).toBe(true);
    });

    it('? ワイルドカード', () => {
      expect(isCronExpression('0 0 ? * MON')).toBe(true);
      expect(isCronExpression('0 0 15 * ?')).toBe(true);
    });

    it('6フィールド（秒付きまたはAWS形式）', () => {
      expect(isCronExpression('0 0 0 * * *')).toBe(true);
      expect(isCronExpression('0 0 * * ? 2024')).toBe(true);
    });

    it('7フィールド', () => {
      expect(isCronExpression('0 0 0 * * * 2024')).toBe(true);
    });
  });

  describe('無効なcron式', () => {
    it('フィールド数が少なすぎる', () => {
      expect(isCronExpression('0 0 * *')).toBe(false);
      expect(isCronExpression('0 0')).toBe(false);
      expect(isCronExpression('*')).toBe(false);
    });

    it('フィールド数が多すぎる', () => {
      expect(isCronExpression('0 0 0 * * * * 2024')).toBe(false);
    });

    it('無効な文字列', () => {
      expect(isCronExpression('hello world foo bar baz')).toBe(false);
      expect(isCronExpression('')).toBe(false);
    });
  });
});

describe('extractCronFromParentheses', () => {
  it('括弧付きcron式から内部の式を抽出する', () => {
    const result = extractCronFromParentheses('cron(0 0 * * *)');
    expect(result.expression).toBe('0 0 * * *');
    expect(result.isParentheses).toBe(true);
    expect(result.display).toBe('cron(0 0 * * *)');
  });

  it('スペース付きの括弧形式も処理できる', () => {
    const result = extractCronFromParentheses('cron (0 0 * * *)');
    expect(result.expression).toBe('0 0 * * *');
    expect(result.isParentheses).toBe(true);
  });

  it('括弧なしのテキストはそのまま返す', () => {
    const result = extractCronFromParentheses('0 0 * * *');
    expect(result.expression).toBe('0 0 * * *');
    expect(result.isParentheses).toBe(false);
  });

  it('cronで始まるが括弧がない場合', () => {
    const result = extractCronFromParentheses('cron expression');
    expect(result.isParentheses).toBe(false);
  });
});
