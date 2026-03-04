import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { ResumeCandidate } from '../lib/resume-types';
import {
  CANDIDATE_STATUSES,
  CANDIDATE_STATUS_COLORS,
  QUALIFICATION_CATEGORIES,
  CATEGORY_COLORS,
  GENDER_LABELS,
  formatDateTime,
  formatPhoneForWhatsApp,
  getDaysUntil,
} from '../lib/resume-constants';
import ResumeProcessingStatusBadge from '../components/resume/ResumeProcessingStatus';
import ResumeBranchesCell from '../components/resume/ResumeBranchesCell';
import ResumeDoctorTypesCell from '../components/resume/ResumeDoctorTypesCell';
import ResumeNotesSection from '../components/resume/ResumeNotesSection';
import ResumeTagsManager from '../components/resume/ResumeTagsManager';

export default function ResumeCandidateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [candidate, setCandidate] = useState<ResumeCandidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showRaw, setShowRaw] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.get<ResumeCandidate>(`/resume/candidates/${id}`);
      setCandidate(res.data);
    } catch {
      setError('Кандидат не найден');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const silentLoad = useCallback(async () => {
    if (!id) return;
    try {
      const res = await api.get<ResumeCandidate>(`/resume/candidates/${id}`);
      setCandidate(res.data);
    } catch { /* ignore */ }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const updateField = async (field: string, value: unknown) => {
    if (!id) return;
    try {
      await api.patch(`/resume/candidates/${id}`, { [field]: value });
      load();
    } catch {
      /* ignore */
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    if (!confirm('Удалить кандидата? Он попадёт в корзину.')) return;
    try {
      await api.delete(`/resume/candidates/${id}`);
      navigate('/hr/resume/candidates');
    } catch {
      /* ignore */
    }
  };

  const handleReprocess = async () => {
    if (!id) return;
    try {
      await api.post(`/resume/candidates/${id}/reprocess`);
      load();
    } catch {
      /* ignore */
    }
  };

  const handleDownloadFile = async () => {
    if (!candidate?.uploadedFile) return;
    try {
      const res = await api.get(`/resume/files/${candidate.uploadedFile.id}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = candidate.uploadedFile.originalName;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
  };

  if (loading) return <p className="text-sm text-gray-400">Загрузка...</p>;
  if (error || !candidate) return <p className="text-sm text-red-600">{error || 'Не найден'}</p>;

  const c = candidate;
  const accDays = getDaysUntil(c.accreditationExpiryDate);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{c.fullName || 'Без имени'}</h2>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {c.specialization && <span className="text-sm text-gray-600">{c.specialization}</span>}
            <ResumeProcessingStatusBadge status={c.processingStatus} />
            {c.aiConfidence != null && c.aiConfidence < 0.6 && (
              <span
                className="text-xs text-amber-600 cursor-help"
                title="Парсинг мог сработать некорректно. Попробуйте пересчитать."
              >
                ⚠ Низкое качество парсинга
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={handleReprocess}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Пересчитать
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
          >
            Удалить
          </button>
        </div>
      </div>

      {/* Status row */}
      <div className="flex items-center gap-4 flex-wrap">
        <div>
          <span className="text-xs text-gray-400 block mb-1">Этап</span>
          <select
            value={c.status}
            onChange={(e) => updateField('status', e.target.value)}
            className={`text-sm font-medium rounded-lg px-3 py-1.5 border-0 cursor-pointer ${CANDIDATE_STATUS_COLORS[c.status] || ''}`}
          >
            {Object.entries(CANDIDATE_STATUSES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <span className="text-xs text-gray-400 block mb-1">Направление</span>
          <ResumeDoctorTypesCell candidateId={c.id} doctorTypes={c.doctorTypes || []} onUpdated={silentLoad} />
        </div>
        <div>
          <span className="text-xs text-gray-400 block mb-1">Филиалы</span>
          <ResumeBranchesCell candidateId={c.id} branches={c.branches} onUpdated={silentLoad} />
        </div>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={async () => {
              await api.patch(`/resume/candidates/${c.id}`, { priority: 'ARCHIVE' });
              navigate('/hr/resume/archive');
            }}
            className="px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            В архив
          </button>
          <button
            type="button"
            onClick={async () => {
              if (!confirm('Удалить кандидата?')) return;
              await api.patch(`/resume/candidates/${c.id}`, { priority: 'DELETED' });
              navigate('/hr/resume/trash');
            }}
            className="px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
          >
            Удалить
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Personal Info */}
        <Section title="Личные данные">
          <Field label="ФИО" value={c.fullName} />
          <Field label="Email" value={c.email} />
          <Field label="Телефон" value={c.phone}>
            {c.phone && (
              <span className="flex items-center gap-2 mt-0.5">
                <a href={`tel:${c.phone}`} className="text-accent text-xs hover:underline">Позвонить</a>
                <a
                  href={`https://wa.me/${formatPhoneForWhatsApp(c.phone)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-600 text-xs hover:underline"
                >
                  WhatsApp
                </a>
              </span>
            )}
          </Field>
          <Field label="Дата рождения" value={formatDateTime(c.birthDate)} />
          <Field label="Город" value={c.city} />
          <Field label="Пол" value={GENDER_LABELS[c.gender] || '—'} />
        </Section>

        {/* Education */}
        <Section title="Образование">
          <Field label="ВУЗ" value={c.university} />
          <Field label="Факультет" value={c.faculty} />
          <Field label="Год выпуска" value={c.graduationYear?.toString()} />
          <Field label="Интернатура" value={c.internshipPlace} />
          {c.internshipSpecialty && <Field label="Специальность интернатуры" value={c.internshipSpecialty} />}
          <Field label="Ординатура" value={c.residencyPlace} />
          {c.residencySpecialty && <Field label="Специальность ординатуры" value={c.residencySpecialty} />}
        </Section>

        {/* Qualification */}
        <Section title="Квалификация">
          <Field label="Специализация" value={c.specialization} />
          {c.additionalSpecializations.length > 0 && (
            <Field label="Доп. специализации" value={c.additionalSpecializations.join(', ')} />
          )}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Категория:</span>
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[c.qualificationCategory] || ''}`}>
              {QUALIFICATION_CATEGORIES[c.qualificationCategory] || '—'}
            </span>
          </div>
          {c.categoryAssignedDate && <Field label="Присвоена" value={formatDateTime(c.categoryAssignedDate)} />}
        </Section>

        {/* Accreditation */}
        <Section title="Аккредитация">
          <Field label="Статус" value={c.accreditationStatus ? 'Есть' : 'Нет'} />
          {c.accreditationDate && <Field label="Дата" value={formatDateTime(c.accreditationDate)} />}
          {c.accreditationExpiryDate && (
            <div>
              <Field label="Истекает" value={formatDateTime(c.accreditationExpiryDate)} />
              {accDays !== null && (
                <span className={`text-xs font-medium ${accDays < 0 ? 'text-red-600' : accDays < 90 ? 'text-amber-600' : 'text-green-600'}`}>
                  {accDays < 0 ? `Просрочена (${Math.abs(accDays)} дн.)` : `Осталось ${accDays} дн.`}
                </span>
              )}
            </div>
          )}
          {c.certificateNumber && <Field label="Сертификат" value={c.certificateNumber} />}
          {c.certificateIssueDate && <Field label="Выдан" value={formatDateTime(c.certificateIssueDate)} />}
          {c.certificateExpiryDate && <Field label="Действует до" value={formatDateTime(c.certificateExpiryDate)} />}
        </Section>

        {/* Experience */}
        <Section title="Опыт работы">
          <Field label="Общий стаж" value={c.totalExperienceYears != null ? `${c.totalExperienceYears} лет` : null} />
          <Field label="Стаж по специальности" value={c.specialtyExperienceYears != null ? `${c.specialtyExperienceYears} лет` : null} />
        </Section>

        {/* Additional */}
        <Section title="Дополнительно">
          {c.nmoPoints != null && <Field label="Баллы НМО" value={c.nmoPoints.toString()} />}
          {c.languages.length > 0 && <Field label="Языки" value={c.languages.join(', ')} />}
          {c.additionalSkills && <Field label="Навыки" value={c.additionalSkills} />}
          {c.publications && <Field label="Публикации" value={c.publications} />}
        </Section>
      </div>

      {/* Work history timeline */}
      {c.workHistory && c.workHistory.length > 0 && (
        <Section title="Трудовая история">
          <div className="space-y-3">
            {c.workHistory.map((wh) => (
              <div key={wh.id} className="border-l-2 border-accent/30 pl-4 py-1">
                <p className="text-sm font-medium text-gray-900">{wh.position}</p>
                <p className="text-sm text-gray-600">{wh.organization}</p>
                {wh.department && <p className="text-xs text-gray-400">{wh.department}</p>}
                {wh.city && <p className="text-xs text-gray-400">{wh.city}</p>}
                <p className="text-xs text-gray-400 mt-0.5">
                  {wh.startDate ? formatDateTime(wh.startDate) : '?'} — {wh.isCurrent ? 'настоящее время' : wh.endDate ? formatDateTime(wh.endDate) : '?'}
                </p>
                {wh.description && <p className="text-xs text-gray-500 mt-1">{wh.description}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Education details */}
      {c.education && c.education.length > 0 && (
        <Section title="Детали образования">
          <div className="space-y-3">
            {c.education.map((edu) => (
              <div key={edu.id} className="border-l-2 border-indigo-200 pl-4 py-1">
                <p className="text-sm font-medium text-gray-900">{edu.institution}</p>
                {edu.faculty && <p className="text-sm text-gray-600">{edu.faculty}</p>}
                {edu.specialty && <p className="text-xs text-gray-500">{edu.specialty}</p>}
                {edu.degree && <p className="text-xs text-gray-400">{edu.degree}</p>}
                {edu.city && <p className="text-xs text-gray-400">{edu.city}</p>}
                <p className="text-xs text-gray-400 mt-0.5">
                  {edu.startYear || '?'} — {edu.endYear || '?'}
                  {edu.type && ` (${edu.type})`}
                </p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* CME Courses */}
      {c.cmeCourses && c.cmeCourses.length > 0 && (
        <Section title="Повышение квалификации / НМО">
          <div className="space-y-2">
            {c.cmeCourses.map((course) => (
              <div key={course.id} className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm font-medium text-gray-900">{course.courseName}</p>
                {course.provider && <p className="text-xs text-gray-500">{course.provider}</p>}
                <div className="flex gap-3 mt-1 text-xs text-gray-400">
                  {course.completedAt && <span>{formatDateTime(course.completedAt)}</span>}
                  {course.hours && <span>{course.hours} ч.</span>}
                  {course.nmoPoints && <span>{course.nmoPoints} баллов НМО</span>}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Tags */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <ResumeTagsManager candidateId={c.id} tags={c.tags || []} onUpdated={load} />
      </div>

      {/* Notes */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <ResumeNotesSection candidateId={c.id} notes={c.notes || []} onUpdated={load} />
      </div>

      {/* Raw text / file */}
      {(c.rawText || c.uploadedFile) && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Исходное резюме</h3>
            <button
              type="button"
              onClick={() => setShowRaw((v) => !v)}
              className="text-xs text-accent hover:underline"
            >
              {showRaw ? 'Скрыть' : 'Показать'}
            </button>
          </div>
          {showRaw && (
            <div>
              {c.uploadedFile && (
                <div className="flex items-center gap-3 mb-2">
                  <p className="text-xs text-gray-400">
                    Файл: {c.uploadedFile.originalName} ({(c.uploadedFile.sizeBytes / 1024).toFixed(0)} КБ)
                  </p>
                  <button type="button" onClick={handleDownloadFile} className="text-xs text-accent hover:underline inline-flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Скачать
                  </button>
                </div>
              )}
              {c.rawText && (
                <pre className="text-xs text-gray-600 whitespace-pre-wrap bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                  {c.rawText}
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Field({ label, value, children }: { label: string; value?: string | null; children?: React.ReactNode }) {
  return (
    <div>
      <span className="text-xs text-gray-400">{label}:</span>{' '}
      <span className="text-sm text-gray-700">{value || '—'}</span>
      {children}
    </div>
  );
}
