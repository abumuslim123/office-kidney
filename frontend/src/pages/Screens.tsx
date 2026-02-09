import { useEffect, useState, Fragment } from 'react';
import { api } from '../lib/api';

type ScreenRow = {
  id: string;
  deviceId: string;
  name: string | null;
  currentVideoPath: string | null;
  createdAt: string;
  lastSeenAt: string | null;
};

type ScreenPhoto = {
  id: string;
  screenId: string;
  imagePath: string;
  durationSeconds: number;
  rotation: number;
  expiresAt: string | null;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
};

export default function Screens() {
  const [screens, setScreens] = useState<ScreenRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editScreen, setEditScreen] = useState<ScreenRow | null>(null);
  const [editName, setEditName] = useState('');
  const [editError, setEditError] = useState('');
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [expandedScreenId, setExpandedScreenId] = useState<string | null>(null);
  const [photoLoadingId, setPhotoLoadingId] = useState<string | null>(null);
  const [photoUploadingId, setPhotoUploadingId] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string>('');
  const [photosByScreen, setPhotosByScreen] = useState<Record<string, ScreenPhoto[]>>({});

  const toLocalInput = (utcIso: string) => {
    const date = new Date(utcIso);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    const y = date.getFullYear();
    const m = pad(date.getMonth() + 1);
    const d = pad(date.getDate());
    const hh = pad(date.getHours());
    const mm = pad(date.getMinutes());
    return `${y}-${m}-${d}T${hh}:${mm}`;
  };

  const fromLocalInput = (localValue: string) => {
    if (!localValue) return null;
    const [datePart, timePart] = localValue.split('T');
    if (!datePart || !timePart) return null;
    const [y, m, d] = datePart.split('-').map(Number);
    const [hh, mm] = timePart.split(':').map(Number);
    if ([y, m, d, hh, mm].some((v) => Number.isNaN(v))) return null;
    const date = new Date(y, m - 1, d, hh, mm, 0, 0);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get<ScreenRow[]>('/screens');
      setScreens(res.data);
      const noVideo = res.data.filter((s) => !s.currentVideoPath);
      void Promise.all(
        noVideo.map(async (s) => {
          try {
            const photosRes = await api.get<ScreenPhoto[]>(`/screens/${s.id}/photos`);
            return { id: s.id, photos: photosRes.data };
          } catch {
            return null;
          }
        }),
      ).then((items) => {
        const updates = items.filter(Boolean) as { id: string; photos: ScreenPhoto[] }[];
        if (updates.length === 0) return;
        setPhotosByScreen((prev) => {
          const next = { ...prev };
          updates.forEach((u) => {
            next[u.id] = u.photos;
          });
          return next;
        });
      });
    } catch {
      setScreens([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const loadPhotos = async (screenId: string) => {
    setPhotoLoadingId(screenId);
    setPhotoError('');
    try {
      const res = await api.get<ScreenPhoto[]>(`/screens/${screenId}/photos`);
      setPhotosByScreen((prev) => ({ ...prev, [screenId]: res.data }));
    } catch {
      setPhotoError('Ошибка загрузки фото');
    } finally {
      setPhotoLoadingId(null);
    }
  };

  const togglePhotos = async (screenId: string) => {
    if (expandedScreenId === screenId) {
      setExpandedScreenId(null);
      return;
    }
    setExpandedScreenId(screenId);
    if (!photosByScreen[screenId]) {
      await loadPhotos(screenId);
    }
  };

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
    setUploadProgress(0);
    try {
      const form = new FormData();
      form.append('file', file);
      await api.post(`/screens/${screenId}/video`, form, {
        onUploadProgress: (ev) => {
          if (ev.total != null && ev.total > 0) {
            setUploadProgress(Math.round((100 * ev.loaded) / ev.total));
          }
        },
      });
      load();
    } catch (err: unknown) {
      const data = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data
        : null;
      setUploadError((data?.message as string) || 'Ошибка загрузки');
    } finally {
      setUploadingId(null);
      setUploadProgress(null);
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

  const handleDeleteVideo = async (screenId: string) => {
    if (!confirm('Удалить видео для этого экрана?')) return;
    try {
      await api.delete(`/screens/${screenId}/video`);
      load();
    } catch {
      setUploadError('Ошибка удаления видео');
    }
  };

  const handlePhotoUpload = async (screenId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setPhotoError('');
    setPhotoUploadingId(screenId);
    try {
      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        const form = new FormData();
        form.append('file', file);
        form.append('durationSeconds', '15');
        form.append('rotation', '0');
        form.append('orderIndex', String((photosByScreen[screenId]?.length || 0) + i));
        await api.post(`/screens/${screenId}/photos`, form);
      }
      await loadPhotos(screenId);
    } catch (err: unknown) {
      const data = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data
        : null;
      setPhotoError((data?.message as string) || 'Ошибка загрузки фото');
    } finally {
      setPhotoUploadingId(null);
      e.target.value = '';
    }
  };

  const updatePhotoLocal = (screenId: string, photoId: string, patch: Partial<ScreenPhoto>) => {
    setPhotosByScreen((prev) => ({
      ...prev,
      [screenId]: (prev[screenId] || []).map((p) => (p.id === photoId ? { ...p, ...patch } : p)),
    }));
  };

  const handlePhotoSave = async (screenId: string, photo: ScreenPhoto) => {
    try {
      await api.patch(`/screens/photos/${photo.id}`, {
        durationSeconds: photo.durationSeconds,
        rotation: photo.rotation,
        orderIndex: photo.orderIndex,
        expiresAt: photo.expiresAt || null,
      });
      await loadPhotos(screenId);
    } catch {
      setPhotoError('Ошибка сохранения фото');
    }
  };

  const handlePhotoDelete = async (screenId: string, photoId: string) => {
    if (!confirm('Удалить фото?')) return;
    try {
      await api.delete(`/screens/photos/${photoId}`);
      await loadPhotos(screenId);
    } catch {
      setPhotoError('Ошибка удаления фото');
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
      {photoError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {photoError}
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
                <Fragment key={s.id}>
                  <tr key={s.id}>
                    <td className="px-4 py-2 text-sm text-gray-900 font-mono">{s.deviceId}</td>
                    <td className="px-4 py-2 text-sm text-gray-900">{s.name || '—'}</td>
                    <td className="px-4 py-2 text-sm align-middle">
                      {uploadingId === s.id ? (
                        <div className="flex items-center gap-2">
                          <span className="inline-block w-5 h-5 border-2 border-gray-300 border-t-accent rounded-full animate-spin" aria-hidden />
                          <span className="text-gray-600">Загрузка{uploadProgress != null ? ` ${uploadProgress}%` : ''}...</span>
                          {uploadProgress != null && (
                            <div className="w-16 h-1.5 bg-gray-200 rounded overflow-hidden">
                              <div className="h-full bg-accent rounded" style={{ width: `${uploadProgress}%` }} />
                            </div>
                          )}
                        </div>
                      ) : s.currentVideoPath ? (
                        <div className="flex items-center gap-2">
                          <div className="w-[120px] h-[68px] rounded overflow-hidden bg-gray-200 shrink-0">
                            <video
                              src={`${api.defaults.baseURL}/public/screens/video/${s.id}`}
                              muted
                              playsInline
                              preload="metadata"
                              className="w-full h-full object-cover"
                              onError={() => {}}
                            />
                          </div>
                          <span className="text-gray-600">Да</span>
                        </div>
                      ) : (photosByScreen[s.id] || []).length > 0 ? (
                        <div className="flex items-center gap-2">
                          <div className="w-[120px] h-[68px] rounded overflow-hidden bg-gray-200 shrink-0">
                            <img
                              src={`${api.defaults.baseURL}/public/screens/photo/${photosByScreen[s.id][0].id}`}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <span className="text-gray-600">Фото</span>
                        </div>
                      ) : (
                        'Нет'
                      )}
                    </td>
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
                      {s.currentVideoPath && (
                        <button
                          type="button"
                          onClick={() => handleDeleteVideo(s.id)}
                          className="text-red-600 hover:underline"
                        >
                          Удалить видео
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => togglePhotos(s.id)}
                        className="text-accent hover:underline"
                      >
                        Фото
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(s)}
                        className="text-red-600 hover:underline"
                      >
                        Удалить
                      </button>
                    </td>
                  </tr>
                  {expandedScreenId === s.id && (
                    <tr key={`${s.id}-photos`}>
                      <td colSpan={5} className="px-4 py-4 bg-gray-50">
                        <div className="flex items-center justify-between mb-3">
                          <div className="text-sm text-gray-700 font-medium">Фото для слайдшоу</div>
                          <label className="text-accent hover:underline cursor-pointer text-sm">
                            {photoUploadingId === s.id ? 'Загрузка фото...' : 'Загрузить фото'}
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              className="hidden"
                              disabled={photoUploadingId !== null}
                              onChange={(e) => handlePhotoUpload(s.id, e)}
                            />
                          </label>
                        </div>
                        {photoLoadingId === s.id ? (
                          <p className="text-sm text-gray-500">Загрузка фото...</p>
                        ) : (
                          <div className="space-y-3">
                            {(photosByScreen[s.id] || []).length === 0 ? (
                              <p className="text-sm text-gray-500">Фото не добавлены.</p>
                            ) : (
                              (photosByScreen[s.id] || []).map((p) => {
                                const isExpired = p.expiresAt ? new Date(p.expiresAt) <= new Date() : false;
                                return (
                                  <div key={p.id} className="flex items-start gap-3 bg-white border border-gray-200 rounded p-3">
                                    <div className="w-[120px] h-[68px] rounded overflow-hidden bg-gray-200 shrink-0">
                                      <img
                                        src={`${api.defaults.baseURL}/public/screens/photo/${p.id}`}
                                        alt=""
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                    <div className="flex-1 grid grid-cols-5 gap-3">
                                      <label className="text-xs text-gray-600">
                                        Длительность (сек)
                                        <input
                                          type="number"
                                          min={1}
                                          max={3600}
                                          value={p.durationSeconds}
                                          onChange={(e) => updatePhotoLocal(s.id, p.id, { durationSeconds: Number(e.target.value) })}
                                          className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-sm"
                                        />
                                      </label>
                                      <label className="text-xs text-gray-600">
                                        Поворот
                                        <select
                                          value={p.rotation}
                                          onChange={(e) => updatePhotoLocal(s.id, p.id, { rotation: Number(e.target.value) })}
                                          className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-sm"
                                        >
                                          <option value={0}>0°</option>
                                          <option value={90}>90°</option>
                                          <option value={180}>180°</option>
                                          <option value={270}>270°</option>
                                        </select>
                                      </label>
                                      <label className="text-xs text-gray-600">
                                        Истекает
                                        <input
                                          type="datetime-local"
                                          value={p.expiresAt ? toLocalInput(p.expiresAt) : ''}
                                          onChange={(e) => updatePhotoLocal(s.id, p.id, { expiresAt: fromLocalInput(e.target.value) })}
                                          className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-sm"
                                        />
                                      </label>
                                      <div className="flex items-end">
                                        <button
                                          type="button"
                                          onClick={() => updatePhotoLocal(s.id, p.id, { expiresAt: null })}
                                          className="text-xs text-gray-500 hover:text-gray-700"
                                        >
                                          Очистить
                                        </button>
                                      </div>
                                      <label className="text-xs text-gray-600">
                                        Порядок
                                        <input
                                          type="number"
                                          min={0}
                                          value={p.orderIndex}
                                          onChange={(e) => updatePhotoLocal(s.id, p.id, { orderIndex: Number(e.target.value) })}
                                          className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-sm"
                                        />
                                      </label>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                      <button
                                        type="button"
                                        onClick={() => handlePhotoSave(s.id, p)}
                                        className="text-sm text-accent hover:underline"
                                      >
                                        Сохранить
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handlePhotoDelete(s.id, p.id)}
                                        className="text-sm text-red-600 hover:underline"
                                      >
                                        Удалить
                                      </button>
                                      {isExpired && <span className="text-xs text-red-500">Истекло</span>}
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
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
