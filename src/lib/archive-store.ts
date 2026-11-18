import { attachVersion, restoreVersion, type ArchiveDoc, type ArchiveVersion } from './archive';
import { publishedDocs } from './archive-public';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('wu_m1ng.archive', 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('documents', { keyPath: 'id' });
      req.result.createObjectStore('originals');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(Error('其他标签页正在使用旧数据库，请关闭后重试。'));
  });
}
function merged(local: ArchiveDoc[]) {
  const map = new Map(publishedDocs.map((doc) => [doc.id, doc]));
  for (const doc of local) {
    const remote = map.get(doc.id);
    if (
      remote &&
      remote.versions.length >= doc.versions.length &&
      doc.versions.every(
        (v, i) =>
          remote.versions[i]?.source.sha256 === v.source.sha256 &&
          remote.versions[i].createdAt === v.createdAt,
      )
    )
      continue;
    map.set(doc.id, doc);
  }
  return [...map.values()];
}
async function transact<T>(
  stores: string[],
  mode: IDBTransactionMode,
  work: (tx: IDBTransaction, done: (value: T) => void, fail: (e: unknown) => void) => void,
): Promise<T> {
  const db = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(stores, mode);
      let result: T;
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(tx.error || Error('保存中断，现有数据已保留。'));
      const fail = (error: unknown) => {
        tx.abort();
        reject(error);
      };
      work(
        tx,
        (v) => {
          result = v;
        },
        fail,
      );
    });
  } finally {
    db.close();
  }
}
export function loadArchive() {
  return transact<ArchiveDoc[]>(['documents'], 'readonly', (tx, done) => {
    const req = tx.objectStore('documents').getAll();
    req.onsuccess = () => done(merged(req.result));
  });
}
export function getOriginal(hash: string) {
  return transact<Blob | undefined>(['originals'], 'readonly', (tx, done) => {
    const req = tx.objectStore('originals').get(hash);
    req.onsuccess = () => done(req.result);
  });
}
export async function saveImport(v: ArchiveVersion, file: Blob) {
  const result = await transact<ReturnType<typeof attachVersion>>(
    ['documents', 'originals'],
    'readwrite',
    (tx, done, fail) => {
      const store = tx.objectStore('documents');
      const req = store.getAll();
      req.onsuccess = () => {
        try {
          const attached = attachVersion(merged(req.result), v);
          if (attached.status !== '重复') store.put(attached.doc);
          tx.objectStore('originals').put(file, v.source.sha256);
          done(attached);
        } catch (e) {
          fail(e);
        }
      };
    },
  );
  window.dispatchEvent(new Event('archive-change'));
  return result;
}
export async function restore(id: string, version: number, expectedVersion: number) {
  await transact(['documents'], 'readwrite', (tx, done, fail) => {
    const store = tx.objectStore('documents');
    const req = store.getAll();
    req.onsuccess = () => {
      try {
        const doc = merged(req.result).find((d) => d.id === id);
        if (!doc || doc.versions.length !== expectedVersion)
          throw Error('题解已有变更，请重新打开最新记录。');
        store.put(restoreVersion(doc, version));
        done(true);
      } catch (e) {
        fail(e);
      }
    };
  });
  window.dispatchEvent(new Event('archive-change'));
}
