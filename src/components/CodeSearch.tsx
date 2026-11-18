import { useEffect, useMemo, useState } from 'react';
import { indexMarkdown, matchSnippets, type Snippet } from '../lib/code-search';
import { loadArchive } from '../lib/archive-store';
import { publishedDocs } from '../lib/archive-public';
import { url } from '../lib/url';
import { categories } from '../data/knowledge';

export default function CodeSearch({ initial }: { initial: Snippet[] }) {
  const [documents, setDocuments] = useState(initial);
  const [warning, setWarning] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [language, setLanguage] = useState('');
  const [sensitive, setSensitive] = useState(false);
  const [exact, setExact] = useState(true);
  const [limit, setLimit] = useState(30);
  useEffect(() => {
    let active = true;
    const combine = (docs: typeof publishedDocs) => {
      if (!active) return;
      const snippets = docs.flatMap((doc) => {
        const v = doc.versions.at(-1);
        if (!v || v.category === 'pwn') return [];
        const path = publishedDocs.some(
          (d) => d.id === doc.id && d.versions.at(-1)?.source.sha256 === v.source.sha256,
        )
          ? 'writeups/' + doc.id + '/'
          : 'writeups/view/?id=' + encodeURIComponent(doc.id);
        return indexMarkdown(v.markdown, { title: v.title, path, category: v.category }, true);
      });
      setDocuments([...initial, ...snippets]);
    };
    const refresh = () =>
      loadArchive()
        .then(combine)
        .catch(() => {
          combine(publishedDocs);
          if (active) setWarning('本地题解暂时无法读取，正在显示公开资料。');
        });
    refresh();
    return () => {
      active = false;
    };
  }, [initial]);
  const results = useMemo(
    () => matchSnippets(documents, query, { category, language, sensitive, exact }),
    [documents, query, category, language, sensitive, exact],
  );
  return (
    <div className="code-search">
      <div className="toolbar">
        <input
          type="search"
          aria-label="搜索代码片段"
          placeholder="输入命令、函数或代码原文…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(30);
          }}
        />
        <select
          aria-label="代码分类"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">所有方向</option>
          {[...new Set(documents.map((s) => s.category))].sort().map((c) => (
            <option key={c} value={c}>
              {categories.find((k) => k.id === c)?.name || c}
            </option>
          ))}
        </select>
        <select
          aria-label="代码语言"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
        >
          <option value="">所有语言</option>
          {[...new Set(documents.map((s) => s.language))].sort().map((l) => (
            <option key={l}>{l}</option>
          ))}
        </select>
      </div>
      <div className="search-options">
        <label>
          <input type="checkbox" checked={exact} onChange={(e) => setExact(e.target.checked)} />{' '}
          精确匹配
        </label>
        <label>
          <input
            type="checkbox"
            checked={sensitive}
            onChange={(e) => setSensitive(e.target.checked)}
          />{' '}
          区分大小写
        </label>
      </div>
      {warning && <p role="status">{warning}</p>}
      <p className="muted" role="status">
        {!query.trim()
          ? '可搜索 ' + documents.length + ' 处代码，保留空格和标点。'
          : '找到 ' + results.length + ' 处匹配。'}
      </p>
      {results.slice(0, limit).map((r) => (
        <article className="snippet-result" key={r.path + '#' + r.anchor}>
          <small>
            {r.category} · {r.language} · {r.section} · 片段第 {r.matchLine} 行
          </small>
          <h2>
            <a href={url(r.path) + '#' + r.anchor}>{r.title} ↗</a>
          </h2>
          <pre>
            <code>{r.excerpt}</code>
          </pre>
        </article>
      ))}
      {results.length > limit && (
        <button className="button secondary" onClick={() => setLimit(limit + 30)}>
          显示更多匹配
        </button>
      )}
    </div>
  );
}
