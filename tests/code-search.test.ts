import test from 'node:test';
import assert from 'node:assert/strict';
import { indexMarkdown, matchSnippets } from '../src/lib/code-search';
const options = { exact: true, sensitive: true, category: '', language: '' };
const doc = { title: '格式笔记', path: 'writeups/view/?id=example', category: 'misc' };
const body = [
  '# 编码',
  '行内示例 `hex(value)`。',
  '## 常量',
  '~~~asm',
  'mov eax, 0x400123',
  '~~~',
  '## 校验',
  '```python',
  'assert raw == b"[a];"',
  '```',
].join('\n');
test('代码索引保留特殊字符、上下文与可回跳的位置', () => {
  const index = indexMarkdown(body, doc, true);
  assert.equal(index.length, 3);
  const [hit] = matchSnippets(index, '[a];', options);
  assert.equal(hit.language, 'python');
  assert.equal(hit.section, '校验');
  assert.equal(hit.anchor, 'line-8');
  assert.equal(hit.excerpt, 'assert raw == b"[a];"');
  assert.equal(matchSnippets(index, 'hex(value)', options)[0].language, 'inline');
  assert.equal(matchSnippets(index, '0x400123', options)[0].anchor, 'line-4');
  assert.equal(matchSnippets(index, 'MOV', options).length, 0);
  assert.equal(
    matchSnippets(index, 'EAX mov', { ...options, exact: false, sensitive: false }).length,
    1,
  );
  assert.equal(matchSnippets(index, 'eax', { ...options, language: 'bash' }).length, 0);
  assert.equal(matchSnippets(index, 'eax', { ...options, category: 'crypto' }).length, 0);
});
