import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

type TopicRow = {
  id: string;
  name: string;
  keywords: string[];
  keywordsText: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

const normalizeKeywords = (value: string) =>
  value
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);

export default function CallTopics() {
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [newName, setNewName] = useState('');
  const [newKeywords, setNewKeywords] = useState('');
  const [newActive, setNewActive] = useState(true);
  const [dirty, setDirty] = useState<Record<string, true>>({});

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
      setDirty({});
    } catch {
      setError('Не удалось загрузить тематики');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updateLocal = (id: string, patch: Partial<TopicRow>) => {
    setTopics((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    setDirty((prev) => ({ ...prev, [id]: true }));
  };

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

  const saveTopic = async (topic: TopicRow) => {
    setSavingId(topic.id);
    setError('');
    try {
      await api.put(`/calls/topics/${topic.id}`, {
        name: topic.name,
        keywords: normalizeKeywords(topic.keywordsText),
        isActive: topic.isActive,
      });
      setDirty((prev) => {
        const next = { ...prev };
        delete next[topic.id];
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
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Тематики звонков</h2>
        <Link to="/calls" className="text-sm text-accent hover:underline">
          Назад к звонкам
        </Link>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
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
              className="mt-1 w-56 border border-gray-300 rounded px-2 py-1 text-sm"
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
              className="mt-1 w-72 border border-gray-300 rounded px-2 py-1 text-sm"
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
            className="px-4 py-1.5 bg-accent text-white rounded text-sm font-medium hover:opacity-90"
          >
            Добавить
          </button>
        </form>
      </div>

      {loading ? (
        <p className="text-gray-500">Загрузка...</p>
      ) : topics.length === 0 ? (
        <p className="text-gray-500">Тематики не добавлены.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Название</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ключевые слова</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {topics.map((topic) => (
                <tr key={topic.id}>
                  <td className="px-4 py-2 text-sm text-gray-900">
                    <input
                      type="text"
                      value={topic.name}
                      onChange={(e) => updateLocal(topic.id, { name: e.target.value })}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-700">
                    <input
                      type="text"
                      value={topic.keywordsText}
                      onChange={(e) => updateLocal(topic.id, { keywordsText: e.target.value })}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-700">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={topic.isActive}
                        onChange={(e) => updateLocal(topic.id, { isActive: e.target.checked })}
                      />
                      {topic.isActive ? 'Активна' : 'Отключена'}
                    </label>
                  </td>
                  <td className="px-4 py-2 text-sm text-right space-x-2">
                    <button
                      type="button"
                      onClick={() => saveTopic(topic)}
                      disabled={!dirty[topic.id] || savingId === topic.id}
                      className="text-accent hover:underline disabled:opacity-50"
                    >
                      {savingId === topic.id ? 'Сохранение...' : 'Сохранить'}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteTopic(topic)}
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
