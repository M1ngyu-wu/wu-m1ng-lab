import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
const server = spawn(process.execPath, ['scripts/astro.mjs', 'preview', '--host', '127.0.0.1'], {
  stdio: 'pipe',
});
try {
  for (let i = 0; i < 30; i++) {
    try {
      if ((await fetch('http://127.0.0.1:4321')).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', (e) => console.log('ERROR', e.message));
  page.on('console', (m) => {
    if (m.type() === 'warning' || m.type() === 'error') console.log(m.type(), m.text());
  });
  await page.goto('http://127.0.0.1:4321/articles/stack-ret2libc/');
  console.log(
    'PRE',
    await page
      .locator('.prose pre')
      .evaluateAll((es) =>
        es.map((e) => ({
          class: e.className,
          data: e.dataset,
          code: e.querySelector('code')?.className,
        })),
      ),
  );
  console.log(
    'OVERFLOW',
    await page.evaluate(() =>
      Array.from(document.querySelectorAll('*'))
        .map((e) => ({
          tag: e.tagName,
          cls: e.className,
          left: e.getBoundingClientRect().left,
          right: e.getBoundingClientRect().right,
        }))
        .filter((e) => e.right > innerWidth + 2)
        .slice(0, 25),
    ),
  );
  await page.goto('http://127.0.0.1:4321/');
  await page.keyboard.press('Control+k');
  await page.locator('.pagefind-ui__search-input').fill('ret2libc');
  await page.waitForTimeout(1500);
  console.log('SEARCH', await page.locator('#search-dialog').innerText());
  await browser.close();
} finally {
  server.kill();
}
