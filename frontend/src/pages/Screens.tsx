import { useEffect, useState, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

type ScreenRow = {
  id: string;
  deviceId: string;
  name: string | null;
  currentVideoPath: string | null;
  photosCount?: number;
  firstPhotoId?: string | null;
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
  const [defaultPhotoDurationSeconds, setDefaultPhotoDurationSeconds] = useState<number>(15);
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
  const [dirtyPhotosByScreen, setDirtyPhotosByScreen] = useState<Record<string, Record<string, true>>>({});
  const [savingAllPhotosId, setSavingAllPhotosId] = useState<string | null>(null);

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
    } catch {
      setScreens([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    api.get<{ defaultPhotoDurationSeconds: number }>('/screens/settings')
      .then((r) => {
        const v = Number(r.data?.defaultPhotoDurationSeconds);
        if (Number.isFinite(v) && v > 0) setDefaultPhotoDurationSeconds(v);
      })
      .catch(() => {});
  }, []);

  const loadPhotos = async (screenId: string) => {
    setPhotoLoadingId(screenId);
    setPhotoError('');
    try {
      const res = await api.get<ScreenPhoto[]>(`/screens/${screenId}/photos`);
      setPhotosByScreen((prev) => ({ ...prev, [screenId]: res.data }));
      setDirtyPhotosByScreen((prev) => {
        const next = { ...prev };
        delete next[screenId];
        return next;
      });
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
        form.append('durationSeconds', String(defaultPhotoDurationSeconds));
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
    setDirtyPhotosByScreen((prev) => ({
      ...prev,
      [screenId]: { ...(prev[screenId] || {}), [photoId]: true },
    }));
  };

  const handleSaveAllPhotos = async (screenId: string) => {
    const dirty = dirtyPhotosByScreen[screenId] || {};
    const dirtyIds = Object.keys(dirty);
    if (!dirtyIds.length) return;
    setSavingAllPhotosId(screenId);
    setPhotoError('');
    try {
      const photos = photosByScreen[screenId] || [];
      const toSave = photos.filter((p) => dirty[p.id]);
      await Promise.all(toSave.map((p) => api.patch(`/screens/photos/${p.id}`, {
        durationSeconds: p.durationSeconds,
        rotation: p.rotation,
        orderIndex: p.orderIndex,
        expiresAt: p.expiresAt || null,
      })));
      await loadPhotos(screenId);
    } catch {
      setPhotoError('Ошибка сохранения фото');
    } finally {
      setSavingAllPhotosId(null);
    }
  };

  const handleDeleteAllPhotos = async (screenId: string) => {
    if (!confirm('Удалить ВСЕ фото этого экрана? Это действие необратимо.')) return;
    setPhotoError('');
    try {
      await api.delete(`/screens/${screenId}/photos`);
      await loadPhotos(screenId);
      await load();
    } catch {
      setPhotoError('Ошибка удаления фото');
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
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Настройка экранов</h2>
        <Link to="/screens/settings" className="px-3 py-1.5 border border-gray-300 rounded text-sm font-medium text-gray-700 hover:bg-gray-50">
          Настройки
        </Link>
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
                      ) : s.firstPhotoId ? (
                        <div className="flex items-center gap-2">
                          <div className="w-[120px] h-[68px] rounded overflow-hidden bg-gray-200 shrink-0">
                            <img
                              src={`${api.defaults.baseURL}/public/screens/photo/${s.firstPhotoId}`}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <span className="text-gray-600">Фото{s.photosCount ? ` (${s.photosCount})` : ''}</span>
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
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => handleSaveAllPhotos(s.id)}
                              disabled={savingAllPhotosId === s.id || Object.keys(dirtyPhotosByScreen[s.id] || {}).length === 0}
                              className="text-sm px-3 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
                            >
                              {savingAllPhotosId === s.id
                                ? 'Сохранение...'
                                : `Сохранить все${Object.keys(dirtyPhotosByScreen[s.id] || {}).length ? ` (${Object.keys(dirtyPhotosByScreen[s.id] || {}).length})` : ''}`}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteAllPhotos(s.id)}
                              className="text-sm px-3 py-1.5 rounded border border-red-300 text-red-700 bg-white hover:bg-red-50"
                            >
                              Удалить все фото
                            </button>
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
