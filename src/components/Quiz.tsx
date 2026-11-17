import { useState } from 'react';
import { questions } from '../data/questions';
import { knowledge } from '../data/knowledge';
import { grade, recordAnswer } from '../lib/storage';
import { useLab } from './useLab';
import { url } from '../lib/url';
const typeNames = {
  single: '单选题',
  multiple: '多选题',
  boolean: '判断题',
  short: '简答题',
  flashcard: '闪卡',
};
export default function Quiz({ knowledgeIds }: { knowledgeIds?: string[] }) {
  const { data, update, error } = useLab();
  const [filter, setFilter] = useState('全部'),
    [mode, setMode] = useState('all'),
    [index, setIndex] = useState(0),
    [answer, setAnswer] = useState<string[]>([]),
    [submitted, setSubmitted] = useState(false),
    [correct, setCorrect] = useState(false),
    [revealed, setRevealed] = useState(false);
  const pool = questions.filter(
    (q) =>
      (!knowledgeIds || knowledgeIds.includes(q.knowledge)) &&
      (filter === '全部' || filter === q.knowledge),
  );
  const wrongIds = new Set(
    data.attempts
      .filter((a) => !a.correct && !data.reviews[a.question]?.mastered)
      .map((a) => a.question),
  );
  const [sessionIds, setSessionIds] = useState<string[] | null>(null);
  const list = mode === 'all' ? pool : pool.filter((q) => sessionIds?.includes(q.id));
  const q = list[Math.min(index, Math.max(0, list.length - 1))];
  const reset = () => {
    setAnswer([]);
    setSubmitted(false);
    setRevealed(false);
  };
  const selectMode = (m: string) => {
    setMode(m);
    setSessionIds(
      m === 'wrong'
        ? [...wrongIds]
        : m === 'due'
          ? questions
              .filter(
                (q) =>
                  data.reviews[q.id] &&
                  !data.reviews[q.id].mastered &&
                  Date.parse(data.reviews[q.id].due) <= Date.now(),
              )
              .map((q) => q.id)
          : null,
    );
    setIndex(0);
    reset();
  };
  const submit = (result?: boolean) => {
    if (!q) return;
    const pass = result ?? grade(answer, q.answers, q.type === 'multiple');
    if (
      update(
        recordAnswer(
          data,
          q.id,
          pass,
          q.type === 'flashcard' ? [pass ? '自评：记得' : '自评：忘记'] : answer,
        ),
      )
    ) {
      setCorrect(pass);
      setSubmitted(true);
    }
  };
  const review = q ? data.reviews[q.id] : null;
  const attempts = data.attempts.filter(
    (a) =>
      !knowledgeIds ||
      questions.some((q) => q.id === a.question && knowledgeIds.includes(q.knowledge)),
  );
  return (
    <>
      {error && (
        <div className="callout error" role="alert">
          {error}
        </div>
      )}
      <div className="metric-grid">
        <div>
          <strong>{attempts.length}</strong>
          <span>累计答题</span>
        </div>
        <div>
          <strong>
            {attempts.length
              ? Math.round((attempts.filter((a) => a.correct).length / attempts.length) * 100)
              : 0}
            %
          </strong>
          <span>正确率（含闪卡自评）</span>
        </div>
        <div>
          <strong>{[...wrongIds].filter((id) => pool.some((q) => q.id === id)).length}</strong>
          <span>待复盘错题</span>
        </div>
        <div>
          <strong>{pool.filter((q) => data.reviews[q.id]?.mastered).length}</strong>
          <span>已掌握题目</span>
        </div>
      </div>
      <div className="toolbar">
        <select
          aria-label="自测知识点筛选"
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setIndex(0);
            reset();
          }}
        >
          <option>全部</option>
          {knowledge
            .filter(
              (k) =>
                pool.some((q) => q.knowledge === k.id) ||
                questions.some(
                  (q) => q.knowledge === k.id && (!knowledgeIds || knowledgeIds.includes(k.id)),
                ),
            )
            .map((k) => (
              <option value={k.id} key={k.id}>
                {k.name}
              </option>
            ))}
        </select>
        {[
          ['all', '全部题目'],
          ['wrong', '错题复盘'],
          ['due', '到期复习'],
        ].map(([id, label]) => (
          <button
            key={id}
            className="filter-chip"
            aria-pressed={mode === id}
            onClick={() => selectMode(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="notice">
        示例题库 · 简答题按给定答案匹配，提交后请结合解析复核；闪卡采用主动回忆与自评。
      </p>
      {!q ? (
        <div className="empty">当前筛选没有题目。可以切换到全部题目开始学习。</div>
      ) : (
        <>
          <div className="question-nav" aria-label="选择题目">
            {list.map((item, i) => (
              <button
                key={item.id}
                className={item.id === q.id ? 'active' : ''}
                onClick={() => {
                  setIndex(i);
                  reset();
                }}
                aria-label={`第 ${i + 1} 题`}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <section className="panel question-card">
            <span className="eyebrow">
              {typeNames[q.type]} / {Math.min(index + 1, list.length)} OF {list.length} / 示例
            </span>
            <h3>{q.prompt}</h3>
            {q.type === 'short' ? (
              <label className="field" style={{ marginTop: 20 }}>
                输入你的答案
                <input
                  aria-label="简答题答案"
                  disabled={submitted}
                  maxLength={2000}
                  value={answer[0] || ''}
                  onChange={(e) => setAnswer([e.target.value])}
                />
              </label>
            ) : q.type === 'flashcard' ? (
              <div className="callout">
                先在心中回忆答案，再翻开卡片。
                {revealed && <p className="accent">{q.answers.join('、')}</p>}
              </div>
            ) : (
              <div className="quiz-options">
                {q.options?.map((option) => (
                  <label key={option}>
                    <input
                      type={q.type === 'multiple' ? 'checkbox' : 'radio'}
                      name={q.id}
                      disabled={submitted}
                      checked={answer.includes(option)}
                      onChange={() =>
                        setAnswer(
                          q.type === 'multiple'
                            ? answer.includes(option)
                              ? answer.filter((a) => a !== option)
                              : [...answer, option]
                            : [option],
                        )
                      }
                    />
                    {option}
                  </label>
                ))}
              </div>
            )}
            <div className="toolbar">
              {q.type === 'flashcard' ? (
                !revealed ? (
                  <button className="button primary" onClick={() => setRevealed(true)}>
                    翻开答案
                  </button>
                ) : (
                  !submitted && (
                    <>
                      <button className="button primary" onClick={() => submit(true)}>
                        记得
                      </button>
                      <button className="button secondary" onClick={() => submit(false)}>
                        忘记了
                      </button>
                    </>
                  )
                )
              ) : (
                <button
                  className="button primary"
                  disabled={submitted || !answer.length || !answer[0]?.trim()}
                  onClick={() => submit()}
                >
                  提交答案
                </button>
              )}
              {submitted && (
                <button className="button secondary" onClick={reset}>
                  重新作答
                </button>
              )}
              <button
                className="button secondary"
                disabled={index >= list.length - 1}
                onClick={() => {
                  setIndex((i) => i + 1);
                  reset();
                }}
              >
                下一题 →
              </button>
            </div>
            {submitted && (
              <div className="feedback" role="status">
                <h4>{correct ? '回答正确，继续连接知识。' : '记下这次疑问，再理解一次。'}</h4>
                <p>参考答案：{q.answers.join('；')}</p>
                <p>{q.explanation}</p>
                <p>易错原因：{q.pitfall}</p>
                <div className="link-list">
                  <a href={url(`knowledge/${q.knowledge}/`)}>
                    关联知识：{knowledge.find((k) => k.id === q.knowledge)?.name} →
                  </a>
                  <a href={url(`articles/${q.article}/`)}>回到关联文章 →</a>
                </div>
              </div>
            )}
            {review && (
              <div style={{ marginTop: 20 }}>
                <div className="toolbar">
                  <button
                    className="filter-chip"
                    aria-pressed={review.mastered}
                    onClick={() =>
                      update({
                        ...data,
                        reviews: {
                          ...data.reviews,
                          [q.id]: { ...review, mastered: !review.mastered },
                        },
                      })
                    }
                  >
                    {review.mastered ? '✓ 已掌握' : '标记已掌握'}
                  </button>
                  <label className="small muted">
                    下次复习{' '}
                    <input
                      aria-label="下次复习日期"
                      type="date"
                      value={review.due.slice(0, 10)}
                      onChange={(e) => {
                        if (e.target.value)
                          update({
                            ...data,
                            reviews: {
                              ...data.reviews,
                              [q.id]: {
                                ...review,
                                due: new Date(e.target.value + 'T09:00:00').toISOString(),
                              },
                            },
                          });
                      }}
                    />
                  </label>
                </div>
                <p className="notice">
                  连续正确后间隔：1 / 3 / 7 / 14 / 30 天；答错 10 分钟后复习，可手动调整。
                </p>
              </div>
            )}
          </section>
        </>
      )}
      <section className="panel" style={{ marginTop: 24 }}>
        <h3>最近复习记录</h3>
        <div className="history">
          {attempts
            .slice(-8)
            .reverse()
            .map((a, i) => (
              <div key={i}>
                <a
                  href={url(`knowledge/${questions.find((q) => q.id === a.question)?.knowledge}/`)}
                >
                  {questions.find((q) => q.id === a.question)?.prompt}
                </a>
                <span>
                  {a.correct ? '✓' : '✕'} {new Date(a.at).toLocaleDateString('zh-CN')}
                </span>
              </div>
            ))}
        </div>
        {!attempts.length && (
          <p className="muted small">暂无答题记录。完成第一道题后，这里会显示真实记录。</p>
        )}
      </section>
    </>
  );
}
