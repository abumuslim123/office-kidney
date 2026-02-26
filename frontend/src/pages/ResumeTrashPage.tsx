import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { formatDate } from '../lib/resume-constants';
import type { CandidateRow } from '../lib/resume-types';

export default function ResumeTrashPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const page = Number(searchParams.get('page')) || 1;
  const search = searchParams.get('search') || '';
  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const loadCandidates = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: pageSize, priority: 'DELETED' };
      if (search) params.search = search;
      const res = await api.get<{ candidates: CandidateRow[]; total: number }>('/resume/candidates', { params });
      setCandidates(res.data.candidates);
      setTotal(res.data.total);
    } catch { /* */ } finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { loadCandidates(); }, [loadCandidates]);

  async function handleRestore(id: string) {
    await api.put(`/resume/candidates/${id}`, { priority: 'ACTIVE' });
    loadCandidates();
  }

  async function handlePermanentDelete(id: string) {
    if (!confirm('Полностью удалить кандидата? Это действие необратимо.')) return;
    await api.delete(`/resume/candidates/${id}`);
    loadCandidates();
  }

  function goToPage(p: number) {
    const params = new URLSearchParams(searchParams);
    if (p <= 1) params.delete('page'); else params.set('page', String(p));
    setSearchParams(params, { replace: true });
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Корзина</h1>
        <p className="text-sm text-gray-500 mt-1">{total} {total === 1 ? 'кандидат' : 'кандидатов'} в корзине</p>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Поиск по ФИО..."
          value={search}
          onChange={(e) => {
            const params = new URLSearchParams(searchParams);
            if (e.target.value) params.set('search', e.target.value); else params.delete('search');
            params.delete('page');
            setSearchParams(params, { replace: true });
          }}
          className="flex-1 max-w-md px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">ФИО</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Специализация</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Дата удаления</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">Загрузка...</td></tr>
              ) : candidates.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">Корзина пуста</td></tr>
              ) : candidates.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link to={`/hr/resume/candidates/${c.id}`} className="font-medium text-indigo-600 hover:text-indigo-800">{c.fullName}</Link>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{c.specialization || '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(c.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      <button onClick={() => handleRestore(c.id)} className="text-xs text-indigo-600 hover:underline">Восстановить</button>
                      <button onClick={() => handlePermanentDelete(c.id)} className="text-xs text-red-600 hover:underline">Удалить навсегда</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
            <span className="text-sm text-gray-500">Стр. {page} из {totalPages}</span>
            <div className="flex gap-1">
              <button onClick={() => goToPage(page - 1)} disabled={page <= 1} className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50">Назад</button>
              <button onClick={() => goToPage(page + 1)} disabled={page >= totalPages} className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50">Вперёд</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
