import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { ResumeCandidate } from '../lib/resume-types';
import { formatDateTime } from '../lib/resume-constants';

export default function ResumeTrashPage() {
  const [candidates, setCandidates] = useState<ResumeCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: ResumeCandidate[]; total: number }>('/resume/candidates', {
        params: { priority: 'DELETED', page, limit },
      });
      setCandidates(res.data.data);
      setTotal(res.data.total);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  const restore = async (id: string) => {
    try {
      await api.patch(`/resume/candidates/${id}`, { priority: 'ACTIVE' });
      load();
    } catch {
      /* ignore */
    }
  };

  const hardDelete = async (id: string) => {
    if (!confirm('Удалить кандидата безвозвратно?')) return;
    try {
      await api.delete(`/resume/candidates/${id}`);
      load();
    } catch {
      /* ignore */
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">
        Корзина <span className="text-sm font-normal text-gray-400">({total})</span>
      </h2>

      {loading ? (
        <p className="text-sm text-gray-400">Загрузка...</p>
      ) : candidates.length === 0 ? (
        <p className="text-sm text-gray-400">Корзина пуста</p>
      ) : (
        <>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200">
                  <th className="text-left px-4 py-2 font-medium text-gray-600">ФИО</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Специализация</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Причина</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Дата удаления</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {candidates.map((c) => {
                  const isDuplicate = (c.tags || []).some((t) => t.label === 'Дубликат');
                  return (
                    <tr key={c.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-2">
                        <Link to={`/hr/resume/candidates/${c.id}`} className="text-accent hover:underline">
                          {c.fullName || '—'}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-gray-600">{c.specialization || '—'}</td>
                      <td className="px-4 py-2">
                        {isDuplicate ? (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            Дубликат
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">Вручную</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-gray-400">{formatDateTime(c.updatedAt)}</td>
                      <td className="px-4 py-2 text-right space-x-3">
                        <button
                          type="button"
                          onClick={() => restore(c.id)}
                          className="text-xs text-accent hover:underline"
                        >
                          Восстановить
                        </button>
                        <button
                          type="button"
                          onClick={() => hardDelete(c.id)}
                          className="text-xs text-red-600 hover:underline"
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

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
              >
                Назад
              </button>
              <span className="text-sm text-gray-500">
                {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
              >
                Далее
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
