import { test, expect } from '@playwright/test';
import { zipSync, strToU8 } from 'fflate';
const note =
  '# 保全证据\n比赛：Archive Cup\n方向：Misc\n难度：Medium\n知识点：文件取证、采样信封\n## 观察\n样本是只读的。\n\n```bash\nprintf "%s;" SHA256\n```\n<img src=x onerror="globalThis.document.body.id=123">';
function file(name: string, text: string) {
  return { name, mimeType: 'text/plain', buffer: Buffer.from(text) };
}
test('上传多文件、失败重试、重复、来源、版本恢复、知识与代码联动', async ({ page }) => {
  await page.goto('/writeups/import/');
  const input = page.getByLabel('选择题解文件');
  await input.setInputFiles([
    file('evidence.md', note),
    file('记录.txt', '证据编号\n第二份独立记录'),
    file('empty.md', ''),
  ]);
  await expect(page.getByText('完成 2 / 3 · 失败 1')).toBeVisible();
  await page.getByRole('button', { name: '重试失败文件' }).click();
  await expect(page.getByText('完成 2 / 3 · 失败 1')).toBeVisible();
  await input.setInputFiles(file('evidence.md', note));
  await expect(page.getByText('重复', { exact: true })).toBeVisible();
  await page.getByLabel('粘贴题解原文').fill(note + '\n新增取证观察。');
  await page.getByRole('button', { name: '导入粘贴文本' }).click();
  await expect(page.getByText('新版本', { exact: true })).toBeVisible();
  await page.goto('/writeups/');
  await page.getByLabel('搜索题解').fill('Archive Cup');
  await page.getByLabel('题解难度').selectOption('Hard');
  await expect(page.getByText('没有匹配的题解。')).toBeVisible();
  await page.getByLabel('题解难度').selectOption('Medium');
  await page.getByRole('link', { name: '保全证据', exact: true }).click();
  await expect(page.getByRole('heading', { name: '原文来源', exact: true })).toBeVisible();
  await expect(page.getByText('新增取证观察。').first()).toBeVisible();
  await page.getByLabel('查看版本').selectOption('1');
  await page.getByRole('button', { name: '恢复为新版本' }).click();
  await expect(page.getByLabel('查看版本')).toHaveValue('3');
  await expect(page.locator('body')).not.toHaveAttribute('id', '123');
  await page.goto('/search/code/');
  await page.getByLabel('搜索代码片段').fill('"%s;"');
  const link = page.locator('.snippet-result').getByRole('link', { name: /保全证据/ });
  await link.click();
  await expect(page.locator('[data-source-focus]')).toContainText('printf');
  await expect(page.locator('[data-source-focus]')).toBeFocused();
  await page.goto('/knowledge/');
  await page.getByLabel('搜索知识节点').fill('采样信封');
  await page.getByRole('button', { name: '采样信封', exact: true }).click();
  await expect(page.locator('.graph-info')).toContainText('保全证据');
  await page.getByRole('link', { name: '记录学习进度' }).click();
  await expect(page.locator('main')).toContainText('采样信封');
  await page.goto('/growth/');
  await expect(
    page
      .locator('tbody tr')
      .filter({ has: page.getByRole('rowheader', { name: 'Misc', exact: true }) })
      .first()
      .locator('td')
      .first(),
  ).toHaveText('1');
  await page.goto('/writeups/import/');
  await expect(page.getByLabel('仓库专用 Fine-grained Token')).toHaveValue('');
});
test('DOCX 正文可提取，损坏 PDF 有明确失败状态', async ({ page }) => {
  await page.goto('/writeups/import/');
  const doc = zipSync({
    'word/document.xml': strToU8(
      '<w:document xmlns:w="urn:test"><w:body><w:p><w:r><w:t>文档证据字段</w:t></w:r></w:p></w:body></w:document>',
    ),
  });
  await page
    .getByLabel('选择题解文件')
    .setInputFiles([
      { name: '证据.docx', mimeType: 'application/zip', buffer: Buffer.from(doc) },
      file('损坏.pdf', 'invalid'),
    ]);
  await expect(page.getByText('完成 1 / 2 · 失败 1')).toBeVisible({ timeout: 20000 });
  await page.getByRole('link', { name: '查看题解', exact: true }).click();
  await expect(page.locator('.prose')).toContainText('文档证据字段');
});
