import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import HrTabs from '../components/HrTabs';

type HrFolder = {
  id: string;
  name: string;
  createdAt: string;
  lists?: HrList[];
};

type HrList = {
  id: string;
  name: string;
  year: number | null;
  createdAt: string;
};

export default function HR() {
  const { folderId } = useParams<{ folderId?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const hasPerm = (slug: string) => user?.permissions?.some((p) => p.slug === slug) ?? false;
  const isFolderView = Boolean(folderId);

  // Folders view state
  const [folders, setFolders] = useState<HrFolder[]>([]);
  const [foldersLoading, setFoldersLoading] = useState(true);
  const [showFolderForm, setShowFolderForm] = useState(false);
  const [folderFormName, setFolderFormName] = useState('');
  const [folderError, setFolderError] = useState('');

  // Folder view state (lists inside folder)
  const [folder, setFolder] = useState<HrFolder | null>(null);
  const [folderLoading, setFolderLoading] = useState(false);
  const [showListForm, setShowListForm] = useState(false);
  const [listForm, setListForm] = useState({ name: '', year: '' });
  const [editingList, setEditingList] = useState<HrList | null>(null);
  const [editListForm, setEditListForm] = useState({ name: '', year: '' });
  const [showImportForm, setShowImportForm] = useState(false);
  const [importForm, setImportForm] = useState({ name: '', year: '' });
  const [importing, setImporting] = useState(false);
  const [listError, setListError] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const importFileRef = useRef<HTMLInputElement>(null);

  const loadFolders = async () => {
    setFoldersLoading(true);
    try {
      const res = await api.get<HrFolder[]>('/hr/folders');
      setFolders(res.data);
    } finally {
      setFoldersLoading(false);
    }
  };

  const loadFolder = async (id: string) => {
    setFolderLoading(true);
    try {
      const res = await api.get<HrFolder>(`/hr/folders/${id}`);
      setFolder(res.data);
    } finally {
      setFolderLoading(false);
    }
  };

  useEffect(() => {
    if (!isFolderView) {
      loadFolders();
    }
  }, [isFolderView]);

  useEffect(() => {
    if (folderId) {
      loadFolder(folderId);
    } else {
      setFolder(null);
    }
  }, [folderId]);

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    setFolderError('');
    try {
      await api.post('/hr/folders', { name: folderFormName.trim() });
      setShowFolderForm(false);
      setFolderFormName('');
      loadFolders();
    } catch (err: unknown) {
      const data = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string | string[] } } }).response?.data
        : null;
      const msg = data?.message;
      setFolderError(Array.isArray(msg) ? msg.join(', ') : (msg as string) || 'Ошибка создания');
    }
  };

  const handleDeleteFolder = async (id: string) => {
    if (!confirm('Удалить папку и все списки внутри?')) return;
    try {
      await api.delete(`/hr/folders/${id}`);
      if (folderId === id) navigate('/hr');
      loadFolders();
    } catch {}
  };

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderId) return;
    setListError('');
    try {
      await api.post('/hr/lists', {
        folderId,
        name: listForm.name,
        year: listForm.year ? parseInt(listForm.year, 10) : null,
      });
      setShowListForm(false);
      setListForm({ name: '', year: '' });
      loadFolder(folderId);
    } catch (err: unknown) {
      const data = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string | string[] } } }).response?.data
        : null;
      const msg = data?.message;
      setListError(Array.isArray(msg) ? msg.join(', ') : (msg as string) || 'Ошибка создания');
    }
  };

  const handleDeleteList = async (id: string) => {
    if (!confirm('Удалить список и все записи?')) return;
    try {
      await api.delete(`/hr/lists/${id}`);
      if (folderId) loadFolder(folderId);
    } catch {}
  };

  const handleCopyList = async (list: HrList) => {
    try {
      const res = await api.post<HrList>(`/hr/lists/${list.id}/copy`, {
        name: `${list.name} (копия)`,
      });
      if (folderId) loadFolder(folderId);
      navigate(`/hr/${res.data.id}`);
    } catch {}
  };

  const openEditList = (list: HrList) => {
    setEditingList(list);
    setEditListForm({
      name: list.name,
      year: list.year != null ? String(list.year) : '',
    });
    setListError('');
  };

  const handleUpdateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingList || !folderId) return;
    setListError('');
    try {
      await api.put(`/hr/lists/${editingList.id}`, {
        name: editListForm.name.trim(),
        year: editListForm.year.trim() ? parseInt(editListForm.year, 10) : null,
      });
      setEditingList(null);
      loadFolder(folderId);
    } catch (err: unknown) {
      const data = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string | string[] } } }).response?.data
        : null;
      const msg = data?.message;
      setListError(Array.isArray(msg) ? msg.join(', ') : (msg as string) || 'Ошибка сохранения');
    }
  };

  const handleCreateFromFile = async (e: React.FormEvent) => {
    e.preventDefault();
    const file = importFileRef.current?.files?.[0];
    if (!file || !folderId) {
      setListError('Выберите файл');
      return;
    }
    setListError('');
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const params = new URLSearchParams({ folderId });
      if (importForm.name.trim()) params.set('name', importForm.name.trim());
      if (importForm.year.trim()) params.set('year', importForm.year.trim());
      const res = await api.post<HrList>(`/hr/lists/import?${params.toString()}`, formData);
      setShowImportForm(false);
      setImportForm({ name: '', year: '' });
      if (importFileRef.current) importFileRef.current.value = '';
      loadFolder(folderId);
      navigate(`/hr/${res.data.id}`);
    } catch (err: unknown) {
      const data = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string | string[] } } }).response?.data
        : null;
      const msg = data?.message;
      setListError(Array.isArray(msg) ? msg.join(', ') : (msg as string) || 'Ошибка импорта');
    } finally {
      setImporting(false);
    }
  };

  const lists = folder?.lists ?? [];
  const filteredLists = yearFilter
    ? lists.filter((l) => l.year !== null && String(l.year) === yearFilter)
    : lists;
  const years = [...new Set(lists.map((l) => l.year).filter(Boolean))].sort((a, b) => (b || 0) - (a || 0));

  if (isFolderView) {
    return (
      <div>
        <HrTabs active="lists" />
        <div className="flex items-center gap-4 mb-6">
          <Link to="/hr" className="text-accent hover:underline text-sm">
            ← Назад к папкам
          </Link>
          <h2 className="text-xl font-semibold text-gray-900">
            {folderLoading ? 'Загрузка...' : folder ? folder.name : 'Папка'}
          </h2>
        </div>

        {folder && (
          <>
            <div className="flex items-center gap-2 mb-6">
              <button
                type="button"
                onClick={() => setShowImportForm(!showImportForm)}
                className="px-4 py-2 border border-gray-300 text-sm font-medium rounded hover:bg-gray-50"
              >
                {showImportForm ? 'Отмена' : 'Создать из файла'}
              </button>
              <button
                type="button"
                onClick={() => setShowListForm(!showListForm)}
                className="px-4 py-2 bg-accent text-white text-sm font-medium rounded hover:bg-accent-hover"
              >
                {showListForm ? 'Отмена' : 'Создать список'}
              </button>
            </div>

            {showImportForm && (
              <form onSubmit={handleCreateFromFile} className="mb-6 p-4 bg-white border border-gray-200 rounded-lg max-w-md">
                {listError && <p className="text-red-600 text-sm mb-2">{listError}</p>}
                <p className="text-sm text-gray-600 mb-3">Загрузите Excel: первая строка — заголовки колонок (названия полей), остальные — данные. Будет создан новый список с полями типа «Текст».</p>
                <div className="grid gap-3">
                  <input
                    ref={importFileRef}
                    type="file"
                    accept=".xlsx"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    onChange={() => setListError('')}
                  />
                  <input
                    type="text"
                    placeholder="Название списка (необязательно)"
                    value={importForm.name}
                    onChange={(e) => setImportForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  />
                  <input
                    type="number"
                    placeholder="Год (необязательно)"
                    value={importForm.year}
                    onChange={(e) => setImportForm((f) => ({ ...f, year: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  />
                </div>
                <button type="submit" disabled={importing} className="mt-3 px-4 py-2 bg-accent text-white text-sm rounded hover:bg-accent-hover disabled:opacity-50">
                  {importing ? 'Создание...' : 'Создать список из файла'}
                </button>
              </form>
            )}

            {showListForm && (
              <form onSubmit={handleCreateList} className="mb-6 p-4 bg-white border border-gray-200 rounded-lg max-w-md">
                {listError && <p className="text-red-600 text-sm mb-2">{listError}</p>}
                <div className="grid gap-3">
                  <input
                    type="text"
                    placeholder="Название списка"
                    value={listForm.name}
                    onChange={(e) => setListForm((f) => ({ ...f, name: e.target.value }))}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  />
                  <input
                    type="number"
                    placeholder="Год (необязательно)"
                    value={listForm.year}
                    onChange={(e) => setListForm((f) => ({ ...f, year: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  />
                </div>
                <button type="submit" className="mt-3 px-4 py-2 bg-accent text-white text-sm rounded hover:bg-accent-hover">
                  Создать
                </button>
              </form>
            )}

            {editingList && (
              <form onSubmit={handleUpdateList} className="mb-6 p-4 bg-white border border-gray-200 rounded-lg max-w-md">
                <h3 className="text-lg font-medium text-gray-900 mb-3">Редактировать список</h3>
                {listError && <p className="text-red-600 text-sm mb-2">{listError}</p>}
                <div className="grid gap-3">
                  <input
                    type="text"
                    placeholder="Название списка"
                    value={editListForm.name}
                    onChange={(e) => setEditListForm((f) => ({ ...f, name: e.target.value }))}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  />
                  <input
                    type="number"
                    placeholder="Год (необязательно)"
                    value={editListForm.year}
                    onChange={(e) => setEditListForm((f) => ({ ...f, year: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div className="mt-3 flex gap-2">
                  <button type="submit" className="px-4 py-2 bg-accent text-white text-sm rounded hover:bg-accent-hover">
                    Сохранить
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingList(null)}
                    className="px-4 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50"
                  >
                    Отмена
                  </button>
                </div>
              </form>
            )}

            <div className="mb-4 flex gap-2 items-center">
              <label className="text-sm text-gray-600">Фильтр по году:</label>
              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded text-sm"
              >
                <option value="">Все</option>
                {years.map((y) => (
                  <option key={y!} value={y!}>{y}</option>
                ))}
              </select>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              {folderLoading ? (
                <div className="p-8 text-center text-gray-500">Загрузка...</div>
              ) : filteredLists.length === 0 ? (
                <div className="p-8 text-center text-gray-500">Списков пока нет</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filteredLists.map((l) => (
                    <div key={l.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                      <Link to={`/hr/${l.id}`} className="text-accent hover:underline font-medium">
                        {l.name}
                        {l.year && <span className="ml-2 text-gray-500 font-normal">({l.year})</span>}
                      </Link>
                      <span className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditList(l)}
                          className="text-accent hover:underline text-sm"
                        >
                          Редактировать
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyList(l)}
                          className="text-accent hover:underline text-sm"
                        >
                          Копировать
                        </button>
                        {hasPerm('hr_delete_entries') && (
                          <button
                            type="button"
                            onClick={() => handleDeleteList(l.id)}
                            className="text-red-600 hover:underline text-sm"
                          >
                            Удалить
                          </button>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      <HrTabs active="lists" />
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">HR — Папки</h2>
        <button
          type="button"
          onClick={() => setShowFolderForm(!showFolderForm)}
          className="px-4 py-2 bg-accent text-white text-sm font-medium rounded hover:bg-accent-hover"
        >
          {showFolderForm ? 'Отмена' : 'Создать папку'}
        </button>
      </div>

      {showFolderForm && (
        <form onSubmit={handleCreateFolder} className="mb-6 p-4 bg-white border border-gray-200 rounded-lg max-w-md">
          {folderError && <p className="text-red-600 text-sm mb-2">{folderError}</p>}
          <div className="grid gap-3">
            <input
              type="text"
              placeholder="Название папки"
              value={folderFormName}
              onChange={(e) => setFolderFormName(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
          </div>
          <button type="submit" className="mt-3 px-4 py-2 bg-accent text-white text-sm rounded hover:bg-accent-hover">
            Создать
          </button>
        </form>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {foldersLoading ? (
          <div className="p-8 text-center text-gray-500">Загрузка...</div>
        ) : folders.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Папок пока нет. Создайте папку, чтобы добавлять в неё списки.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {folders.map((f) => (
              <div key={f.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                <Link to={`/hr/folder/${f.id}`} className="text-accent hover:underline font-medium flex items-center gap-2">
                  {f.name}
                  {f.lists !== undefined && (
                    <span className="text-gray-500 font-normal text-sm">({f.lists.length})</span>
                  )}
                </Link>
                {hasPerm('hr_delete_folders') && (
                  <button
                    type="button"
                    onClick={() => handleDeleteFolder(f.id)}
                    className="text-red-600 hover:underline text-sm"
                  >
                    Удалить папку
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
