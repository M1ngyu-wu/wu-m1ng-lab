import { knowledge, categories } from '../data/knowledge';
import { tools as toolCatalog } from '../data/tools';

export interface ArchiveConcept {
  id: string;
  name: string;
  category: string;
  aliases: string[];
  line: number;
  matched: string;
}
export interface ArchiveSource {
  id: string;
  filename: string;
  format: string;
  sha256: string;
  uploadedAt: string;
  bodyStart: number;
  generatedPrefix?: number;
  sections: { title: string; start: number; end: number; excerpt: string }[];
}
export interface ArchiveVersion {
  version: number;
  createdAt: string;
  title: string;
  contest: string;
  category: string;
  difficulty: string;
  summary: string;
  markdown: string;
  concepts: ArchiveConcept[];
  tools: string[];
  source: ArchiveSource;
  identity?: string;
  restoredFrom?: number;
  commit?: string;
}
export interface ArchiveDoc {
  id: string;
  versions: ArchiveVersion[];
}
export const unknown = '未知';
export const currentVersion = (doc: ArchiveDoc) => doc.versions[doc.versions.length - 1];
const normalize = (name: string) =>
  name.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
export async function sha256(value: ArrayBuffer | string) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
function findMetadata(lines: string[], names: string[]) {
  const pattern = new RegExp(
    '^\\s*(?:[-*]\\s+)?(?:\\*\\*)?(?:' + names.join('|') + ')(?:\\*\\*)?\\s*[:：]\\s*(.+?)\\s*$',
    'i',
  );
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(pattern);
    if (match) return { value: match[1].replace(/^["']|["']$/g, '').trim(), line: i + 1 };
  }
  return { value: '', line: 0 };
}
const aliases: Record<string, string[]> = {
  linux: ['Linux 基础'],
  http: ['HTTP', 'HTTPS'],
  modular: ['modular arithmetic', '模运算'],
  forensics: ['文件取证', 'file forensics', '数字取证'],
  contracts: ['智能合约', 'smart contract'],
  disassembly: ['反汇编', 'disassembly'],
  gdb: ['GDB'],
  assembly: ['x86-64 汇编'],
  'stack-frame': ['stack frame', '栈帧'],
  xss: ['跨站脚本', 'XSS'],
  sqli: ['SQL 注入', 'SQL injection'],
};
const namedConcepts = knowledge.filter((node) => aliases[node.id]);
function isMention(line: string, alias: string) {
  const literal = alias.replace(/[.*+?^$(){}|[\]\\]/g, '\\$&');
  const left = /^[a-z0-9]/i.test(alias) ? '(?<![a-z0-9_])' : '';
  const right = /[a-z0-9]$/i.test(alias) ? '(?![a-z0-9_])' : '';
  return new RegExp(left + literal + right, 'i').exec(line)?.[0];
}
export const archiveLimits = { bytes: 5 * 1024 * 1024, chars: 512 * 1024, lines: 10000 };
export function checkText(input: string) {
  if (input.length > archiveLimits.chars || input.split('\n').length > archiveLimits.lines)
    throw new Error('提取内容超过 512K 字符或 10,000 行，请拆分文件。');
  if (/[\u0000-\u0008\u000e-\u001a]/.test(input))
    throw new Error('检测到二进制内容，请使用 UTF-8 文本、PDF 或 DOCX。');
  if (!input.trim()) throw new Error('未找到可读取的正文。');
}
function markupInfo(lines: string[]) {
  const headings: { index: number; title: string }[] = [];
  const prose: string[] = [];
  let fence = '';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (fence) {
      if (new RegExp('^ {0,3}' + fence[0] + '{' + fence.length + ',}\\s*$').test(line)) fence = '';
      prose.push('');
      continue;
    }
    const marker = line.match(/^ {0,3}(\x60{3,}|~{3,})/);
    if (marker) {
      fence = marker[1];
      prose.push('');
      continue;
    }
    const heading = line.match(/^ {0,3}#{1,6}\s+(.+?)\s*#*$/);
    if (heading) headings.push({ index: i, title: heading[1] });
    prose.push(line);
  }
  return { headings, prose };
}
export async function parseArchive(
  input: string,
  filename: string,
  fileHash: string,
  now = new Date().toISOString(),
): Promise<ArchiveVersion> {
  checkText(input);
  const lines = input
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .split('\n');
  const metadataEnd =
    lines[0]?.trim() === '---' ? lines.findIndex((line, i) => i > 0 && /^---\s*$/.test(line)) : -1;
  const start = metadataEnd >= 0 ? metadataEnd + 1 : 0;
  const body = lines.slice(start);
  const { headings, prose } = markupInfo(body);
  const meta = [...lines.slice(0, start), ...prose];
  const field = (...keys: string[]) => findMetadata(meta, keys).value;
  const markdown = body.join('\n');
  checkText(markdown);
  const contest = field('contest', 'event', 'competition', '比赛', '赛事', '比赛名称');
  const titleField = field('title', 'challenge', '题目', '题目名称', '标题');
  const title = (
    titleField ||
    headings[0]?.title ||
    (filename === '粘贴文本.txt' ? prose.find(Boolean) : '') ||
    filename.replace(/\.[^.]+$/, '') ||
    '未命名题解'
  ).slice(0, 200);
  const declaredCategory = normalize(field('category', 'direction', '方向', '技术方向', '分类'));
  const categoryFromMeta = categories.find(
    (c) => c.id === declaredCategory || normalize(c.name) === declaredCategory,
  )?.id;
  const rawTags = findMetadata(meta, ['concepts', 'tags', '知识点', '核心知识点', '标签']);
  const concepts: ArchiveConcept[] = [];
  for (const node of namedConcepts) {
    const spellings = [node.name, ...aliases[node.id]];
    let line = 0;
    const seen = new Set<string>();
    for (let i = 0; i < meta.length; i++)
      for (const alias of spellings) {
        const spelling = isMention(meta[i], alias);
        if (spelling) {
          if (!line) line = i + 1;
          seen.add(spelling);
        }
      }
    if (line)
      concepts.push({
        id: node.id,
        name: node.name,
        category: node.category,
        aliases: [...seen],
        matched: [...seen][0],
        line,
      });
  }
  const directions = new Set(concepts.map((c) => c.category));
  const category =
    categoryFromMeta ||
    (!declaredCategory && directions.size === 1 ? [...directions][0] : 'unknown');
  for (let label of rawTags.value
    .replace(/^\[|\]$/g, '')
    .split(/[,，、;]/)
    .slice(0, 40)) {
    label = label
      .trim()
      .replace(/^["']|["']$/g, '')
      .trim();
    if (!label || label.length > 64 || /[<>]/.test(label)) continue;
    if (concepts.some((c) => [c.name, ...c.aliases].some((a) => normalize(a) === normalize(label))))
      continue;
    const same = knowledge.find(
      (k) =>
        normalize(k.name) === normalize(label) &&
        (category === 'unknown' || category === k.category),
    );
    const id =
      same?.id || 'concept-' + (await sha256(category + '\n' + normalize(label))).slice(0, 24);
    if (!concepts.some((c) => c.id === id))
      concepts.push({
        id,
        name: same?.name || label,
        category: same?.category || category,
        aliases: [label],
        matched: label,
        line: rawTags.line,
      });
  }
  const levels: Record<string, string> = {
    easy: 'Easy',
    medium: 'Medium',
    hard: 'Hard',
    expert: 'Expert',
    简单: 'Easy',
    中等: 'Medium',
    困难: 'Hard',
    专家: 'Expert',
  };
  const difficulty = levels[normalize(field('difficulty', 'level', '难度'))] || unknown;
  const summary = (
    field('summary', 'description', '摘要', '简介') ||
    prose.find(
      (line) => line.trim() && !/^\s*(?:#|>|[|!*])|^\s*[\w\u4e00-\u9fff ]{1,15}[:：]/.test(line),
    ) ||
    ''
  )
    .trim()
    .slice(0, 240);
  const blocks = [...headings];
  if (!blocks.length || blocks[0].index !== 0) blocks.unshift({ index: 0, title: '正文' });
  const sections = blocks.map((h, i) => ({
    title: h.title,
    start: start + h.index + 1,
    end: start + (blocks[i + 1]?.index ?? body.length),
    excerpt:
      body
        .slice(h.index, blocks[i + 1]?.index ?? body.length)
        .find((l) => l.trim() && !l.trim().startsWith('#'))
        ?.slice(0, 120) || h.title.slice(0, 120),
  }));
  const taggedTools = toolCatalog
    .filter((t) => !t.dangerous && body.some((l) => l.includes(t.name) || l.trim() === t.command))
    .map((t) => t.id);
  const prefix = /^\s*#\s+/.test(markdown) ? '' : '# ' + title.replace(/[\r\n]/g, ' ') + '\n\n';
  const explicitId = field('challenge_id', 'writeup_id', '题目ID');
  return {
    version: 1,
    createdAt: now,
    title,
    contest: contest || unknown,
    category,
    difficulty,
    summary,
    markdown: prefix + markdown,
    concepts,
    tools: taggedTools,
    ...(explicitId ? { identity: normalize(contest) + '/' + normalize(explicitId) } : {}),
    source: {
      id: 'src-' + fileHash,
      filename: filename.split(/[\\/]/).pop()!.slice(-180),
      format: filename.split('.').pop()!.toLowerCase(),
      sha256: fileHash,
      uploadedAt: now,
      bodyStart: start + 1,
      generatedPrefix: prefix ? 2 : 0,
      sections,
    },
  };
}
function similarity(a: string, b: string) {
  const tokens = (s: string) => new Set(s.toLowerCase().match(/[\u4e00-\u9fff]|[\w-]+/g) || []);
  const left = tokens(a),
    right = tokens(b);
  let hits = 0;
  for (const token of left) if (right.has(token)) hits++;
  return hits / (left.size + right.size - hits || 1);
}
export function attachVersion(
  docs: ArchiveDoc[],
  v: ArchiveVersion,
): { doc: ArchiveDoc; status: '新增' | '新版本' | '重复' } {
  const duplicate = docs.find((doc) =>
    doc.versions.some((old) => old.source.sha256 === v.source.sha256),
  );
  if (duplicate) return { doc: duplicate, status: '重复' };
  const candidates = docs.filter((doc) => {
    const old = currentVersion(doc);
    if (old.identity || v.identity) return Boolean(v.identity && old.identity === v.identity);
    if (
      normalize(v.title) !== normalize(old.title) ||
      normalize(v.contest) !== normalize(old.contest)
    )
      return false;
    if (v.category !== 'unknown' && old.category !== 'unknown' && v.category !== old.category)
      return false;
    return (
      v.contest !== unknown ||
      (v.source.filename !== '粘贴文本.txt' &&
        old.source.filename === v.source.filename &&
        similarity(old.markdown, v.markdown) >= 0.8)
    );
  });
  if (candidates.length === 1) {
    const doc = candidates[0];
    return {
      doc: {
        ...doc,
        versions: [...doc.versions, { ...v, version: currentVersion(doc).version + 1 }],
      },
      status: '新版本',
    };
  }
  return { doc: { id: 'wu-' + v.source.sha256.slice(0, 24), versions: [v] }, status: '新增' };
}
export function restoreVersion(doc: ArchiveDoc, n: number): ArchiveDoc {
  const version = doc.versions.find((v) => v.version === n);
  if (!version || n === currentVersion(doc).version) throw new Error('请选择一个已有的历史版本。');
  const { commit: _oldCommit, ...snapshot } = version;
  return {
    ...doc,
    versions: [
      ...doc.versions,
      {
        ...snapshot,
        version: currentVersion(doc).version + 1,
        createdAt: new Date().toISOString(),
        restoredFrom: n,
      },
    ],
  };
}
