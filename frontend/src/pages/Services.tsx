import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function Services() {
  const [data, setData] = useState<{ message?: string; jobs?: unknown[] } | null>(null);

  useEffect(() => {
    api.get('/services').then((r) => setData(r.data)).catch(() => setData(null));
  }, []);

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Сервисы и задачи</h2>
      <div className="bg-white border border-gray-200 rounded-lg p-6 text-gray-600">
        {data?.message || 'Модуль сервисов и фоновых задач будет добавлен.'}
      </div>
    </div>
  );
}
