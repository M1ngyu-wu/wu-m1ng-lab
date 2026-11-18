import { useEffect, useState } from 'react';
import { categories, knowledge as builtins, learningOrder } from '../data/knowledge';
import { useCatalog } from './useCatalog';
import { archivePath, latestVersion } from '../lib/growth';
import {
  blankStudy,
  validateData,
  recordStudy,
  STORAGE_KEY,
  type LabData,
  type Study,
  type Status,
} from '../lib/storage';
import { useLab } from './useLab';
import Quiz from './Quiz';
import { url } from '../lib/url';
function download(text: string, name: string) {
  const href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
export default function Learning() {
  const { data, update, error, ready } = useLab();
  const { nodes: knowledge, docs, catalogError } = useCatalog();
  const ordered = [
    ...learningOrder(),
    ...knowledge.filter((k) => !builtins.some((n) => n.id === k.id)),
  ];
  const [tab, setTab] = useState('progress'),
    [selected, setSelected] = useState('linux'),
    [category, setCategory] = useState('全部'),
    [draft, setDraft] = useState<Study>(blankStudy),
    [message, setMessage] = useState(''),
    [preview, setPreview] = useState<LabData | null>(null),
    [importError, setImportError] = useState('');
  const [requested, setRequested] = useState<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('tab') === 'quiz') setTab('quiz');
    const id = params.get('node');
    setRequested(id);
  }, []);
  useEffect(() => {
    if (requested && knowledge.some((k) => k.id === requested)) {
      setSelected(requested);
      setRequested(null);
    }
  }, [requested, knowledge]);
  useEffect(() => {
    setDraft(data.study[selected] || blankStudy());
  }, [selected, data]);
  const edit = (changes: Partial<Study>) => {
    const next = { ...draft, ...changes };
    setDraft(next);
    if (!ready) return;
    if (!Number.isInteger(next.minutes) || next.minutes < 0 || next.minutes > 1000000) {
      setMessage('学习时长请输入 0–1000000 的整数。');
      return;
    }
    if (update(recordStudy(data, selected, next))) setMessage('已自动保存到当前浏览器。');
  };
  const current = knowledge.find((k) => k.id === selected) || {
    id: selected,
    name: selected,
    description: '相关题解已不在当前知识库，此前保存的学习记录仍可编辑。',
    prerequisites: [] as string[],
  };
  const isBuiltin = builtins.some((n) => n.id === selected);
  const relatedDocs = docs.filter((doc) =>
    latestVersion(doc).concepts.some((c) => c.id === selected),
  );
  const count = (s: Status) =>
    knowledge.filter((k) => (data.study[k.id]?.status || '未开始') === s).length;
  const importFile = async (file: File | undefined) => {
    setPreview(null);
    setImportError('');
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setImportError('备份不能超过 10 MB。');
      return;
    }
    try {
      setPreview(validateData(JSON.parse(await file.text())));
    } catch (e) {
      setImportError((e as Error).message + ' 原有记录未修改。');
    }
  };
  return (
    <>
      {catalogError && (
        <p className="notice" role="status">
          {catalogError}
        </p>
      )}
      {error && (
        <div className="callout error" role="alert">
          {error}
        </div>
      )}
      <div className="tabs" role="tablist" aria-label="学习模块">
        {[
          ['progress', '学习进度'],
          ['quiz', '题解复盘与自测'],
          ['backup', '备份与恢复'],
        ].map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => {
              setTab(id);
              history.replaceState(null, '', `?tab=${id}`);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'quiz' ? (
        <Quiz
          initialKnowledge={
            new URLSearchParams(typeof location === 'undefined' ? '' : location.search).get(
              'node',
            ) || undefined
          }
        />
      ) : tab === 'backup' ? (
        <section className="panel">
          <h2>让学习记录始终属于你</h2>
          <p className="notice">
            备份包括知识点状态、时长、评价、笔记、命令收藏、答题历史和复习计划。导入为完整替换；验证、预览后才会写入。
          </p>
          <div className="toolbar" style={{ marginTop: 20 }}>
            <button
              className="button primary"
              onClick={() =>
                download(
                  JSON.stringify(data, null, 2),
                  `wu_m1ng-backup-${new Date().toISOString().slice(0, 10)}.json`,
                )
              }
            >
              导出 JSON 备份
            </button>
            <button
              className="button secondary"
              onClick={() => {
                try {
                  download(localStorage.getItem(STORAGE_KEY) || '{}', 'wu_m1ng-raw-backup.json');
                } catch {
                  setImportError('浏览器阻止访问存储。');
                }
              }}
            >
              导出原始存储
            </button>
          </div>
          <label className="field">
            选择 JSON 备份文件
            <input
              aria-label="导入 JSON 文件"
              type="file"
              accept="application/json,.json"
              onChange={(e) => {
                void importFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
          {importError && (
            <div role="alert" className="callout error">
              {importError}
            </div>
          )}
          {preview && (
            <div className="callout">
              <h3>导入前预览</h3>
              <p>
                {Object.keys(preview.study).length} 条学习记录 · {preview.favorites.length} 条收藏 ·{' '}
                {preview.attempts.length} 次答题 · {Object.keys(preview.reviews).length} 项复习计划
              </p>
              <p>确认后覆盖当前浏览器的记录。建议先导出当前备份。</p>
              <div className="toolbar" style={{ marginTop: 14 }}>
                <button
                  className="button primary"
                  onClick={() => {
                    if (update(preview, true)) {
                      setPreview(null);
                      setMessage('备份已恢复。');
                    }
                  }}
                >
                  确认替换并导入
                </button>
                <button className="button secondary" onClick={() => setPreview(null)}>
                  取消
                </button>
              </div>
            </div>
          )}
          <p role="status" className="notice">
            {message}
          </p>
        </section>
      ) : (
        <>
          <div className="metric-grid">
            <div>
              <strong>{knowledge.length}</strong>
              <span>知识点总数</span>
            </div>
            {(['已掌握', '学习中', '未开始'] as Status[]).map((s) => (
              <div key={s}>
                <strong>{count(s)}</strong>
                <span>{s}</span>
              </div>
            ))}
          </div>
          <div className="direction-progress">
            {categories.map((c) => {
              const nodes = knowledge.filter((k) => k.category === c.id);
              const mastered = nodes.filter((k) => data.study[k.id]?.status === '已掌握').length;
              return (
                <div key={c.id}>
                  <p>
                    <span>{c.name}</span>
                    <span>
                      {mastered}/{nodes.length}
                    </span>
                  </p>
                  <div
                    className="progress"
                    role="progressbar"
                    aria-label={`${c.name} 掌握进度`}
                    aria-valuemin={0}
                    aria-valuemax={nodes.length}
                    aria-valuenow={mastered}
                  >
                    <span style={{ width: `${(mastered / nodes.length) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="toolbar">
            <select
              aria-label="学习方向筛选"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option>全部</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <span className="muted small">按前置依赖排序 · 点击知识点记录学习</span>
          </div>
          <div className="study-layout">
            <div className="study-list">
              {ordered
                .filter((k) => category === '全部' || k.category === category)
                .map((k, i) => (
                  <button
                    key={k.id}
                    className={k.id === selected ? 'selected' : ''}
                    onClick={() => {
                      setSelected(k.id);
                      setMessage('');
                    }}
                  >
                    <span>
                      {String(i + 1).padStart(2, '0')}　{k.name}
                    </span>
                    <small>{data.study[k.id]?.status || '未开始'}</small>
                  </button>
                ))}
            </div>
            <section className="panel">
              <span className="eyebrow">PERSONAL LEARNING RECORD</span>
              <h2 style={{ marginTop: 10 }}>{current.name}</h2>
              <p className="notice">{current.description}</p>
              <div className="tags">
                {current.prerequisites.length ? (
                  current.prerequisites.map((id) => (
                    <span key={id}>前置：{knowledge.find((k) => k.id === id)?.name}</span>
                  ))
                ) : (
                  <span>无前置知识，可从这里开始</span>
                )}
              </div>
              <div className="two-col" style={{ marginTop: 25 }}>
                <label className="field">
                  学习状态
                  <select
                    aria-label="学习状态"
                    value={draft.status}
                    onChange={(e) => edit({ status: e.target.value as Status })}
                  >
                    {['未开始', '学习中', '已掌握'].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  累计学习时长（分钟）
                  <input
                    aria-label="学习时长"
                    type="number"
                    min="0"
                    max="1000000"
                    step="1"
                    value={draft.minutes}
                    onChange={(e) => edit({ minutes: +e.target.value })}
                  />
                </label>
              </div>
              <label className="field">
                自我评价
                <select
                  aria-label="自我评价"
                  value={draft.rating}
                  onChange={(e) => edit({ rating: +e.target.value })}
                >
                  <option value="0">尚未评价</option>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n} / 5
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                个人笔记
                <textarea
                  aria-label="个人笔记"
                  placeholder="用自己的话解释：理解了什么，还有什么疑问？"
                  maxLength={20000}
                  value={draft.notes}
                  onChange={(e) => edit({ notes: e.target.value })}
                />
              </label>
              <p role="status" className="notice">
                {message || '修改后即时自动保存。'} 最近学习：
                {data.study[selected]?.updated
                  ? new Date(data.study[selected].updated).toLocaleString('zh-CN')
                  : '尚无记录'}
              </p>
              <a
                href={url(
                  isBuiltin
                    ? `knowledge/${selected}/`
                    : `knowledge/?node=${encodeURIComponent(selected)}`,
                )}
                className="text-link"
              >
                查看文章、工具与关联实验 →
              </a>
              <div className="link-list">
                {relatedDocs.map((doc) => (
                  <a key={doc.id} href={url(archivePath(doc.id))}>
                    {latestVersion(doc).title} →
                  </a>
                ))}
              </div>
            </section>
          </div>
          <section className="panel" style={{ marginTop: 25 }}>
            <h3>最近学习记录</h3>
            <div className="history">
              {Object.entries(data.study)
                .filter(([, s]) => s.updated)
                .sort((a, b) => Date.parse(b[1].updated) - Date.parse(a[1].updated))
                .slice(0, 6)
                .map(([id, s]) => (
                  <div key={id}>
                    <button
                      className="text-link"
                      style={{ background: 'none', border: 0, padding: 0 }}
                      onClick={() => setSelected(id)}
                    >
                      {knowledge.find((k) => k.id === id)?.name || id}
                    </button>
                    <span>
                      {s.status} · {s.minutes} 分钟 ·{' '}
                      {new Date(s.updated).toLocaleDateString('zh-CN')}
                    </span>
                  </div>
                ))}
            </div>
            {!Object.keys(data.study).length && (
              <p className="small muted">暂无学习记录。选择一个知识点，开始记录。</p>
            )}
          </section>
        </>
      )}
    </>
  );
}
