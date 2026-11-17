import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { unified } from '@astrojs/markdown-remark';
import { createReadStream, existsSync } from 'node:fs';
import { resolve, sep } from 'node:path';

const localSearch = {
  name: 'local-pagefind',
  hooks: {
    'astro:server:setup': ({ server }) => {
      server.middlewares.use((req, res, next) => {
        const prefix = `${(process.env.BASE_PATH || '/').replace(/\/$/, '')}/pagefind/`;
        if (!req.url?.startsWith(prefix)) return next();
        const root = resolve('dist/pagefind');
        let file;
        try {
          file = resolve(root, decodeURIComponent(req.url.slice(prefix.length).split('?')[0]));
        } catch {
          return next();
        }
        if (!file.startsWith(root + sep) || !existsSync(file)) return next();
        const type = file.endsWith('.js')
          ? 'text/javascript'
          : file.endsWith('.css')
            ? 'text/css'
            : file.endsWith('.wasm')
              ? 'application/wasm'
              : file.endsWith('.json')
                ? 'application/json'
                : 'application/octet-stream';
        res.setHeader('Content-Type', type);
        createReadStream(file).pipe(res);
      });
    },
  },
};

export default defineConfig({
  site: process.env.SITE_URL || 'https://wu-m1ng-lab-20261117.shashwu07.chatgpt.site',
  base: process.env.BASE_PATH || '/',
  integrations: [react(), mdx(), sitemap(), localSearch],
  vite: { plugins: [tailwindcss()] },
  markdown: {
    processor: unified({ remarkPlugins: [remarkMath], rehypePlugins: [rehypeKatex] }),
    shikiConfig: { themes: { light: 'github-light', dark: 'github-dark' } },
  },
});
