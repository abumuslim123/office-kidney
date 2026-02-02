import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { publicApi } from '../lib/api';

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
  name: string;
  year: number | null;
  fields: FieldDef[];
};

type HrEntry = {
  id: string;
  data: Record<string, unknown>;
  createdAt: string;
};

function formatDate(value: unknown): string {
  if (!value) return '—';
  const str = String(value);
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(str)) return str;
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[3]}.${isoMatch[2]}.${isoMatch[1]}`;
  const jsDateMatch = str.match(/^\w{3}\s+(\w{3})\s+(\d{1,2})\s+(\d{4})/);
  if (jsDateMatch) {
    const months: Record<string, string> = {
      Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
      Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
    };
    const day = jsDateMatch[2].padStart(2, '0');
    const month = months[jsDateMatch[1]] || '01';
    return `${day}.${month}.${jsDateMatch[3]}`;
  }
  return str;
}

export default function HrListsPublic() {
  const { token } = useParams<{ token: string }>();
  const [list, setList] = useState<HrList | null>(null);
  const [entries, setEntries] = useState<HrEntry[]>([]);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [entryDetailModal, setEntryDetailModal] = useState<HrEntry | null>(null);

  useEffect(() => {
    if (!token) {
      setAccessError('Ссылка недействительна');
      setLoading(false);
      return;
    }
    setLoading(true);
    setAccessError(null);
    publicApi
      .get<HrList>(`/public/lists/${token}`)
      .then((res) => setList(res.data))
      .catch(() => setAccessError('Доступ отключён или ссылка недействительна'))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!token || !list) {
      setEntries([]);
      return;
    }
    publicApi
      .get<HrEntry[]>(`/public/lists/${token}/entries`, { params: search ? { search } : {} })
      .then((res) => setEntries(res.data))
      .catch(() => setEntries([]));
  }, [token, list?.id, search]);

  const fields = list?.fields ?? [];
  const sortedFields = [...fields].sort((a, b) => a.order - b.order);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="p-6 bg-white border border-gray-200 rounded-lg shadow">
          <p className="text-gray-700">Ссылка недействительна</p>
        </div>
      </div>
    );
  }

  if (accessError && !loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="p-6 bg-white border border-gray-200 rounded-lg shadow">
          <p className="text-gray-700">{accessError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-xl font-semibold text-gray-900 mb-6">Список</h1>

        {loading ? (
          <div className="p-8 text-center text-gray-500">Загрузка...</div>
        ) : list ? (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-900">
                {list.name}
                {list.year != null && <span className="ml-2 text-gray-500 font-normal">({list.year})</span>}
              </h2>
            </div>
            <div className="mb-4">
              <input
                type="text"
                placeholder="Поиск..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded text-sm"
              />
            </div>
            {sortedFields.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500">
                В списке нет полей
              </div>
            ) : entries.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500">
                Записей нет
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead className="bg-gray-100 border-b-2 border-gray-300">
                    <tr>
                      {sortedFields.map((f) => (
                        <th
                          key={f.id}
                          className="text-left px-4 py-3 font-medium text-gray-700 whitespace-nowrap border-r border-gray-200 last:border-r-0"
                        >
                          {f.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {entries.map((entry, idx) => (
                      <tr
                        key={entry.id}
                        className={`cursor-pointer ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-gray-100`}
                        onDoubleClick={() => setEntryDetailModal(entry)}
                      >
                        {sortedFields.map((f) => {
                          const value = entry.data[f.name];
                          const strValue = String(value ?? '');
                          return (
                            <td
                              key={f.id}
                              className={`px-4 py-3 border-r border-gray-100 last:border-r-0 ${
                                f.fieldType === 'textarea' ? 'max-w-xs align-top' : 'whitespace-nowrap'
                              }`}
                            >
                              {f.fieldType === 'status' &&
                              Array.isArray(f.options) &&
                              f.options.length > 0 &&
                              typeof f.options[0] === 'object' ? (
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
                                <div className="truncate max-w-xs" title={strValue}>
                                  {strValue || '—'}
                                </div>
                              ) : (
                                strValue || '—'
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {entryDetailModal && list && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
                onClick={() => setEntryDetailModal(null)}
                role="dialog"
                aria-modal="true"
                aria-labelledby="entry-detail-title-public"
              >
                <div
                  className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                    <h2 id="entry-detail-title-public" className="text-lg font-medium text-gray-900">Подробнее</h2>
                    <button
                      type="button"
                      onClick={() => setEntryDetailModal(null)}
                      className="px-3 py-1.5 border border-gray-300 text-sm rounded hover:bg-gray-50"
                    >
                      Закрыть
                    </button>
                  </div>
                  <div className="px-4 py-3 overflow-y-auto flex-1">
                    <dl className="space-y-3">
                      {sortedFields.map((f) => {
                        const value = entryDetailModal.data[f.name];
                        const strValue = String(value ?? '');
                        return (
                          <div key={f.id}>
                            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">{f.name}</dt>
                            <dd className="mt-0.5 text-sm text-gray-900">
                              {f.fieldType === 'status' &&
                              Array.isArray(f.options) &&
                              f.options.length > 0 &&
                              typeof f.options[0] === 'object' ? (
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
                                <pre className="whitespace-pre-wrap font-sans text-sm">{strValue || '—'}</pre>
                              ) : (
                                strValue || '—'
                              )}
                            </dd>
                          </div>
                        );
                      })}
                    </dl>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
