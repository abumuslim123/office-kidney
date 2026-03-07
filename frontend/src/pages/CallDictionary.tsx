import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

type DictEntry = {
  id: string;
  originalWord: string;
  correctedWord: string;
  isActive: boolean;
  createdAt: string;
};

export default function CallDictionary() {
  const [entries, setEntries] = useState<DictEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [newOriginal, setNewOriginal] = useState('');
  const [newCorrected, setNewCorrected] = useState('');
  const [newActive, setNewActive] = useState(true);
  const [dirty, setDirty] = useState<Record<string, true>>({});

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<DictEntry[]>('/calls/dictionary/entries');
      setEntries(res.data);
      setDirty({});
    } catch {
      setError('Не удалось загрузить словарь');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const updateLocal = (id: string, patch: Partial<DictEntry>) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    setDirty((prev) => ({ ...prev, [id]: true }));
  };

  const createEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/calls/dictionary/entries', {
        originalWord: newOriginal,
        correctedWord: newCorrected,
        isActive: newActive,
      });
      setNewOriginal('');
      setNewCorrected('');
      setNewActive(true);
      await load();
    } catch (err: unknown) {
      const data = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data
        : null;
      setError((data?.message as string) || 'Ошибка сохранения');
    }
  };

  const saveEntry = async (entry: DictEntry) => {
    setSavingId(entry.id);
    setError('');
    try {
      await api.put(`/calls/dictionary/entries/${entry.id}`, {
        originalWord: entry.originalWord,
        correctedWord: entry.correctedWord,
        isActive: entry.isActive,
      });
      setDirty((prev) => {
        const next = { ...prev };
        delete next[entry.id];
        return next;
      });
    } catch (err: unknown) {
      const data = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data
        : null;
      setError((data?.message as string) || 'Ошибка сохранения');
    } finally {
      setSavingId(null);
    }
  };

  const deleteEntry = async (entry: DictEntry) => {
    if (!confirm(`Удалить запись «${entry.originalWord} → ${entry.correctedWord}»?`)) return;
    setError('');
    try {
      await api.delete(`/calls/dictionary/entries/${entry.id}`);
      await load();
    } catch {
      setError('Ошибка удаления');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Словарь коррекций</h2>
        <Link to="/calls" className="text-sm text-accent hover:underline">
          Назад к звонкам
        </Link>
      </div>

      <p className="text-sm text-gray-500 mb-4">
        Слова из колонки «Оригинал» будут автоматически заменены на «Исправление» после транскрипции.
        Например: «кидай» → «Кидней» для корректного распознавания медицинских терминов.
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="mb-6 p-4 bg-white border border-gray-200 rounded-lg">
        <div className="text-sm font-medium text-gray-900 mb-3">Новая запись</div>
        <form onSubmit={createEntry} className="flex flex-wrap gap-4 items-end">
          <label className="text-xs text-gray-600">
            Оригинал (как распознано)
            <input
              type="text"
              value={newOriginal}
              onChange={(e) => setNewOriginal(e.target.value)}
              className="mt-1 w-48 border border-gray-300 rounded px-2 py-1 text-sm"
              placeholder="кидай"
              required
            />
          </label>
          <label className="text-xs text-gray-600">
            Исправление
            <input
              type="text"
              value={newCorrected}
              onChange={(e) => setNewCorrected(e.target.value)}
              className="mt-1 w-48 border border-gray-300 rounded px-2 py-1 text-sm"
              placeholder="Кидней"
              required
            />
          </label>
          <label className="text-xs text-gray-600 flex items-center gap-2 mt-6">
            <input
              type="checkbox"
              checked={newActive}
              onChange={(e) => setNewActive(e.target.checked)}
            />
            Активна
          </label>
          <button
            type="submit"
            className="px-4 py-1.5 bg-accent text-white rounded text-sm font-medium hover:opacity-90"
          >
            Добавить
          </button>
        </form>
      </div>

      {loading ? (
        <p className="text-gray-500">Загрузка...</p>
      ) : entries.length === 0 ? (
        <p className="text-gray-500">Словарь пуст. Добавьте коррекции для улучшения распознавания.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Оригинал</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Исправление</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-4 py-2 text-sm">
                    <input
                      type="text"
                      value={entry.originalWord}
                      onChange={(e) => updateLocal(entry.id, { originalWord: e.target.value })}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="px-4 py-2 text-sm">
                    <input
                      type="text"
                      value={entry.correctedWord}
                      onChange={(e) => updateLocal(entry.id, { correctedWord: e.target.value })}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="px-4 py-2 text-sm">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={entry.isActive}
                        onChange={(e) => updateLocal(entry.id, { isActive: e.target.checked })}
                      />
                      {entry.isActive ? 'Активна' : 'Отключена'}
                    </label>
                  </td>
                  <td className="px-4 py-2 text-sm text-right space-x-2">
                    <button
                      type="button"
                      onClick={() => saveEntry(entry)}
                      disabled={!dirty[entry.id] || savingId === entry.id}
                      className="text-accent hover:underline disabled:opacity-50"
                    >
                      {savingId === entry.id ? 'Сохранение...' : 'Сохранить'}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteEntry(entry)}
                      className="text-red-600 hover:underline"
                    >
                      Удалить
                    </button>
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
