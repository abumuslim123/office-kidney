import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

type HrList = {
  id: string;
  name: string;
  year: number | null;
  createdAt: string;
};

export default function HR() {
  const navigate = useNavigate();
  const [lists, setLists] = useState<HrList[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', year: '' });
  const [yearFilter, setYearFilter] = useState('');
  const [error, setError] = useState('');
  const [showImportForm, setShowImportForm] = useState(false);
  const [importForm, setImportForm] = useState({ name: '', year: '' });
  const [importing, setImporting] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const params = yearFilter ? { year: yearFilter } : {};
      const res = await api.get<HrList[]>('/hr/lists', { params });
      setLists(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [yearFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/hr/lists', {
        name: form.name,
        year: form.year ? parseInt(form.year, 10) : null,
      });
      setShowForm(false);
      setForm({ name: '', year: '' });
      load();
    } catch (err: unknown) {
      const data = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string | string[] } } }).response?.data
        : null;
      const msg = data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : (msg as string) || 'Ошибка создания');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить список и все записи?')) return;
    try {
      await api.delete(`/hr/lists/${id}`);
      load();
    } catch {}
  };

  const handleCreateFromFile = async (e: React.FormEvent) => {
    e.preventDefault();
    const file = importFileRef.current?.files?.[0];
    if (!file) {
      setError('Выберите файл');
      return;
    }
    setError('');
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const params = new URLSearchParams();
      if (importForm.name.trim()) params.set('name', importForm.name.trim());
      if (importForm.year.trim()) params.set('year', importForm.year.trim());
      const res = await api.post<HrList>(`/hr/lists/import?${params.toString()}`, formData);
      setShowImportForm(false);
      setImportForm({ name: '', year: '' });
      if (importFileRef.current) importFileRef.current.value = '';
      load();
      navigate(`/hr/${res.data.id}`);
    } catch (err: unknown) {
      const data = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string | string[] } } }).response?.data
        : null;
      const msg = data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : (msg as string) || 'Ошибка импорта');
    } finally {
      setImporting(false);
    }
  };

  const years = [...new Set(lists.map((l) => l.year).filter(Boolean))].sort((a, b) => (b || 0) - (a || 0));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">HR — Списки</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowImportForm(!showImportForm)}
            className="px-4 py-2 border border-gray-300 text-sm font-medium rounded hover:bg-gray-50"
          >
            {showImportForm ? 'Отмена' : 'Создать из файла'}
          </button>
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-accent text-white text-sm font-medium rounded hover:bg-accent-hover"
          >
            {showForm ? 'Отмена' : 'Создать список'}
          </button>
        </div>
      </div>

      {showImportForm && (
        <form onSubmit={handleCreateFromFile} className="mb-6 p-4 bg-white border border-gray-200 rounded-lg max-w-md">
          {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
          <p className="text-sm text-gray-600 mb-3">Загрузите Excel: первая строка — заголовки колонок (названия полей), остальные — данные. Будет создан новый список с полями типа «Текст».</p>
          <div className="grid gap-3">
            <input
              ref={importFileRef}
              type="file"
              accept=".xlsx"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              onChange={() => setError('')}
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

      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 p-4 bg-white border border-gray-200 rounded-lg max-w-md">
          {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
          <div className="grid gap-3">
            <input
              type="text"
              placeholder="Название списка"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
            <input
              type="number"
              placeholder="Год (необязательно)"
              value={form.year}
              onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
          </div>
          <button type="submit" className="mt-3 px-4 py-2 bg-accent text-white text-sm rounded hover:bg-accent-hover">
            Создать
          </button>
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
            <option key={y} value={y!}>{y}</option>
          ))}
        </select>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Загрузка...</div>
        ) : lists.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Списков пока нет</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {lists.map((l) => (
              <div key={l.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                <Link to={`/hr/${l.id}`} className="text-accent hover:underline font-medium">
                  {l.name}
                  {l.year && <span className="ml-2 text-gray-500 font-normal">({l.year})</span>}
                </Link>
                <button
                  type="button"
                  onClick={() => handleDelete(l.id)}
                  className="text-red-600 hover:underline text-sm"
                >
                  Удалить
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
