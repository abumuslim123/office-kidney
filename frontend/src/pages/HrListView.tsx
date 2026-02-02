import { useEffect, useState, useRef } from 'react';
import { useParams, Link, NavLink } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

type StatusOption = { label: string; color: string };

type FieldDef = {
  id: string;
  name: string;
  fieldType: 'text' | 'textarea' | 'date' | 'phone' | 'select' | 'status';
  options: string[] | StatusOption[] | null;
  order: number;
};

type HrList = {
  id: string;
  folderId?: string;
  name: string;
  year: number | null;
  fields: FieldDef[];
};

type HrEntry = {
  id: string;
  data: Record<string, unknown>;
  createdAt: string;
};

export default function HrListView() {
  const { listId } = useParams<{ listId: string }>();
  const { user } = useAuth();
  const hasPerm = (slug: string) => user?.permissions?.some((p) => p.slug === slug) ?? false;
  const [list, setList] = useState<HrList | null>(null);
  const [entries, setEntries] = useState<HrEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Forms
  const [showFieldForm, setShowFieldForm] = useState(false);
  const [fieldForm, setFieldForm] = useState({ name: '', fieldType: 'text' as FieldDef['fieldType'], options: '' });
  const [statusOptions, setStatusOptions] = useState<StatusOption[]>([]);
  const [editingField, setEditingField] = useState<FieldDef | null>(null);
  const [editFieldForm, setEditFieldForm] = useState({ name: '', fieldType: 'text' as FieldDef['fieldType'], options: '' });
  const [editStatusOptions, setEditStatusOptions] = useState<StatusOption[]>([]);
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [entryData, setEntryData] = useState<Record<string, string>>({});
  const [editingEntry, setEditingEntry] = useState<HrEntry | null>(null);

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; errors: string[] } | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [expandedCells, setExpandedCells] = useState<Set<string>>(new Set());

  const getEntriesParams = () => {
    const params: Record<string, string> = {};
    if (search) params.search = search;
    for (const [k, v] of Object.entries(filters)) {
      if (v && v.trim()) params[`f_${k}`] = v.trim();
    }
    return params;
  };

  const load = async () => {
    if (!listId) return;
    setLoading(true);
    try {
      const [listRes, entriesRes] = await Promise.all([
        api.get<HrList>(`/hr/lists/${listId}`),
        api.get<HrEntry[]>(`/hr/lists/${listId}/entries`, { params: getEntriesParams() }),
      ]);
      setList(listRes.data);
      setEntries(entriesRes.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [listId]);

  // Serialize filters to string for stable dependency comparison
  const filtersKey = JSON.stringify(filters);

  useEffect(() => {
    if (listId) {
      // Parse filters from serialized key to avoid stale closure
      const currentFilters: Record<string, string> = JSON.parse(filtersKey);
      const params: Record<string, string> = {};
      if (search) params.search = search;
      for (const [k, v] of Object.entries(currentFilters)) {
        if (v && v.trim()) params[`f_${k}`] = v.trim();
      }
      console.log('[HrListView] fetching entries with params:', params);
      api.get<HrEntry[]>(`/hr/lists/${listId}/entries`, { params })
        .then((res) => setEntries(res.data));
    }
  }, [search, filtersKey, listId]);

  // ========== Fields ==========

  const handleAddField = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const options =
        fieldForm.fieldType === 'select' && fieldForm.options
          ? fieldForm.options.split(',').map((s) => s.trim()).filter(Boolean)
          : fieldForm.fieldType === 'status' && statusOptions.length > 0
            ? statusOptions
            : null;
      await api.post(`/hr/lists/${listId}/fields`, {
        name: fieldForm.name,
        fieldType: fieldForm.fieldType,
        options,
      });
      setFieldForm({ name: '', fieldType: 'text', options: '' });
      setStatusOptions([]);
      setShowFieldForm(false);
      load();
    } catch (err: unknown) {
      const data = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string | string[] } } }).response?.data
        : null;
      const msg = data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : (msg as string) || 'Ошибка');
    }
  };

  const addStatusOption = () => setStatusOptions((prev) => [...prev, { label: '', color: '#6b7280' }]);
  const updateStatusOption = (i: number, key: 'label' | 'color', value: string) => {
    setStatusOptions((prev) => prev.map((o, j) => (j === i ? { ...o, [key]: value } : o)));
  };
  const removeStatusOption = (i: number) => setStatusOptions((prev) => prev.filter((_, j) => j !== i));

  const handleDeleteField = async (fieldId: string) => {
    if (!confirm('Удалить поле?')) return;
    await api.delete(`/hr/fields/${fieldId}`);
    load();
  };

  const handleMoveField = async (fieldId: string, direction: 'up' | 'down') => {
    const idx = fields.findIndex((f) => f.id === fieldId);
    if (idx < 0) return;
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= fields.length) return;
    const other = fields[newIdx];
    try {
      await api.put(`/hr/fields/${fieldId}`, { order: other.order });
      await api.put(`/hr/fields/${other.id}`, { order: fields[idx].order });
      load();
    } catch {}
  };

  const startEditingField = (f: FieldDef) => {
    setEditingField(f);
    setEditFieldForm({
      name: f.name,
      fieldType: f.fieldType,
      options: f.fieldType === 'select' && Array.isArray(f.options) && f.options.length > 0 && typeof f.options[0] === 'string'
        ? (f.options as string[]).join(', ')
        : '',
    });
    setEditStatusOptions(
      f.fieldType === 'status' && Array.isArray(f.options) && f.options.length > 0 && typeof f.options[0] === 'object'
        ? (f.options as StatusOption[]).map((o) => ({ label: o.label, color: o.color }))
        : [],
    );
  };

  const addEditStatusOption = () => setEditStatusOptions((prev) => [...prev, { label: '', color: '#6b7280' }]);
  const updateEditStatusOption = (i: number, key: 'label' | 'color', value: string) => {
    setEditStatusOptions((prev) => prev.map((o, j) => (j === i ? { ...o, [key]: value } : o)));
  };
  const removeEditStatusOption = (i: number) => setEditStatusOptions((prev) => prev.filter((_, j) => j !== i));

  const handleUpdateField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingField) return;
    setError('');
    try {
      const options =
        editFieldForm.fieldType === 'select' && editFieldForm.options
          ? editFieldForm.options.split(',').map((s) => s.trim()).filter(Boolean)
          : editFieldForm.fieldType === 'status' && editStatusOptions.length > 0
            ? editStatusOptions
            : undefined;
      await api.put(`/hr/fields/${editingField.id}`, {
        name: editFieldForm.name,
        fieldType: editFieldForm.fieldType,
        ...(options !== undefined && { options }),
      });
      setEditingField(null);
      load();
    } catch (err: unknown) {
      const data = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string | string[] } } }).response?.data
        : null;
      const msg = data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : (msg as string) || 'Ошибка');
    }
  };

  const formatDate = (value: unknown): string => {
    if (!value) return '—';
    const str = String(value);
    // Already in dd.mm.yyyy format
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(str)) {
      return str;
    }
    // ISO format (yyyy-mm-dd)
    const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      return `${isoMatch[3]}.${isoMatch[2]}.${isoMatch[1]}`;
    }
    // JS Date string (e.g., "Thu Dec 12 2024 00:00:00 GMT+0000")
    const jsDateMatch = str.match(/^\w{3}\s+(\w{3})\s+(\d{1,2})\s+(\d{4})/);
    if (jsDateMatch) {
      const months: Record<string, string> = {
        Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
        Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
      };
      const day = jsDateMatch[2].padStart(2, '0');
      const month = months[jsDateMatch[1]] || '01';
      const year = jsDateMatch[3];
      return `${day}.${month}.${year}`;
    }
    return str;
  };

  const toggleCellExpand = (cellKey: string) => {
    setExpandedCells((prev) => {
      const next = new Set(prev);
      if (next.has(cellKey)) {
        next.delete(cellKey);
      } else {
        next.add(cellKey);
      }
      return next;
    });
  };

  // ========== Entries ==========

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (editingEntry) {
        await api.put(`/hr/entries/${editingEntry.id}`, { data: entryData });
      } else {
        await api.post(`/hr/lists/${listId}/entries`, { data: entryData });
      }
      setEntryData({});
      setShowEntryForm(false);
      setEditingEntry(null);
      load();
    } catch (err: unknown) {
      const data = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string | string[] } } }).response?.data
        : null;
      const msg = data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : (msg as string) || 'Ошибка');
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!confirm('Удалить запись?')) return;
    await api.delete(`/hr/entries/${entryId}`);
    load();
  };

  const handleDeleteAllEntries = async () => {
    if (!listId) return;
    if (!confirm(`Удалить ВСЕ записи из списка? Это действие необратимо!`)) return;
    try {
      const res = await api.delete<{ deleted: number }>(`/hr/lists/${listId}/entries`);
      setError('');
      alert(`Удалено записей: ${res.data.deleted}`);
      load();
    } catch {
      setError('Ошибка при удалении записей');
    }
  };

  const startEditEntry = (entry: HrEntry) => {
    const data: Record<string, string> = {};
    for (const [k, v] of Object.entries(entry.data)) {
      data[k] = String(v ?? '');
    }
    setEntryData(data);
    setEditingEntry(entry);
    setShowEntryForm(true);
  };

  const handleExport = async () => {
    if (!listId) return;
    setExporting(true);
    try {
      const res = await api.get(`/hr/lists/${listId}/export`, {
        params: getEntriesParams(),
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      const contentDisposition = res.headers['content-disposition'];
      let filename = 'export.xlsx';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?(.+)"?/);
        if (match) filename = decodeURIComponent(match[1]);
      }
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setError('Ошибка экспорта');
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    if (!listId) return;
    try {
      const res = await api.get(`/hr/lists/${listId}/template`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      const contentDisposition = res.headers['content-disposition'];
      let filename = 'template.xlsx';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?(.+)"?/);
        if (match) filename = decodeURIComponent(match[1]);
      }
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setError('Ошибка загрузки шаблона');
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !listId) return;
    setImporting(true);
    setImportResult(null);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post<{ imported: number; errors: string[] }>(`/hr/lists/${listId}/import`, formData);
      setImportResult(res.data);
      load();
    } catch (err: unknown) {
      const data = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string | string[] } } }).response?.data
        : null;
      const msg = data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : (msg as string) || 'Ошибка импорта');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const fields = list?.fields?.sort((a, b) => a.order - b.order) || [];

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Загрузка...</div>;
  }

  if (!list) {
    return <div className="p-8 text-center text-red-600">Список не найден</div>;
  }

  return (
    <div>
      <div className="flex gap-2 mb-4 border-b border-gray-200 pb-2">
        <NavLink
          to="/hr"
          end
          className={({ isActive }) =>
            `px-3 py-2 rounded text-sm font-medium ${isActive ? 'bg-accent text-white' : 'text-gray-600 hover:bg-gray-100'}`
          }
        >
          Списки
        </NavLink>
        <NavLink
          to="/hr/events"
          className={({ isActive }) =>
            `px-3 py-2 rounded text-sm font-medium ${isActive ? 'bg-accent text-white' : 'text-gray-600 hover:bg-gray-100'}`
          }
        >
          План мероприятий
        </NavLink>
      </div>
      <div className="mb-4">
        {list.folderId ? (
          <Link to={`/hr/folder/${list.folderId}`} className="text-accent hover:underline text-sm">&larr; Назад в папку</Link>
        ) : (
          <Link to="/hr" className="text-accent hover:underline text-sm">&larr; Назад к спискам</Link>
        )}
      </div>

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">
          {list.name}
          {list.year && <span className="ml-2 text-gray-500 font-normal">({list.year})</span>}
        </h2>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleDownloadTemplate}
            disabled={fields.length === 0}
            className="px-3 py-1.5 border border-gray-300 text-sm rounded hover:bg-gray-50 disabled:opacity-50"
          >
            Скачать шаблон
          </button>
          <input
            ref={importFileRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={handleImportFile}
          />
          {hasPerm('hr_edit_entries') && (
            <button
              type="button"
              onClick={() => importFileRef.current?.click()}
              disabled={importing || fields.length === 0}
              className="px-3 py-1.5 border border-gray-300 text-sm rounded hover:bg-gray-50 disabled:opacity-50"
            >
              {importing ? 'Импорт...' : 'Импорт'}
            </button>
          )}
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || fields.length === 0}
            className="px-3 py-1.5 border border-gray-300 text-sm rounded hover:bg-gray-50 disabled:opacity-50"
          >
            {exporting ? 'Экспорт...' : 'Экспорт Excel'}
          </button>
          {hasPerm('hr_delete_all_entries') && (
            <button
              type="button"
              onClick={handleDeleteAllEntries}
              disabled={entries.length === 0}
              className="px-3 py-1.5 border border-red-300 text-red-600 text-sm rounded hover:bg-red-50 disabled:opacity-50"
            >
              Удалить все
            </button>
          )}
          {(hasPerm('hr_manage_fields') || hasPerm('hr_edit_fields') || hasPerm('hr_delete_fields')) && (
            <button
              type="button"
              onClick={() => setShowFieldForm(!showFieldForm)}
              className="px-3 py-1.5 border border-gray-300 text-sm rounded hover:bg-gray-50"
            >
              {showFieldForm ? 'Отмена' : 'Настроить поля'}
            </button>
          )}
          {hasPerm('hr_edit_entries') && (
            <button
              type="button"
              onClick={() => {
                setEditingEntry(null);
                setEntryData({});
                setShowEntryForm(!showEntryForm);
              }}
              className="px-4 py-2 bg-accent text-white text-sm font-medium rounded hover:bg-accent-hover"
            >
              {showEntryForm && !editingEntry ? 'Отмена' : 'Добавить запись'}
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
      {importResult && (
        <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded text-sm">
          <p className="text-gray-800">Импортировано записей: {importResult.imported}</p>
          {importResult.errors?.length > 0 && (
            <ul className="mt-2 text-red-600 list-disc list-inside">
              {importResult.errors.slice(0, 10).map((err, i) => (
                <li key={i}>{err}</li>
              ))}
              {importResult.errors.length > 10 && (
                <li>… и ещё {importResult.errors.length - 10} ошибок</li>
              )}
            </ul>
          )}
        </div>
      )}

      {/* Field management */}
      {showFieldForm && (
        <div className="mb-6 p-4 bg-white border border-gray-200 rounded-lg">
          <h3 className="font-medium text-gray-800 mb-3">Поля списка</h3>
          {fields.length > 0 && (
            <div className="mb-4 space-y-2">
              {fields.map((f, idx) => (
                <div key={f.id} className="flex items-center gap-3 text-sm bg-gray-50 px-3 py-2 rounded">
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      onClick={() => handleMoveField(f.id, 'up')}
                      disabled={idx === 0}
                      className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs leading-none"
                      title="Вверх"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveField(f.id, 'down')}
                      disabled={idx === fields.length - 1}
                      className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs leading-none"
                      title="Вниз"
                    >
                      ▼
                    </button>
                  </div>
                  <span className="font-medium">{f.name}</span>
                  <span className="text-gray-500">({f.fieldType})</span>
                  {f.options && (
                    <span className="text-gray-400">
                      [{Array.isArray(f.options) && f.options.length > 0 && typeof f.options[0] === 'object'
                        ? (f.options as StatusOption[]).map((o) => o.label).join(', ')
                        : (f.options as string[]).join(', ')}]
                    </span>
                  )}
                  {(hasPerm('hr_manage_fields') || hasPerm('hr_edit_fields')) && (
                    <button
                      type="button"
                      onClick={() => startEditingField(f)}
                      className="text-accent hover:underline text-sm"
                    >
                      Редактировать
                    </button>
                  )}
                  {(hasPerm('hr_manage_fields') || hasPerm('hr_delete_fields')) && (
                    <button
                      type="button"
                      onClick={() => handleDeleteField(f.id)}
                      className="text-red-600 hover:underline ml-auto"
                    >
                      Удалить
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Edit field form */}
          {editingField && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-medium text-gray-800 mb-2">Редактировать поле</h4>
              <form onSubmit={handleUpdateField} className="flex flex-col gap-3">
                <div className="flex gap-2 items-end flex-wrap">
                  <div>
                    <label className="text-xs text-gray-600">Название</label>
                    <input
                      type="text"
                      value={editFieldForm.name}
                      onChange={(e) => setEditFieldForm((f) => ({ ...f, name: e.target.value }))}
                      required
                      className="w-40 px-2 py-1 border border-gray-300 rounded text-sm ml-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Тип</label>
                    <select
                      value={editFieldForm.fieldType}
                      onChange={(e) => setEditFieldForm((f) => ({ ...f, fieldType: e.target.value as FieldDef['fieldType'] }))}
                      className="px-2 py-1 border border-gray-300 rounded text-sm ml-1"
                    >
                      <option value="text">Текст</option>
                      <option value="textarea">Текст (многострочный)</option>
                      <option value="date">Дата</option>
                      <option value="phone">Телефон</option>
                      <option value="select">Выбор</option>
                      <option value="status">Статус</option>
                    </select>
                  </div>
                  {editFieldForm.fieldType === 'select' && (
                    <div>
                      <label className="text-xs text-gray-600">Варианты (через запятую)</label>
                      <input
                        type="text"
                        value={editFieldForm.options}
                        onChange={(e) => setEditFieldForm((f) => ({ ...f, options: e.target.value }))}
                        placeholder="Да, Нет"
                        className="w-48 px-2 py-1 border border-gray-300 rounded text-sm ml-1"
                      />
                    </div>
                  )}
                </div>
                {editFieldForm.fieldType === 'status' && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-600">Варианты статуса (название + цвет)</span>
                      <button type="button" onClick={addEditStatusOption} className="text-accent hover:underline text-sm">
                        + Добавить
                      </button>
                    </div>
                    {editStatusOptions.map((opt, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={opt.label}
                          onChange={(e) => updateEditStatusOption(i, 'label', e.target.value)}
                          placeholder="Название"
                          className="w-32 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                        <input
                          type="color"
                          value={opt.color}
                          onChange={(e) => updateEditStatusOption(i, 'color', e.target.value)}
                          className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
                          title="Цвет"
                        />
                        <button type="button" onClick={() => removeEditStatusOption(i)} className="text-red-600 hover:underline text-sm">
                          Удалить
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <button type="submit" className="px-3 py-1.5 bg-accent text-white text-sm rounded hover:bg-accent-hover">
                    Сохранить
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingField(null)}
                    className="px-3 py-1.5 border border-gray-300 text-sm rounded hover:bg-gray-50"
                  >
                    Отмена
                  </button>
                </div>
              </form>
            </div>
          )}

          <form onSubmit={handleAddField} className="flex gap-2 items-end flex-wrap">
            <div>
              <label className="text-xs text-gray-600">Название</label>
              <input
                type="text"
                value={fieldForm.name}
                onChange={(e) => setFieldForm((f) => ({ ...f, name: e.target.value }))}
                required
                className="w-40 px-2 py-1 border border-gray-300 rounded text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600">Тип</label>
              <select
                value={fieldForm.fieldType}
                onChange={(e) => setFieldForm((f) => ({ ...f, fieldType: e.target.value as FieldDef['fieldType'] }))}
                className="px-2 py-1 border border-gray-300 rounded text-sm"
              >
                <option value="text">Текст</option>
                <option value="textarea">Текст (многострочный)</option>
                <option value="date">Дата</option>
                <option value="phone">Телефон</option>
                <option value="select">Выбор</option>
                <option value="status">Статус</option>
              </select>
            </div>
            {fieldForm.fieldType === 'select' && (
              <div>
                <label className="text-xs text-gray-600">Варианты (через запятую)</label>
                <input
                  type="text"
                  value={fieldForm.options}
                  onChange={(e) => setFieldForm((f) => ({ ...f, options: e.target.value }))}
                  placeholder="Да, Нет"
                  className="w-48 px-2 py-1 border border-gray-300 rounded text-sm"
                />
              </div>
            )}
            {fieldForm.fieldType === 'status' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600">Варианты статуса (название + цвет)</span>
                  <button type="button" onClick={addStatusOption} className="text-accent hover:underline text-sm">
                    + Добавить
                  </button>
                </div>
                {statusOptions.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={opt.label}
                      onChange={(e) => updateStatusOption(i, 'label', e.target.value)}
                      placeholder="Название"
                      className="w-32 px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                    <input
                      type="color"
                      value={opt.color}
                      onChange={(e) => updateStatusOption(i, 'color', e.target.value)}
                      className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
                      title="Цвет"
                    />
                    <button type="button" onClick={() => removeStatusOption(i)} className="text-red-600 hover:underline text-sm">
                      Удалить
                    </button>
                  </div>
                ))}
              </div>
            )}
            {(hasPerm('hr_manage_fields') || hasPerm('hr_edit_fields')) && (
              <button type="submit" className="px-3 py-1.5 bg-accent text-white text-sm rounded hover:bg-accent-hover">
                Добавить поле
              </button>
            )}
          </form>
        </div>
      )}

      {/* Entry form */}
      {showEntryForm && fields.length > 0 && (
        <form onSubmit={handleAddEntry} className="mb-6 p-4 bg-white border border-gray-200 rounded-lg">
          <h3 className="font-medium text-gray-800 mb-3">
            {editingEntry ? 'Редактировать запись' : 'Новая запись'}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {fields.map((f) => (
              <div key={f.id} className={f.fieldType === 'textarea' ? 'sm:col-span-2 lg:col-span-1' : ''}>
                <label className="text-xs text-gray-600">{f.name}</label>
                {f.fieldType === 'select' && Array.isArray(f.options) && f.options.length > 0 && typeof f.options[0] === 'string' ? (
                  <select
                    value={entryData[f.name] || ''}
                    onChange={(e) => setEntryData((d) => ({ ...d, [f.name]: e.target.value }))}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                  >
                    <option value="">—</option>
                    {(f.options as string[]).map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : f.fieldType === 'status' && Array.isArray(f.options) && f.options.length > 0 && typeof f.options[0] === 'object' ? (
                  <select
                    value={entryData[f.name] || ''}
                    onChange={(e) => setEntryData((d) => ({ ...d, [f.name]: e.target.value }))}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                  >
                    <option value="">—</option>
                    {(f.options as StatusOption[]).map((opt) => (
                      <option key={opt.label} value={opt.label}>{opt.label}</option>
                    ))}
                  </select>
                ) : f.fieldType === 'date' ? (
                  <input
                    type="date"
                    value={entryData[f.name] || ''}
                    onChange={(e) => setEntryData((d) => ({ ...d, [f.name]: e.target.value }))}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                  />
                ) : f.fieldType === 'phone' ? (
                  <input
                    type="tel"
                    value={entryData[f.name] || ''}
                    onChange={(e) => setEntryData((d) => ({ ...d, [f.name]: e.target.value }))}
                    placeholder="+7 999 123-45-67"
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                  />
                ) : f.fieldType === 'textarea' ? (
                  <textarea
                    value={entryData[f.name] || ''}
                    onChange={(e) => setEntryData((d) => ({ ...d, [f.name]: e.target.value }))}
                    rows={4}
                    className="max-w-md w-full px-2 py-1.5 border border-gray-300 rounded text-sm resize-y"
                  />
                ) : (
                  <input
                    type="text"
                    value={entryData[f.name] || ''}
                    onChange={(e) => setEntryData((d) => ({ ...d, [f.name]: e.target.value }))}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <button type="submit" className="px-4 py-2 bg-accent text-white text-sm rounded hover:bg-accent-hover">
              {editingEntry ? 'Сохранить' : 'Добавить'}
            </button>
            {editingEntry && (
              <button
                type="button"
                onClick={() => {
                  setEditingEntry(null);
                  setEntryData({});
                  setShowEntryForm(false);
                }}
                className="px-4 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50"
              >
                Отмена
              </button>
            )}
          </div>
        </form>
      )}

      {/* Search */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="Поиск..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded text-sm"
        />
        {fields.length > 0 && (
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className="px-3 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50"
          >
            Фильтры
            {(Object.keys(filters).some((k) => filters[k]?.trim()) || search) && (
              <span className="ml-1 text-accent">•</span>
            )}
          </button>
        )}
      </div>

      {/* Filters by fields */}
      {fields.length > 0 && showFilters && (
        <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium text-gray-700">Фильтры по полям</span>
            {(Object.keys(filters).some((k) => filters[k]?.trim()) || search) && (
              <button
                type="button"
                onClick={() => {
                  setFilters({});
                  setSearch('');
                }}
                className="text-sm text-gray-600 hover:text-gray-800 underline"
              >
                Сбросить фильтры
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {fields.map((f) => (
              <div key={f.id} className="flex flex-col gap-0.5">
                <label className="text-xs text-gray-600">{f.name}</label>
                <input
                  type="text"
                  value={filters[f.name] ?? ''}
                  onChange={(e) => setFilters((prev) => ({ ...prev, [f.name]: e.target.value }))}
                  placeholder={`Фильтр по ${f.name}`}
                  className="w-full max-w-xs px-2 py-1.5 border border-gray-300 rounded text-sm"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Entries table */}
      {fields.length === 0 ? (
        <div className="p-8 text-center text-gray-500 bg-white border border-gray-200 rounded-lg">
          Сначала добавьте поля в список
        </div>
      ) : entries.length === 0 ? (
        <div className="p-8 text-center text-gray-500 bg-white border border-gray-200 rounded-lg">
          Записей пока нет
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gray-100 border-b-2 border-gray-300">
              <tr>
                {fields.map((f) => (
                  <th key={f.id} className="text-left px-4 py-3 font-medium text-gray-700 whitespace-nowrap border-r border-gray-200 last:border-r-0">
                    {f.name}
                  </th>
                ))}
                <th className="text-left px-4 py-3 font-medium text-gray-700">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {entries.map((entry, idx) => (
                <tr key={entry.id} className={`hover:bg-blue-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                  {fields.map((f) => {
                    const cellKey = `${entry.id}-${f.id}`;
                    const isExpanded = expandedCells.has(cellKey);
                    const value = entry.data[f.name];
                    const strValue = String(value ?? '');

                    return (
                      <td
                        key={f.id}
                        className={`px-4 py-3 border-r border-gray-100 last:border-r-0 ${f.fieldType === 'textarea' ? 'max-w-xs align-top' : 'whitespace-nowrap'}`}
                      >
                        {f.fieldType === 'status' && Array.isArray(f.options) && f.options.length > 0 && typeof f.options[0] === 'object' ? (
                          (() => {
                            const label = strValue;
                            const opt = (f.options as StatusOption[]).find((o) => o.label === label);
                            if (!label) return '—';
                            return (
                              <span
                                className="inline-block px-2 py-0.5 rounded text-xs text-white"
                                style={{ backgroundColor: opt?.color ?? '#6b7280' }}
                              >
                                {label}
                              </span>
                            );
                          })()
                        ) : f.fieldType === 'date' ? (
                          formatDate(value)
                        ) : f.fieldType === 'textarea' ? (
                          <div
                            className={`cursor-pointer ${isExpanded ? 'whitespace-pre-wrap' : 'truncate max-w-xs'}`}
                            onClick={() => toggleCellExpand(cellKey)}
                            title={isExpanded ? 'Свернуть' : 'Развернуть'}
                          >
                            {strValue || '—'}
                          </div>
                        ) : (
                          strValue || '—'
                        )}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 whitespace-nowrap">
                    {hasPerm('hr_edit_entries') && (
                      <button
                        type="button"
                        onClick={() => startEditEntry(entry)}
                        className="text-accent hover:underline mr-3"
                      >
                        Изменить
                      </button>
                    )}
                    {hasPerm('hr_delete_entries') && (
                      <button
                        type="button"
                        onClick={() => handleDeleteEntry(entry.id)}
                        className="text-red-600 hover:underline"
                      >
                        Удалить
                      </button>
                    )}
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
