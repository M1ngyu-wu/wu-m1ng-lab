import { useEffect, useMemo, useState } from 'react';
import { publishedDocs } from '../lib/archive-public';
import { loadArchive } from '../lib/archive-store';
import { catalogNodes } from '../lib/growth';

export function useCatalog() {
  const [docs, setDocs] = useState(publishedDocs);
  const [catalogError, setError] = useState('');
  useEffect(() => {
    let request = 0;
    const sync = async () => {
      const id = ++request;
      try {
        const records = await loadArchive();
        if (id === request) {
          setDocs(records);
          setError('');
        }
      } catch {
        if (id === request) setError('本地题解未能读取，当前显示已载入的数据。');
      }
    };
    void sync();
    window.addEventListener('archive-change', sync);
    return () => {
      request++;
      window.removeEventListener('archive-change', sync);
    };
  }, []);
  const nodes = useMemo(() => catalogNodes(docs), [docs]);
  return { docs, nodes, catalogError };
}
