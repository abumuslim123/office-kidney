import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

type Speaker = {
  id: string;
  name: string;
  tritechModelId: string | null;
  status: string;
  description: string | null;
  createdAt: string;
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  ready: { label: 'Готов', color: 'text-green-600' },
  training: { label: 'Обучение...', color: 'text-yellow-600' },
  pending: { label: 'Ожидание', color: 'text-gray-500' },
  error: { label: 'Ошибка', color: 'text-red-600' },
};

export default function CallSpeakers() {
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<Speaker[]>('/calls/speakers');
      setSpeakers(res.data);
    } catch {
      setError('Не удалось загрузить дикторов');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const createSpeaker = async (e: React.FormEvent) => {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) { setError('Выберите аудио-файл с образцом голоса'); return; }
    if (!newName.trim()) { setError('Укажите имя диктора'); return; }

    setCreating(true);
    setError('');
    const form = new FormData();
    form.append('audio', file);
    form.append('name', newName.trim());
    if (newDescription.trim()) form.append('description', newDescription.trim());

    try {
      await api.post('/calls/speakers', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setNewName('');
      setNewDescription('');
      if (fileRef.current) fileRef.current.value = '';
      await load();
    } catch (err: unknown) {
      const data = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data
        : null;
      setError((data?.message as string) || 'Ошибка создания модели диктора');
    } finally {
      setCreating(false);
    }
  };

  const deleteSpeaker = async (speaker: Speaker) => {
    if (!confirm(`Удалить диктора «${speaker.name}»? Модель также будет удалена из 3iTech.`)) return;
    setError('');
    try {
      await api.delete(`/calls/speakers/${speaker.id}`);
      await load();
    } catch {
      setError('Ошибка удаления');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Модели дикторов (3iTech)</h2>
        <Link to="/settings/kcalls" className="text-sm text-accent hover:underline">
          Назад к настройкам
        </Link>
      </div>

      <p className="text-sm text-gray-500 mb-4">
        Загрузите образец голоса оператора (30+ секунд речи) для обучения модели.
        После обучения модель может автоматически определять оператора по голосу при транскрипции.
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="mb-6 p-4 bg-white border border-gray-200 rounded-lg">
        <div className="text-sm font-medium text-gray-900 mb-3">Добавить диктора</div>
        <form onSubmit={createSpeaker} className="flex flex-wrap gap-4 items-end">
          <label className="text-xs text-gray-600">
            Имя
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="mt-1 w-48 border border-gray-300 rounded px-2 py-1 text-sm"
              placeholder="Иванов Иван"
              required
            />
          </label>
          <label className="text-xs text-gray-600">
            Описание
            <input
              type="text"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              className="mt-1 w-48 border border-gray-300 rounded px-2 py-1 text-sm"
              placeholder="Администратор"
            />
          </label>
          <label className="text-xs text-gray-600">
            Аудио-образец
            <input
              ref={fileRef}
              type="file"
              accept="audio/*"
              className="mt-1 w-56 text-sm"
              required
            />
          </label>
          <button
            type="submit"
            disabled={creating}
            className="px-4 py-1.5 bg-accent text-white rounded text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {creating ? 'Создание...' : 'Добавить'}
          </button>
        </form>
      </div>

      {loading ? (
        <p className="text-gray-500">Загрузка...</p>
      ) : speakers.length === 0 ? (
        <p className="text-gray-500">Дикторы не добавлены.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Имя</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Описание</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Дата</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {speakers.map((speaker) => {
                const st = STATUS_LABELS[speaker.status] || { label: speaker.status, color: 'text-gray-500' };
                return (
                  <tr key={speaker.id}>
                    <td className="px-4 py-2 text-sm text-gray-900 font-medium">{speaker.name}</td>
                    <td className="px-4 py-2 text-sm text-gray-500">{speaker.description || '—'}</td>
                    <td className={`px-4 py-2 text-sm font-medium ${st.color}`}>{st.label}</td>
                    <td className="px-4 py-2 text-sm text-gray-500">
                      {new Date(speaker.createdAt).toLocaleDateString('ru-RU')}
                    </td>
                    <td className="px-4 py-2 text-sm text-right">
                      <button
                        type="button"
                        onClick={() => deleteSpeaker(speaker)}
                        className="text-red-600 hover:underline"
                      >
                        Удалить
                      </button>
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
