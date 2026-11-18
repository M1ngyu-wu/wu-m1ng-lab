import { questions } from '../data/questions';
import { useLab } from './useLab';
import { useCatalog } from './useCatalog';
import { studyHistory } from '../lib/growth';
import { url } from '../lib/url';

export default function RecentActivity() {
  const { data, ready, error } = useLab();
  const { nodes } = useCatalog();
  const activity = [
    ...studyHistory(data).map((s) => ({
      at: s.at,
      name: nodes.find((n) => n.id === s.concept)?.name || s.concept,
      detail: s.after,
      path: 'learning/?node=' + encodeURIComponent(s.concept),
    })),
    ...data.attempts.map((a) => ({
      at: a.at,
      name: questions.find((q) => q.id === a.question)?.prompt || a.question,
      detail: a.correct ? '自测 · 正确' : '自测 · 待复习',
      path: 'learning/?tab=quiz',
    })),
  ]
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, 5);
  if (error) return <p role="alert">{error}</p>;
  if (!ready) return <p className="muted">正在读取本机记录…</p>;
  if (!activity.length)
    return (
      <p className="muted">
        还没有学习动态。
        <a className="text-link" href={url('learning/')}>
          记录第一次学习 →
        </a>
      </p>
    );
  return (
    <div className="history">
      {activity.map((a, i) => (
        <div key={i}>
          <a href={url(a.path)}>{a.name}</a>
          <span>
            {a.detail} · {new Date(a.at).toLocaleDateString('zh-CN')}
          </span>
        </div>
      ))}
    </div>
  );
}
