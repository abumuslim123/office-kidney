import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

export default function ScreensSettings() {
  const [defaultPhotoDurationSeconds, setDefaultPhotoDurationSeconds] = useState<number>(15);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get<{ defaultPhotoDurationSeconds: number }>('/screens/settings')
      .then((r) => {
        const v = Number(r.data?.defaultPhotoDurationSeconds);
        if (Number.isFinite(v) && v > 0) setDefaultPhotoDurationSeconds(v);
      })
      .catch(() => setError('Не удалось загрузить настройки'))
      .finally(() => setLoading(false));
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await api.put<{ defaultPhotoDurationSeconds: number }>('/screens/settings', {
        defaultPhotoDurationSeconds,
      });
      const v = Number(res.data?.defaultPhotoDurationSeconds);
      if (Number.isFinite(v) && v > 0) setDefaultPhotoDurationSeconds(v);
    } catch {
      setError('Ошибка сохранения длительности по умолчанию');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Настройки экранов</h2>
        <Link to="/screens" className="text-sm text-accent hover:underline">
          Назад к экранам
        </Link>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Загрузка...</p>
      ) : (
        <form onSubmit={save} className="bg-white border border-gray-200 rounded-lg p-4 max-w-md">
          <div className="text-sm font-medium text-gray-900 mb-2">Длительность по умолчанию</div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-gray-600">
              Длительность (сек)
              <input
                type="number"
                min={1}
                max={3600}
                value={defaultPhotoDurationSeconds}
                onChange={(e) => setDefaultPhotoDurationSeconds(Number(e.target.value))}
                className="mt-1 w-40 border border-gray-300 rounded px-2 py-1 text-sm"
              />
            </label>
            <button
              type="submit"
              disabled={saving}
              className="px-3 py-1.5 bg-accent text-white rounded text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            Используется при загрузке новых фото на экран.
          </div>
        </form>
      )}
    </div>
  );
}
