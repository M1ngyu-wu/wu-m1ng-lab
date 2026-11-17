import { getCollection } from 'astro:content';
export const getArticles = async () =>
  (await getCollection('articles')).sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
export const readingTime = (body = '') =>
  Math.max(
    1,
    Math.ceil(
      (body.match(/[\u4e00-\u9fff]/g)?.length || 0) / 350 +
        (body.match(/[A-Za-z0-9_]+/g)?.length || 0) / 200,
    ),
  );
export const dateLabel = (date: Date) => date.toISOString().slice(0, 10);
