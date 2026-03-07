import { useEffect, useState } from 'react';
import { api } from '../lib/api';

type TopicRow = {
  id: string;
  name: string;
  keywords: string[];
  keywordsText: string;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

const normalizeKeywords = (value: string) =>
  value
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);

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

export default function CallTopics() {
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [newName, setNewName] = useState('');
  const [newKeywords, setNewKeywords] = useState('');
  const [newActive, setNewActive] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editKeywords, setEditKeywords] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<TopicRow[]>('/calls/topics');
      setTopics(
        res.data.map((t) => ({
          ...t,
          keywordsText: (t.keywords || []).join(', '),
        })),
      );
    } catch {
      setError('Не удалось загрузить тематики');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const createTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/calls/topics', {
        name: newName,
        keywords: normalizeKeywords(newKeywords),
        isActive: newActive,
      });
      setNewName('');
      setNewKeywords('');
      setNewActive(true);
      await load();
    } catch (err: unknown) {
      const data = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data
        : null;
      setError((data?.message as string) || 'Ошибка сохранения');
    }
  };

  const startEdit = (topic: TopicRow) => {
    setEditingId(topic.id);
    setEditName(topic.name);
    setEditKeywords(topic.keywordsText);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditKeywords('');
  };

  const saveEdit = async (topic: TopicRow) => {
    setSavingId(topic.id);
    setError('');
    try {
      await api.put(`/calls/topics/${topic.id}`, {
        name: editName,
        keywords: normalizeKeywords(editKeywords),
        isActive: topic.isActive,
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

  const toggleActive = async (topic: TopicRow) => {
    setError('');
    try {
      await api.put(`/calls/topics/${topic.id}`, {
        isActive: !topic.isActive,
      });
      setTopics((prev) =>
        prev.map((t) => (t.id === topic.id ? { ...t, isActive: !t.isActive } : t)),
      );
    } catch {
      setError('Ошибка обновления статуса');
    }
  };

  const deleteTopic = async (topic: TopicRow) => {
    if (!confirm(`Удалить тематику «${topic.name}»?`)) return;
    setError('');
    try {
      await api.delete(`/calls/topics/${topic.id}`);
      await load();
    } catch {
      setError('Ошибка удаления');
    }
  };

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Тематики звонков</h3>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="mb-6 p-4 bg-white border border-gray-200 rounded-lg">
        <div className="text-sm font-medium text-gray-900 mb-3">Новая тематика</div>
        <form onSubmit={createTopic} className="flex flex-wrap gap-4 items-end">
          <label className="text-xs text-gray-600">
            Название
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="mt-1 block w-56 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none"
              placeholder="Например: Возражения"
              required
            />
          </label>
          <label className="text-xs text-gray-600">
            Ключевые слова (через запятую)
            <input
              type="text"
              value={newKeywords}
              onChange={(e) => setNewKeywords(e.target.value)}
              className="mt-1 block w-72 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none"
              placeholder="дорого, скидка, акция"
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
      ) : topics.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-16">Тематики не добавлены.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr className="bg-gray-50/80">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Название</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ключевые слова</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Слов</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Создал</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Создана</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Изменена</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Активна</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {topics.map((topic) => {
                const isEditing = editingId === topic.id;
                const isSaving = savingId === topic.id;

                return (
                  <tr key={topic.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none"
                        />
                      ) : (
                        <span className="font-medium">{topic.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editKeywords}
                          onChange={(e) => setEditKeywords(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none"
                        />
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {topic.keywords.map((kw, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-indigo-50 text-indigo-700 rounded-full"
                            >
                              {kw}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 text-center">
                      {topic.keywords.length}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {topic.createdBy || <span className="text-gray-300">&mdash;</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                      {formatDate(topic.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                      {formatDate(topic.updatedAt)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => toggleActive(topic)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent/30 ${
                          topic.isActive ? 'bg-accent' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                            topic.isActive ? 'translate-x-6' : 'translate-x-1'
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
                              onClick={() => saveEdit(topic)}
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
                              onClick={() => startEdit(topic)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-accent hover:bg-accent/10 transition-colors"
                              title="Редактировать"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteTopic(topic)}
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
