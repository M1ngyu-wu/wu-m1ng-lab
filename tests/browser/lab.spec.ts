import { test, expect } from '@playwright/test';
test('多选、判断、简答和闪卡均保存反馈与复习日期', async ({ page }) => {
  await page.goto('/learning/?tab=quiz');
  await page.getByLabel('第 3 题', { exact: true }).click();
  for (const answer of ['复用现有指令', '需要检查 Gadget 副作用', 'ret 会从栈取出跳转地址'])
    await page.getByLabel(answer, { exact: true }).check();
  await page.getByRole('button', { name: '提交答案', exact: true }).click();
  await expect(page.locator('.feedback')).toContainText('回答正确');
  await page.getByLabel('第 4 题', { exact: true }).click();
  await page.getByLabel('错误', { exact: true }).check();
  await page.getByRole('button', { name: '提交答案', exact: true }).click();
  await expect(page.locator('.feedback')).toContainText('回答正确');
  await page.getByLabel('第 2 题', { exact: true }).click();
  await page.getByLabel('简答题答案').fill('40');
  await page.getByRole('button', { name: '提交答案', exact: true }).click();
  await expect(page.locator('.feedback')).toContainText('回答正确');
  await page.getByLabel('第 6 题', { exact: true }).click();
  await page.getByRole('button', { name: '翻开答案' }).click();
  await page.getByRole('button', { name: '记得', exact: true }).click();
  await expect(page.locator('.feedback')).toContainText('16 字节');
  await page.getByLabel('下次复习日期').fill('2026-12-01');
  const data = await page.evaluate(() => JSON.parse(localStorage.getItem('wu_m1ng.lab.v1')!));
  expect(data.attempts).toHaveLength(4);
  expect(data.reviews.q6.due).toContain('2026-12-01');
});
test('损坏的本地记录不会被普通编辑覆盖', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('wu_m1ng.lab.v1', 'broken-original'));
  await page.goto('/learning/');
  await expect(page.getByRole('alert')).toContainText('原始内容已保留');
  await page.getByLabel('个人笔记').fill('尝试修改');
  await expect(page.getByRole('alert')).toContainText('原始记录存在读取错误');
  expect(await page.evaluate(() => localStorage.getItem('wu_m1ng.lab.v1'))).toBe('broken-original');
});
test('首页题解入口、主题和移动导航', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'wu_m1ng_' })).toBeVisible();
  await expect(page.getByLabel('教学终端命令')).toHaveCount(0);
  await expect(page.getByRole('link', { name: '浏览题解', exact: true })).toHaveAttribute(
    'href',
    /\/writeups\/$/,
  );
  await expect(page.getByRole('heading', { name: '最近学习动态' })).toBeVisible();
  await page.getByLabel('切换深浅主题').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.screenshot({ path: 'artifacts/home-light.png', fullPage: true });
  await page.getByLabel('切换深浅主题').click();
  await page.screenshot({ path: 'artifacts/home-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel('展开导航').click();
  await expect(page.getByRole('navigation')).toBeVisible();
  await page.getByRole('link', { name: 'Pwn Lab', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Pwn 可视化实验室.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/lab-mobile.png', fullPage: true });
});
test('归档组合筛选与空状态', async ({ page }) => {
  await page.goto('/archives/');
  await page.locator('#article-category').selectOption('pwn');
  await expect(page.locator('[data-article]:visible')).toHaveCount(3);
  await page.locator('#article-kind').selectOption('Writeup');
  await expect(page.locator('[data-article]:visible')).toHaveCount(1);
  await page.locator('#article-query').fill('不存在的题目');
  await expect(page.locator('#article-empty')).toBeVisible();
});
test('全站搜索含正文与工具，支持快捷键关闭', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');
  await expect(page.locator('#search-dialog')).toBeVisible();
  await page.locator('.pagefind-ui__search-input').fill('ret2libc');
  await expect(page.locator('.pagefind-ui__result').first()).toBeVisible({ timeout: 15000 });
  await page.locator('.pagefind-ui__search-input').fill('telescope');
  await expect(page.locator('.pagefind-ui__result').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#search-dialog')).not.toBeVisible();
});
test('栈覆盖严格边界与动态 Buffer', async ({ page }) => {
  await page.goto('/lab/');
  const slider = page.getByLabel('输入长度');
  await slider.fill('40');
  await expect(page.getByTestId('return-bytes')).toHaveText('0');
  await slider.fill('41');
  await expect(page.getByTestId('return-bytes')).toHaveText('1');
  await slider.fill('48');
  await expect(page.getByTestId('return-bytes')).toHaveText('8');
  await page.getByLabel('Buffer 大小').fill('64');
  await expect(page.getByTestId('return-offset')).toHaveText('72');
});
test('ROP 单步、重置和排序', async ({ page }) => {
  await page.goto('/lab/?tab=rop');
  await page.getByRole('button', { name: '单步执行', exact: true }).click();
  await expect(page.locator('.register-grid')).toContainText('0x7ffff7bd8698');
  await expect(page.locator('.register-grid')).toContainText('0x7fffffffe010');
  await page.getByLabel('下移第 1 个 Gadget').click();
  await expect(page.locator('.register-grid')).toContainText('0x0');
  await page.getByRole('button', { name: '重置执行' }).click();
});
test('ret2libc 正确算术与错误状态', async ({ page }) => {
  await page.goto('/lab/?tab=ret2libc');
  await expect(page.getByTestId('libc-base')).toHaveText('0x7ffff7a00000');
  await page.getByLabel('puts 泄露地址', { exact: true }).fill('oops');
  await expect(page.getByRole('alert')).toContainText('64 位十六进制');
  await page.getByLabel('puts 泄露地址', { exact: true }).fill('0x7ffff7b80aa0');
  await expect(page.getByTestId('libc-base')).toHaveText('0x7ffff7b00000');
});
test('Syscall 预设和可编辑寄存器', async ({ page }) => {
  await page.goto('/lab/?tab=syscall');
  await page.getByLabel('系统调用预设').selectOption('0');
  await expect(page.locator('.callout').last()).toContainText('read(');
  await page.getByLabel('系统调用预设').selectOption('2');
  await expect(page.getByLabel('RAX', { exact: true })).toHaveValue('0x9');
  await page.getByLabel('R10', { exact: true }).fill('0x42');
  await expect(page.locator('.code-output')).toContainText('r10, 0x42');
});
test('知识图谱选择、方向过滤和关联文章', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/knowledge/');
  await page.getByLabel('选择知识节点').selectOption('ret2libc');
  await expect(page.locator('.graph-info')).toContainText('ret2libc');
  await expect(
    page.locator('.graph-info').getByRole('link', { name: '进入关联实验 →' }),
  ).toHaveAttribute('href', '/lab/?tab=ret2libc');
  await page.getByLabel('图谱方向').selectOption('web');
  await page.getByLabel('选择知识节点').selectOption('sqli');
  await expect(page.locator('.graph-canvas canvas').first()).toBeVisible();
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'artifacts/knowledge-desktop.png', fullPage: true });
});
test('命令过滤、收藏、复制反馈和刷新持久化', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/tools/');
  await page.getByLabel('搜索工具命令').fill('telescope');
  await expect(page.locator('.tool-card')).toHaveCount(1);
  await page.getByRole('button', { name: '收藏 递归解引用栈', exact: true }).click();
  await page.getByRole('button', { name: '复制命令', exact: true }).click();
  await expect(page.getByRole('button', { name: '已复制 ✓' })).toBeVisible();
  await page.reload();
  await page.getByLabel('搜索工具命令').fill('telescope');
  await expect(page.getByRole('button', { name: '取消收藏 递归解引用栈' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});
test('学习笔记立即保存，导出、导入预览和失败保护', async ({ page }) => {
  await page.goto('/learning/');
  await page.getByLabel('学习状态').selectOption('学习中');
  await page.getByLabel('个人笔记').fill('理解描述符与指针的区别');
  await page.getByLabel('学习时长').fill('25');
  await page.reload();
  await expect(page.getByLabel('个人笔记')).toHaveValue('理解描述符与指针的区别');
  await expect(page.getByLabel('学习时长')).toHaveValue('25');
  await page.getByRole('tab', { name: '备份与恢复' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 JSON 备份' }).click();
  expect((await download).suggestedFilename()).toMatch(/wu_m1ng-backup/);
  const before = await page.evaluate(() => localStorage.getItem('wu_m1ng.lab.v1'));
  await page.getByLabel('导入 JSON 文件').setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"version":99}'),
  });
  await expect(page.getByRole('alert')).toContainText('原有记录未修改');
  expect(await page.evaluate(() => localStorage.getItem('wu_m1ng.lab.v1'))).toBe(before);
  const valid = JSON.parse(before!);
  valid.study.linux.notes = '恢复测试';
  await page.getByLabel('导入 JSON 文件').setInputFiles({
    name: 'valid.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(valid)),
  });
  await expect(page.getByRole('heading', { name: '导入前预览' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('wu_m1ng.lab.v1'))).toBe(before);
  await page.getByRole('button', { name: '确认替换并导入' }).click();
  await page.getByRole('tab', { name: '学习进度', exact: true }).click();
  await expect(page.getByLabel('个人笔记')).toHaveValue('恢复测试');
});
test('自测错题、反馈、历史与已掌握标记', async ({ page }) => {
  await page.goto('/learning/?tab=quiz');
  await page.getByLabel('高地址', { exact: true }).check();
  await page.getByRole('button', { name: '提交答案', exact: true }).click();
  await expect(page.getByRole('status').first()).toContainText('低地址');
  await page.getByRole('button', { name: '错题复盘', exact: true }).click();
  await expect(page.locator('.question-card')).toContainText('栈通常向哪个方向增长');
  await page.getByLabel('低地址', { exact: true }).check();
  await page.getByRole('button', { name: '提交答案', exact: true }).click();
  await expect(page.getByRole('status').first()).toContainText('回答正确');
  await page.getByRole('button', { name: '标记已掌握', exact: true }).click();
  await expect(page.getByRole('button', { name: '✓ 已掌握', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('.history')).toContainText('栈通常');
});
test('文章目录、高亮、公式、Mermaid、图片与复制', async ({ page }) => {
  await page.goto('/articles/stack-ret2libc/');
  await expect(page.locator('.toc a').first()).toBeVisible();
  await expect(page.locator('.astro-code').first()).toBeVisible();
  await expect(page.locator('.katex').first()).toBeVisible();
  await expect(page.locator('.mermaid-figure svg')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.prose img')).toHaveJSProperty('complete', true);
  await expect(page.getByRole('button', { name: '复制代码' }).first()).toBeVisible();
  await page.screenshot({ path: 'artifacts/article-desktop.png', fullPage: true });
});
test('所有主要页面移动端无横向溢出或运行时异常', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const path of [
    '/',
    '/archives/',
    '/categories/',
    '/knowledge/',
    '/tools/',
    '/learning/',
    '/about/',
    '/articles/stack-ret2libc/',
  ]) {
    await page.goto(path);
    await page.locator('h1').waitFor();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      path,
    ).toBe(true);
  }
  expect(errors).toEqual([]);
  await page.goto('/');
  await page.screenshot({ path: 'artifacts/home-mobile.png', fullPage: true });
});
