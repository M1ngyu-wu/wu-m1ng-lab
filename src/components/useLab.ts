import { useCallback, useEffect, useState } from 'react';
import { emptyData, readData, saveData, type LabData } from '../lib/storage';
export function useLab() {
  const [data, setData] = useState(emptyData);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const sync = () => {
      const r = readData();
      setData(r.data);
      setError(r.error);
      setReady(true);
    };
    sync();
    window.addEventListener('storage', sync);
    window.addEventListener('lab-data', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('lab-data', sync);
    };
  }, []);
  const update = useCallback((next: LabData, replace = false) => {
    try {
      if (readData().error && !replace)
        throw new Error('原始记录存在读取错误。请先导出原始存储，再通过备份恢复进行明确替换。');
      saveData(next);
      setData(next);
      setError('');
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  }, []);
  return { data, update, error, ready };
}
