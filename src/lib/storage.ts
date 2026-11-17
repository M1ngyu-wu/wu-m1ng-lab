import { knowledge } from '../data/knowledge';
import { questions } from '../data/questions';
import { tools } from '../data/tools';
export type Status = '未开始' | '学习中' | '已掌握';
export interface Study {
  status: Status;
  minutes: number;
  updated: string;
  rating: number;
  notes: string;
}
export interface Attempt {
  question: string;
  correct: boolean;
  at: string;
  answer: string[];
}
export interface Review {
  mastered: boolean;
  due: string;
  streak: number;
}
export interface LabData {
  version: 1;
  study: Record<string, Study>;
  favorites: string[];
  attempts: Attempt[];
  reviews: Record<string, Review>;
}
export const STORAGE_KEY = 'wu_m1ng.lab.v1';
export const emptyData = (): LabData => ({
  version: 1,
  study: {},
  favorites: [],
  attempts: [],
  reviews: {},
});
export const blankStudy = (): Study => ({
  status: '未开始',
  minutes: 0,
  updated: '',
  rating: 0,
  notes: '',
});
const object = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const validDate = (v: unknown) =>
  typeof v === 'string' && v.length < 40 && !Number.isNaN(Date.parse(v));
const integer = (v: unknown, max: number) =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max;
export function validateData(input: unknown): LabData {
  if (
    !object(input) ||
    input.version !== 1 ||
    !object(input.study) ||
    !object(input.reviews) ||
    !Array.isArray(input.favorites) ||
    !Array.isArray(input.attempts)
  )
    throw new Error('备份格式不正确或版本不受支持。');
  if (input.attempts.length > 10000 || input.favorites.length > tools.length)
    throw new Error('备份条目过多。');
  const result = emptyData();
  for (const [id, s] of Object.entries(input.study)) {
    if (
      !knowledge.some((k) => k.id === id) ||
      !object(s) ||
      !['未开始', '学习中', '已掌握'].includes(String(s.status)) ||
      !integer(s.minutes, 1000000) ||
      !integer(s.rating, 5) ||
      typeof s.notes !== 'string' ||
      s.notes.length > 20000 ||
      !(s.updated === '' || validDate(s.updated))
    )
      throw new Error(`学习记录无效：${id}`);
    result.study[id] = {
      status: s.status as Status,
      minutes: s.minutes as number,
      rating: s.rating as number,
      notes: s.notes,
      updated: s.updated as string,
    };
  }
  for (const id of input.favorites) {
    if (typeof id !== 'string' || !tools.some((t) => t.id === id))
      throw new Error('收藏命令 ID 无效。');
    if (!result.favorites.includes(id)) result.favorites.push(id);
  }
  for (const a of input.attempts) {
    if (
      !object(a) ||
      !questions.some((q) => q.id === a.question) ||
      typeof a.correct !== 'boolean' ||
      !validDate(a.at) ||
      !Array.isArray(a.answer) ||
      a.answer.length > 20 ||
      !a.answer.every((x) => typeof x === 'string' && x.length <= 2000)
    )
      throw new Error('答题记录无效。');
    result.attempts.push({
      question: a.question as string,
      correct: a.correct,
      at: a.at as string,
      answer: a.answer as string[],
    });
  }
  for (const [id, r] of Object.entries(input.reviews)) {
    if (
      !questions.some((q) => q.id === id) ||
      !object(r) ||
      typeof r.mastered !== 'boolean' ||
      !validDate(r.due) ||
      !integer(r.streak, 365)
    )
      throw new Error(`复习记录无效：${id}`);
    result.reviews[id] = { mastered: r.mastered, due: r.due as string, streak: r.streak as number };
  }
  return result;
}
export function readData(): { data: LabData; error: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return { data: raw ? validateData(JSON.parse(raw)) : emptyData(), error: '' };
  } catch {
    return {
      data: emptyData(),
      error: '无法读取本地记录。原始内容已保留，请先导出原始备份或检查浏览器存储权限。',
    };
  }
}
export function saveData(data: LabData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(validateData(data)));
    window.dispatchEvent(new Event('lab-data'));
  } catch {
    throw new Error('保存失败，当前修改未写入。请检查浏览器存储空间或权限。');
  }
}
export const normalize = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[\s。.!！]/g, '');
export function grade(answers: string[], expected: string[], multiple = false) {
  if (multiple)
    return answers.length === expected.length && expected.every((e) => answers.includes(e));
  return answers.length === 1 && expected.some((e) => normalize(e) === normalize(answers[0]));
}
export function recordAnswer(
  data: LabData,
  id: string,
  correct: boolean,
  answer: string[],
  now = new Date(),
): LabData {
  const prev = data.reviews[id];
  const streak = correct ? Math.min(365, (prev?.streak || 0) + 1) : 0;
  const days = correct ? [1, 3, 7, 14, 30][Math.min(streak - 1, 4)] : 0;
  const due = new Date(now.getTime() + (correct ? days * 86400000 : 600000));
  return {
    ...data,
    attempts: [...data.attempts, { question: id, correct, answer, at: now.toISOString() }].slice(
      -10000,
    ),
    reviews: {
      ...data.reviews,
      [id]: { mastered: correct && (prev?.mastered || false), due: due.toISOString(), streak },
    },
  };
}
