import { useRef, useState } from 'react';
import { parseFile } from '../lib/archive-files';
import { saveImport } from '../lib/archive-store';
import { url } from '../lib/url';
import { useCatalog } from './useCatalog';
import ArchivePublish from './ArchivePublish';
type Item = { file: File; state: string; error?: string; id?: string };
export default function ArchiveImport() {
  const [items, setItems] = useState<Item[]>([]),
    [text, setText] = useState(''),
    [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const { docs, catalogError } = useCatalog();
  async function process(files: File[], retry = false) {
    if (lock.current || !files.length) return;
    lock.current = true;
    setBusy(true);
    const queue = retry
      ? items.map((it) => (it.error ? { file: it.file, state: '等待解析' } : it))
      : [...items, ...files.map((file) => ({ file, state: '等待解析' }) as Item)];
    const update = (i: number, it: Item) => {
      queue[i] = it;
      setItems([...queue]);
    };
    setItems([...queue]);
    try {
      for (let i = 0; i < queue.length; i++) {
        const { file, state } = queue[i];
        if (state !== '等待解析') continue;
        update(i, { file, state: '解析中' });
        try {
          const parsed = await parseFile(file);
          const { doc, status } = await saveImport(parsed, file);
          update(i, { file, state: status, id: doc.id });
        } catch (e) {
          update(i, {
            file,
            state: '失败',
            error: e instanceof Error ? e.message : '文件无法处理。',
          });
        }
      }
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <div
        className="panel archive-panel"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void process([...e.dataTransfer.files]);
        }}
      >
        <label className="file-drop">
          选择或拖入多个题解文件
          <input
            aria-label="选择题解文件"
            type="file"
            multiple
            disabled={busy}
            accept=".md,.txt,.docx,.pdf"
            onChange={(e) => {
              void process(Array.from(e.target.files || []));
              e.target.value = '';
            }}
          />
        </label>
        <p className="small muted">
          Markdown、UTF-8 TXT、DOCX 或文字版 PDF，每个文件最多 5 MiB。扫描件需先 OCR。
        </p>
        <label className="field">
          粘贴题解原文
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="# 题目名称"
          />
        </label>
        <button
          className="button secondary"
          disabled={busy || !text.trim()}
          onClick={() => {
            void process([new File([text], '粘贴文本.txt', { type: 'text/plain' })]);
            setText('');
          }}
        >
          导入粘贴文本
        </button>
      </div>
      {items.length > 0 && (
        <section className="panel archive-panel" aria-live="polite">
          <h2>导入队列</h2>
          <p>
            完成 {items.filter((i) => i.id).length} / {items.length} · 失败{' '}
            {items.filter((i) => i.error).length}
          </p>
          {items.map((it, i) => (
            <div className="notebook-row" key={i}>
              <b>{it.file.name}</b>
              <span>
                {it.state} {it.error}
              </span>
              {it.id && (
                <a className="text-link" href={url('writeups/view/?id=' + it.id)}>
                  查看题解
                </a>
              )}
            </div>
          ))}
          {items.some((i) => i.error) && (
            <button
              disabled={busy}
              onClick={() =>
                process(
                  items.filter((i) => i.error).map((i) => i.file),
                  true,
                )
              }
            >
              重试失败文件
            </button>
          )}
        </section>
      )}
      {catalogError && <p role="alert">{catalogError}</p>}
      <ArchivePublish docs={docs} />
    </>
  );
}
