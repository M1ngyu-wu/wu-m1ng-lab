import { useState } from 'react';
import { tools } from '../data/tools';
import { useLab } from './useLab';
import { url } from '../lib/url';
export default function Toolbox() {
  const { data, update, error } = useLab();
  const [query, setQuery] = useState(''),
    [category, setCategory] = useState('全部'),
    [tag, setTag] = useState('全部'),
    [favorites, setFavorites] = useState(false),
    [copied, setCopied] = useState(''),
    [copyError, setCopyError] = useState('');
  const result = tools.filter(
    (t) =>
      (category === '全部' || t.category === category) &&
      (tag === '全部' || t.tags.includes(tag)) &&
      (!favorites || data.favorites.includes(t.id)) &&
      `${t.name} ${t.command} ${t.explanation} ${t.tags.join(' ')}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const copy = async (id: string, command: string) => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(id);
      setCopyError('');
      setTimeout(() => setCopied(''), 1800);
    } catch {
      setCopyError('剪贴板不可用，请手动选择并复制命令文本。');
    }
  };
  return (
    <>
      {error && (
        <p role="alert" className="callout error">
          {error}
        </p>
      )}
      {copyError && (
        <p role="alert" className="callout warning">
          {copyError}
        </p>
      )}
      <div className="toolbar">
        <input
          aria-label="搜索工具命令"
          placeholder="搜索命令、工具或用途…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label="工具分类"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option>全部</option>
          {[...new Set(tools.map((t) => t.category))].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select aria-label="标签筛选" value={tag} onChange={(e) => setTag(e.target.value)}>
          <option>全部</option>
          {[...new Set(tools.flatMap((t) => t.tags))].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <button
          className="filter-chip"
          aria-pressed={favorites}
          onClick={() => setFavorites((v) => !v)}
        >
          ☆ 收藏 ({data.favorites.length})
        </button>
      </div>
      <p className="notice" aria-live="polite">
        {result.length} 条命令 · 示例速查数据 · 仅展示与复制
      </p>
      <div className="tool-grid">
        {result.map((t) => (
          <article className="panel tool-card" key={t.id} id={t.id}>
            <header>
              <span className="eyebrow">{t.category}</span>
              <button
                className="icon-button"
                aria-label={`${data.favorites.includes(t.id) ? '取消收藏' : '收藏'} ${t.name}`}
                aria-pressed={data.favorites.includes(t.id)}
                onClick={() =>
                  update({
                    ...data,
                    favorites: data.favorites.includes(t.id)
                      ? data.favorites.filter((x) => x !== t.id)
                      : [...data.favorites, t.id],
                  })
                }
              >
                {data.favorites.includes(t.id) ? '★' : '☆'}
              </button>
            </header>
            <h3>
              <a href={url(`tools/${t.id}/`)}>{t.name} ↗</a>
            </h3>
            <p>{t.explanation}</p>
            <pre>
              <code>{t.command}</code>
            </pre>
            <div className="toolbar" style={{ marginBottom: 0 }}>
              <button className="button secondary compact" onClick={() => copy(t.id, t.command)}>
                {copied === t.id ? '已复制 ✓' : '复制命令'}
              </button>
              <div className="tags">
                {t.tags.map((tag) => (
                  <span key={tag}>#{tag}</span>
                ))}
              </div>
            </div>
            <details>
              <summary>用法、注意事项与关联知识</summary>
              <p>
                <b>示例：</b>
                {t.example}
              </p>
              <p className={t.dangerous ? 'callout warning' : ''}>
                <b>{t.dangerous ? '⚠ 运行提示：' : '注意：'}</b>
                {t.caution}
              </p>
              <div className="link-list">
                {t.knowledge.map((k) => (
                  <a href={url(`knowledge/${k}/`)} key={k}>
                    知识点 · {k} →
                  </a>
                ))}
                <a href={t.source} target="_blank" rel="noreferrer">
                  核对官方文档 ↗
                </a>
              </div>
            </details>
          </article>
        ))}
      </div>
      {!result.length && <div className="empty">没有匹配的命令。试试其他关键词或取消筛选。</div>}
    </>
  );
}
