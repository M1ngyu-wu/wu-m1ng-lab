import { useEffect, useRef, useState } from 'react';
import { knowledge } from '../data/knowledge';
import { currentVersion, type ArchiveDoc } from '../lib/archive';
import { publishedDocs } from '../lib/archive-public';
import {
  archiveChanged,
  publishArchive,
  repoUrl,
  siteUrl,
  type PublishProgress,
} from '../lib/githubPublish';
const labels = {
  prepared: '发布文件已生成',
  committed: 'GitHub 已提交',
  unchanged: '文件已是最新版本',
  waiting: '等待 GitHub Actions',
  running: 'GitHub Actions 执行中',
  deployed: 'GitHub Pages 部署成功',
  timeout: '尚未确认部署，请查看运行记录',
};
export default function ArchivePublish({ docs }: { docs: ArchiveDoc[] }) {
  const pending = docs.filter((d) =>
    archiveChanged(
      d,
      publishedDocs.find((p) => p.id === d.id),
    ),
  );
  const [excluded, setExcluded] = useState<string[]>([]);
  const [status, setStatus] = useState<PublishProgress>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null),
    controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const selected = pending.filter((d) => !excluded.includes(d.id));
  async function publish() {
    if (!input.current || controller.current) return;
    const token = input.current.value;
    input.current.value = '';
    const job = new AbortController();
    controller.current = job;
    setBusy(true);
    setError('');
    setStatus(undefined);
    try {
      await publishArchive({
        token,
        docs: selected,
        published: publishedDocs,
        knownConceptIds: knowledge.map((k) => k.id),
        signal: job.signal,
        progress: setStatus,
      });
    } catch (e) {
      if (!job.signal.aborted)
        setError(e instanceof Error ? e.message : '网络请求失败，请检查连接后重试。');
    } finally {
      controller.current = null;
      setBusy(false);
    }
  }
  return (
    <section className="panel archive-panel">
      <h2>发布到 GitHub Pages</h2>
      <p>
        所选题解的全部版本、生成的正文、知识关联、原文件名与来源摘录将公开到{' '}
        <a className="text-link" href={repoUrl}>
          M1ngyu-wu/wu-m1ng-lab
        </a>
        。学习记录与上传的原始附件保存在本机。
      </p>
      {pending.length > 0 ? (
        <>
          <fieldset disabled={busy}>
            <legend>本批发布内容</legend>
            {pending.map((d) => (
              <label key={d.id} className="archive-check">
                <input
                  type="checkbox"
                  checked={!excluded.includes(d.id)}
                  onChange={(e) =>
                    setExcluded((prev) =>
                      e.target.checked ? prev.filter((id) => id !== d.id) : [...prev, d.id],
                    )
                  }
                />
                {currentVersion(d).title} · {d.versions.length} 个版本
              </label>
            ))}
          </fieldset>
          <label className="field">
            仓库专用 Fine-grained Token
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              ref={input}
              disabled={busy}
            />
          </label>
          <p className="muted small">
            只选择此仓库，授予 Contents 读写、Actions 只读及默认 Metadata 只读权限。
          </p>
          <button className="button primary" disabled={busy || !selected.length} onClick={publish}>
            {busy ? '正在发布…' : '发布所选题解'}
          </button>
        </>
      ) : (
        <p className="notice">没有待发布的本地版本。</p>
      )}
      {status && (
        <div role="status">
          <strong>{labels[status.stage]}</strong>{' '}
          {status.sha && (
            <a className="text-link" href={repoUrl + '/commit/' + status.sha}>
              提交 {status.sha.slice(0, 7)}
            </a>
          )}{' '}
          {status.runId && (
            <a className="text-link" href={repoUrl + '/actions/runs/' + status.runId}>
              部署记录
            </a>
          )}
          {status.stats && (
            <p>
              新增文章 {status.stats.newDocs} · 更新文章 {status.stats.updatedDocs} · 新增知识点{' '}
              {status.stats.newConcepts} · 更新关联知识点 {status.stats.updatedConcepts}
            </p>
          )}
          {status.stage === 'deployed' && <a href={siteUrl + 'writeups/'}>查看已发布题解 →</a>}
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
