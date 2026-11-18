import { useState } from 'react';
import { useLab } from './useLab';
import { useCatalog } from './useCatalog';
import { growthSummary, percent, type GrowthArticle } from '../lib/growth';
import { url } from '../lib/url';
import '../styles/growth.css';

export default function Growth({ articles }: { articles: GrowthArticle[] }) {
  const { data, ready, error } = useLab();
  const { docs, catalogError } = useCatalog();
  const [period, setPeriod] = useState(6);
  if (!ready) return <p className="muted">正在读取本机学习记录…</p>;
  if (error)
    return (
      <p role="alert" className="callout error">
        {error}
      </p>
    );
  const summary = growthSummary(data, docs, articles);
  const now = new Date();
  const cutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - period + 1, 1))
    .toISOString()
    .slice(0, 7);
  const months = summary.months.filter((m) => period === 0 || m.month >= cutoff);
  return (
    <div className="growth-content">
      {catalogError && (
        <p className="callout warning" role="status">
          {catalogError}
        </p>
      )}
      <div className="metric-grid">
        <div>
          <strong>
            {summary.activeDays}
            <small> 天</small>
          </strong>
          <span>近 30 天学习活跃</span>
        </div>
        <div>
          <strong>
            {summary.covered}
            <small> / {summary.total}</small>
          </strong>
          <span>已开始学习的知识点</span>
        </div>
        <div>
          <strong>
            {summary.rows.reduce((sum, r) => sum + r.writeups, 0) + summary.uncategorized}
          </strong>
          <span>个人题解</span>
        </div>
      </div>
      <section className="panel">
        <h2>按技术方向查看</h2>
        <p className="notice">
          题解和文章计数排除内置示例，导入题解同时计入生成文章。掌握状态取自学习记录，自测正确率仅统计有标准答案的作答。
        </p>
        {summary.uncategorized > 0 && <p>另有 {summary.uncategorized} 篇题解尚无明确方向。</p>}
        <div className="growth-scroll" tabIndex={0} role="region" aria-label="各方向数据">
          <table>
            <thead>
              <tr>
                {['方向', '题解', '文章', '知识点', '学习中', '已掌握', '自测正确率'].map((s) => (
                  <th key={s}>{s}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summary.rows.map((r) => (
                <tr key={r.id}>
                  <th scope="row">{r.name}</th>
                  <td>{r.writeups}</td>
                  <td>{r.articles}</td>
                  <td>{r.concepts}</td>
                  <td>{r.studying}</td>
                  <td>{r.mastered}</td>
                  <td>
                    {percent(r.correct, r.answers)}{' '}
                    {r.answers > 0 && (
                      <small>
                        ({r.correct}/{r.answers})
                      </small>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div className="two-col">
        <section className="panel">
          <h2>当前学习重点</h2>
          {summary.focus.length ? (
            <div className="link-list">
              {summary.focus.map((n) => (
                <a key={n.id} href={url('learning/?node=' + encodeURIComponent(n.id))}>
                  {n.name} →
                </a>
              ))}
            </div>
          ) : (
            <p className="notice">把知识点标记为「学习中」，就能在这里继续学习。</p>
          )}
        </section>
        <section className="panel">
          <h2>值得复习的方向</h2>
          {summary.needsReview.length ? (
            <>
              <p className="notice">曾经答错的方向，按已作答题目的正确率排列。</p>
              <ul>
                {summary.needsReview.map((r) => (
                  <li key={r.id}>
                    {r.name} · {r.answers - r.correct} 次错答 / {r.answers} 次作答
                  </li>
                ))}
              </ul>
              <a className="text-link" href={url('learning/?tab=quiz')}>
                打开错题复盘 →
              </a>
            </>
          ) : (
            <p className="notice">
              {summary.rows.some((r) => r.answers)
                ? '目前已记录的自测均答对。'
                : '完成自测后，这里会列出有错答记录的方向。'}
            </p>
          )}
        </section>
      </div>
      <section className="panel">
        <div className="toolbar">
          <h2>每月变化</h2>
          <select
            aria-label="趋势时间范围"
            value={period}
            onChange={(e) => setPeriod(Number(e.target.value))}
          >
            <option value={6}>近 6 个月</option>
            <option value={12}>近 12 个月</option>
            <option value={0}>全部月份</option>
          </select>
        </div>
        <p className="notice">
          按 UTC
          月份统计有记录的月份。同一知识点一天记一次学习，掌握变化为已掌握数的净增减。旧版备份只保留最后学习时间。
        </p>
        {months.length ? (
          <div className="growth-scroll" tabIndex={0} role="region" aria-label="月度统计">
            <table>
              <thead>
                <tr>
                  {[
                    '月份',
                    '新增题解',
                    '首次新增知识点',
                    '学习记录',
                    '自测正确率',
                    '掌握净变化',
                  ].map((s) => (
                    <th key={s}>{s}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {months.map((m) => (
                  <tr key={m.month}>
                    <th scope="row">{m.month}</th>
                    <td>{m.writeups}</td>
                    <td>{m.concepts}</td>
                    <td>{m.study}</td>
                    <td>{percent(m.correct, m.answers)}</td>
                    <td>
                      {m.masteryDelta > 0 ? '+' : ''}
                      {m.masteryDelta}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty">该时段暂无导入、学习或计分自测记录。</p>
        )}
      </section>
    </div>
  );
}
