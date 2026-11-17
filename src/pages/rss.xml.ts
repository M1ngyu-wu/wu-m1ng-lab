import type { APIRoute } from 'astro';
import { getArticles } from '../lib/articles';
import { url } from '../lib/url';
const escape = (text: string) =>
  text.replace(
    /[<>&"']/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!,
  );
export const GET: APIRoute = async ({ site }) => {
  const articles = await getArticles();
  const origin = site || new URL('https://wu-m1ng.example.com');
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>wu_m1ng — Cyber Security Lab</title><link>${origin}</link><description>网络安全技术笔记与交互学习</description><language>zh-cn</language>${articles.map((a) => `<item><title>${escape(a.data.title)}</title><link>${new URL(url(`articles/${a.id}/`), origin)}</link><guid>${new URL(url(`articles/${a.id}/`), origin)}</guid><description>${escape(a.data.description)}</description><pubDate>${a.data.date.toUTCString()}</pubDate></item>`).join('')}</channel></rss>`,
    { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } },
  );
};
