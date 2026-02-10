import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

const EMPLOYEES_LIST_ID = '46';
const DEFAULT_LIMIT = 25;
const SEARCH_DEBOUNCE_MS = 350;

type BitrixElement = Record<string, unknown> & { ID?: string; NAME?: string };

export default function Bitrix24Employees() {
  const navigate = useNavigate();
  const [elements, setElements] = useState<BitrixElement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(DEFAULT_LIMIT);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addName, setAddName] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');

  const load = useCallback(async (noCache = false, pageNum = 1, searchQuery = '') => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', String(pageNum));
      params.set('limit', String(limit));
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (noCache) params.set('_t', String(Date.now()));
      const url = `/bitrix24/lists/${EMPLOYEES_LIST_ID}/elements?${params.toString()}`;
      const r = await api.get<{ elements: BitrixElement[]; total: number; page: number; limit: number }>(url);
      setElements(Array.isArray(r.data?.elements) ? r.data.elements : []);
      setTotal(typeof r.data?.total === 'number' ? r.data.total : 0);
      setPage(r.data?.page ?? pageNum);
    } catch (err: unknown) {
      const data = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data
        : null;
      setError(data?.message || 'Ошибка загрузки списка');
      setElements([]);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    load(false, page, search);
  }, [page, search, load]);

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
      searchDebounceRef.current = null;
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchInput]);

  const handleDelete = async (elementId: string) => {
    if (!confirm('Удалить элемент?')) return;
    setDeletingId(elementId);
    try {
      await api.delete(
        `/bitrix24/lists/${EMPLOYEES_LIST_ID}/elements/${elementId}`
      );
      await load(false, page, search);
    } catch (err: unknown) {
      const data = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data
        : null;
      alert(data?.message || 'Ошибка удаления');
    } finally {
      setDeletingId(null);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    setAdding(true);
    try {
      await api.post(`/bitrix24/lists/${EMPLOYEES_LIST_ID}/elements`, {
        NAME: addName.trim(),
      });
      setShowAddForm(false);
      setAddName('');
      setPage(1);
      // Задержка и принудительная перезагрузка без кэша; новые сверху — показываем страницу 1
      await new Promise((r) => setTimeout(r, 500));
      await load(true, 1, search);
    } catch (err: unknown) {
      const data = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data
        : null;
      setAddError(data?.message || 'Ошибка добавления');
    } finally {
      setAdding(false);
    }
  };

  const columns = elements.length
    ? Object.keys(
        typeof elements[0] === 'object' && elements[0] !== null
          ? (elements[0] as Record<string, unknown>)
          : {}
      ).filter((k) => k !== 'ID' || true)
    : ['ID', 'NAME'];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          ← Назад
        </button>
        <h3 className="text-lg font-medium text-gray-900">Сотрудники (список Битрикс24)</h3>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Поиск</label>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="По имени…"
            className="border border-gray-300 rounded px-3 py-2 text-sm w-56"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="px-4 py-2 bg-accent text-white rounded text-sm font-medium"
        >
          Добавить
        </button>
      </div>

      {showAddForm && (
        <form
          onSubmit={handleAdd}
          className="bg-white border border-gray-200 rounded-lg p-4 flex flex-wrap items-end gap-3"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Название</label>
            <input
              type="text"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 text-sm w-64"
              required
            />
          </div>
          <button
            type="submit"
            disabled={adding}
            className="px-4 py-2 bg-accent text-white rounded text-sm disabled:opacity-50"
          >
            {adding ? 'Добавление…' : 'Сохранить'}
          </button>
          <button
            type="button"
            onClick={() => { setShowAddForm(false); setAddName(''); setAddError(''); }}
            className="px-4 py-2 border border-gray-300 rounded text-sm"
          >
            Отмена
          </button>
          {addError && <p className="text-sm text-red-600 w-full">{addError}</p>}
        </form>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-6 text-gray-500">Загрузка…</div>
        ) : error ? (
          <div className="p-6 text-red-600">{error}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col}
                      className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase"
                    >
                      {col}
                    </th>
                  ))}
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 w-24">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {elements.map((el) => {
                  const id = String(el.ID ?? el.id ?? '');
                  return (
                    <tr key={id}>
                      {columns.map((col) => (
                        <td key={col} className="px-4 py-2 text-sm text-gray-900">
                          {formatCell(el[col])}
                        </td>
                      ))}
                      <td className="px-4 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => handleDelete(id)}
                          disabled={deletingId === id}
                          className="text-red-600 hover:text-red-800 text-sm disabled:opacity-50"
                        >
                          {deletingId === id ? '…' : 'Удалить'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!loading && !error && elements.length === 0 && (
          <div className="p-6 text-gray-500">Элементов нет.</div>
        )}
      </div>

      {!loading && !error && total > 0 && (
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>
            Страница {page} из {Math.max(1, Math.ceil(total / limit))}
            {total > 0 && ` (всего ${total})`}
          </span>
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Назад
          </button>
          <button
            type="button"
            disabled={page >= Math.ceil(total / limit)}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Вперёд
          </button>
        </div>
      )}
    </div>
  );
}

function formatCell(val: unknown): string {
  if (val == null) return '';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}
