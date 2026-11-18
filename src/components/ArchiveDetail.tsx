import { useEffect, useState } from 'react';
import { currentVersion, type ArchiveDoc } from '../lib/archive';
import { url } from '../lib/url';
import { restore, getOriginal } from '../lib/archive-store';
import { questions } from '../data/questions';
import { tools } from '../data/tools';
import { useCatalog } from './useCatalog';
import ArchiveMarkdown from './ArchiveMarkdown';

export function changedLines(a: string, b: string) {
  const before = a.split('\n'),
    after = b.split('\n');
  let first = 0,
    tail = 0;
  while (first < Math.min(before.length, after.length) && before[first] === after[first]) first++;
  while (
    tail < Math.min(before.length, after.length) - first &&
    before[before.length - tail - 1] === after[after.length - tail - 1]
  )
    tail++;
  return [
    ...before.slice(first, before.length - tail).map((s) => '− ' + s),
    ...after.slice(first, after.length - tail).map((s) => '+ ' + s),
  ].join('\n');
}
export default function ArchiveDetail({
  published,
  articles = [],
}: {
  published?: ArchiveDoc;
  articles?: { id: string; title: string; concepts: string[] }[];
}) {
  const { docs, catalogError } = useCatalog();
  const [id, setId] = useState(published?.id || ''),
    [selected, setSelected] = useState(0),
    [base, setBase] = useState(1),
    [message, setMessage] = useState('');
  useEffect(() => {
    if (!published) setId(new URLSearchParams(location.search).get('id') || '');
  }, [published]);
  const doc = docs.find((d) => d.id === id) || published;
  const latest = doc && currentVersion(doc);
  const v = doc?.versions.find((x) => x.version === selected) || latest;
  useEffect(() => {
    const position = () => {
      document.querySelector('[data-source-focus]')?.removeAttribute('data-source-focus');
      if (!v || !/^#line-\d+$/.test(location.hash)) return;
      const target = document.getElementById(location.hash.slice(1));
      if (target) {
        target.setAttribute('data-source-focus', '');
        target.tabIndex = -1;
        target.focus({ preventScroll: true });
        target.scrollIntoView();
      }
    };
    position();
    window.addEventListener('hashchange', position);
    return () => window.removeEventListener('hashchange', position);
  }, [id, v]);
  if (!doc || !v || !latest)
    return (
      <section className="panel">
        <h1>题解详情</h1>
        <p>{catalogError || '此浏览器中没有对应的题解。'}</p>
        <a href={url('writeups/')}>返回题解中心</a>
      </section>
    );
  const source = v.source;
  const path = (n: number) =>
    '#line-' + Math.max(1, n - source.bodyStart + 1 + (source.generatedPrefix || 0));
  const original = async () => {
    try {
      const blob = await getOriginal(source.sha256);
      if (!blob) {
        setMessage('此浏览器没有原始附件，可查看下方来源摘录。');
        return;
      }
      const u = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = u;
      a.download = source.filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(u), 1000);
    } catch {
      setMessage('无法读取本地附件。');
    }
  };
  const prior = doc.versions.find((x) => x.version === base) || doc.versions[0];
  return (
    <>
      <header className="page-head">
        <span className="eyebrow">WRITEUPS</span>
        <h1>{v.title}</h1>
        <p>{v.summary}</p>
        <small>
          {v.contest} · {v.category} · {v.difficulty} · v{v.version} · {v.createdAt.slice(0, 10)}
        </small>
      </header>
      <div className="archive-layout">
        <article
          data-pagefind-body
          data-type="题解"
          data-category={v.category}
          data-pagefind-filter="类型[data-type],分类[data-category]"
        >
          <ArchiveMarkdown
            value={v.markdown}
            filename={source.filename}
            offset={source.bodyStart - 1 - (source.generatedPrefix || 0)}
          />
        </article>
        <aside className="panel">
          <h2>章节目录</h2>
          {source.sections.map((s) => (
            <p key={s.start}>
              <a href={path(s.start)}>{s.title}</a>
            </p>
          ))}
        </aside>
      </div>
      <section className="panel archive-panel">
        <h2>原文来源</h2>
        <p>
          {source.filename} · {source.format} · {source.uploadedAt}
        </p>
        <small>
          SHA-256 <code>{source.sha256}</code>
        </small>
        <p>
          <button onClick={original}>下载本地原件</button>{' '}
          <button
            onClick={() => {
              const u = URL.createObjectURL(
                new Blob([v.markdown], { type: 'text/markdown;charset=utf-8' }),
              );
              const a = document.createElement('a');
              a.href = u;
              a.download = doc.id + '-v' + v.version + '.md';
              a.click();
              setTimeout(() => URL.revokeObjectURL(u), 1000);
            }}
          >
            下载此版 Markdown
          </button>
        </p>
        {source.sections.map((s) => (
          <details key={s.start}>
            <summary>
              {s.title} · 原文第 {s.start}–{s.end} 行
            </summary>
            <blockquote>{s.excerpt}</blockquote>
            <a href={path(s.start)}>定位对应正文</a>
          </details>
        ))}
      </section>
      <section className="panel archive-panel">
        <h2>知识关联与融合记录</h2>
        {v.concepts.length === 0 && <p>原文未识别出有依据的知识点。</p>}
        {v.concepts.map((c) => (
          <div key={c.id} className="archive-entry">
            <b>{c.name}</b>
            <p>
              {c.aliases.join(' / ')} → {c.name} · {c.id} · {v.createdAt.slice(0, 10)}
            </p>
            <small>
              {c.id.startsWith('concept-') ? '同方向显式标签归一' : '匹配已登记的名称或别名'} ·{' '}
              <a href={path(c.line)}>
                原文第 {c.line} 行「{c.matched}」
              </a>
            </small>
            <div className="link-list">
              <a href={url('knowledge/?node=' + c.id)}>在图谱中查看</a>
              <a href={url('learning/?node=' + c.id)}>学习记录</a>
              {questions.some((q) => q.knowledge === c.id) && (
                <a href={url('learning/?tab=quiz&node=' + c.id)}>相关自测</a>
              )}
            </div>
          </div>
        ))}
        {v.tools.map((id) => (
          <a key={id} className="filter-chip" href={url('tools/' + id + '/')}>
            {tools.find((t) => t.id === id)?.name || id}
          </a>
        ))}
        {articles
          .filter((a) => a.concepts.some((id) => v.concepts.some((k) => k.id === id)))
          .map((a) => (
            <p key={a.id}>
              <a href={url('articles/' + a.id + '/')}>相关文章 · {a.title}</a>
            </p>
          ))}
        {docs
          .filter(
            (d) =>
              d.id !== doc.id &&
              currentVersion(d).concepts.some((c) => v.concepts.some((k) => k.id === c.id)),
          )
          .map((d) => (
            <p key={d.id}>
              <a href={url('writeups/view/?id=' + d.id)}>关联题解 · {currentVersion(d).title}</a>
            </p>
          ))}
      </section>
      <section className="panel archive-panel">
        <h2>版本历史</h2>
        <label>
          查看版本{' '}
          <select
            aria-label="查看版本"
            value={v.version}
            onChange={(e) => setSelected(Number(e.target.value))}
          >
            {doc.versions.map((s) => (
              <option value={s.version} key={s.version}>
                v{s.version} · {s.createdAt} {s.restoredFrom ? '恢复自 v' + s.restoredFrom : ''}
              </option>
            ))}
          </select>
        </label>
        <p>
          {v.commit ? (
            <a href={'https://github.com/M1ngyu-wu/wu-m1ng-lab/commit/' + v.commit}>
              GitHub 提交 {v.commit.slice(0, 7)}
            </a>
          ) : (
            '尚无已验证的 GitHub 提交记录'
          )}
        </p>
        {doc.versions.length > 1 && (
          <>
            <label>
              比较基准{' '}
              <select value={base} onChange={(e) => setBase(Number(e.target.value))}>
                {doc.versions.map((s) => (
                  <option key={s.version} value={s.version}>
                    v{s.version}
                  </option>
                ))}
              </select>
            </label>
            <pre>{changedLines(prior.markdown, v.markdown) || '正文相同'}</pre>
            <p>
              知识关联变化 · 新增{' '}
              {v.concepts
                .filter((c) => !prior.concepts.some((k) => k.id === c.id))
                .map((c) => c.name)
                .join('、') || '无'}{' '}
              / 移除{' '}
              {prior.concepts
                .filter((c) => !v.concepts.some((k) => k.id === c.id))
                .map((c) => c.name)
                .join('、') || '无'}
            </p>
          </>
        )}
        {v.version !== latest.version && (
          <button
            onClick={async () => {
              try {
                await restore(doc.id, v.version, latest.version);
                setSelected(0);
                setMessage('已创建新的本地恢复版本，可在导入页发布。');
              } catch (e) {
                setMessage(String(e));
              }
            }}
          >
            恢复为新版本
          </button>
        )}
        <a className="text-link" href={url('writeups/import/')}>
          {' '}
          导入与发布 →
        </a>
      </section>
      <p role="status">{message || catalogError}</p>
    </>
  );
}
