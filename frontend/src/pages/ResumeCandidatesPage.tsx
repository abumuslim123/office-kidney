import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import {
  CANDIDATE_STATUSES,
  CANDIDATE_STATUS_COLORS,
  CANDIDATE_PRIORITIES,
  CANDIDATE_PRIORITY_COLORS,
  QUALIFICATION_CATEGORIES,
  CATEGORY_COLORS,
  formatDate,
  formatExperienceYears,
  formatPhoneForWhatsApp,
  getDaysUntil,
} from '../lib/resume-constants';
import type { CandidateRow } from '../lib/resume-types';
import ResumeFiltersBar from '../components/resume/ResumeFiltersBar';
import ResumeBranchesCell from '../components/resume/ResumeBranchesCell';
import ResumeProcessingStatus from '../components/resume/ResumeProcessingStatus';

export default function ResumeCandidatesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deduping, setDeduping] = useState(false);
  const [dedupResult, setDedupResult] = useState<string | null>(null);

  const page = Number(searchParams.get('page')) || 1;
  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const filters = useMemo(() => ({
    search: searchParams.get('search') || '',
    specialization: searchParams.get('specialization') || '',
    category: searchParams.get('category') || '',
    status: searchParams.get('status') || '',
    priority: searchParams.get('priority') || '',
    branch: searchParams.get('branch') || '',
    city: searchParams.get('city') || '',
    workCity: searchParams.get('workCity') || '',
    educationCity: searchParams.get('educationCity') || '',
    experience: searchParams.get('experience') || '',
    accreditation: searchParams.get('accreditation') || '',
  }), [searchParams]);

  const setFilters = useCallback((f: typeof filters) => {
    const params = new URLSearchParams();
    Object.entries(f).forEach(([k, v]) => { if (v) params.set(k, v); });
    setSearchParams(params, { replace: true });
  }, [setSearchParams]);

  const goToPage = useCallback((p: number) => {
    const params = new URLSearchParams(searchParams);
    if (p <= 1) params.delete('page'); else params.set('page', String(p));
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);

  const loadCandidates = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: pageSize };
      Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
      const res = await api.get<{ candidates: CandidateRow[]; total: number }>('/resume/candidates', { params });
      setCandidates(res.data.candidates);
      setTotal(res.data.total);
    } catch { /* */ } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => { loadCandidates(); }, [loadCandidates]);

  async function updateField(id: string, field: string, value: unknown) {
    try {
      await api.put(`/resume/candidates/${id}`, { [field]: value });
      loadCandidates();
    } catch { /* */ }
  }

  async function reprocess(id: string) {
    await api.post(`/resume/candidates/${id}/reprocess`);
    loadCandidates();
  }

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const params: Record<string, string> = {};
      Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
      const res = await api.get('/resume/candidates/export', { params, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `candidates_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch { /* */ } finally {
      setExporting(false);
    }
  }, [filters]);

  const handleDedup = useCallback(async () => {
    setDeduping(true);
    setDedupResult(null);
    try {
      const body: Record<string, string> = {};
      Object.entries(filters).forEach(([k, v]) => { if (v) body[k] = v; });
      const res = await api.post<{ deleted: number; tagged: number }>('/resume/candidates/deduplicate', body);
      const parts: string[] = [];
      if (res.data.deleted > 0) parts.push(`удалено ${res.data.deleted}`);
      if (res.data.tagged > 0) parts.push(`помечено ${res.data.tagged}`);
      setDedupResult(parts.length > 0 ? parts.join(', ') : 'дубликатов не найдено');
      loadCandidates();
    } catch {
      setDedupResult('ошибка');
    } finally {
      setDeduping(false);
    }
  }, [filters, loadCandidates]);

  const paginationItems = useMemo(() => {
    const items: (number | 'ellipsis')[] = [];
    const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
      .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1);
    pages.forEach((p, idx) => {
      if (idx > 0 && p - pages[idx - 1] > 1) items.push('ellipsis');
      items.push(p);
    });
    return items;
  }, [totalPages, page]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">База кандидатов</h1>
        <p className="text-sm text-gray-500 mt-1">
          {total} {total === 1 ? 'кандидат' : 'кандидатов'} найдено
        </p>
      </div>

      <ResumeFiltersBar
        filters={filters}
        onChange={setFilters}
        onExport={handleExport}
        onDedup={handleDedup}
        exporting={exporting}
        deduping={deduping}
        dedupResult={dedupResult}
      />

      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">ФИО</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Специализация</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Филиал</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Категория</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Стаж</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Аккредитация</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Этап</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Приоритет</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Теги</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-500">Загрузка...</td></tr>
              ) : candidates.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-500">Кандидаты не найдены</td></tr>
              ) : candidates.map((c) => {
                const isProcessing = c.processingStatus !== 'COMPLETED' && c.processingStatus !== 'FAILED';
                const isFailed = c.processingStatus === 'FAILED';
                const daysLeft = getDaysUntil(c.accreditationExpiryDate);
                const isExpired = daysLeft !== null && daysLeft <= 0;
                const isExpiring = daysLeft !== null && daysLeft <= 90 && daysLeft > 0;

                return (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link to={`/hr/resume/candidates/${c.id}`} className="font-medium text-indigo-600 hover:text-indigo-800">
                        {c.fullName}
                      </Link>
                      {isProcessing && (
                        <div className="mt-1"><ResumeProcessingStatus status={c.processingStatus} /></div>
                      )}
                      {isFailed && (
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-xs text-red-600">Ошибка обработки</span>
                          <button onClick={() => reprocess(c.id)} className="text-xs text-indigo-600 hover:underline">Повторить</button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{c.specialization || '—'}</td>
                    <td className="px-4 py-3">
                      <ResumeBranchesCell candidateId={c.id} branches={c.branches} onUpdate={loadCandidates} />
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[c.qualificationCategory] || CATEGORY_COLORS.NONE}`}>
                        {QUALIFICATION_CATEGORIES[c.qualificationCategory] || c.qualificationCategory}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{formatExperienceYears(c.totalExperienceYears)}</td>
                    <td className="px-4 py-3">
                      {!c.accreditationStatus ? (
                        <span className="text-xs text-gray-400">Нет</span>
                      ) : (
                        <div>
                          <span className="text-xs">{formatDate(c.accreditationExpiryDate)}</span>
                          {isExpired && <span className="ml-1 text-xs text-red-600 font-medium">Истекла</span>}
                          {isExpiring && <span className="ml-1 text-xs text-amber-600 font-medium">{daysLeft} дн.</span>}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={c.status}
                        onChange={(e) => { e.stopPropagation(); updateField(c.id, 'status', e.target.value); }}
                        onClick={(e) => e.stopPropagation()}
                        className={`text-xs px-2 py-1 rounded border-0 font-medium cursor-pointer ${CANDIDATE_STATUS_COLORS[c.status] || ''}`}
                      >
                        {Object.entries(CANDIDATE_STATUSES).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={c.priority}
                        onChange={(e) => { e.stopPropagation(); updateField(c.id, 'priority', e.target.value); }}
                        onClick={(e) => e.stopPropagation()}
                        className={`text-xs px-2 py-1 rounded border-0 font-medium cursor-pointer ${CANDIDATE_PRIORITY_COLORS[c.priority] || ''}`}
                      >
                        {Object.entries(CANDIDATE_PRIORITIES).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(c.tags || []).slice(0, 3).map((tag) => (
                          <span key={tag.id} className="inline-block text-[10px] px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: tag.color || '#64748b' }}>
                            {tag.label}
                          </span>
                        ))}
                        {(c.tags || []).length > 3 && <span className="text-[10px] text-gray-400">+{c.tags.length - 3}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {c.phone && (
                        <div className="flex items-center gap-1">
                          <a href={`tel:${c.phone}`} onClick={(e) => e.stopPropagation()} className="text-gray-400 hover:text-gray-600" title="Позвонить">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                            </svg>
                          </a>
                          <a href={`https://wa.me/${formatPhoneForWhatsApp(c.phone)}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-gray-400 hover:text-green-600" title="WhatsApp">
                            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                            </svg>
                          </a>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
            <span className="text-sm text-gray-500">
              Показано {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} из {total}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                Назад
              </button>
              {paginationItems.map((item, idx) =>
                item === 'ellipsis' ? (
                  <span key={`e-${idx}`} className="px-2 text-gray-400">...</span>
                ) : (
                  <button
                    key={item}
                    onClick={() => goToPage(item)}
                    className={`px-3 py-1.5 text-sm border rounded-md ${
                      item === page ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {item}
                  </button>
                ),
              )}
              <button
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                Вперёд
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
