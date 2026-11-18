import { categories, knowledge, type Knowledge } from '../data/knowledge';
import { questions } from '../data/questions';
import type { ArchiveDoc } from './archive';
import type { LabData, StudyDay } from './storage';

export interface CatalogNode extends Omit<Knowledge, 'category'> {
  category: string;
  aliases?: string[];
  sources?: { doc: string; version: number; line: number; sourceId: string }[];
}
export type GrowthArticle = { category: string; kind: string; date: string; example: boolean };
const baseIds = new Set(knowledge.map((node) => node.id));
export const latestVersion = (doc: ArchiveDoc) => doc.versions[doc.versions.length - 1];
export const archivePath = (id: string) => 'writeups/view/?id=' + encodeURIComponent(id);

export function catalogNodes(docs: ArchiveDoc[]): CatalogNode[] {
  const byId = new Map<string, CatalogNode>(knowledge.map((node) => [node.id, node]));
  for (const doc of docs) {
    for (const concept of latestVersion(doc).concepts) {
      const node = byId.get(concept.id) || {
        id: concept.id,
        name: concept.name,
        category: concept.category,
        description: '来自导入题解的知识点，可在关联题解中查看来源。',
        prerequisites: [],
      };
      const version = latestVersion(doc);
      byId.set(concept.id, {
        ...node,
        aliases: [...new Set([...(node.aliases || []), ...concept.aliases])],
        sources: [
          ...(node.sources || []),
          {
            doc: doc.id,
            version: version.version,
            line: concept.line,
            sourceId: version.source.id,
          },
        ],
      });
    }
  }
  return [...byId.values()];
}
export function studyHistory(data: LabData): StudyDay[] {
  const days = data.studyDays || [];
  const tracked = new Set(days.map((d) => d.concept));
  return [
    ...days,
    ...Object.entries(data.study).flatMap(([id, s]) =>
      !tracked.has(id) && s.updated
        ? [
            {
              concept: id,
              before: s.status,
              after: s.status,
              at: new Date(s.updated).toISOString(),
            },
          ]
        : [],
    ),
  ];
}
const quizById = new Map(questions.map((q) => [q.id, q]));
const nodeById = new Map(knowledge.map((k) => [k.id, k]));
const dayMs = 86400000;
export const percent = (n: number, total: number) =>
  total ? Math.round((100 * n) / total) + '%' : '—';
export function growthSummary(
  data: LabData,
  docs: ArchiveDoc[],
  articles: GrowthArticle[],
  now = new Date(),
) {
  const nodes = catalogNodes(docs);
  const latest = docs.map(latestVersion);
  const attempts = data.attempts.filter((a) => {
    const question = quizById.get(a.question);
    return question && question.type !== 'flashcard';
  });
  const rows = categories.map((c) => {
    const contents = articles.filter((a) => a.category === c.id && !a.example);
    const archived = latest.filter((v) => v.category === c.id).length;
    const concepts = nodes.filter((node) => node.category === c.id);
    const answers = attempts.filter(
      (a) => nodeById.get(quizById.get(a.question)!.knowledge)?.category === c.id,
    );
    return {
      id: c.id,
      name: c.name,
      writeups: archived + contents.filter((a) => a.kind === 'Writeup').length,
      articles: archived + contents.length,
      concepts: concepts.length,
      mastered: concepts.filter((n) => data.study[n.id]?.status === '已掌握').length,
      studying: concepts.filter((n) => data.study[n.id]?.status === '学习中').length,
      answers: answers.length,
      correct: answers.filter((a) => a.correct).length,
    };
  });
  const months = new Map<
    string,
    {
      month: string;
      writeups: number;
      concepts: number;
      study: number;
      answers: number;
      correct: number;
      masteryDelta: number;
    }
  >();
  function monthAt(at: string) {
    const month = new Date(at).toISOString().slice(0, 7);
    if (!months.has(month))
      months.set(month, {
        month,
        writeups: 0,
        concepts: 0,
        study: 0,
        answers: 0,
        correct: 0,
        masteryDelta: 0,
      });
    return months.get(month)!;
  }
  const firstSeen = new Map<string, string>();
  for (const doc of docs) {
    monthAt(doc.versions[0].createdAt).writeups++;
    for (const version of doc.versions)
      for (const c of version.concepts) {
        if (
          !baseIds.has(c.id) &&
          (!firstSeen.has(c.id) || Date.parse(version.createdAt) < Date.parse(firstSeen.get(c.id)!))
        )
          firstSeen.set(c.id, version.createdAt);
      }
  }
  articles
    .filter((a) => !a.example && a.kind === 'Writeup')
    .forEach((a) => monthAt(a.date).writeups++);
  firstSeen.forEach((date) => monthAt(date).concepts++);
  const history = studyHistory(data);
  for (const day of history) {
    const m = monthAt(day.at);
    m.study++;
    m.masteryDelta += Number(day.after === '已掌握') - Number(day.before === '已掌握');
  }
  for (const answer of attempts) {
    const m = monthAt(answer.at);
    m.answers++;
    if (answer.correct) m.correct++;
  }
  const activeDays = new Set(
    [...history, ...data.attempts]
      .map((r) => new Date(r.at).toISOString().slice(0, 10))
      .filter((day) => {
        const daysAgo = (Date.parse(now.toISOString().slice(0, 10)) - Date.parse(day)) / dayMs;
        return daysAgo >= 0 && daysAgo < 30;
      }),
  ).size;
  return {
    rows,
    months: [...months.values()].sort((a, b) => b.month.localeCompare(a.month)),
    activeDays,
    focus: nodes
      .filter((k) => data.study[k.id]?.status === '学习中')
      .sort((a, b) => Date.parse(data.study[b.id].updated) - Date.parse(data.study[a.id].updated)),
    needsReview: rows
      .filter((r) => r.answers > r.correct)
      .sort((a, b) => a.correct / a.answers - b.correct / b.answers),
    covered: nodes.filter((k) => data.study[k.id]?.status && data.study[k.id].status !== '未开始')
      .length,
    total: nodes.length,
    uncategorized: latest.filter((v) => !categories.some((c) => c.id === v.category)).length,
  };
}
