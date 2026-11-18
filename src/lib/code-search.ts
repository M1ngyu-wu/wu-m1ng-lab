import { fromMarkdown } from 'mdast-util-from-markdown';
import type { RootContent, PhrasingContent } from 'mdast';

export interface Snippet {
  title: string;
  path: string;
  category: string;
  section: string;
  language: string;
  source: string;
  line: number;
  anchor: string;
}

export function indexMarkdown(
  markdown: string,
  document: Pick<Snippet, 'title' | 'path' | 'category'>,
  imported = false,
): Snippet[] {
  const result: Snippet[] = [];
  let section = document.title;
  let ordinal = 0;
  function visit(node: RootContent | PhrasingContent) {
    if (node.type === 'heading') {
      section = node.children.map((n) => ('value' in n ? n.value : '')).join('') || section;
    }
    if (node.type === 'code' || node.type === 'inlineCode') {
      const line = node.position?.start.line || 1;
      ordinal++;
      if (node.type === 'code' && node.lang === 'mermaid') return;
      result.push({
        ...document,
        section,
        language: node.type === 'code' ? node.lang || 'text' : 'inline',
        line,
        source: node.value,
        anchor: imported ? 'line-' + line : 'snippet-' + ordinal,
      });
      return;
    }
    if ('children' in node) node.children.forEach(visit);
  }
  fromMarkdown(markdown).children.forEach(visit);
  return result;
}

export function matchSnippets(
  index: Snippet[],
  query: string,
  options: { exact: boolean; sensitive: boolean; category: string; language: string },
) {
  if (!query.trim()) return [];
  const fold = (s: string) => (options.sensitive ? s : s.toLowerCase());
  const words = options.exact ? [fold(query)] : fold(query.trim()).split(/\s+/);
  return index.flatMap((entry) => {
    if (
      (options.category && entry.category !== options.category) ||
      (options.language && entry.language !== options.language)
    )
      return [];
    const code = fold(entry.source);
    if (!words.every((word) => code.includes(word))) return [];
    const at = code.indexOf(words[0]);
    const firstLine = code.slice(0, at).split('\n').length - 1;
    const lines = entry.source.split('\n');
    const from = Math.max(0, firstLine - 1);
    const to = Math.min(lines.length, firstLine + words[0].split('\n').length + 1);
    return [{ ...entry, excerpt: lines.slice(from, to).join('\n'), matchLine: firstLine + 1 }];
  });
}
