import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import {
  CANDIDATE_STATUSES,
  CANDIDATE_STATUS_COLORS,
  CANDIDATE_PRIORITIES,
  CANDIDATE_PRIORITY_COLORS,
  QUALIFICATION_CATEGORIES,
  CATEGORY_COLORS,
  BRANCHES,
  BRANCH_COLORS,
  formatDate,
  formatMonthYear,
  formatPhoneForWhatsApp,
  formatExperienceYears,
  getDaysUntil,
} from '../lib/resume-constants';
import type { CandidateDetail } from '../lib/resume-types';
import ResumeNotesSection from '../components/resume/ResumeNotesSection';
import ResumeTagsManager from '../components/resume/ResumeTagsManager';

export default function ResumeCandidateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [candidate, setCandidate] = useState<CandidateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRawText, setShowRawText] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.get<CandidateDetail>(`/resume/candidates/${id}`);
      setCandidate(res.data);
    } catch {
      setCandidate(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function updateField(field: string, value: unknown) {
    if (!id) return;
    await api.put(`/resume/candidates/${id}`, { [field]: value });
    load();
  }

  async function handleDelete() {
    if (!id || !confirm('Переместить кандидата в корзину?')) return;
    await api.delete(`/resume/candidates/${id}`);
    navigate('/hr/resume/candidates');
  }

  async function handleRestore() {
    if (!id) return;
    await api.put(`/resume/candidates/${id}`, { priority: 'ACTIVE' });
    load();
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-gray-500">Загрузка карточки...</div>;
  }

  if (!candidate) {
    return (
      <div className="text-center py-20">
        <h2 className="text-lg font-semibold text-gray-900">Кандидат не найден</h2>
        <button onClick={() => navigate('/hr/resume/candidates')} className="mt-4 text-sm text-indigo-600 hover:underline">
          Вернуться к списку
        </button>
      </div>
    );
  }

  const c = candidate;
  const accDaysLeft = getDaysUntil(c.accreditationExpiryDate);
  const certDaysLeft = getDaysUntil(c.certificateExpiryDate);
  const totalNmoFromCourses = c.cmeCourses.reduce((sum, cr) => sum + (cr.nmoPoints || 0), 0);
  const isDeleted = c.priority === 'DELETED' || c.priority === 'ARCHIVE';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/hr/resume/candidates')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Назад к списку
        </button>
        <div className="flex items-center gap-2">
          {isDeleted ? (
            <button onClick={handleRestore} className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50">Восстановить</button>
          ) : (
            <button onClick={handleDelete} className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-md hover:bg-red-50">Удалить</button>
          )}
        </div>
      </div>

      {/* Main info card */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{c.fullName}</h1>
            {c.specialization && <p className="text-gray-600 mt-1">{c.specialization}</p>}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CANDIDATE_STATUS_COLORS[c.status] || ''}`}>
                {CANDIDATE_STATUSES[c.status] || c.status}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CANDIDATE_PRIORITY_COLORS[c.priority] || ''}`}>
                {CANDIDATE_PRIORITIES[c.priority] || c.priority}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[c.qualificationCategory] || CATEGORY_COLORS.NONE}`}>
                {QUALIFICATION_CATEGORIES[c.qualificationCategory] || c.qualificationCategory}
              </span>
              {c.branches.map((b) => (
                <span key={b} className={`text-xs px-2 py-0.5 rounded-full font-medium ${BRANCH_COLORS[b] || 'bg-gray-100 text-gray-800'}`}>{b}</span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {c.phone && (
              <>
                <a href={`tel:${c.phone}`} className="p-2 rounded-full border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                  </svg>
                </a>
                <a href={`https://wa.me/${formatPhoneForWhatsApp(c.phone)}`} target="_blank" rel="noreferrer" className="p-2 rounded-full border border-gray-200 text-gray-500 hover:text-green-600 hover:bg-green-50">
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                  </svg>
                </a>
              </>
            )}
            {c.aiConfidence !== null && (
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${c.aiConfidence >= 0.8 ? 'bg-green-100 text-green-700' : c.aiConfidence >= 0.5 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`} title="AI уверенность парсинга">
                AI: {Math.round(c.aiConfidence * 100)}%
              </span>
            )}
          </div>
        </div>

        {/* Resume file viewer */}
        {c.uploadedFile && (
          <div className="mt-4">
            <button onClick={() => setShowRawText(!showRawText)} className="text-sm text-indigo-600 hover:underline flex items-center gap-1">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              {showRawText ? 'Скрыть оригинал' : 'Показать оригинал резюме'}
              ({c.uploadedFile.originalName})
            </button>
          </div>
        )}
      </div>

      {/* Raw text / PDF viewer */}
      {showRawText && (
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          {c.uploadedFile && (c.uploadedFile.mimeType === 'application/pdf' || c.uploadedFile.mimeType?.startsWith('image/')) ? (
            <iframe
              src={`/api/resume/files/${c.uploadedFile.id}`}
              className="w-full h-[600px] rounded border border-gray-100"
              title="Резюме"
            />
          ) : c.rawText ? (
            <pre className="text-sm text-gray-700 whitespace-pre-wrap max-h-96 overflow-auto">{c.rawText}</pre>
          ) : (
            <p className="text-sm text-gray-500">Исходный текст недоступен</p>
          )}
          {c.uploadedFile && (
            <a
              href={`/api/resume/files/${c.uploadedFile.id}`}
              download
              className="mt-3 inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Скачать файл
            </a>
          )}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Personal info */}
        <Section title="Личные данные" icon="user">
          <InfoRow label="Email" value={c.email} />
          <InfoRow label="Телефон" value={c.phone} />
          <InfoRow label="Дата рождения" value={formatDate(c.birthDate)} />
          <InfoRow label="Город" value={c.city} />
          {c.additionalSpecializations?.length > 0 && (
            <InfoRow label="Доп. специализации" value={c.additionalSpecializations.join(', ')} />
          )}
          {c.languages?.length > 0 && <InfoRow label="Языки" value={c.languages.join(', ')} />}
        </Section>

        {/* Education */}
        <Section title="Образование" icon="edu">
          <InfoRow label="ВУЗ" value={c.university} />
          <InfoRow label="Факультет" value={c.faculty} />
          <InfoRow label="Год окончания" value={c.graduationYear?.toString()} />
          {c.internshipPlace && (
            <>
              <hr className="my-2 border-gray-100" />
              <InfoRow label="Интернатура" value={c.internshipPlace} />
              <InfoRow label="Спец. интернатуры" value={c.internshipSpecialty} />
              <InfoRow label="Год окончания" value={c.internshipYearEnd?.toString()} />
            </>
          )}
          {c.residencyPlace && (
            <>
              <hr className="my-2 border-gray-100" />
              <InfoRow label="Ординатура" value={c.residencyPlace} />
              <InfoRow label="Спец. ординатуры" value={c.residencySpecialty} />
              <InfoRow label="Год окончания" value={c.residencyYearEnd?.toString()} />
            </>
          )}
          {(c.education || []).length > 0 && (
            <>
              <hr className="my-2 border-gray-100" />
              <p className="text-xs font-medium text-gray-500 uppercase mt-2 mb-1">Дополнительное образование</p>
              {c.education.map((edu) => (
                <div key={edu.id} className="mb-2">
                  <p className="text-sm font-medium text-gray-900">{edu.institution}</p>
                  {edu.specialty && <p className="text-xs text-gray-600">{edu.specialty}</p>}
                  {edu.endYear && <p className="text-xs text-gray-400">{edu.endYear}</p>}
                </div>
              ))}
            </>
          )}
        </Section>
      </div>

      {/* Work history */}
      {(c.workHistory || []).length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" />
            </svg>
            Опыт работы
          </h3>
          <div className="relative pl-6 border-l-2 border-gray-200 space-y-6">
            {c.workHistory.map((wh) => (
              <div key={wh.id} className="relative">
                <div className="absolute -left-[25px] top-1 h-3 w-3 rounded-full border-2 border-indigo-500 bg-white" />
                <div>
                  <p className="text-sm font-semibold text-gray-900">{wh.organization}</p>
                  <p className="text-sm text-gray-700">{wh.position}</p>
                  {wh.department && <p className="text-xs text-gray-500">{wh.department}</p>}
                  <p className="text-xs text-gray-400 mt-1">
                    {formatMonthYear(wh.startDate)} — {wh.isCurrent ? 'по настоящее время' : formatMonthYear(wh.endDate)}
                  </p>
                  {wh.description && <p className="text-sm text-gray-600 mt-1">{wh.description}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Accreditation */}
        <Section title="Аккредитация" icon="shield">
          <InfoRow label="Статус" value={c.accreditationStatus ? 'Аккредитован' : 'Нет аккредитации'} />
          <InfoRow label="Дата истечения" value={formatDate(c.accreditationExpiryDate)} />
          {accDaysLeft !== null && accDaysLeft <= 90 && accDaysLeft > 0 && (
            <p className="text-xs text-amber-600 font-medium mt-1">Истекает через {accDaysLeft} дн.</p>
          )}
          {accDaysLeft !== null && accDaysLeft <= 0 && (
            <p className="text-xs text-red-600 font-medium mt-1">Аккредитация истекла</p>
          )}
          <InfoRow label="Номер сертификата" value={c.certificateNumber} />
          <InfoRow label="Сертификат истекает" value={formatDate(c.certificateExpiryDate)} />
          {certDaysLeft !== null && certDaysLeft <= 90 && certDaysLeft > 0 && (
            <p className="text-xs text-amber-600 font-medium mt-1">Сертификат истекает через {certDaysLeft} дн.</p>
          )}
        </Section>

        {/* CME / NMO */}
        <Section title="Повышение квалификации (НМО)" icon="book">
          <InfoRow label="Стаж (общий)" value={formatExperienceYears(c.totalExperienceYears)} />
          <InfoRow label="Стаж (по спец.)" value={formatExperienceYears(c.specialtyExperienceYears)} />
          <InfoRow label="Баллы НМО" value={c.nmoPoints?.toString()} />
          {totalNmoFromCourses > 0 && (
            <InfoRow label="НМО из курсов" value={totalNmoFromCourses.toString()} />
          )}
          {c.publications && <InfoRow label="Публикации" value={c.publications} />}
          {c.additionalSkills && <InfoRow label="Доп. навыки" value={c.additionalSkills} />}
          {(c.cmeCourses || []).length > 0 && (
            <>
              <hr className="my-2 border-gray-100" />
              <p className="text-xs font-medium text-gray-500 uppercase mt-2 mb-1">Курсы</p>
              {c.cmeCourses.map((course) => (
                <div key={course.id} className="mb-2">
                  <p className="text-sm font-medium text-gray-900">{course.courseName}</p>
                  <div className="flex gap-3 text-xs text-gray-500">
                    {course.provider && <span>{course.provider}</span>}
                    {course.completedAt && <span>{formatDate(course.completedAt)}</span>}
                    {course.hours && <span>{course.hours} ч.</span>}
                    {course.nmoPoints && <span>{course.nmoPoints} баллов НМО</span>}
                  </div>
                </div>
              ))}
            </>
          )}
        </Section>
      </div>

      {/* Tags & Status management */}
      <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-900">Теги и статус</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="text-xs font-medium text-gray-500">Этап</label>
            <select
              value={c.status}
              onChange={(e) => updateField('status', e.target.value)}
              className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
            >
              {Object.entries(CANDIDATE_STATUSES).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Приоритет</label>
            <select
              value={c.priority}
              onChange={(e) => updateField('priority', e.target.value)}
              className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-md"
            >
              {Object.entries(CANDIDATE_PRIORITIES).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">Филиалы</label>
            <div className="mt-1 flex flex-wrap gap-2">
              {BRANCHES.map((b) => {
                const checked = c.branches.includes(b);
                return (
                  <button
                    key={b}
                    onClick={() => updateField('branches', checked ? c.branches.filter((x) => x !== b) : [...c.branches, b])}
                    className={`text-xs px-2 py-1 rounded border ${checked ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                  >
                    {b}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 block mb-2">Теги</label>
          <ResumeTagsManager candidateId={c.id} tags={c.tags || []} onRefresh={load} />
        </div>
      </div>

      {/* Notes */}
      <ResumeNotesSection candidateId={c.id} notes={c.notes || []} onRefresh={load} />
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  const iconSvg = {
    user: <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />,
    edu: <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />,
    shield: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />,
    book: <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />,
  }[icon];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
        <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          {iconSvg}
        </svg>
        {title}
      </h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value || value === '—') return null;
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-900 font-medium text-right ml-4">{value}</span>
    </div>
  );
}
