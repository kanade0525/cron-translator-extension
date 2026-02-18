import { test, expect, chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.resolve(__dirname, '..', '..');
const TEST_PAGE = `file://${path.resolve(EXTENSION_PATH, 'test_all.html')}`;

/** @type {import('@playwright/test').BrowserContext} */
let context;
/** @type {import('@playwright/test').Page} */
let page;

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-first-run',
      '--disable-gpu',
    ],
  });
  page = await context.newPage();
  await page.goto(TEST_PAGE);
  // content scriptの初期処理を待つ
  await page.waitForTimeout(2000);

  // 全セクションをスクロールして表示させ、content scriptに検出させる
  const sections = page.locator('.test-section');
  const count = await sections.count();
  for (let i = 0; i < count; i++) {
    await sections.nth(i).scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
  }
  // ページトップに戻る
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
});

test.afterAll(async () => {
  await context?.close();
});

// ============================================================
// ヘルパー関数
// ============================================================

/**
 * wrapperをホバーしてツールチップのテキストを取得する
 */
async function getTooltipText(p, wrapper) {
  await p.mouse.move(0, 0);
  await p.waitForTimeout(100);

  await wrapper.scrollIntoViewIfNeeded();
  await wrapper.hover();
  await p.waitForTimeout(700);

  return await p.locator('.cron-tooltip').evaluateAll(
    els => {
      const el = els.find(e => e.style.display === 'block');
      return el ? el.textContent.trim() : '';
    }
  );
}

/**
 * 指定セクション内のcron式をホバーし、翻訳テキストを検証する
 */
async function findAndVerifyCron(p, sectionSelector, cronText, expectedTranslation) {
  const section = p.locator(sectionSelector);
  await section.scrollIntoViewIfNeeded();
  await p.waitForTimeout(500);

  const wrappers = section.locator('.cron-wrapper');
  const count = await wrappers.count();

  for (let i = 0; i < count; i++) {
    const wrapper = wrappers.nth(i);
    const text = (await wrapper.textContent()).trim();
    if (text === cronText || text.includes(cronText)) {
      const tooltip = await getTooltipText(p, wrapper);
      expect(tooltip).toBe(expectedTranslation);
      return;
    }
  }
  throw new Error(`Cron式 "${cronText}" がセクション ${sectionSelector} 内に見つかりません (wrappers: ${count})`);
}

// ============================================================
// Cron式の検出 — .cron-wrapper が生成されること
// ============================================================

test.describe('Cron式の検出とハイライト', () => {
  test('ページ全体でcron式が検出される', async () => {
    const wrappers = page.locator('.cron-wrapper');
    const count = await wrappers.count();
    expect(count).toBeGreaterThan(0);
  });

  test('基本パターンセクションのcron式が検出される', async () => {
    const section = page.locator('#basic');
    await section.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    const wrappers = section.locator('.cron-wrapper');
    expect(await wrappers.count()).toBeGreaterThanOrEqual(8);
  });

  test('複雑なパターンセクションのcron式が検出される', async () => {
    const section = page.locator('#complex');
    await section.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    const wrappers = section.locator('.cron-wrapper');
    expect(await wrappers.count()).toBeGreaterThanOrEqual(1);
  });

  test('特殊パターンセクションのcron式が検出される', async () => {
    const section = page.locator('#special');
    await section.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    const wrappers = section.locator('.cron-wrapper');
    expect(await wrappers.count()).toBeGreaterThanOrEqual(1);
  });

  test('実用例セクションのcron式が検出される', async () => {
    const section = page.locator('#realworld');
    await section.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    const wrappers = section.locator('.cron-wrapper');
    expect(await wrappers.count()).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================
// ツールチップの表示
// ============================================================

test.describe('ツールチップの表示', () => {
  test('ホバーでツールチップが表示される', async () => {
    const wrapper = page.locator('.cron-wrapper').first();
    await wrapper.scrollIntoViewIfNeeded();
    await wrapper.hover();
    await page.waitForTimeout(700);

    const visible = await page.locator('.cron-tooltip').evaluateAll(
      els => els.some(el => el.style.display === 'block')
    );
    expect(visible).toBe(true);
  });

  test('ツールチップに翻訳テキストが含まれる', async () => {
    const wrapper = page.locator('.cron-wrapper').first();
    await wrapper.scrollIntoViewIfNeeded();
    await wrapper.hover();
    await page.waitForTimeout(700);

    const text = await page.locator('.cron-tooltip').evaluateAll(
      els => els.find(el => el.style.display === 'block')?.textContent || ''
    );
    expect(text.length).toBeGreaterThan(0);
    expect(text).toContain('に実行');
  });

  test('ホバーを外すとツールチップが消える', async () => {
    const wrapper = page.locator('.cron-wrapper').first();
    await wrapper.scrollIntoViewIfNeeded();
    await wrapper.hover();
    await page.waitForTimeout(700);

    await page.mouse.move(0, 0);
    await page.waitForTimeout(300);

    const allHidden = await page.locator('.cron-tooltip').evaluateAll(
      els => els.every(el => el.style.display !== 'block')
    );
    expect(allHidden).toBe(true);
  });
});

// ============================================================
// 翻訳の正確性 — toBe完全一致
// ============================================================

test.describe('基本パターンの翻訳', () => {
  test('0 0 * * *', async () => {
    await findAndVerifyCron(page, '#basic', '0 0 * * *', '毎日の0時00分に実行');
  });

  test('*/5 * * * *', async () => {
    await findAndVerifyCron(page, '#basic', '*/5 * * * *', '毎日の5分ごとに実行');
  });

  test('0 */2 * * *', async () => {
    await findAndVerifyCron(page, '#basic', '0 */2 * * *', '毎日の2時間ごと（各時間の0分）に実行');
  });

  test('30 8 * * MON-FRI', async () => {
    await findAndVerifyCron(page, '#basic', '30 8 * * MON-FRI', '月曜日から金曜日の8時30分に実行');
  });

  test('0 9 * * 1-5', async () => {
    await findAndVerifyCron(page, '#basic', '0 9 * * 1-5', '月曜日から金曜日の9時00分に実行');
  });

  test('15 10,14,18 * * *', async () => {
    await findAndVerifyCron(page, '#basic', '15 10,14,18 * * *', '毎日の10時、14時、18時の15分に実行');
  });

  test('0 0 1 */3 *', async () => {
    await findAndVerifyCron(page, '#basic', '0 0 1 */3 *', '3ヶ月ごとの1日の0時00分に実行');
  });

  test('0 0 15 * *', async () => {
    await findAndVerifyCron(page, '#basic', '0 0 15 * *', '毎月15日の0時00分に実行');
  });
});

test.describe('複雑なパターンの翻訳', () => {
  test('0 9-17 * * MON,WED,FRI', async () => {
    await findAndVerifyCron(page, '#complex', '0 9-17 * * MON,WED,FRI', '月曜日と水曜日と金曜日の9時から17時の毎時0分に実行');
  });

  test('0/15 9-18 * * 1-5', async () => {
    await findAndVerifyCron(page, '#complex', '0/15 9-18 * * 1-5', '月曜日から金曜日の9時から18時の間、0分から15分ごとに実行');
  });

  test('*/10 * 1-7 * *', async () => {
    await findAndVerifyCron(page, '#complex', '*/10 * 1-7 * *', '毎月1-7日の10分ごとに実行');
  });

  test('0 0 */2 * *', async () => {
    await findAndVerifyCron(page, '#complex', '0 0 */2 * *', '毎月2日ごとの0時00分に実行');
  });
});

test.describe('特殊パターンの翻訳', () => {
  test('0 0 L * *', async () => {
    await findAndVerifyCron(page, '#special', '0 0 L * *', '毎月月末の0時00分に実行');
  });

  test('0 0 * * 1#2', async () => {
    await findAndVerifyCron(page, '#special', '0 0 * * 1#2', '第2月曜日の0時00分に実行');
  });

  test('0 0 15W * *', async () => {
    await findAndVerifyCron(page, '#special', '0 0 15W * *', '毎月15日に最も近い平日の0時00分に実行');
  });

  test('0 0 * * 5L', async () => {
    await findAndVerifyCron(page, '#special', '0 0 * * 5L', '最終金曜日の0時00分に実行');
  });

  test('0 0 * * 1#1,3#1', async () => {
    await findAndVerifyCron(page, '#special', '0 0 * * 1#1,3#1', '第1月曜日と第1水曜日の0時00分に実行');
  });
});

test.describe('実用例の翻訳', () => {
  test('0 2 * * *', async () => {
    await findAndVerifyCron(page, '#realworld', '0 2 * * *', '毎日の2時00分に実行');
  });

  test('0 3 * * 0', async () => {
    await findAndVerifyCron(page, '#realworld', '0 3 * * 0', '日曜日の3時00分に実行');
  });

  test('0 4 1 * *', async () => {
    await findAndVerifyCron(page, '#realworld', '0 4 1 * *', '毎月1日の4時00分に実行');
  });

  test('0 */6 * * *', async () => {
    await findAndVerifyCron(page, '#realworld', '0 */6 * * *', '毎日の6時間ごと（各時間の0分）に実行');
  });

  test('0 0 * * MON', async () => {
    await findAndVerifyCron(page, '#realworld', '0 0 * * MON', '月曜日の0時00分に実行');
  });

  test('0 8,12,17 * * 1-5', async () => {
    await findAndVerifyCron(page, '#realworld', '0 8,12,17 * * 1-5', '月曜日から金曜日の8時、12時、17時の00分に実行');
  });
});
