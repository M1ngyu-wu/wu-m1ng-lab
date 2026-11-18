import { useMemo, useState, type ReactNode } from 'react';
import { fromMarkdown } from 'mdast-util-from-markdown';
import type { RootContent, PhrasingContent } from 'mdast';
type Node = RootContent | PhrasingContent;
function external(href: string) {
  try {
    const u = new URL(href);
    return u.protocol === 'https:' ? u.href : undefined;
  } catch {
    return undefined;
  }
}
function Picture({ href, alt }: { href: string; alt: string }) {
  const [show, setShow] = useState(false);
  const src = external(href);
  return src ? (
    show ? (
      <img src={src} referrerPolicy="no-referrer" loading="lazy" alt={alt} />
    ) : (
      <button onClick={() => setShow(true)}>加载外部图片 · {alt || new URL(src).hostname}</button>
    )
  ) : (
    <span>图片附件 · {alt || href}</span>
  );
}
function Code({ value, lang }: { value: string; lang?: string | null }) {
  const [copied, setCopied] = useState('');
  const simpleFlow = lang === 'mermaid' && /^\s*(graph|flowchart)\s+(TD|LR|TB)\b/.test(value);
  const edges = simpleFlow
    ? value
        .split(/\n|;/)
        .slice(1, 81)
        .map((l) =>
          l
            .trim()
            .match(
              /^([\w\u4e00-\u9fff]+)(?:\[([^\]]{1,80})\])?\s*-->\s*([\w\u4e00-\u9fff]+)(?:\[([^\]]{1,80})\])?$/,
            ),
        )
        .filter(Boolean)
    : [];
  return (
    <>
      {edges.length > 0 && (
        <figure aria-label="流程图">
          {edges.map((e, i) => (
            <div key={i}>
              {e![2] || e![1]} → {e![4] || e![3]}
            </div>
          ))}
        </figure>
      )}
      <div className="code-caption">
        {lang || 'text'}{' '}
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied('已复制');
            } catch {
              setCopied('请手动复制');
            }
          }}
        >
          {copied || '复制代码'}
        </button>
      </div>
      <pre>
        <code>
          {value
            .split(
              /("(?:[^"\\]|\\.)*"|'[^'\n]*'|\b(?:0x[\da-fA-F]+|\d+|import|return|const|def|SELECT|FROM)\b)/g,
            )
            .map((part, i) =>
              i % 2 ? (
                <span key={i} className="accent">
                  {part}
                </span>
              ) : (
                part
              ),
            )}
        </code>
      </pre>
    </>
  );
}
export default function ArchiveMarkdown({
  value,
  offset,
  filename,
}: {
  value: string;
  offset: number;
  filename: string;
}) {
  const tree = useMemo(() => fromMarkdown(value), [value]);
  const claimed = new Set<number>();
  function render(n: Node, key: number): ReactNode {
    const line = n.position?.start.line || 0;
    const id = line && !claimed.has(line) ? 'line-' + line : undefined;
    if (line) claimed.add(line);
    const children = 'children' in n ? n.children.map(render) : undefined;
    let piece: ReactNode;
    switch (n.type) {
      case 'text':
        piece = n.value.split('\n').map((part, i) => {
          const anchor = line + i;
          const mark = i > 0 && !claimed.has(anchor);
          if (mark) claimed.add(anchor);
          return (
            <span id={mark ? 'line-' + anchor : undefined} key={i}>
              {i ? '\n' : ''}
              {part}
            </span>
          );
        });
        break;
      case 'html':
        piece = n.value;
        break;
      case 'heading':
        piece = n.depth < 3 ? <h2>{children}</h2> : <h3>{children}</h3>;
        break;
      case 'paragraph':
        piece = <p>{children}</p>;
        break;
      case 'code':
        piece = (
          <>
            <Code value={n.value} lang={n.lang} />
            <details>
              <summary>代码来源</summary>
              <p>
                {filename} · 原文第 {line + offset}–{(n.position?.end.line || line) + offset} 行
              </p>
              <pre>{n.value}</pre>
            </details>
          </>
        );
        break;
      case 'inlineCode':
        piece = <code>{n.value}</code>;
        break;
      case 'link':
        piece = external(n.url) ? (
          <a href={external(n.url)} rel="noreferrer">
            {children}
          </a>
        ) : (
          children
        );
        break;
      case 'image':
        piece = <Picture href={n.url} alt={n.alt || ''} />;
        break;
      case 'strong':
        piece = <strong>{children}</strong>;
        break;
      case 'emphasis':
        piece = <em>{children}</em>;
        break;
      case 'list':
        return n.ordered ? (
          <ol id={id} key={key}>
            {children}
          </ol>
        ) : (
          <ul id={id} key={key}>
            {children}
          </ul>
        );
      case 'listItem':
        return (
          <li key={key} id={id}>
            {children}
          </li>
        );
      case 'blockquote':
        piece = <blockquote>{children}</blockquote>;
        break;
      case 'break':
        piece = <br />;
        break;
      case 'thematicBreak':
        piece = <hr />;
        break;
      default:
        piece = children;
    }
    return [
      'text',
      'html',
      'inlineCode',
      'link',
      'image',
      'strong',
      'emphasis',
      'break',
      'linkReference',
    ].includes(n.type) ? (
      <span id={id} key={key}>
        {piece}
      </span>
    ) : (
      <div id={id} key={key}>
        {piece}
      </div>
    );
  }
  return <div className="prose">{tree.children.map(render)}</div>;
}
