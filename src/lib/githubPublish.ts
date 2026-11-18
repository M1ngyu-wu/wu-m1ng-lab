import type { ArchiveDoc, ArchiveVersion } from './archive';

const repo = 'M1ngyu-wu/wu-m1ng-lab';
export const repoUrl = 'https://github.com/' + repo;
export const siteUrl = 'https://m1ngyu-wu.github.io/wu-m1ng-lab/';
const apiRoot = 'https://api.github.com/repos/' + repo;
const contentRoot = 'src/data/archive/';
const idPattern = /^wu-[0-9a-f]{24}$/;
const shaPattern = /^[a-f0-9]{40}$/;
const encoder = new TextEncoder();

export type PublishStats = {
  newDocs: number;
  updatedDocs: number;
  newConcepts: number;
  updatedConcepts: number;
};
export type PublishProgress = {
  stage: 'prepared' | 'committed' | 'unchanged' | 'waiting' | 'running' | 'deployed' | 'timeout';
  sha?: string;
  runId?: number;
  stats?: PublishStats;
};
type Progress = (value: PublishProgress) => void;
type TreeEntry = { path: string; mode: string; type: string; sha: string };
type Change = { path: string; mode: '100644'; type: 'blob'; content: string };

function checkVersion(id: string, v: ArchiveVersion, index: number) {
  if (
    !idPattern.test(id) ||
    v.version !== index + 1 ||
    !v.title?.trim() ||
    typeof v.markdown !== 'string' ||
    !/^[0-9a-f]{64}$/.test(v.source.sha256) ||
    !Array.isArray(v.source.sections) ||
    !Array.isArray(v.concepts) ||
    !Array.isArray(v.tools)
  )
    throw new Error('题解结构或来源哈希无效。请重新导入原文。');
}

// Serialize only fields the public archive renders. Browser backups, uploaded
// files, study records and local receipt hints are deliberately outside this schema.
function publicVersion(v: ArchiveVersion) {
  const source = v.source;
  return {
    version: v.version,
    createdAt: v.createdAt,
    title: v.title,
    contest: v.contest,
    category: v.category,
    difficulty: v.difficulty,
    summary: v.summary,
    markdown: v.markdown,
    concepts: v.concepts.map((c) => ({
      id: c.id,
      name: c.name,
      category: c.category,
      aliases: c.aliases.map(String),
      line: c.line,
      matched: c.matched,
    })),
    tools: v.tools.map(String),
    source: {
      id: source.id,
      filename: source.filename.split(/[\\/]/).pop(),
      format: source.format,
      sha256: source.sha256,
      uploadedAt: source.uploadedAt,
      bodyStart: source.bodyStart,
      generatedPrefix: source.generatedPrefix,
      sections: source.sections.map((s) => ({
        title: s.title,
        start: s.start,
        end: s.end,
        excerpt: s.excerpt,
      })),
    },
    identity: v.identity,
    restoredFrom: v.restoredFrom,
  };
}

function serialized(doc: ArchiveDoc) {
  if (!doc.versions.length) throw new Error('不能发布没有版本的题解。');
  doc.versions.forEach((v, i) => checkVersion(doc.id, v, i));
  return JSON.stringify({ id: doc.id, versions: doc.versions.map(publicVersion) }, null, 2) + '\n';
}

export function archiveChanged(local: ArchiveDoc, published?: ArchiveDoc) {
  return !published || serialized(local) !== serialized(published);
}

export async function gitBlobSha(content: string) {
  const body = encoder.encode(content);
  const prefix = encoder.encode('blob ' + body.byteLength + '\0');
  const bytes = new Uint8Array(prefix.byteLength + body.byteLength);
  bytes.set(prefix);
  bytes.set(body, prefix.byteLength);
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-1', bytes)), (x) =>
    x.toString(16).padStart(2, '0'),
  ).join('');
}

class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export type PublishOptions = {
  token: string;
  docs: ArchiveDoc[];
  published: ArchiveDoc[];
  knownConceptIds: string[];
  progress: Progress;
  signal?: AbortSignal;
  fetcher?: typeof fetch;
  pollMs?: number;
  attempts?: number;
};

function apiClient(token: string, fetcher: typeof fetch, signal?: AbortSignal) {
  return async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    const response = await fetcher(apiRoot + path, {
      method,
      signal,
      redirect: 'error',
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      headers: {
        Authorization: 'Bearer ' + token,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) {
      const limited =
        response.status === 429 ||
        response.headers.get('X-RateLimit-Remaining') === '0' ||
        response.headers.has('retry-after');
      const messages: Record<number, string> = {
        401: '令牌无效或已过期。请重新输入此仓库的令牌。',
        403: '权限不足或分支受保护。请检查令牌的仓库范围、Contents 写权限和 Actions 读权限，以及分支规则。',
        404: '找不到仓库、分支或 Pages 工作流。请检查令牌的仓库范围和 Actions 读权限。',
        409: '远端分支已更新。请刷新网站后重新发布，本地稿件仍保留。',
        422: 'GitHub 拒绝更新。请检查分支保护规则或远端版本后重试。',
      };
      throw new ApiError(
        response.status,
        limited
          ? 'GitHub API 已限流。请稍后重试。'
          : (messages[response.status] ??
              'GitHub 服务返回错误 ' + response.status + '，请稍后重试。'),
      );
    }
    return response.json() as Promise<T>;
  };
}
type Api = ReturnType<typeof apiClient>;
const conflict = () =>
  new Error(
    '同一题解或其 Markdown 已在远端修改。请等待网站更新，备份本地稿，再以远端最新版本为基础导入。',
  );

async function readDocument(api: Api, entry: TreeEntry, cached?: ArchiveDoc): Promise<ArchiveDoc> {
  if (entry.type !== 'blob' || entry.mode !== '100644') throw conflict();
  if (cached && (await gitBlobSha(serialized(cached))) === entry.sha) return cached;
  const blob = await api<{ encoding: string; content: string }>('/git/blobs/' + entry.sha);
  if (blob.encoding !== 'base64') throw conflict();
  const bytes = Uint8Array.from(atob(blob.content.replace(/\s/g, '')), (char) =>
    char.charCodeAt(0),
  );
  const raw = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  const doc = JSON.parse(raw) as ArchiveDoc;
  // A manually authored public file may include additional fields or different
  // formatting. Refuse to replace it when it is outside our generated format.
  if (entry.path !== contentRoot + doc.id + '.json' || serialized(doc) !== raw) throw conflict();
  return doc;
}

async function prepare(api: Api, entries: TreeEntry[], options: PublishOptions) {
  const files = new Map(entries.map((e) => [e.path, e]));
  const hints = new Map(options.published.map((doc) => [doc.id, doc]));
  const remoteDocs = new Map<string, ArchiveDoc>();
  const known = new Set(options.knownConceptIds);
  for (const entry of entries) {
    if (!/^src\/data\/archive\/wu-[0-9a-f]{24}\.json$/.test(entry.path)) continue;
    const id = entry.path.slice(contentRoot.length, -5);
    const remote = await readDocument(api, entry, hints.get(id));
    remoteDocs.set(id, remote);
    for (const concept of remote.versions.at(-1)!.concepts) known.add(concept.id);
  }
  const changes: Change[] = [];
  const affected = new Set<string>();
  const stats: PublishStats = { newDocs: 0, updatedDocs: 0, newConcepts: 0, updatedConcepts: 0 };
  function change(path: string, content: string) {
    changes.push({ path, content, mode: '100644', type: 'blob' });
  }

  for (const doc of options.docs) {
    const json = serialized(doc);
    const path = contentRoot + doc.id;
    const previous = remoteDocs.get(doc.id);
    const mdEntry = files.get(path + '.md');
    const priorCount = previous?.versions.length ?? 0;
    if (previous) {
      if (
        priorCount > doc.versions.length ||
        serialized({ id: doc.id, versions: doc.versions.slice(0, priorCount) }) !==
          serialized(previous)
      )
        throw conflict();
      if (
        !mdEntry ||
        mdEntry.mode !== '100644' ||
        (await gitBlobSha(previous.versions.at(-1)!.markdown)) !== mdEntry.sha
      )
        throw conflict();
    } else if (mdEntry) throw conflict();
    if (priorCount === doc.versions.length) continue;
    const current = doc.versions.at(-1)!;
    change(path + '.json', json);
    change(path + '.md', current.markdown);
    for (const version of doc.versions.slice(priorCount)) {
      const marker = 'src/data/archive-revisions/' + doc.id + '/' + version.version + '.txt';
      if (files.has(marker)) throw conflict();
      change(marker, version.source.sha256 + '\n');
    }
    if (previous) {
      stats.updatedDocs++;
      for (const c of previous.versions.at(-1)!.concepts) affected.add(c.id);
    } else stats.newDocs++;
    for (const c of current.concepts) affected.add(c.id);
  }
  for (const id of affected) {
    if (known.has(id)) stats.updatedConcepts++;
    else stats.newConcepts++;
  }
  return { changes, stats };
}

type WorkflowRun = { id: number; head_sha: string; status: string; conclusion: string | null };
function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    signal?.throwIfAborted();
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', abort, { once: true });
  });
}

async function watchDeployment(
  api: Api,
  branch: string,
  sha: string,
  stats: PublishStats,
  opts: PublishOptions,
) {
  const params = new URLSearchParams({ branch, head_sha: sha, event: 'push', per_page: '10' });
  let runId: number | undefined;
  for (let count = 0; count < (opts.attempts ?? 64); count++) {
    const list = await api<{ workflow_runs: WorkflowRun[] }>(
      '/actions/workflows/pages.yml/runs?' + params,
    );
    const run = list.workflow_runs.find((r) => r.head_sha === sha);
    if (run) {
      runId = run.id;
      if (run.status === 'completed') {
        if (run.conclusion !== 'success') {
          opts.progress({ stage: 'running', sha, runId, stats });
          throw new Error(
            'Pages 工作流已结束，结果为 ' + run.conclusion + '。请打开运行记录检查日志并重新运行。',
          );
        }
        opts.progress({ stage: 'deployed', sha, runId, stats });
        return;
      }
      opts.progress({ stage: 'running', sha, runId, stats });
    } else opts.progress({ stage: 'waiting', sha, stats });
    await sleep(opts.pollMs ?? 7500, opts.signal);
  }
  opts.progress({ stage: 'timeout', sha, runId, stats });
}

export async function publishArchive(opts: PublishOptions) {
  if (!opts.token.trim() || !opts.docs.length) throw new Error('请选择题解并输入仓库令牌。');
  if (new Set(opts.docs.map((d) => d.id)).size !== opts.docs.length)
    throw new Error('发布清单有重复题解。');
  opts.docs.forEach(serialized);
  opts.progress({ stage: 'prepared' });
  const api = apiClient(opts.token.trim(), opts.fetcher ?? fetch, opts.signal);
  const remote = await api<{ full_name: string; default_branch: string }>('');
  if (remote.full_name.toLowerCase() !== repo.toLowerCase()) throw new Error('目标仓库不匹配。');
  const branch = remote.default_branch;
  if (branch !== 'main')
    throw new Error('默认分支与 Pages 工作流的 main 触发分支不一致，请同步配置后再发布。');
  const workflow = await api<{ path: string; state: string }>('/actions/workflows/pages.yml');
  if (workflow.path !== '.github/workflows/pages.yml' || workflow.state !== 'active')
    throw new Error('Pages 工作流未启用。请在仓库 Actions 中检查。');
  const ref = '/heads/' + encodeURIComponent(branch);
  for (let attempt = 0; attempt < 2; attempt++) {
    const reference = await api<{ object: { sha: string } }>('/git/ref' + ref);
    const head = reference.object.sha;
    if (!shaPattern.test(head)) throw new Error('GitHub 返回了无效的分支版本。');
    const parent = await api<{ tree: { sha: string } }>('/git/commits/' + head);
    const base = parent.tree.sha;
    const tree = await api<{ tree: TreeEntry[]; truncated: boolean }>(
      '/git/trees/' + base + '?recursive=1',
    );
    if (tree.truncated) throw new Error('GitHub 未返回完整文件清单。请从本地 Git 发布这一批文件。');
    const { changes, stats } = await prepare(api, tree.tree, opts);
    if (!changes.length) {
      opts.progress({ stage: 'unchanged', sha: head, stats });
      await watchDeployment(api, branch, head, stats, opts);
      return;
    }
    const updated = await api<{ sha: string }>('/git/trees', 'POST', {
      base_tree: base,
      tree: changes,
    });
    const commit = await api<{ sha: string }>('/git/commits', 'POST', {
      message: 'Publish ' + (stats.newDocs + stats.updatedDocs) + ' writeup(s)',
      tree: updated.sha,
      parents: [head],
    });
    if (!shaPattern.test(commit.sha)) throw new Error('GitHub 未返回有效提交。');
    try {
      await api('/git/refs' + ref, 'PATCH', { sha: commit.sha, force: false });
    } catch (error) {
      if (attempt === 0 && error instanceof ApiError && [409, 422].includes(error.status)) {
        const current = await api<{ object: { sha: string } }>('/git/ref' + ref);
        if (current.object.sha !== head) continue;
      }
      throw error;
    }
    opts.progress({ stage: 'committed', sha: commit.sha, stats });
    await watchDeployment(api, branch, commit.sha, stats, opts);
    return;
  }
}
