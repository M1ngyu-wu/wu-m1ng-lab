import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { knowledge, learningOrder, categories } from '../src/data/knowledge';
import { tools } from '../src/data/tools';
import { questions } from '../src/data/questions';
import { stackModel, libcAddresses, ropState } from '../src/lib/simulation';
import { emptyData, validateData, grade, recordAnswer } from '../src/lib/storage';

test('覆盖边界：到达边界不等于写入返回地址', () => {
  assert.equal(stackModel(32, 32).overflow, 0);
  assert.equal(stackModel(32, 40).returnBytes, 0);
  assert.equal(stackModel(32, 41).returnBytes, 1);
  assert.equal(stackModel(32, 48).returnBytes, 8);
});
test('64 位地址保持精度，拒绝无效输入和溢出', () => {
  const r = libcAddresses('0x7ffff7a80aa0', '0x80aa0', '0x50d60', '0x1d8698');
  assert.equal(r.base, 0x7ffff7a00000n);
  assert.equal(r.system, 0x7ffff7a50d60n);
  assert.equal(r.aligned, true);
  assert.throws(() => libcAddresses('123', '0x0', '0x0', '0x0'));
  assert.throws(() => libcAddresses('0x0', '0x1', '0x0', '0x0'));
  assert.throws(() => libcAddresses('0xffffffffffffffff', '0x0', '0x1', '0x0'));
});
test('ROP 消费数据槽，寄存器和 RSP 一致', () => {
  const chain = [
    { id: '1', op: 'pop rdi' as const, value: '0x1234' },
    { id: '2', op: 'ret' as const, value: '0x0' },
  ];
  assert.equal(ropState(chain, 1).regs.RDI, '0x1234');
  assert.equal(ropState(chain, 1).rsp, 0x7fffffffe010n);
  assert.equal(ropState(chain, 2).rsp, 0x7fffffffe018n);
  assert.equal(ropState(chain, 0).regs.RDI, '0x0');
});
test('统一数据关系有效，学习顺序满足依赖，示例题不少于 15 道', () => {
  const ids = new Set(knowledge.map((k) => k.id));
  assert.equal(ids.size, knowledge.length);
  const order = learningOrder().map((k) => k.id);
  knowledge.forEach((k) =>
    k.prerequisites.forEach((p) => assert.ok(order.indexOf(p) < order.indexOf(k.id))),
  );
  tools.forEach((t) => {
    t.knowledge.forEach((k) => assert.ok(ids.has(k)));
    assert.match(t.source, /^https:\/\//);
  });
  assert.ok(questions.length >= 15);
  assert.equal(new Set(questions.map((q) => q.type)).size, 5);
  questions.forEach((q) => {
    assert.ok(ids.has(q.knowledge));
    assert.ok(existsSync(`src/content/articles/${q.article}.md`));
    assert.ok(q.answers.length);
  });
  const articles = readdirSync('src/content/articles');
  assert.ok(articles.length >= 5);
  assert.equal(categories.length, 7);
});
test('导入完整验证，不接受未知 ID、非法状态、负时长和伪造日期', () => {
  const good = emptyData();
  good.study.linux = {
    status: '学习中',
    minutes: 12,
    rating: 3,
    updated: '2026-11-17T10:00:00Z',
    notes: '理解描述符',
  };
  assert.deepEqual(validateData(JSON.parse(JSON.stringify(good))), good);
  for (const invalid of [
    { ...good, version: 2 },
    { ...good, study: { unknown: good.study.linux } },
    { ...good, study: { linux: { ...good.study.linux, minutes: -1 } } },
    { ...good, study: { linux: { ...good.study.linux, status: '伪造' } } },
    { ...good, reviews: { q1: { mastered: false, due: 'invalid', streak: 0 } } },
  ])
    assert.throws(() => validateData(invalid));
  assert.equal(good.study.linux.minutes, 12);
  assert.throws(() =>
    validateData(
      JSON.parse(
        '{"version":1,"study":{"__proto__":{}},"favorites":[],"attempts":[],"reviews":{}}',
      ),
    ),
  );
});
test('答案匹配和间隔复习，错误重置 streak 并保存历史', () => {
  assert.ok(grade([' 40 字节。'], ['40字节']));
  assert.ok(grade(['b', 'a'], ['a', 'b'], true));
  assert.ok(!grade(['a'], ['a', 'b'], true));
  const now = new Date('2026-11-17T10:00:00Z');
  let d = recordAnswer(emptyData(), 'q1', false, ['高地址'], now);
  assert.equal(d.attempts.length, 1);
  assert.equal(d.reviews.q1.due, '2026-11-17T10:10:00.000Z');
  d = recordAnswer(d, 'q1', true, ['低地址'], now);
  assert.equal(d.reviews.q1.streak, 1);
  assert.equal(d.reviews.q1.due, '2026-11-18T10:00:00.000Z');
  assert.deepEqual(validateData(d), d);
});
test('生产页面的站内链接和资源均存在', () => {
  if (!existsSync('dist/index.html')) return;
  const walk = (path: string): string[] =>
    readdirSync(path, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(`${path}/${e.name}`) : [`${path}/${e.name}`],
    );
  const files = walk('dist').filter((f) => f.endsWith('.html'));
  const base = (process.env.BASE_PATH || '').replace(/\/$/, '');
  for (const file of files) {
    const html = readFileSync(file, 'utf8');
    for (const match of html.matchAll(/(?:href|src)="(\/[^"]*)"/g)) {
      let target = decodeURIComponent(match[1].split(/[?#]/)[0]);
      if (base && (target === base || target.startsWith(base + '/')))
        target = target.slice(base.length) || '/';
      if (!target) continue;
      assert.ok(
        existsSync(`dist${target}`) || existsSync(`dist${target}/index.html`),
        `${file} → ${target}`,
      );
    }
  }
  assert.ok(existsSync('dist/rss.xml'));
  assert.ok(existsSync('dist/sitemap-index.xml'));
  assert.ok(existsSync('dist/robots.txt'));
  assert.ok(existsSync('dist/pagefind/pagefind.js'));
});
