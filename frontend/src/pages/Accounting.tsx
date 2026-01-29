import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function Accounting() {
  const [data, setData] = useState<{ message?: string; data?: unknown[] } | null>(null);

  useEffect(() => {
    api.get('/accounting').then((r) => setData(r.data)).catch(() => setData(null));
  }, []);

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Учёт</h2>
      <div className="bg-white border border-gray-200 rounded-lg p-6 text-gray-600">
        {data?.message || 'Модуль таблиц учёта будет доработан.'}
      </div>
    </div>
  );
}
