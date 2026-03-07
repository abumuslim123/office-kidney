import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

type FavoriteCall = {
  id: string;
  employeeName: string;
  clientName: string | null;
  clientPhone: string | null;
  callAt: string;
  durationSeconds: number;
  status: string;
  isFavorite: boolean;
};

const formatDate = (s: string) => {
  try { return new Date(s).toLocaleString('ru'); } catch { return s; }
};

const formatSeconds = (value?: number) => {
  if (!value || value <= 0) return '0:00';
  const total = Math.round(value);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

export default function CallsFavorites() {
  const navigate = useNavigate();
  const [calls, setCalls] = useState<FavoriteCall[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get<FavoriteCall[]>('/calls/favorites');
      setCalls(res.data);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const removeFavorite = async (callId: string) => {
    await api.post(`/calls/favorites/${callId}`);
    setCalls((prev) => prev.filter((c) => c.id !== callId));
  };

  if (loading) return <p className="text-gray-500 text-sm">Загрузка...</p>;

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-3">Избранные звонки</h3>
      {calls.length === 0 ? (
        <p className="text-sm text-gray-400">Нет избранных звонков. Пометьте звонок звёздочкой в списке.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr className="bg-gray-50/80">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Дата</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Сотрудник</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Клиент</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Длит.</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {calls.map((call) => (
                <tr key={call.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 text-sm text-gray-700">{formatDate(call.callAt)}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{call.employeeName}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{call.clientName || call.clientPhone || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{formatSeconds(call.durationSeconds)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => navigate(`/calls/${call.id}`)}
                        className="px-2 py-1 text-xs text-accent hover:underline"
                      >
                        Открыть
                      </button>
                      <button
                        type="button"
                        onClick={() => removeFavorite(call.id)}
                        className="px-2 py-1 text-xs text-red-500 hover:underline"
                        title="Убрать из избранного"
                      >
                        Убрать
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
