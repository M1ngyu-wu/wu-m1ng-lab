import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';
import { categories, knowledge } from './data/knowledge';
const articles = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/articles' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    category: z.string().refine((id) => categories.some((c) => c.id === id), '未知分类'),
    tags: z.array(z.string()),
    difficulty: z.enum(['入门', '基础', '进阶']),
    prerequisites: z.array(z.string()),
    knowledge: z.array(z.string().refine((id) => knowledge.some((k) => k.id === id), '未知知识点')),
    kind: z.enum(['Note', 'Writeup']).default('Note'),
    example: z.boolean().default(true),
    cards: z
      .array(
        z.object({
          type: z.enum(['核心知识点', '漏洞原理', '关键指令', '利用思路', '常见错误', '重要结论']),
          content: z.string(),
        }),
      )
      .default([]),
  }),
});
export const collections = { articles };
