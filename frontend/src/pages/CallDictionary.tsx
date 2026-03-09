import { useEffect, useState } from 'react';
import { api } from '../lib/api';

type DictEntry = {
  id: string;
  originalWord: string;
  correctedWord: string;
  isActive: boolean;
  createdAt: string;
};

const formatDate = (s: string) => {
  try {
    return new Date(s).toLocaleString('ru', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return s;
  }
};

export default function CallDictionary() {
  const [entries, setEntries] = useState<DictEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [newOriginal, setNewOriginal] = useState('');
  const [newCorrected, setNewCorrected] = useState('');
  const [newActive, setNewActive] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editOriginal, setEditOriginal] = useState('');
  const [editCorrected, setEditCorrected] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<DictEntry[]>('/calls/dictionary/entries');
      setEntries(res.data);
    } catch {
      setError('Не удалось загрузить словарь');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

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

  const startEdit = (entry: DictEntry) => {
    setEditingId(entry.id);
    setEditOriginal(entry.originalWord);
    setEditCorrected(entry.correctedWord);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditOriginal('');
    setEditCorrected('');
  };

  const saveEdit = async (entry: DictEntry) => {
    setSavingId(entry.id);
    setError('');
    try {
      await api.put(`/calls/dictionary/entries/${entry.id}`, {
        originalWord: editOriginal,
        correctedWord: editCorrected,
        isActive: entry.isActive,
      });
      setEditingId(null);
      await load();
    } catch (err: unknown) {
      const data = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data
        : null;
      setError((data?.message as string) || 'Ошибка сохранения');
    } finally {
      setSavingId(null);
    }
  };

  const toggleActive = async (entry: DictEntry) => {
    setError('');
    try {
      await api.put(`/calls/dictionary/entries/${entry.id}`, {
        isActive: !entry.isActive,
      });
      setEntries((prev) =>
        prev.map((e) => (e.id === entry.id ? { ...e, isActive: !e.isActive } : e)),
      );
    } catch {
      setError('Ошибка обновления статуса');
    }
  };

  const deleteEntry = async (entry: DictEntry) => {
    if (!confirm(`Удалить запись «${entry.originalWord} -> ${entry.correctedWord}»?`)) return;
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
      <h3 className="text-lg font-semibold text-gray-900 mb-1">Словарь коррекций</h3>
      <p className="text-sm text-gray-500 mb-4">
        Слова из колонки «Оригинал» будут автоматически заменены на «Исправление» после транскрипции.
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
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
              className="mt-1 block w-48 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none"
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
              className="mt-1 block w-48 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none"
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
            className="px-4 py-1.5 bg-accent text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Добавить
          </button>
        </form>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <svg className="w-6 h-6 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : entries.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-16">Словарь пуст. Добавьте коррекции для улучшения распознавания.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr className="bg-gray-50/80">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Оригинал</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Исправление</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Создана</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Активна</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.map((entry) => {
                const isEditing = editingId === entry.id;
                const isSaving = savingId === entry.id;

                return (
                  <tr key={entry.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editOriginal}
                          onChange={(e) => setEditOriginal(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none"
                        />
                      ) : (
                        <span className="font-medium">{entry.originalWord}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editCorrected}
                          onChange={(e) => setEditCorrected(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none"
                        />
                      ) : (
                        <span>{entry.correctedWord}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                      {formatDate(entry.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => toggleActive(entry)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent/30 ${
                          entry.isActive ? 'bg-accent' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                            entry.isActive ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              onClick={() => saveEdit(entry)}
                              disabled={isSaving}
                              className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 disabled:opacity-50 transition-colors"
                              title="Сохранить"
                            >
                              {isSaving ? (
                                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                              ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                              title="Отмена"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => startEdit(entry)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-accent hover:bg-accent/10 transition-colors"
                              title="Редактировать"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteEntry(entry)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="Удалить"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
