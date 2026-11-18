import test from 'node:test';
import assert from 'node:assert/strict';
import { publishArchive, type PublishProgress } from '../src/lib/githubPublish';
import { attachVersion, parseArchive, sha256 } from '../src/lib/archive';
const base = 'https://api.github.com/repos/M1ngyu-wu/wu-m1ng-lab';
const head = 'a'.repeat(40),
  sha = 'b'.repeat(40),
  tree = 'c'.repeat(40);
const make = async (text: string) =>
  attachVersion([], await parseArchive(text, 'safe.md', await sha256(text))).doc;
async function run(outcome: 'success' | 'denied' | 'conflict' | 'build-fail') {
  const docs = await Promise.all([
    make('# 审计笔记\n只记录证据。'),
    make('# 证书指纹\n保存元数据。'),
  ]);
  const original = JSON.stringify(docs),
    stages: PublishProgress[] = [],
    writes: string[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const uri = String(input);
    assert.ok(uri.startsWith(base));
    assert.ok(!uri.includes('test-secret'));
    assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer test-secret');
    assert.equal(init?.redirect, 'error');
    const path = uri.slice(base.length);
    const method = init?.method;
    const respond = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status });
    if (method !== 'GET') writes.push(path);
    if (outcome === 'denied') return respond({}, 401);
    if (path === '') return respond({ full_name: 'M1ngyu-wu/wu-m1ng-lab', default_branch: 'main' });
    if (path === '/actions/workflows/pages.yml')
      return respond({ path: '.github/workflows/pages.yml', state: 'active' });
    if (path === '/git/ref/heads/main') return respond({ object: { sha: head } });
    if (path === '/git/commits/' + head) return respond({ tree: { sha: tree } });
    if (path.startsWith('/git/trees/') && method === 'GET')
      return respond({ tree: [], truncated: false });
    if (path === '/git/trees') {
      const data = JSON.parse(String(init?.body));
      assert.equal(data.base_tree, tree);
      assert.equal(data.tree.length, 6);
      for (const f of data.tree) assert.match(f.path, /^src\/data\/archive(?:-revisions)?\//);
      assert.ok(!String(init?.body).includes('test-secret'));
      return respond({ sha: tree });
    }
    if (path === '/git/commits') {
      assert.deepEqual(JSON.parse(String(init?.body)).parents, [head]);
      return respond({ sha });
    }
    if (path === '/git/refs/heads/main') {
      assert.equal(JSON.parse(String(init?.body)).force, false);
      return respond({}, outcome === 'conflict' ? 409 : 200);
    }
    if (path.startsWith('/actions/workflows/pages.yml/runs?'))
      return respond({
        workflow_runs: [
          {
            id: 42,
            head_sha: sha,
            status: 'completed',
            conclusion: outcome === 'build-fail' ? 'failure' : 'success',
          },
        ],
      });
    throw Error('unexpected route ' + path);
  };
  const action = publishArchive({
    token: 'test-secret',
    docs,
    published: [],
    knownConceptIds: [],
    progress: (s) => stages.push(s),
    fetcher,
    pollMs: 0,
    attempts: 1,
  });
  if (outcome === 'success') {
    await action;
    assert.equal(stages.at(-1)?.stage, 'deployed');
    assert.equal(stages.at(-1)?.stats?.newDocs, 2);
    assert.equal(writes.filter((p) => p === '/git/commits').length, 1);
  } else {
    await assert.rejects(action);
    assert.ok(!stages.some((s) => s.stage === 'deployed'));
    assert.equal(JSON.stringify(docs), original);
  }
}
for (const scenario of ['success', 'denied', 'conflict', 'build-fail'] as const)
  test('发布协议 ' + scenario, () => run(scenario));
