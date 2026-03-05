import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { ResumeCandidate } from '../lib/resume-types';
import {
  QUALIFICATION_CATEGORIES,
  CATEGORY_COLORS,
  PREDEFINED_TAGS,
  formatDateTime,
  formatPhoneForWhatsApp,
  getDaysUntil,
} from '../lib/resume-constants';
import ResumeBranchesCell from '../components/resume/ResumeBranchesCell';

const PAGE_SIZES = [10, 25, 50, 100];

export default function ResumeArchivePage() {
  const [candidates, setCandidates] = useState<ResumeCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(25);
  const [tagDropdownId, setTagDropdownId] = useState<string | null>(null);
  const [contactPopupId, setContactPopupId] = useState<string | null>(null);
  const tagDropdownRef = useRef<HTMLDivElement>(null);
  const contactPopupRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: ResumeCandidate[]; total: number }>('/resume/candidates', {
        params: { priority: 'ARCHIVE', page, limit },
      });
      setCandidates(res.data.data);
      setTotal(res.data.total);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [page, limit]);

  const silentReload = useCallback(async () => {
    try {
      const res = await api.get<{ data: ResumeCandidate[]; total: number }>('/resume/candidates', {
        params: { priority: 'ARCHIVE', page, limit },
      });
      setCandidates(res.data.data);
      setTotal(res.data.total);
    } catch { /* ignore */ }
  }, [page, limit]);

  useEffect(() => {
    load();
  }, [load]);

  // Close tag dropdown on outside click
  useEffect(() => {
    if (!tagDropdownId) return;
    const handler = (e: MouseEvent) => {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(e.target as Node)) {
        setTagDropdownId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [tagDropdownId]);

  // Close contact popup on outside click
  useEffect(() => {
    if (!contactPopupId) return;
    const handler = (e: MouseEvent) => {
      if (contactPopupRef.current && !contactPopupRef.current.contains(e.target as Node)) {
        setContactPopupId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [contactPopupId]);

  const restore = async (id: string) => {
    try {
      await api.patch(`/resume/candidates/${id}`, { priority: 'ACTIVE' });
      silentReload();
    } catch {
      /* ignore */
    }
  };

  const handleAddTag = async (candidateId: string, label: string, color: string) => {
    try {
      await api.post(`/resume/candidates/${candidateId}/tags`, { label, color });
      setTagDropdownId(null);
      silentReload();
    } catch {
      /* ignore */
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    try {
      await api.delete(`/resume/tags/${tagId}`);
      silentReload();
    } catch {
      /* ignore */
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">
        Архив <span className="text-sm font-normal text-gray-400">({total})</span>
      </h2>

      {loading ? (
        <p className="text-sm text-gray-400">Загрузка...</p>
      ) : candidates.length === 0 ? (
        <p className="text-sm text-gray-400">Архив пуст</p>
      ) : (
        <>
          <div className="bg-white border border-gray-200 rounded-xl overflow-visible">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200">
                  <th className="text-left px-3 py-2 font-medium text-gray-600">ФИО</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Специализация</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Филиал</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Квалификация</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Теги</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Контакты</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {candidates.map((c) => {
                  const accDays = getDaysUntil(c.accreditationExpiryDate);
                  return (
                    <tr key={c.id} className="hover:bg-gray-50/50">
                      {/* ФИО */}
                      <td className="px-3 py-2">
                        <Link to={`/hr/resume/candidates/${c.id}`} className="text-accent hover:underline font-medium">
                          {c.fullName || '—'}
                        </Link>
                        <div className="text-xs text-gray-400">{formatDateTime(c.createdAt)}</div>
                      </td>
                      {/* Специализация */}
                      <td className="px-3 py-2 text-gray-600">{c.specialization || '—'}</td>
                      {/* Филиал */}
                      <td className="px-3 py-2">
                        <ResumeBranchesCell candidateId={c.id} branches={c.branches} onUpdated={silentReload} />
                      </td>
                      {/* Квалификация = Категория + Стаж + Аккредитация */}
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[c.qualificationCategory] || ''}`}>
                            {QUALIFICATION_CATEGORIES[c.qualificationCategory] || '—'}
                          </span>
                          {c.totalExperienceYears != null && (
                            <span className="text-xs text-gray-500">{c.totalExperienceYears} л.</span>
                          )}
                        </div>
                        {c.accreditationStatus ? (
                          <div className={`text-xs mt-0.5 ${
                            accDays !== null && accDays < 0
                              ? 'text-red-600'
                              : accDays !== null && accDays < 90
                                ? 'text-amber-600'
                                : 'text-green-600'
                          }`}>
                            {c.accreditationExpiryDate
                              ? `Аккр. до ${new Date(c.accreditationExpiryDate).toLocaleDateString('ru-RU')}`
                              : 'Аккр. есть'}
                            {accDays !== null && accDays < 0 && ' (истекла)'}
                          </div>
                        ) : (
                          <div className="text-xs text-gray-400 mt-0.5">Нет аккр.</div>
                        )}
                      </td>
                      {/* Теги */}
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-1">
                          {(c.tags || []).map((tag) => (
                            <span
                              key={tag.id}
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium text-white leading-tight"
                              style={{ backgroundColor: tag.color || '#6b7280' }}
                            >
                              {tag.label}
                              <button type="button" onClick={() => handleRemoveTag(tag.id)} className="ml-0.5 hover:text-white/70 leading-none">×</button>
                            </span>
                          ))}
                          <div className="relative" ref={tagDropdownId === c.id ? tagDropdownRef : undefined}>
                            <button
                              type="button"
                              onClick={() => setTagDropdownId(tagDropdownId === c.id ? null : c.id)}
                              className="w-5 h-5 flex items-center justify-center rounded-full text-gray-400 hover:text-accent hover:bg-gray-100 transition-colors"
                              title="Добавить тег"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                            </button>
                            {tagDropdownId === c.id && (
                              <div className="absolute z-30 top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-1.5 min-w-[150px]">
                                {PREDEFINED_TAGS
                                  .filter((p) => !(c.tags || []).some((t) => t.label === p.label))
                                  .map((p) => (
                                    <button
                                      key={p.label}
                                      type="button"
                                      onClick={() => handleAddTag(c.id, p.label, p.color)}
                                      className="block w-full text-left px-2 py-1 text-xs rounded hover:bg-gray-50 transition-colors"
                                    >
                                      <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: p.color }} />
                                      {p.label}
                                    </button>
                                  ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      {/* Контакты */}
                      <td className="px-3 py-2">
                        {c.phone && (
                          <div className="relative" ref={contactPopupId === c.id ? contactPopupRef : undefined}>
                            <button
                              type="button"
                              onClick={() => setContactPopupId(contactPopupId === c.id ? null : c.id)}
                              className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-accent hover:bg-gray-100 transition-colors"
                            >
                              <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </button>
                            {contactPopupId === c.id && (
                              <div className="absolute z-30 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-3 min-w-[220px]">
                                <div className="flex items-center gap-2 mb-3">
                                  <span className="text-sm font-medium text-gray-900">{c.phone}</span>
                                  <button
                                    type="button"
                                    onClick={() => navigator.clipboard.writeText(c.phone!)}
                                    className="text-gray-400 hover:text-accent"
                                    title="Скопировать"
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                  </button>
                                </div>
                                <div className="flex flex-col gap-2">
                                  <a
                                    href={`tel:${c.phone}`}
                                    className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
                                  >
                                    Позвонить
                                  </a>
                                  <a
                                    href={`https://wa.me/${formatPhoneForWhatsApp(c.phone)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-white bg-green-500 hover:bg-green-600 rounded-lg transition-colors"
                                  >
                                    Написать в WhatsApp
                                  </a>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      {/* Восстановить */}
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => restore(c.id)}
                          className="text-xs text-accent hover:underline"
                        >
                          Восстановить
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">
              {(page - 1) * limit + 1}–{Math.min(page * limit, total)} из {total}
            </span>
            <div className="flex items-center gap-3">
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
              >
                {PAGE_SIZES.map((s) => (
                  <option key={s} value={s}>{s} на стр.</option>
                ))}
              </select>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
                >
                  Назад
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
                >
                  Далее
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
