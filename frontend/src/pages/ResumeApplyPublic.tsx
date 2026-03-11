import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useFieldArray, FormProvider, useFormContext } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { publicApi } from '../lib/api';
import { BRANCHES, QUALIFICATION_CATEGORIES } from '../lib/resume-constants';

/* ─── Schemas ─── */

const applyFormSchema = z.object({
  fullName: z.string().min(2, 'Введите полное имя (минимум 2 символа)'),
  email: z.string().email('Некорректный email').or(z.literal('')).optional(),
  phone: z.string().optional(),
  birthDate: z.string().optional(),
  city: z.string().optional(),
  branches: z.array(z.string()).default([]),
  university: z.string().optional(),
  faculty: z.string().optional(),
  graduationYear: z.coerce.number().min(1950).max(2040).nullable().optional(),
  internshipPlace: z.string().optional(),
  internshipSpecialty: z.string().optional(),
  internshipYearEnd: z.coerce.number().min(1950).max(2040).nullable().optional(),
  residencyPlace: z.string().optional(),
  residencySpecialty: z.string().optional(),
  residencyYearEnd: z.coerce.number().min(1950).max(2040).nullable().optional(),
  education: z.array(z.object({
    institution: z.string().min(1, 'Укажите учебное заведение'),
    faculty: z.string().optional(),
    specialty: z.string().optional(),
    degree: z.string().optional(),
    startYear: z.coerce.number().nullable().optional(),
    endYear: z.coerce.number().nullable().optional(),
    type: z.string().optional(),
  })).default([]),
  specialization: z.string().optional(),
  additionalSpecializations: z.array(z.string()).default([]),
  qualificationCategory: z.enum(['HIGHEST', 'FIRST', 'SECOND', 'NONE']).default('NONE'),
  categoryAssignedDate: z.string().optional(),
  categoryExpiryDate: z.string().optional(),
  accreditationStatus: z.boolean().default(false),
  accreditationDate: z.string().optional(),
  accreditationExpiryDate: z.string().optional(),
  certificateNumber: z.string().optional(),
  certificateIssueDate: z.string().optional(),
  certificateExpiryDate: z.string().optional(),
  totalExperienceYears: z.coerce.number().nullable().optional(),
  specialtyExperienceYears: z.coerce.number().nullable().optional(),
  desiredSalary: z.coerce.number().nullable().optional(),
  desiredSalaryType: z.string().nullable().optional(),
  workHistory: z.array(z.object({
    organization: z.string().min(1, 'Укажите организацию'),
    position: z.string().min(1, 'Укажите должность'),
    department: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    isCurrent: z.boolean().default(false),
    description: z.string().optional(),
  })).default([]),
  nmoPoints: z.coerce.number().nullable().optional(),
  publications: z.string().optional(),
  languages: z.array(z.string()).default([]),
  additionalSkills: z.string().optional(),
  cmeCourses: z.array(z.object({
    courseName: z.string().min(1, 'Укажите название курса'),
    provider: z.string().optional(),
    completedAt: z.string().optional(),
    hours: z.coerce.number().nullable().optional(),
    nmoPoints: z.coerce.number().nullable().optional(),
    certificateNumber: z.string().optional(),
  })).default([]),
  freeFormNote: z.string().optional(),
  consentToDataProcessing: z.literal(true, {
    message: 'Необходимо согласие на обработку персональных данных',
  }),
  website: z.string().optional(), // honeypot
});

type ApplyFormData = z.infer<typeof applyFormSchema>;

const DRAFT_KEY = 'kidney_resume_apply_draft';
const DRAFT_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

const INPUT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent/30 focus:border-accent';
const LABEL = 'block text-sm font-medium text-gray-700 mb-1';

/* ─── Component ─── */

export default function ResumeApplyPublic() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [specializations, setSpecializations] = useState<string[]>([]);

  useEffect(() => {
    publicApi.get<string[]>('/public/resume/apply/specializations')
      .then((r) => setSpecializations(r.data))
      .catch(() => {});
  }, []);

  const loadDraft = useCallback((): Partial<ApplyFormData> | undefined => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return undefined;
      const { data, ts } = JSON.parse(raw);
      if (Date.now() - ts > DRAFT_TTL) {
        localStorage.removeItem(DRAFT_KEY);
        return undefined;
      }
      return data;
    } catch {
      return undefined;
    }
  }, []);

  const draft = loadDraft();

  const methods = useForm<ApplyFormData>({
    resolver: zodResolver(applyFormSchema) as any,
    defaultValues: {
      fullName: '', email: '', phone: '', birthDate: '', city: '', branches: [],
      university: '', faculty: '', graduationYear: null,
      internshipPlace: '', internshipSpecialty: '', internshipYearEnd: null,
      residencyPlace: '', residencySpecialty: '', residencyYearEnd: null,
      education: [],
      specialization: '', additionalSpecializations: [],
      qualificationCategory: 'NONE', categoryAssignedDate: '', categoryExpiryDate: '',
      accreditationStatus: false, accreditationDate: '', accreditationExpiryDate: '',
      certificateNumber: '', certificateIssueDate: '', certificateExpiryDate: '',
      totalExperienceYears: null, specialtyExperienceYears: null,
      desiredSalary: null, desiredSalaryType: null, workHistory: [],
      nmoPoints: null, publications: '', languages: [], additionalSkills: '', cmeCourses: [],
      freeFormNote: '',
      consentToDataProcessing: undefined as unknown as true,
      website: '',
      ...draft,
    },
    mode: 'onBlur',
  });

  const { register, watch, handleSubmit, formState: { errors } } = methods;

  // Auto-save draft
  useEffect(() => {
    const sub = watch((data) => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ data, ts: Date.now() }));
      } catch { /* ignore */ }
    });
    return () => sub.unsubscribe();
  }, [watch]);

  const onSubmit = async (data: ApplyFormData) => {
    if (data.website) return; // honeypot
    setSubmitting(true);
    setError('');
    try {
      await publicApi.post('/public/resume/apply/submit', {
        ...data,
        email: data.email || undefined,
      });
      localStorage.removeItem(DRAFT_KEY);
      navigate('/resume/apply/success');
    } catch (err: unknown) {
      const resp = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string }; status?: number } }).response
        : null;
      if (resp?.status === 429) {
        setError('Слишком много заявок. Пожалуйста, попробуйте позже.');
      } else {
        setError(resp?.data?.message || 'Ошибка отправки заявки');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Подать резюме</h1>
          <p className="text-sm text-gray-500 mt-1">Заполните форму, чтобы стать частью нашей команды</p>
        </div>

        {/* Honeypot */}
        <div className="absolute" style={{ left: '-9999px', top: '-9999px' }} aria-hidden="true">
          <input type="text" tabIndex={-1} autoComplete="off" {...register('website')} />
        </div>

        <FormProvider {...methods}>
          <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-6">

            {/* ── Личные данные ── */}
            <Section title="Личные данные" num={1}>
              <div>
                <label className={LABEL}>ФИО *</label>
                <input {...register('fullName')} className={INPUT} placeholder="Иванов Иван Иванович" />
                {errors.fullName && <p className="text-xs text-red-600 mt-1">{errors.fullName.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL}>Email</label>
                  <input {...register('email')} type="email" className={INPUT} placeholder="email@example.com" />
                  {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email.message}</p>}
                </div>
                <div>
                  <label className={LABEL}>Телефон</label>
                  <input {...register('phone')} type="tel" className={INPUT} placeholder="+7 (999) 123-45-67" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL}>Дата рождения</label>
                  <input {...register('birthDate')} type="date" className={INPUT} />
                </div>
                <div>
                  <label className={LABEL}>Город</label>
                  <input {...register('city')} className={INPUT} placeholder="Москва" />
                </div>
              </div>
              <div>
                <label className={LABEL}>Филиалы</label>
                <BranchSelector />
              </div>
            </Section>

            {/* ── Образование ── */}
            <Section title="Образование" num={2}>
              <EducationFields />
            </Section>

            {/* ── Специализация ── */}
            <Section title="Специализация" num={3}>
              <SpecializationFields specializations={specializations} />
            </Section>

            {/* ── Опыт работы ── */}
            <Section title="Опыт работы" num={4}>
              <WorkExperienceFields />
            </Section>

            {/* ── Дополнительно ── */}
            <Section title="Дополнительная информация" num={5}>
              <AdditionalFields />
            </Section>

            {/* ── Свободная форма ── */}
            <Section title="Что ещё важно знать?" num={6} subtitle="Расскажите о себе то, о чём мы не спросили">
              <div>
                <textarea
                  {...register('freeFormNote')}
                  rows={4}
                  className={INPUT}
                  placeholder="Любая информация, которую вы хотели бы добавить..."
                />
              </div>
            </Section>

            {/* ── Согласие и отправка ── */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  {...register('consentToDataProcessing')}
                  className="mt-0.5 rounded border-gray-300 text-accent focus:ring-accent/30"
                />
                <span className="text-sm text-gray-600">
                  Я согласен(а) на обработку персональных данных в соответствии с политикой конфиденциальности
                </span>
              </label>
              {errors.consentToDataProcessing && (
                <p className="text-xs text-red-600">{errors.consentToDataProcessing.message}</p>
              )}

              {error && (
                <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full px-6 py-3 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {submitting ? 'Отправка...' : 'Отправить заявку'}
              </button>
            </div>
          </form>
        </FormProvider>
      </div>
    </div>
  );
}

/* ─── Section wrapper ─── */

function Section({ title, num, subtitle, children }: { title: string; num: number; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
      <div className="flex items-center gap-3 mb-1">
        <span className="w-7 h-7 rounded-full bg-accent text-white flex items-center justify-center text-xs font-medium shrink-0">
          {num}
        </span>
        <div>
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

/* ─── Field components ─── */

function useFormContextTyped() {
  return useFormContext<ApplyFormData>();
}

function BranchSelector() {
  const { watch, setValue } = useFormContextTyped();
  const branches = watch('branches') || [];
  return (
    <div className="flex gap-2 flex-wrap">
      {BRANCHES.map((b) => {
        const selected = branches.includes(b);
        return (
          <button
            key={b}
            type="button"
            onClick={() => {
              const next = selected ? branches.filter((x: string) => x !== b) : [...branches, b];
              setValue('branches', next);
            }}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              selected
                ? 'bg-accent text-white border-accent'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {b}
          </button>
        );
      })}
    </div>
  );
}

function EducationFields() {
  const { register, control } = useFormContextTyped();
  const { fields: eduFields, append: appendEdu, remove: removeEdu } = useFieldArray({ control, name: 'education' });

  return (
    <>
      <div>
        <label className={LABEL}>ВУЗ</label>
        <input {...register('university')} className={INPUT} placeholder="Название медицинского ВУЗа" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={LABEL}>Факультет</label>
          <input {...register('faculty')} className={INPUT} />
        </div>
        <div>
          <label className={LABEL}>Год выпуска</label>
          <input {...register('graduationYear', { valueAsNumber: true })} type="number" min={1950} max={2040} className={INPUT} />
        </div>
      </div>
      <hr className="border-gray-200" />
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className={LABEL}>Интернатура</label>
          <input {...register('internshipPlace')} className={INPUT} placeholder="Место" />
        </div>
        <div>
          <label className={LABEL}>Специальность</label>
          <input {...register('internshipSpecialty')} className={INPUT} />
        </div>
        <div>
          <label className={LABEL}>Год окончания</label>
          <input {...register('internshipYearEnd', { valueAsNumber: true })} type="number" min={1950} max={2040} className={INPUT} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className={LABEL}>Ординатура</label>
          <input {...register('residencyPlace')} className={INPUT} placeholder="Место" />
        </div>
        <div>
          <label className={LABEL}>Специальность</label>
          <input {...register('residencySpecialty')} className={INPUT} />
        </div>
        <div>
          <label className={LABEL}>Год окончания</label>
          <input {...register('residencyYearEnd', { valueAsNumber: true })} type="number" min={1950} max={2040} className={INPUT} />
        </div>
      </div>

      {eduFields.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-700">Дополнительное образование</h4>
          {eduFields.map((field, i) => (
            <div key={field.id} className="border border-gray-200 rounded-lg p-3 space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-gray-400">#{i + 1}</span>
                <button type="button" onClick={() => removeEdu(i)} className="text-xs text-red-600 hover:underline">Удалить</button>
              </div>
              <input {...register(`education.${i}.institution`)} className={INPUT} placeholder="Учебное заведение *" />
              <div className="grid grid-cols-2 gap-2">
                <input {...register(`education.${i}.faculty`)} className={INPUT} placeholder="Факультет" />
                <input {...register(`education.${i}.specialty`)} className={INPUT} placeholder="Специальность" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input {...register(`education.${i}.startYear`, { valueAsNumber: true })} type="number" className={INPUT} placeholder="Год начала" />
                <input {...register(`education.${i}.endYear`, { valueAsNumber: true })} type="number" className={INPUT} placeholder="Год окончания" />
                <select {...register(`education.${i}.type`)} className={INPUT}>
                  <option value="">Тип</option>
                  <option value="higher">Высшее</option>
                  <option value="internship">Интернатура</option>
                  <option value="residency">Ординатура</option>
                  <option value="retraining">Переподготовка</option>
                  <option value="other">Другое</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => appendEdu({ institution: '', faculty: '', specialty: '', degree: '', startYear: null, endYear: null, type: '' })}
        className="text-sm text-accent hover:underline"
      >
        + Добавить образование
      </button>
    </>
  );
}

function SpecializationFields({ specializations }: { specializations: string[] }) {
  const { register, watch, setValue } = useFormContextTyped();
  const accreditationStatus = watch('accreditationStatus');
  const addSpecs = watch('additionalSpecializations') || [];
  const [newSpec, setNewSpec] = useState('');

  return (
    <>
      <div>
        <label className={LABEL}>Основная специализация</label>
        <select {...register('specialization')} className={INPUT}>
          <option value="">Выберите...</option>
          {specializations.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={LABEL}>Дополнительные специализации</label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {addSpecs.map((s: string, i: number) => (
            <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-indigo-100 text-indigo-800">
              {s}
              <button type="button" onClick={() => setValue('additionalSpecializations', addSpecs.filter((_: string, j: number) => j !== i))} className="hover:text-red-600">&times;</button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={newSpec} onChange={(e) => setNewSpec(e.target.value)} className={INPUT} placeholder="Добавить специализацию" />
          <button
            type="button"
            onClick={() => { if (newSpec.trim()) { setValue('additionalSpecializations', [...addSpecs, newSpec.trim()]); setNewSpec(''); } }}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >+</button>
        </div>
      </div>
      <div>
        <label className={LABEL}>Квалификационная категория</label>
        <select {...register('qualificationCategory')} className={INPUT}>
          {Object.entries(QUALIFICATION_CATEGORIES).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={LABEL}>Дата присвоения категории</label>
          <input {...register('categoryAssignedDate')} type="date" className={INPUT} />
        </div>
        <div>
          <label className={LABEL}>Дата окончания категории</label>
          <input {...register('categoryExpiryDate')} type="date" className={INPUT} />
        </div>
      </div>
      <hr className="border-gray-200" />
      <label className="flex items-center gap-2">
        <input type="checkbox" {...register('accreditationStatus')} className="rounded border-gray-300 text-accent focus:ring-accent/30" />
        <span className="text-sm font-medium text-gray-700">Есть аккредитация</span>
      </label>
      {accreditationStatus && (
        <div className="space-y-4 pl-6 border-l-2 border-accent/20">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Дата аккредитации</label>
              <input {...register('accreditationDate')} type="date" className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Действует до</label>
              <input {...register('accreditationExpiryDate')} type="date" className={INPUT} />
            </div>
          </div>
          <div>
            <label className={LABEL}>Номер сертификата</label>
            <input {...register('certificateNumber')} className={INPUT} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Сертификат выдан</label>
              <input {...register('certificateIssueDate')} type="date" className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Сертификат действует до</label>
              <input {...register('certificateExpiryDate')} type="date" className={INPUT} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function WorkExperienceFields() {
  const { register, control } = useFormContextTyped();
  const { fields, append, remove } = useFieldArray({ control, name: 'workHistory' });

  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={LABEL}>Общий стаж (лет)</label>
          <input {...register('totalExperienceYears', { valueAsNumber: true })} type="number" step="0.5" min={0} className={INPUT} />
        </div>
        <div>
          <label className={LABEL}>Стаж по специальности (лет)</label>
          <input {...register('specialtyExperienceYears', { valueAsNumber: true })} type="number" step="0.5" min={0} className={INPUT} />
        </div>
      </div>

      <div>
        <label className={LABEL}>Желаемая зарплата</label>
        <div className="flex gap-2">
          <input
            {...register('desiredSalary', { valueAsNumber: true })}
            type="number"
            min={0}
            placeholder="Сумма или процент"
            className={INPUT + ' flex-1'}
          />
          <select {...register('desiredSalaryType')} className={INPUT + ' w-44'}>
            <option value="">Выберите формат</option>
            <option value="FIXED_RUB">{'\u20BD'} Фиксированная</option>
            <option value="PERCENT_OF_VISIT">% от приёма</option>
          </select>
        </div>
        <p className="text-xs text-gray-400 mt-1">Фиксированная сумма в рублях или процент от стоимости приёма</p>
      </div>

      {fields.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-700">Места работы</h4>
          {fields.map((field, i) => (
            <div key={field.id} className="border border-gray-200 rounded-lg p-3 space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-gray-400">#{i + 1}</span>
                <button type="button" onClick={() => remove(i)} className="text-xs text-red-600 hover:underline">Удалить</button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input {...register(`workHistory.${i}.organization`)} className={INPUT} placeholder="Организация *" />
                <input {...register(`workHistory.${i}.position`)} className={INPUT} placeholder="Должность *" />
              </div>
              <input {...register(`workHistory.${i}.department`)} className={INPUT} placeholder="Отделение" />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-400">Начало</label>
                  <input {...register(`workHistory.${i}.startDate`)} type="month" className={INPUT} />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Окончание</label>
                  <input {...register(`workHistory.${i}.endDate`)} type="month" className={INPUT} />
                </div>
              </div>
              <label className="flex items-center gap-2">
                <input type="checkbox" {...register(`workHistory.${i}.isCurrent`)} className="rounded border-gray-300 text-accent" />
                <span className="text-xs text-gray-600">По настоящее время</span>
              </label>
              <textarea {...register(`workHistory.${i}.description`)} className={INPUT} rows={2} placeholder="Описание обязанностей" />
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => append({ organization: '', position: '', department: '', startDate: '', endDate: '', isCurrent: false, description: '' })}
        className="text-sm text-accent hover:underline"
      >
        + Добавить место работы
      </button>
    </>
  );
}

function AdditionalFields() {
  const { register, control, watch, setValue } = useFormContextTyped();
  const { fields, append, remove } = useFieldArray({ control, name: 'cmeCourses' });
  const languages = watch('languages') || [];
  const [newLang, setNewLang] = useState('');

  return (
    <>
      <div>
        <label className={LABEL}>Баллы НМО</label>
        <input {...register('nmoPoints', { valueAsNumber: true })} type="number" min={0} className={INPUT} />
      </div>
      <div>
        <label className={LABEL}>Публикации</label>
        <textarea {...register('publications')} className={INPUT} rows={3} placeholder="Список публикаций..." />
      </div>
      <div>
        <label className={LABEL}>Языки</label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {languages.map((lang: string, i: number) => (
            <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800">
              {lang}
              <button type="button" onClick={() => setValue('languages', languages.filter((_: string, j: number) => j !== i))} className="hover:text-red-600">&times;</button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={newLang} onChange={(e) => setNewLang(e.target.value)} className={INPUT} placeholder="Добавить язык" />
          <button type="button" onClick={() => { if (newLang.trim()) { setValue('languages', [...languages, newLang.trim()]); setNewLang(''); } }} className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">+</button>
        </div>
      </div>
      <div>
        <label className={LABEL}>Дополнительные навыки</label>
        <textarea {...register('additionalSkills')} className={INPUT} rows={2} />
      </div>

      <hr className="border-gray-200" />

      {fields.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-700">Курсы повышения квалификации</h4>
          {fields.map((field, i) => (
            <div key={field.id} className="border border-gray-200 rounded-lg p-3 space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-gray-400">Курс #{i + 1}</span>
                <button type="button" onClick={() => remove(i)} className="text-xs text-red-600 hover:underline">Удалить</button>
              </div>
              <input {...register(`cmeCourses.${i}.courseName`)} className={INPUT} placeholder="Название курса *" />
              <div className="grid grid-cols-2 gap-2">
                <input {...register(`cmeCourses.${i}.provider`)} className={INPUT} placeholder="Организатор" />
                <input {...register(`cmeCourses.${i}.completedAt`)} type="month" className={INPUT} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input {...register(`cmeCourses.${i}.hours`, { valueAsNumber: true })} type="number" className={INPUT} placeholder="Часы" />
                <input {...register(`cmeCourses.${i}.nmoPoints`, { valueAsNumber: true })} type="number" className={INPUT} placeholder="Баллы НМО" />
                <input {...register(`cmeCourses.${i}.certificateNumber`)} className={INPUT} placeholder="Номер серт." />
              </div>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => append({ courseName: '', provider: '', completedAt: '', hours: null, nmoPoints: null, certificateNumber: '' })}
        className="text-sm text-accent hover:underline"
      >
        + Добавить курс
      </button>
    </>
  );
}
