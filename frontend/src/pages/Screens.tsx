import { useEffect, useState } from 'react';
import { api } from '../lib/api';

type ScreenRow = {
  id: string;
  deviceId: string;
  name: string | null;
  currentVideoPath: string | null;
  createdAt: string;
  lastSeenAt: string | null;
};

export default function Screens() {
  const [screens, setScreens] = useState<ScreenRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editScreen, setEditScreen] = useState<ScreenRow | null>(null);
  const [editName, setEditName] = useState('');
  const [editError, setEditError] = useState('');
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get<ScreenRow[]>('/screens');
      setScreens(res.data);
    } catch {
      setScreens([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openEdit = (s: ScreenRow) => {
    setEditScreen(s);
    setEditName(s.name || '');
    setEditError('');
  };

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editScreen) return;
    setEditError('');
    try {
      await api.patch(`/screens/${editScreen.id}`, { name: editName || null });
      setEditScreen(null);
      load();
    } catch (err: unknown) {
      const data = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data
        : null;
      setEditError((data?.message as string) || 'Ошибка сохранения');
    }
  };

  const handleFileChange = async (screenId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');
    setUploadingId(screenId);
    try {
      const form = new FormData();
      form.append('file', file);
      await api.post(`/screens/${screenId}/video`, form);
      load();
    } catch (err: unknown) {
      const data = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data
        : null;
      setUploadError((data?.message as string) || 'Ошибка загрузки');
    } finally {
      setUploadingId(null);
      e.target.value = '';
    }
  };

  const handleDelete = async (s: ScreenRow) => {
    if (!confirm(`Удалить экран «${s.name || s.deviceId}»?`)) return;
    try {
      await api.delete(`/screens/${s.id}`);
      load();
    } catch {
      // ignore
    }
  };

  const formatDate = (s: string) => {
    try {
      return new Date(s).toLocaleString('ru');
    } catch {
      return s;
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Настройка экранов</h2>

      <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
        Установите приложение на телевизор и запустите его. После первого запроса телевизор появится в списке ниже. Загрузите видео для экрана — оно будет автоматически воспроизводиться в приложении на ТВ.
      </div>

      <div className="mb-4">
        <a
          href="/api/public/screens/apk"
          download="kidney-office-tv.apk"
          className="inline-block px-4 py-2 bg-accent text-white rounded text-sm font-medium hover:opacity-90"
        >
          Скачать приложение для ТВ (APK)
        </a>
      </div>

      {uploadError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {uploadError}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Загрузка...</p>
      ) : screens.length === 0 ? (
        <p className="text-gray-500">Нет зарегистрированных экранов. Запустите приложение на ТВ.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">ID устройства</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Имя</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Видео</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Создан</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {screens.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-2 text-sm text-gray-900 font-mono">{s.deviceId}</td>
                  <td className="px-4 py-2 text-sm text-gray-900">{s.name || '—'}</td>
                  <td className="px-4 py-2 text-sm">{s.currentVideoPath ? 'Да' : 'Нет'}</td>
                  <td className="px-4 py-2 text-sm text-gray-500">{formatDate(s.createdAt)}</td>
                  <td className="px-4 py-2 text-sm text-right space-x-2">
                    <button
                      type="button"
                      onClick={() => openEdit(s)}
                      className="text-accent hover:underline"
                    >
                      Изменить имя
                    </button>
                    <label className="text-accent hover:underline cursor-pointer">
                      {uploadingId === s.id ? 'Загрузка...' : 'Загрузить видео'}
                      <input
                        type="file"
                        accept="video/*"
                        className="hidden"
                        disabled={uploadingId !== null}
                        onChange={(e) => handleFileChange(s.id, e)}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => handleDelete(s)}
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

      {editScreen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-10" onClick={() => setEditScreen(null)}>
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-3">Изменить имя экрана</h3>
            <form onSubmit={handleSaveName}>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 mb-3"
                placeholder="Например: Зал 1"
              />
              {editError && <p className="text-red-600 text-sm mb-2">{editError}</p>}
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setEditScreen(null)} className="px-3 py-1.5 text-gray-600">
                  Отмена
                </button>
                <button type="submit" className="px-3 py-1.5 bg-accent text-white rounded">
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
