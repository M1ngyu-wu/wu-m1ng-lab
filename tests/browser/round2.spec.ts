import { test, expect } from '@playwright/test';

test('代码检索支持标点，定位原文章节，保留私有查询', async ({ page }) => {
  await page.goto('/search/code/');
  const query = page.getByLabel('搜索代码片段');
  await query.fill("sqlite3.connect(':memory:')");
  const result = page.locator('.snippet-result').first();
  await expect(result).toContainText('离线演示与安全写法');
  await result.getByRole('link').click();
  await expect(page).toHaveURL(/articles\/sql-injection\/#snippet-\d+/);
  await expect(page.locator('pre:target')).toContainText('sqlite3.connect');
  await page.goBack();
  await query.fill('READelf');
  await page.getByLabel('区分大小写').check();
  await expect(page.locator('.snippet-result')).toHaveCount(0);
  await page.getByLabel('区分大小写').uncheck();
  await expect(page.locator('.snippet-result').first()).toContainText('readelf -h');
});

test('第二轮页面在手机宽度可访问', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const route of ['/writeups/', '/writeups/import/', '/growth/', '/search/code/']) {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(page.locator('main h1').first()).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      route,
    ).toBe(true);
  }
  expect(errors).toEqual([]);
});
