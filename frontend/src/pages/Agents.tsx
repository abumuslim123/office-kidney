import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function Agents() {
  const [data, setData] = useState<{ message?: string; agents?: unknown[] } | null>(null);

  useEffect(() => {
    api.get('/agents').then((r) => setData(r.data)).catch(() => setData(null));
  }, []);

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-4">ИИ-агенты</h2>
      <div className="bg-white border border-gray-200 rounded-lg p-6 text-gray-600">
        {data?.message || 'Модуль ИИ-агентов будет подключён позже.'}
      </div>
    </div>
  );
}
