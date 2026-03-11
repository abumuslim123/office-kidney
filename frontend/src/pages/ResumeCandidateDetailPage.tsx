import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { ResumeCandidate, SimilarCandidate } from '../lib/resume-types';
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
import ResumeScoreCard from '../components/resume/ResumeScoreCard';
import { getScoreColor } from '../lib/resume-constants';

function SimilarCandidatesSection({ candidateId }: { candidateId: string }) {
  const [similar, setSimilar] = useState<SimilarCandidate[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.get<SimilarCandidate[]>(`/resume/candidates/${candidateId}/similar`)
      .then(res => setSimilar(res.data))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [candidateId]);

  if (!loaded || similar.length === 0) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Похожие кандидаты</h3>
      <div className="space-y-1.5">
        {similar.map(s => (
          <Link
            key={s.id}
            to={`/hr/resume/candidates/${s.id}`}
            className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900 truncate">{s.fullName}</span>
                {s.specialization && (
                  <span className="text-xs text-gray-500 truncate">{s.specialization}</span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {s.city && (
                  <span className="text-xs text-gray-400">{s.city}</span>
                )}
                {s.totalExperienceYears != null && (
                  <span className="text-xs text-gray-400">стаж {s.totalExperienceYears} лет</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              {s.aiScore != null && (
                <span className={`text-xs px-1.5 py-0.5 rounded ${getScoreColor(s.aiScore)}`}>
                  {s.aiScore}
                </span>
              )}
              <span className="text-xs font-medium text-indigo-600">
                {Math.round(s.similarity * 100)}%
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function ResumeCandidateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [candidate, setCandidate] = useState<ResumeCandidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showRaw, setShowRaw] = useState(false);
  const [supplementText, setSupplementText] = useState('');
  const [supplementing, setSupplementing] = useState(false);

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

  // Автообновление пока идёт AI-обработка
  useEffect(() => {
    if (!candidate) return;
    const isProcessing = ['PENDING', 'EXTRACTING', 'PARSING'].includes(candidate.processingStatus);
    if (!isProcessing) return;

    const interval = setInterval(silentLoad, 3000);
    return () => clearInterval(interval);
  }, [candidate?.processingStatus, silentLoad]);

  const handleSupplement = async () => {
    if (!id || !supplementText.trim()) return;
    setSupplementing(true);
    try {
      await api.post(`/resume/candidates/${id}/supplement`, { text: supplementText.trim() });
      setSupplementText('');
      silentLoad();
    } catch {
      /* ignore */
    } finally {
      setSupplementing(false);
    }
  };

  const updateField = async (field: string, value: unknown) => {
    if (!id) return;
    try {
      await api.patch(`/resume/candidates/${id}`, { [field]: value });
      load();
    } catch {
      /* ignore */
    }
  };

  const updateFields = async (data: Record<string, unknown>) => {
    if (!id) return;
    try {
      await api.patch(`/resume/candidates/${id}`, data);
      silentLoad();
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

      {/* AI Score Card */}
      <ResumeScoreCard candidateId={c.id} candidate={c} onFieldUpdated={silentLoad} />

      {/* Similar candidates */}
      <SimilarCandidatesSection candidateId={c.id} />

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
          <AdditionalSpecializationsEditor
            specs={c.additionalSpecializations}
            onSave={(specs) => updateFields({ additionalSpecializations: specs })}
          />
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
          <SalaryField candidate={c} onSave={updateFields} />
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
        <ResumeTagsManager candidateId={c.id} tags={c.tags || []} onUpdated={silentLoad} />
      </div>

      {/* Supplement resume */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Дополнить резюме</h3>
        <p className="text-xs text-gray-500 mb-2">
          Вставьте дополнительную информацию (курсы, сертификаты, места работы и т.д.) — AI перепарсит всё заново.
        </p>
        <textarea
          className="w-full border border-gray-300 rounded-lg p-2.5 text-sm resize-y min-h-[80px] focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none"
          placeholder="Например: Курс «УЗИ-диагностика», 2024, РМАНПО, 144 часа, 50 баллов НМО"
          value={supplementText}
          onChange={e => setSupplementText(e.target.value)}
          disabled={supplementing}
          rows={3}
        />
        <div className="flex items-center gap-3 mt-2">
          <button
            onClick={handleSupplement}
            disabled={supplementing || !supplementText.trim()}
            className="text-sm px-4 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {supplementing ? 'Отправка...' : 'Дополнить и пересчитать'}
          </button>
          {supplementing && (
            <span className="text-xs text-gray-500">Текст добавлен, AI обрабатывает резюме...</span>
          )}
        </div>
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

function AdditionalSpecializationsEditor({
  specs,
  onSave,
}: {
  specs: string[];
  onSave: (specs: string[]) => void;
}) {
  const [allSpecs, setAllSpecs] = useState<string[]>([]);
  const [newSpec, setNewSpec] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    api.get<{ specializations: string[] }>('/resume/candidates/filter-options')
      .then((r) => setAllSpecs(r.data.specializations))
      .catch(() => {});
  }, []);

  const filtered = allSpecs.filter(
    (s) => !specs.includes(s) && (!newSpec || s.toLowerCase().includes(newSpec.toLowerCase())),
  );

  const addSpec = (s: string) => {
    const trimmed = s.trim();
    if (trimmed && !specs.includes(trimmed)) {
      onSave([...specs, trimmed]);
    }
    setNewSpec('');
    setShowSuggestions(false);
  };

  const removeSpec = (i: number) => {
    onSave(specs.filter((_, j) => j !== i));
  };

  return (
    <div>
      <span className="text-xs text-gray-400">Доп. специализации</span>
      <div className="flex flex-wrap gap-1.5 mt-1 mb-2">
        {specs.map((s, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-indigo-100 text-indigo-800"
          >
            {s}
            <button
              type="button"
              onClick={() => removeSpec(i)}
              className="hover:text-red-600"
            >
              &times;
            </button>
          </span>
        ))}
        {specs.length === 0 && <span className="text-xs text-gray-400">—</span>}
      </div>
      <div className="relative flex gap-2">
        <input
          value={newSpec}
          onChange={(e) => { setNewSpec(e.target.value); setShowSuggestions(true); }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSpec(newSpec); } }}
          className="flex-1 border border-gray-300 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none"
          placeholder="Добавить специализацию"
        />
        <button
          type="button"
          onClick={() => addSpec(newSpec)}
          className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          +
        </button>
        {showSuggestions && newSpec && filtered.length > 0 && (
          <div className="absolute top-full left-0 right-12 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto z-10">
            {filtered.slice(0, 10).map((s) => (
              <button
                key={s}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => addSpec(s)}
                className="block w-full text-left px-3 py-1.5 text-sm hover:bg-indigo-50 text-gray-700"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function formatSalary(salary: number | null, type: string | null): string {
  if (salary == null || !type) return '—';
  if (type === 'PERCENT_OF_VISIT') return `${salary}%`;
  return `${salary.toLocaleString('ru-RU')} \u20BD`;
}

function SalaryField({ candidate, onSave }: { candidate: ResumeCandidate; onSave: (data: Record<string, unknown>) => void }) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState<string>(candidate.desiredSalary?.toString() || '');
  const [type, setType] = useState<string>(candidate.desiredSalaryType || 'FIXED_RUB');

  const hasSalary = candidate.desiredSalary != null && candidate.desiredSalaryType != null;

  const handleSave = () => {
    const num = parseFloat(amount);
    if (!isNaN(num) && num > 0) {
      onSave({ desiredSalary: num, desiredSalaryType: type });
    }
    setEditing(false);
  };

  if (hasSalary && !editing) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400">Желаемая ЗП:</span>
        <span className="text-sm font-medium text-gray-700">
          {formatSalary(candidate.desiredSalary, candidate.desiredSalaryType)}
        </span>
        <button
          type="button"
          onClick={() => { setAmount(candidate.desiredSalary?.toString() || ''); setType(candidate.desiredSalaryType || 'FIXED_RUB'); setEditing(true); }}
          className="text-xs text-accent hover:underline"
        >
          Изменить
        </button>
      </div>
    );
  }

  if (!hasSalary && !editing) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400">Желаемая ЗП:</span>
        <span className="text-sm text-gray-400">—</span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs text-accent hover:underline"
        >
          Указать
        </button>
      </div>
    );
  }

  return (
    <div>
      <span className="text-xs text-gray-400 block mb-1">Желаемая ЗП</span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder={type === 'PERCENT_OF_VISIT' ? '30' : '80000'}
          className="w-28 border border-gray-300 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none"
        />
        <select
          value={type}
          onChange={e => setType(e.target.value)}
          className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none"
        >
          <option value="FIXED_RUB">{'\u20BD'} Фиксированная</option>
          <option value="PERCENT_OF_VISIT">% от приёма</option>
        </select>
        <button
          type="button"
          onClick={handleSave}
          className="px-2 py-1 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Сохранить
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
        >
          Отмена
        </button>
      </div>
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
