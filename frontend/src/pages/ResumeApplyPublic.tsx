import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useFieldArray, FormProvider } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { publicApi } from '../lib/api';
import { BRANCHES, QUALIFICATION_CATEGORIES } from '../lib/resume-constants';

/* ─── Schemas ─── */

const personalInfoSchema = z.object({
  fullName: z.string().min(2, 'Введите полное имя (минимум 2 символа)'),
  email: z.string().email('Некорректный email').or(z.literal('')).optional(),
  phone: z.string().optional(),
  birthDate: z.string().optional(),
  city: z.string().optional(),
  branches: z.array(z.string()).default([]),
});

const educationStepSchema = z.object({
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
});

const specializationSchema = z.object({
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
});

const workExperienceSchema = z.object({
  totalExperienceYears: z.coerce.number().nullable().optional(),
  specialtyExperienceYears: z.coerce.number().nullable().optional(),
  workHistory: z.array(z.object({
    organization: z.string().min(1, 'Укажите организацию'),
    position: z.string().min(1, 'Укажите должность'),
    department: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    isCurrent: z.boolean().default(false),
    description: z.string().optional(),
  })).default([]),
});

const additionalInfoSchema = z.object({
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
});

const applyFormSchema = personalInfoSchema
  .merge(educationStepSchema)
  .merge(specializationSchema)
  .merge(workExperienceSchema)
  .merge(additionalInfoSchema)
  .extend({
    consentToDataProcessing: z.literal(true, {
      message: 'Необходимо согласие на обработку персональных данных',
    }),
    website: z.string().optional(), // honeypot
    uploadedFileId: z.string().nullable().optional(),
    rawText: z.string().optional(),
  });

type ApplyFormData = z.infer<typeof applyFormSchema>;

const STEP_TITLES = ['Личные данные', 'Образование', 'Специализация', 'Опыт работы', 'Дополнительно', 'Проверка и отправка'];

const stepFields: (keyof ApplyFormData)[][] = [
  ['fullName', 'email', 'phone', 'birthDate', 'city', 'branches'],
  ['university', 'faculty', 'graduationYear', 'internshipPlace', 'internshipSpecialty', 'internshipYearEnd', 'residencyPlace', 'residencySpecialty', 'residencyYearEnd', 'education'],
  ['specialization', 'additionalSpecializations', 'qualificationCategory', 'categoryAssignedDate', 'categoryExpiryDate', 'accreditationStatus', 'accreditationDate', 'accreditationExpiryDate', 'certificateNumber', 'certificateIssueDate', 'certificateExpiryDate'],
  ['totalExperienceYears', 'specialtyExperienceYears', 'workHistory'],
  ['nmoPoints', 'publications', 'languages', 'additionalSkills', 'cmeCourses'],
  ['consentToDataProcessing'],
];

const DRAFT_KEY = 'kidney_resume_apply_draft';
const DRAFT_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

/* ─── Component ─── */

export default function ResumeApplyPublic() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [uploadedFileId, setUploadedFileId] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [specializations, setSpecializations] = useState<string[]>([]);

  useEffect(() => {
    publicApi.get<string[]>('/public/resume/apply/specializations')
      .then((r) => setSpecializations(r.data))
      .catch(() => {});
  }, []);

  // Load draft from localStorage
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
      fullName: '',
      email: '',
      phone: '',
      birthDate: '',
      city: '',
      branches: [],
      university: '',
      faculty: '',
      graduationYear: null,
      internshipPlace: '',
      internshipSpecialty: '',
      internshipYearEnd: null,
      residencyPlace: '',
      residencySpecialty: '',
      residencyYearEnd: null,
      education: [],
      specialization: '',
      additionalSpecializations: [],
      qualificationCategory: 'NONE',
      categoryAssignedDate: '',
      categoryExpiryDate: '',
      accreditationStatus: false,
      accreditationDate: '',
      accreditationExpiryDate: '',
      certificateNumber: '',
      certificateIssueDate: '',
      certificateExpiryDate: '',
      totalExperienceYears: null,
      specialtyExperienceYears: null,
      workHistory: [],
      nmoPoints: null,
      publications: '',
      languages: [],
      additionalSkills: '',
      cmeCourses: [],
      consentToDataProcessing: undefined as unknown as true,
      website: '',
      uploadedFileId: null,
      rawText: '',
      ...draft,
    },
    mode: 'onBlur',
  });

  const { register, trigger, watch, setValue, handleSubmit, formState: { errors } } = methods;

  // Auto-save draft
  useEffect(() => {
    const sub = watch((data) => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ data, ts: Date.now() }));
      } catch { /* ignore */ }
    });
    return () => sub.unsubscribe();
  }, [watch]);

  const goNext = async () => {
    const fields = stepFields[step];
    const valid = await trigger(fields as (keyof ApplyFormData)[]);
    if (valid) setStep((s) => Math.min(s + 1, 5));
  };

  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await publicApi.post<{ id: string }>('/public/resume/apply/upload', form);
      setUploadedFileId(res.data.id);
      setUploadedFileName(file.name);
      setValue('uploadedFileId', res.data.id);
    } catch {
      setError('Ошибка загрузки файла');
    } finally {
      setUploading(false);
    }
    e.target.value = '';
  };

  const onSubmit = async (data: ApplyFormData) => {
    if (data.website) return; // honeypot
    setSubmitting(true);
    setError('');
    try {
      await publicApi.post('/public/resume/apply/submit', {
        ...data,
        uploadedFileId: uploadedFileId || undefined,
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

  const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent/30 focus:border-accent';
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Подать резюме</h1>
          <p className="text-sm text-gray-500 mt-1">Заполните форму, чтобы стать частью нашей команды</p>
        </div>

        {/* Step indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            {STEP_TITLES.map((_title, i) => (
              <div key={i} className="flex items-center">
                <button
                  type="button"
                  onClick={() => i < step && setStep(i)}
                  disabled={i > step}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                    i < step
                      ? 'bg-green-500 text-white cursor-pointer'
                      : i === step
                        ? 'bg-accent text-white'
                        : 'bg-gray-200 text-gray-400'
                  }`}
                >
                  {i < step ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </button>
                {i < STEP_TITLES.length - 1 && (
                  <div className={`w-8 lg:w-16 h-0.5 mx-1 ${i < step ? 'bg-green-500' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>
          <p className="text-center text-sm font-medium text-gray-700">
            Шаг {step + 1}: {STEP_TITLES[step]}
          </p>
        </div>

        {/* Honeypot */}
        <div className="absolute" style={{ left: '-9999px', top: '-9999px' }} aria-hidden="true">
          <input type="text" tabIndex={-1} autoComplete="off" {...register('website')} />
        </div>

        <FormProvider {...methods}>
          <form onSubmit={handleSubmit(onSubmit as any)}>
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              {/* Step 0: Personal info */}
              {step === 0 && (
                <div className="space-y-4">
                  <div>
                    <label className={labelClass}>ФИО *</label>
                    <input {...register('fullName')} className={inputClass} placeholder="Иванов Иван Иванович" />
                    {errors.fullName && <p className="text-xs text-red-600 mt-1">{errors.fullName.message}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Email</label>
                      <input {...register('email')} type="email" className={inputClass} placeholder="email@example.com" />
                      {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email.message}</p>}
                    </div>
                    <div>
                      <label className={labelClass}>Телефон</label>
                      <input {...register('phone')} type="tel" className={inputClass} placeholder="+7 (999) 123-45-67" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Дата рождения</label>
                      <input {...register('birthDate')} type="date" className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Город</label>
                      <input {...register('city')} className={inputClass} placeholder="Москва" />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Филиалы</label>
                    <div className="flex gap-2 flex-wrap">
                      {BRANCHES.map((b) => {
                        const branches = watch('branches') || [];
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
                  </div>
                </div>
              )}

              {/* Step 1: Education */}
              {step === 1 && <EducationStepInner />}

              {/* Step 2: Specialization */}
              {step === 2 && <SpecializationStepInner specializations={specializations} />}

              {/* Step 3: Work experience */}
              {step === 3 && <WorkExperienceStepInner />}

              {/* Step 4: Additional info */}
              {step === 4 && <AdditionalInfoStepInner />}

              {/* Step 5: Review + file upload + submit */}
              {step === 5 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">Загрузка резюме (опционально)</h3>
                    <div className="flex items-center gap-3">
                      <label className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 cursor-pointer hover:bg-gray-50 transition-colors">
                        {uploading ? 'Загрузка...' : 'Выбрать файл'}
                        <input type="file" accept=".pdf,.docx,.txt" onChange={handleFileUpload} className="hidden" disabled={uploading} />
                      </label>
                      {uploadedFileName && <span className="text-sm text-green-600">{uploadedFileName}</span>}
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Или вставьте текст резюме</label>
                    <textarea {...register('rawText')} rows={4} className={inputClass} placeholder="Текст резюме..." />
                  </div>

                  <ReviewSummary />

                  <div>
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
                      <p className="text-xs text-red-600 mt-1">{errors.consentToDataProcessing.message}</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between mt-6">
              {step > 0 ? (
                <button type="button" onClick={goBack} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                  Назад
                </button>
              ) : (
                <div />
              )}
              {step < 5 ? (
                <button type="button" onClick={goNext} className="px-6 py-2 text-sm font-medium rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors">
                  Далее
                </button>
              ) : (
                <button type="submit" disabled={submitting} className="px-6 py-2 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors">
                  {submitting ? 'Отправка...' : 'Отправить заявку'}
                </button>
              )}
            </div>
          </form>
        </FormProvider>
      </div>
    </div>
  );
}

/* ─── Step Components ─── */

function EducationStepInner() {
  const methods = useFormContextTyped();
  const { register, control } = methods;
  const { fields: eduFields, append: appendEdu, remove: removeEdu } = useFieldArray({ control, name: 'education' });

  const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent/30 focus:border-accent';
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1';

  return (
    <div className="space-y-4">
      <div>
        <label className={labelClass}>ВУЗ</label>
        <input {...register('university')} className={inputClass} placeholder="Название медицинского ВУЗа" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Факультет</label>
          <input {...register('faculty')} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Год выпуска</label>
          <input {...register('graduationYear', { valueAsNumber: true })} type="number" min={1950} max={2040} className={inputClass} />
        </div>
      </div>
      <hr className="border-gray-200" />
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className={labelClass}>Интернатура</label>
          <input {...register('internshipPlace')} className={inputClass} placeholder="Место" />
        </div>
        <div>
          <label className={labelClass}>Специальность</label>
          <input {...register('internshipSpecialty')} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Год окончания</label>
          <input {...register('internshipYearEnd', { valueAsNumber: true })} type="number" min={1950} max={2040} className={inputClass} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className={labelClass}>Ординатура</label>
          <input {...register('residencyPlace')} className={inputClass} placeholder="Место" />
        </div>
        <div>
          <label className={labelClass}>Специальность</label>
          <input {...register('residencySpecialty')} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Год окончания</label>
          <input {...register('residencyYearEnd', { valueAsNumber: true })} type="number" min={1950} max={2040} className={inputClass} />
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
              <input {...register(`education.${i}.institution`)} className={inputClass} placeholder="Учебное заведение *" />
              <div className="grid grid-cols-2 gap-2">
                <input {...register(`education.${i}.faculty`)} className={inputClass} placeholder="Факультет" />
                <input {...register(`education.${i}.specialty`)} className={inputClass} placeholder="Специальность" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input {...register(`education.${i}.startYear`, { valueAsNumber: true })} type="number" className={inputClass} placeholder="Год начала" />
                <input {...register(`education.${i}.endYear`, { valueAsNumber: true })} type="number" className={inputClass} placeholder="Год окончания" />
                <select {...register(`education.${i}.type`)} className={inputClass}>
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
    </div>
  );
}

function SpecializationStepInner({ specializations }: { specializations: string[] }) {
  const { register, watch, setValue } = useFormContextTyped();
  const accreditationStatus = watch('accreditationStatus');
  const addSpecs = watch('additionalSpecializations') || [];
  const [newSpec, setNewSpec] = useState('');

  const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent/30 focus:border-accent';
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1';

  return (
    <div className="space-y-4">
      <div>
        <label className={labelClass}>Основная специализация</label>
        <select {...register('specialization')} className={inputClass}>
          <option value="">Выберите...</option>
          {specializations.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>Дополнительные специализации</label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {addSpecs.map((s: string, i: number) => (
            <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-indigo-100 text-indigo-800">
              {s}
              <button type="button" onClick={() => setValue('additionalSpecializations', addSpecs.filter((_: string, j: number) => j !== i))} className="hover:text-red-600">&times;</button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={newSpec} onChange={(e) => setNewSpec(e.target.value)} className={inputClass} placeholder="Добавить специализацию" />
          <button
            type="button"
            onClick={() => { if (newSpec.trim()) { setValue('additionalSpecializations', [...addSpecs, newSpec.trim()]); setNewSpec(''); } }}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >+</button>
        </div>
      </div>
      <div>
        <label className={labelClass}>Квалификационная категория</label>
        <select {...register('qualificationCategory')} className={inputClass}>
          {Object.entries(QUALIFICATION_CATEGORIES).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Дата присвоения категории</label>
          <input {...register('categoryAssignedDate')} type="date" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Дата окончания категории</label>
          <input {...register('categoryExpiryDate')} type="date" className={inputClass} />
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
              <label className={labelClass}>Дата аккредитации</label>
              <input {...register('accreditationDate')} type="date" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Действует до</label>
              <input {...register('accreditationExpiryDate')} type="date" className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Номер сертификата</label>
            <input {...register('certificateNumber')} className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Сертификат выдан</label>
              <input {...register('certificateIssueDate')} type="date" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Сертификат действует до</label>
              <input {...register('certificateExpiryDate')} type="date" className={inputClass} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WorkExperienceStepInner() {
  const { register, control } = useFormContextTyped();
  const { fields, append, remove } = useFieldArray({ control, name: 'workHistory' });

  const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent/30 focus:border-accent';
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Общий стаж (лет)</label>
          <input {...register('totalExperienceYears', { valueAsNumber: true })} type="number" step="0.5" min={0} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Стаж по специальности (лет)</label>
          <input {...register('specialtyExperienceYears', { valueAsNumber: true })} type="number" step="0.5" min={0} className={inputClass} />
        </div>
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
                <input {...register(`workHistory.${i}.organization`)} className={inputClass} placeholder="Организация *" />
                <input {...register(`workHistory.${i}.position`)} className={inputClass} placeholder="Должность *" />
              </div>
              <input {...register(`workHistory.${i}.department`)} className={inputClass} placeholder="Отделение" />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-400">Начало</label>
                  <input {...register(`workHistory.${i}.startDate`)} type="month" className={inputClass} />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Окончание</label>
                  <input {...register(`workHistory.${i}.endDate`)} type="month" className={inputClass} />
                </div>
              </div>
              <label className="flex items-center gap-2">
                <input type="checkbox" {...register(`workHistory.${i}.isCurrent`)} className="rounded border-gray-300 text-accent" />
                <span className="text-xs text-gray-600">По настоящее время</span>
              </label>
              <textarea {...register(`workHistory.${i}.description`)} className={inputClass} rows={2} placeholder="Описание обязанностей" />
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
    </div>
  );
}

function AdditionalInfoStepInner() {
  const { register, control, watch, setValue } = useFormContextTyped();
  const { fields, append, remove } = useFieldArray({ control, name: 'cmeCourses' });
  const languages = watch('languages') || [];
  const [newLang, setNewLang] = useState('');

  const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent/30 focus:border-accent';
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1';

  return (
    <div className="space-y-4">
      <div>
        <label className={labelClass}>Баллы НМО</label>
        <input {...register('nmoPoints', { valueAsNumber: true })} type="number" min={0} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Публикации</label>
        <textarea {...register('publications')} className={inputClass} rows={3} placeholder="Список публикаций..." />
      </div>
      <div>
        <label className={labelClass}>Языки</label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {languages.map((lang: string, i: number) => (
            <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800">
              {lang}
              <button type="button" onClick={() => setValue('languages', languages.filter((_: string, j: number) => j !== i))} className="hover:text-red-600">&times;</button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={newLang} onChange={(e) => setNewLang(e.target.value)} className={inputClass} placeholder="Добавить язык" />
          <button type="button" onClick={() => { if (newLang.trim()) { setValue('languages', [...languages, newLang.trim()]); setNewLang(''); } }} className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">+</button>
        </div>
      </div>
      <div>
        <label className={labelClass}>Дополнительные навыки</label>
        <textarea {...register('additionalSkills')} className={inputClass} rows={2} />
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
              <input {...register(`cmeCourses.${i}.courseName`)} className={inputClass} placeholder="Название курса *" />
              <div className="grid grid-cols-2 gap-2">
                <input {...register(`cmeCourses.${i}.provider`)} className={inputClass} placeholder="Организатор" />
                <input {...register(`cmeCourses.${i}.completedAt`)} type="month" className={inputClass} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input {...register(`cmeCourses.${i}.hours`, { valueAsNumber: true })} type="number" className={inputClass} placeholder="Часы" />
                <input {...register(`cmeCourses.${i}.nmoPoints`, { valueAsNumber: true })} type="number" className={inputClass} placeholder="Баллы НМО" />
                <input {...register(`cmeCourses.${i}.certificateNumber`)} className={inputClass} placeholder="Номер серт." />
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
    </div>
  );
}

function ReviewSummary() {
  const { watch } = useFormContextTyped();
  const data = watch();

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-900">Проверьте данные</h3>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <ReviewField label="ФИО" value={data.fullName} />
        <ReviewField label="Email" value={data.email} />
        <ReviewField label="Телефон" value={data.phone} />
        <ReviewField label="Город" value={data.city} />
        <ReviewField label="Специализация" value={data.specialization} />
        <ReviewField label="Категория" value={QUALIFICATION_CATEGORIES[data.qualificationCategory || 'NONE']} />
        <ReviewField label="ВУЗ" value={data.university} />
        <ReviewField label="Год выпуска" value={data.graduationYear?.toString()} />
        <ReviewField label="Общий стаж" value={data.totalExperienceYears != null ? `${data.totalExperienceYears} лет` : undefined} />
        <ReviewField label="Стаж по спец." value={data.specialtyExperienceYears != null ? `${data.specialtyExperienceYears} лет` : undefined} />
      </div>
      {data.workHistory && data.workHistory.length > 0 && (
        <div>
          <span className="text-xs text-gray-400">Места работы: {data.workHistory.length}</span>
        </div>
      )}
      {data.education && data.education.length > 0 && (
        <div>
          <span className="text-xs text-gray-400">Доп. образование: {data.education.length}</span>
        </div>
      )}
    </div>
  );
}

function ReviewField({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <span className="text-xs text-gray-400">{label}:</span>{' '}
      <span className="text-gray-700">{value}</span>
    </div>
  );
}

/* ─── Helpers ─── */

import { useFormContext } from 'react-hook-form';

function useFormContextTyped() {
  return useFormContext<ApplyFormData>();
}
