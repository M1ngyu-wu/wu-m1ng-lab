import { expect, test } from '@playwright/test';

function pdf(text: string) {
  const content = text ? 'BT /F1 12 Tf 20 50 Td (' + text + ') Tj ET' : 'q Q';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream',
  ];
  let out = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((o, i) => {
    offsets.push(out.length);
    out += String(i + 1) + ' 0 obj\n' + o + '\nendobj\n';
  });
  const start = out.length;
  out +=
    'xref\n0 6\n0000000000 65535 f \n' +
    offsets
      .slice(1)
      .map((o) => String(o).padStart(10, '0') + ' 00000 n \n')
      .join('');
  return Buffer.from(out + 'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + start + '\n%%EOF\n');
}
test('PDF 文本层导入，无文字页提示 OCR', async ({ page }) => {
  await page.goto('/writeups/import/');
  await page.getByLabel('选择题解文件').setInputFiles([
    { name: 'metadata.pdf', mimeType: 'application/pdf', buffer: pdf('Evidence metadata') },
    { name: 'blank.pdf', mimeType: 'application/pdf', buffer: pdf('') },
  ]);
  await expect(page.getByText('完成 1 / 2 · 失败 1')).toBeVisible({ timeout: 20000 });
  await expect(page.getByText(/没有可读取的 PDF 文本层/)).toBeVisible();
  await page.getByRole('link', { name: '查看题解', exact: true }).click();
  await expect(page.locator('.prose')).toContainText('Evidence metadata');
});
test('只有点击发布才认证，401 后令牌已清除且草稿保留', async ({ page }) => {
  const seen: string[] = [];
  await page.route('https://api.github.com/**', async (r) => {
    seen.push(r.request().url());
    await r.fulfill({ status: 401, json: { message: 'Bad credentials' } });
  });
  await page.goto('/writeups/import/');
  await page.getByLabel('粘贴题解原文').fill('# 发布测试\n记录本地验证。');
  await page.getByRole('button', { name: '导入粘贴文本' }).click();
  const token = page.getByLabel('仓库专用 Fine-grained Token');
  await token.fill('fake-test-credential');
  expect(seen).toEqual([]);
  await page.getByRole('button', { name: '发布所选题解' }).click();
  await expect(page.getByRole('alert')).toContainText('令牌无效');
  expect(seen).toEqual(['https://api.github.com/repos/M1ngyu-wu/wu-m1ng-lab']);
  await expect(token).toHaveValue('');
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
    'fake-test-credential',
  );
  await page.reload();
  await expect(page.getByText('发布测试 · 1 个版本')).toBeVisible();
});
