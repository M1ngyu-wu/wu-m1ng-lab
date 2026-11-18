import { archiveLimits, checkText, parseArchive, sha256 } from './archive';

async function readDocx(bytes: Uint8Array) {
  const { unzipSync, strFromU8 } = await import('fflate');
  const files = unzipSync(bytes, {
    filter: (entry) => {
      if (entry.name !== 'word/document.xml') return false;
      if (entry.originalSize > 4 * 1024 * 1024) throw Error('DOCX 展开后过大。');
      return true;
    },
  });
  const xml = files['word/document.xml'];
  if (!xml) throw Error('DOCX 缺少正文。');
  const body = strFromU8(xml);
  if (/<!DOCTYPE|<!ENTITY/i.test(body)) throw Error('DOCX 中的 XML 声明不受支持。');
  const doc = new DOMParser().parseFromString(body, 'application/xml');
  if (doc.querySelector('parsererror')) throw Error('文档 XML 格式错误。');
  return Array.from(doc.getElementsByTagNameNS('*', 'p'), (p) =>
    Array.from(p.getElementsByTagNameNS('*', 't'), (t) => t.textContent).join(''),
  ).join('\n');
}
async function readPdf(bytes: Uint8Array) {
  const pdf = await import('pdfjs-dist');
  pdf.GlobalWorkerOptions.workerSrc = (
    await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  ).default;
  const task = pdf.getDocument({ data: bytes, useSystemFonts: false, useWasm: false });
  try {
    const doc = await task.promise;
    if (doc.numPages > 120) throw Error('PDF 超过 120 页，请拆分文件。');
    let text = '';
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      text +=
        content.items
          .map((item) => ('str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : ''))
          .join('') + '\n';
      if (text.length > archiveLimits.chars) throw Error('提取的 PDF 正文过大。');
      page.cleanup();
    }
    if (!text.trim()) throw Error('没有可读取的 PDF 文本层，请先 OCR 再导入。');
    return text;
  } finally {
    await task.destroy();
  }
}
export async function parseFile(file: File) {
  if (file.size > archiveLimits.bytes) throw Error('单个文件不能超过 5 MiB。');
  const ext = file.name.split('.').at(-1)?.toLowerCase();
  if (!['md', 'txt', 'pdf', 'docx'].includes(ext || ''))
    throw Error('支持 Markdown、TXT、DOCX 和文字版 PDF。');
  const buffer = await file.arrayBuffer();
  const hash = await sha256(buffer);
  const bytes = new Uint8Array(buffer);
  const text =
    ext === 'pdf'
      ? await readPdf(bytes)
      : ext === 'docx'
        ? await readDocx(bytes)
        : new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  checkText(text);
  return parseArchive(text, file.name, hash);
}
