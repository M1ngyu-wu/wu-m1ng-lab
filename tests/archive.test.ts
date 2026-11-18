import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseArchive,
  sha256,
  attachVersion,
  restoreVersion,
  currentVersion,
} from '../src/lib/archive';
import { growthSummary } from '../src/lib/growth';
import { emptyData, blankStudy, recordStudy, validateData } from '../src/lib/storage';
const note = [
  '---',
  'title: 证据记录',
  'contest: Spring',
  'category: misc',
  'difficulty: Medium',
  'tags: [文件取证, 文件取证, 哈希校验]',
  '---',
  '## 调查方法',
  'file forensics 与文件取证使用同一个词条。',
  '~~~bash',
  'file ./sample',
  '~~~',
].join('\n');
const make = async (t: string, file = 'case.md', when = '2026-03-01T00:00:00Z') =>
  parseArchive(t, file, await sha256(t), when);
test('原文哈希、来源行、显式标签与别名保留，缺失元数据为未知', async () => {
  const v = await make(note);
  assert.equal(v.category, 'misc');
  assert.equal(v.difficulty, 'Medium');
  assert.equal(v.source.bodyStart, 8);
  assert.equal(v.source.sections[0].start, 8);
  assert.equal(v.concepts.filter((c) => c.id === 'forensics').length, 1);
  assert.ok(v.tools.includes('file'));
  assert.ok(v.concepts.some((c) => c.id.startsWith('concept-')));
  assert.match(v.markdown, /~~~bash\nfile .\/sample\n~~~/);
  assert.equal((await make('单行文字', 'test.txt')).difficulty, '未知');
  assert.equal(
    await sha256('abc'),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  );
});
test('批次去重、版本追加、恢复保留来源，含糊身份不会覆盖', async () => {
  const v = await make(note);
  const one = attachVersion([], v).doc;
  assert.equal(attachVersion([one], v).status, '重复');
  const v2 = await make(note + '\n继续核实。');
  const two = attachVersion([one], v2).doc;
  assert.equal(two.id, one.id);
  assert.equal(two.versions.length, 2);
  const restored = restoreVersion(two, 1);
  assert.equal(restored.versions.length, 3);
  assert.equal(currentVersion(restored).source.sha256, v.source.sha256);
  assert.equal(currentVersion(restored).restoredFrom, 1);
  assert.equal(two.versions.length, 2);
  const other = await make(note.replace('Spring', 'Autumn'));
  assert.notEqual(attachVersion([one], other).doc.id, one.id);
});
test('成长数据来自学习状态、自测和版本；示例排除，跨月复习不重复计数', async () => {
  const v = await make(note);
  const d = attachVersion([], v).doc;
  const id = v.concepts.find((c) => c.id.startsWith('concept-'))!.id;
  let state = recordStudy(
    emptyData(),
    id,
    { ...blankStudy(), status: '学习中' },
    new Date('2026-03-01T08:00:00Z'),
  );
  state = recordStudy(
    state,
    id,
    { ...blankStudy(), status: '已掌握' },
    new Date('2026-03-02T08:00:00Z'),
  );
  const summary = growthSummary(
    validateData(state),
    [d],
    [{ category: 'misc', kind: 'Writeup', date: '2026-03-01', example: true }],
    new Date('2026-03-03'),
  );
  const row = summary.rows.find((r) => r.id === 'misc')!;
  assert.equal(row.writeups, 1);
  assert.equal(row.mastered, 1);
  assert.equal(row.answers, 0);
  assert.equal(summary.activeDays, 2);
  assert.equal(summary.months[0].masteryDelta, 1);
});
