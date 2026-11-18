import { useEffect, useState } from 'react';
import { categories } from '../data/knowledge';
import { currentVersion, type ArchiveDoc } from '../lib/archive';
import { documentPath } from '../lib/archive-public';
import { url } from '../lib/url';
import { useCatalog } from './useCatalog';
export type Entry = {
  id: string;
  path: string;
  title: string;
  contest: string;
  category: string;
  difficulty: string;
  summary: string;
  date: string;
  tags: string[];
  body: string;
  minutes: number;
  example?: boolean;
};
function entry(doc: ArchiveDoc): Entry {
  const v = currentVersion(doc);
  return {
    id: doc.id,
    path: documentPath(doc),
    title: v.title,
    contest: v.contest,
    category: v.category,
    difficulty: v.difficulty,
    summary: v.summary,
    date: doc.versions[0].createdAt,
    tags: v.concepts.map((c) => c.name),
    body: v.markdown,
    minutes: Math.max(1, Math.ceil(v.markdown.length / 550)),
  };
}
function Row({ item }: { item: Entry }) {
  return (
    <article className="archive-entry">
      <small>
        {item.date.slice(0, 10)} · {item.category} · {item.difficulty} · {item.minutes} 分钟
        {item.example ? ' · 教学示例' : ''}
      </small>
      <h3>
        <a href={url(item.path)}>{item.title}</a>
      </h3>
      <p>{item.summary}</p>
      <small>
        比赛 {item.contest} {item.tags.length ? ' · ' + item.tags.join(' / ') : ''}
      </small>
    </article>
  );
}
export function ArchiveRecent({ limit }: { limit?: number }) {
  const { docs } = useCatalog();
  const entries = docs.map(entry).sort((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      {entries.slice(0, limit ?? entries.length).map((item) => (
        <Row item={item} key={item.id} />
      ))}
    </>
  );
}
export function ArchiveGrid() {
  const { docs } = useCatalog();
  useEffect(() => {
    window.dispatchEvent(new Event('archive-grid'));
  }, [docs]);
  return (
    <>
      {docs.map(entry).map((it) => (
        <div
          key={it.id}
          data-article
          data-category={it.category}
          data-kind="Writeup"
          data-date={it.date.slice(0, 7)}
          data-tags={JSON.stringify(it.tags)}
          data-text={[it.title, it.summary, ...it.tags].join(' ')}
        >
          <Row item={it} />
        </div>
      ))}
    </>
  );
}
export default function ArchiveBrowse({ examples }: { examples: Entry[] }) {
  const { docs, catalogError } = useCatalog();
  const [query, setQuery] = useState(''),
    [category, setCategory] = useState(''),
    [difficulty, setDifficulty] = useState(''),
    [order, setOrder] = useState('desc');
  const rows = [...docs.map(entry), ...examples]
    .filter(
      (it) =>
        (!category || category === it.category) &&
        (!difficulty || difficulty === it.difficulty) &&
        [it.title, it.contest, it.body, ...it.tags]
          .join('\n')
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
    )
    .sort((a, b) =>
      order === 'desc' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date),
    );
  return (
    <>
      <div className="toolbar">
        <input
          aria-label="搜索题解"
          placeholder="题目、比赛、正文或知识点"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label="题解方向"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">所有方向</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value="unknown">未知</option>
        </select>
        <select
          aria-label="题解难度"
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
        >
          <option value="">所有难度</option>
          {['Easy', 'Medium', 'Hard', 'Expert', '未知'].map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        <select aria-label="发布时间排序" value={order} onChange={(e) => setOrder(e.target.value)}>
          <option value="desc">最新发布优先</option>
          <option value="asc">最早发布优先</option>
        </select>
      </div>
      {catalogError && <p role="alert">{catalogError}</p>}
      <p role="status" className="notice">
        {rows.length} 篇题解
      </p>
      {rows.map((item) => (
        <Row item={item} key={item.id} />
      ))}
      {!rows.length && <p className="empty">没有匹配的题解。</p>}
    </>
  );
}
