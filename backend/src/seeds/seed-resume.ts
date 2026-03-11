import { AppDataSource } from '../config/typeorm-data-source';
import { ResumeCandidate } from '../resume/entities/resume-candidate.entity';
import { ResumeLead } from '../resume/entities/resume-lead.entity';
import { ResumeLeadTag } from '../resume/entities/resume-lead-tag.entity';
import { ResumeWorkHistory } from '../resume/entities/resume-work-history.entity';
import { ResumeEducation } from '../resume/entities/resume-education.entity';
import { ResumeCmeCourse } from '../resume/entities/resume-cme-course.entity';
import { ResumeCandidateTag } from '../resume/entities/resume-candidate-tag.entity';
import { ResumeCandidateNote } from '../resume/entities/resume-candidate-note.entity';
import {
  ResumeCandidateDoctorType,
  ResumeCandidateGender,
  ResumeCandidatePriority,
  ResumeCandidateStatus,
  ResumeLeadStatus,
  ResumeProcessingStatus,
  ResumeQualificationCategory,
  ResumeSalaryType,
} from '../resume/entities/resume.enums';

// ─── Справочные данные ───────────────────────────────────────────────

const MALE_FIRST_NAMES = [
  'Александр', 'Дмитрий', 'Сергей', 'Андрей', 'Михаил', 'Иван', 'Максим',
  'Артём', 'Владимир', 'Николай', 'Евгений', 'Павел', 'Олег', 'Денис',
  'Виталий', 'Роман', 'Антон', 'Константин', 'Юрий', 'Тимур',
];
const FEMALE_FIRST_NAMES = [
  'Елена', 'Мария', 'Ольга', 'Наталья', 'Анна', 'Екатерина', 'Татьяна',
  'Ирина', 'Светлана', 'Юлия', 'Виктория', 'Алина', 'Дарья', 'Ксения',
  'Полина', 'Валерия', 'Диана', 'Марина', 'Людмила', 'Галина',
];
const MALE_LAST_NAMES = [
  'Иванов', 'Петров', 'Сидоров', 'Кузнецов', 'Смирнов', 'Попов', 'Васильев',
  'Соколов', 'Михайлов', 'Новиков', 'Фёдоров', 'Морозов', 'Волков', 'Алексеев',
  'Лебедев', 'Семёнов', 'Егоров', 'Павлов', 'Козлов', 'Степанов',
];
const FEMALE_LAST_NAMES = [
  'Иванова', 'Петрова', 'Сидорова', 'Кузнецова', 'Смирнова', 'Попова', 'Васильева',
  'Соколова', 'Михайлова', 'Новикова', 'Фёдорова', 'Морозова', 'Волкова', 'Алексеева',
  'Лебедева', 'Семёнова', 'Егорова', 'Павлова', 'Козлова', 'Степанова',
];
const MALE_PATRONYMICS = [
  'Александрович', 'Дмитриевич', 'Сергеевич', 'Андреевич', 'Михайлович',
  'Иванович', 'Владимирович', 'Николаевич', 'Евгеньевич', 'Павлович',
];
const FEMALE_PATRONYMICS = [
  'Александровна', 'Дмитриевна', 'Сергеевна', 'Андреевна', 'Михайловна',
  'Ивановна', 'Владимировна', 'Николаевна', 'Евгеньевна', 'Павловна',
];

const UNIVERSITIES = [
  'Первый МГМУ им. И.М. Сеченова',
  'РНИМУ им. Н.И. Пирогова',
  'СПбГМУ им. акад. И.П. Павлова',
  'Казанский ГМУ',
  'Новосибирский ГМУ',
  'Самарский ГМУ',
  'Саратовский ГМУ им. В.И. Разумовского',
  'Башкирский ГМУ',
  'Уральский ГМУ',
  'Ростовский ГМУ',
  'Волгоградский ГМУ',
  'Красноярский ГМУ им. проф. В.Ф. Войно-Ясенецкого',
  'Кубанский ГМУ',
  'Тюменский ГМУ',
  'Пермский ГМУ им. акад. Е.А. Вагнера',
];

const FACULTIES = ['Лечебный', 'Педиатрический', 'Медико-профилактический'];

const SPECIALIZATIONS = [
  'Педиатр', 'Неонатолог', 'Хирург', 'Невролог', 'Кардиолог', 'Эндокринолог',
  'Гастроэнтеролог', 'Офтальмолог', 'Оториноларинголог (ЛОР)', 'Уролог',
  'Ортопед-травматолог', 'Аллерголог-иммунолог', 'Пульмонолог', 'Дерматолог',
  'Инфекционист', 'Реаниматолог-анестезиолог', 'Психиатр', 'Ревматолог',
  'Нефролог', 'Гематолог-онколог', 'Врач УЗД', 'Рентгенолог',
  'Клинический лабораторный диагност',
];

const CITIES = [
  'Москва', 'Санкт-Петербург', 'Казань', 'Новосибирск', 'Екатеринбург',
  'Самара', 'Ростов-на-Дону', 'Краснодар', 'Уфа', 'Пермь', 'Воронеж',
  'Волгоград', 'Красноярск', 'Тюмень', 'Челябинск', 'Нижний Новгород', 'Омск',
];

const ORGANIZATIONS = [
  'ГБУЗ «Детская городская клиническая больница №1»',
  'ГБУЗ «Городская поликлиника №5»',
  'ФГБУ «НМИЦ здоровья детей» Минздрава РФ',
  'ООО «МедСервис»',
  'ГБУЗ «Областная детская клиническая больница»',
  'ГБУЗ «Городская клиническая больница №3»',
  'ООО «Клиника Семейная»',
  'ГБУЗ «Республиканская детская клиническая больница»',
  'ООО «Медицинский центр Здоровье»',
  'ГБУЗ «Городская поликлиника №12»',
  'ФГБОУ ВО «Первый МГМУ им. Сеченова» (клиника)',
  'ГБУЗ «Детская поликлиника №7»',
  'ООО «Центр Педиатрии»',
  'ГБУЗ «Перинатальный центр»',
  'ООО «Медицина 24/7»',
  'ГБУЗ «Городская больница №9»',
  'ООО «Клиника доктора Иванова»',
  'ГБУЗ «Краевая клиническая больница»',
];

const POSITIONS = [
  'Врач-педиатр', 'Врач-терапевт', 'Врач-невролог', 'Врач-кардиолог',
  'Врач-хирург', 'Врач-эндокринолог', 'Врач-офтальмолог', 'Врач-ЛОР',
  'Врач-уролог', 'Врач-дерматолог', 'Врач-пульмонолог', 'Врач-аллерголог',
  'Врач УЗД', 'Заведующий отделением', 'Старший врач', 'Врач-ординатор',
];

const DEPARTMENTS = [
  'Педиатрическое отделение', 'Терапевтическое отделение', 'Хирургическое отделение',
  'Отделение неотложной помощи', 'Поликлиническое отделение', 'Отделение реанимации',
  'Диагностическое отделение', 'Консультативное отделение',
];

const CME_COURSES = [
  'Актуальные вопросы педиатрии',
  'Неотложная помощь в педиатрии',
  'Вакцинопрофилактика инфекционных заболеваний',
  'Ультразвуковая диагностика в педиатрии',
  'Клиническая фармакология в педиатрии',
  'Нутрициология детского возраста',
  'Детская кардиология',
  'Аллергология и иммунология детского возраста',
  'Современные методы диагностики',
  'Основы доказательной медицины',
  'Клиническая лабораторная диагностика',
  'Функциональная диагностика',
  'Организация здравоохранения',
  'Медицинская реабилитация',
  'Инфекционные болезни у детей',
  'Пульмонология детского возраста',
];

const CME_PROVIDERS = [
  'ФГБОУ ДПО РМАНПО Минздрава России',
  'Первый МГМУ им. Сеченова (ДПО)',
  'РНИМУ им. Пирогова (ДПО)',
  'Портал НМО',
  'Академия медицинского образования',
  'Казанская ГМА',
  'СПбМАПО',
  'ЦНИИ организации и информатизации здравоохранения',
];

const TAG_LABELS = [
  'Срочно', 'VIP', 'Рекомендован', 'Опыт в стационаре', 'Опыт в поликлинике',
  'Готов к переезду', 'Частичная занятость', 'Высокий рейтинг', 'Обратить внимание',
  'Знание английского', 'С публикациями', 'Молодой специалист',
];

const TAG_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6',
  '#8b5cf6', '#ec4899', '#06b6d4', '#64748b', '#10b981',
];

const LEAD_SOURCES = [
  'hh.ru', 'Telegram', 'Рекомендация', 'Сайт клиники', 'SuperJob',
  'Ярмарка вакансий', 'LinkedIn', 'Avito', 'Звонок',
];

const NOTE_AUTHORS = ['Иванова Е.В.', 'Петров А.С.', 'HR-менеджер', 'Главврач', 'Зав. отделением'];

const NOTE_TEXTS = [
  'Хороший кандидат, рекомендую пригласить на собеседование.',
  'Опыт работы в стационаре подтверждён.',
  'Ожидает обратную связь по результатам интервью.',
  'Готов приступить к работе в течение 2 недель.',
  'Высокая квалификация, рекомендации от предыдущего работодателя.',
  'Необходимо уточнить информацию о сертификации.',
  'Кандидат заинтересован в работе в поликлинике.',
  'Отличные отзывы от коллег.',
  'Требуется дополнительное собеседование с заведующим отделением.',
  'Кандидат рассматривает несколько предложений, нужно ускорить процесс.',
];

const BRANCHES = [
  'Каспийск', 'Махачкала', 'Хасавюрт',
];

const LANGUAGES_LIST = ['Английский', 'Немецкий', 'Французский', 'Китайский', 'Татарский', 'Башкирский'];

const LEAD_NOTES = [
  'Звонил, интересуется вакансией педиатра.',
  'Оставил заявку на сайте.',
  'Рекомендация от действующего сотрудника.',
  'Прислал резюме на email.',
  'Обратился через Telegram-бот.',
  'Посетил ярмарку вакансий, оставил контакты.',
  'Перезвонить через неделю.',
  'Интересуется условиями работы и графиком.',
  'Готов рассмотреть частичную занятость.',
  'Ищет работу в связи с переездом.',
];

const SKILLS = [
  'Навыки работы с аппаратом ИВЛ',
  'Владение методами ультразвуковой диагностики',
  'Опыт работы в реанимации новорождённых',
  'Навыки проведения эндоскопических исследований',
  'Опыт работы с МИС (медицинские информационные системы)',
  'Навыки оказания экстренной медицинской помощи',
  'Опыт работы с электронным документооборотом',
  'Навыки консультирования пациентов',
];

// ─── Утилиты ─────────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: T[], min: number, max: number): T[] {
  const n = randInt(min, max);
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, arr.length));
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min: number, max: number, decimals = 1): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function maybe<T>(fn: () => T, probability = 0.7): T | null {
  return Math.random() < probability ? fn() : null;
}

function randDate(yearFrom: number, yearTo: number): Date {
  const year = randInt(yearFrom, yearTo);
  const month = randInt(0, 11);
  const day = randInt(1, 28);
  return new Date(year, month, day);
}

function generatePhone(index: number): string {
  const base = 9000000000 + index * 37 + randInt(0, 36);
  return `+7${base}`;
}

const TRANSLIT: Record<string, string> = {
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e',
  'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
  'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
  'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch',
  'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
};

function transliterate(str: string): string {
  return str.toLowerCase().split('').map(c => TRANSLIT[c] || c).join('').replace(/[^a-z0-9]/g, '');
}

function generateEmail(fullName: string, index: number): string {
  const parts = fullName.split(' ');
  const last = transliterate(parts[0]);
  const firstInitial = transliterate(parts[1]?.[0] || '');
  const domains = ['mail.ru', 'yandex.ru', 'gmail.com', 'rambler.ru', 'inbox.ru'];
  return `${last}.${firstInitial}${index}@${pick(domains)}`;
}

// ─── Фабрики ─────────────────────────────────────────────────────────

function pickWeighted<T>(options: [T, number][]): T {
  const total = options.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [val, weight] of options) {
    r -= weight;
    if (r <= 0) return val;
  }
  return options[options.length - 1][0];
}

function createCandidate(index: number): Partial<ResumeCandidate> {
  const gender = pickWeighted<ResumeCandidateGender>([
    [ResumeCandidateGender.FEMALE, 55],
    [ResumeCandidateGender.MALE, 40],
    [ResumeCandidateGender.UNKNOWN, 5],
  ]);

  const isMale = gender === ResumeCandidateGender.MALE ||
    (gender === ResumeCandidateGender.UNKNOWN && Math.random() > 0.5);

  const firstName = isMale ? pick(MALE_FIRST_NAMES) : pick(FEMALE_FIRST_NAMES);
  const lastName = isMale ? pick(MALE_LAST_NAMES) : pick(FEMALE_LAST_NAMES);
  const patronymic = isMale ? pick(MALE_PATRONYMICS) : pick(FEMALE_PATRONYMICS);
  const fullName = `${lastName} ${firstName} ${patronymic}`;

  const university = pick(UNIVERSITIES);
  const faculty = pick(FACULTIES);
  const graduationYear = randInt(1990, 2022);
  const totalExp = Math.max(1, 2026 - graduationYear + randInt(-2, 0));
  const specExp = randFloat(totalExp * 0.3, totalExp * 0.9);

  const specialization = pick(SPECIALIZATIONS);
  const additionalSpecs = Math.random() > 0.6 ? pickN(
    SPECIALIZATIONS.filter(s => s !== specialization), 1, 2,
  ) : [];

  const qualCategory = pickWeighted<ResumeQualificationCategory>([
    [ResumeQualificationCategory.HIGHEST, 20],
    [ResumeQualificationCategory.FIRST, 25],
    [ResumeQualificationCategory.SECOND, 15],
    [ResumeQualificationCategory.NONE, 40],
  ]);

  const hasAccreditation = Math.random() < 0.7;
  const accreditationDate = hasAccreditation ? randDate(2019, 2025) : null;
  const accreditationExpiryDate = accreditationDate
    ? new Date(accreditationDate.getFullYear() + 5, accreditationDate.getMonth(), accreditationDate.getDate())
    : null;

  const hasCert = hasAccreditation && Math.random() < 0.8;
  const certIssueDate = hasCert ? randDate(2018, 2025) : null;
  const certExpiryDate = certIssueDate
    ? new Date(certIssueDate.getFullYear() + 5, certIssueDate.getMonth(), certIssueDate.getDate())
    : null;

  const hasSalary = Math.random() < 0.7;

  const status = pickWeighted<ResumeCandidateStatus>([
    [ResumeCandidateStatus.NEW, 25],
    [ResumeCandidateStatus.REVIEWING, 15],
    [ResumeCandidateStatus.INVITED, 10],
    [ResumeCandidateStatus.ONLINE_INTERVIEW, 5],
    [ResumeCandidateStatus.INTERVIEW, 10],
    [ResumeCandidateStatus.TRIAL, 5],
    [ResumeCandidateStatus.INTERNSHIP, 3],
    [ResumeCandidateStatus.HIRED, 7],
    [ResumeCandidateStatus.REJECTED, 12],
    [ResumeCandidateStatus.RESERVE, 8],
  ]);

  const priority = pickWeighted<ResumeCandidatePriority>([
    [ResumeCandidatePriority.ACTIVE, 50],
    [ResumeCandidatePriority.RESERVE, 15],
    [ResumeCandidatePriority.NOT_SUITABLE, 15],
    [ResumeCandidatePriority.ARCHIVE, 15],
    [ResumeCandidatePriority.DELETED, 5],
  ]);

  const city = pick(CITIES);

  const hasResidency = Math.random() < 0.6;
  const hasInternship = graduationYear < 2017 && Math.random() < 0.5;

  const categoryDate = qualCategory !== ResumeQualificationCategory.NONE
    ? randDate(2015, 2024) : null;
  const categoryExpiry = categoryDate
    ? new Date(categoryDate.getFullYear() + 5, categoryDate.getMonth(), categoryDate.getDate())
    : null;

  return {
    fullName,
    email: generateEmail(fullName, index),
    phone: generatePhone(index),
    birthDate: randDate(1960, 2000),
    city,
    gender,
    doctorTypes: pickN(Object.values(ResumeCandidateDoctorType), 1, 2),
    university,
    faculty,
    graduationYear,
    internshipPlace: hasInternship ? pick(UNIVERSITIES) : null,
    internshipSpecialty: hasInternship ? specialization : null,
    internshipYearEnd: hasInternship ? graduationYear + 1 : null,
    residencyPlace: hasResidency ? pick(UNIVERSITIES) : null,
    residencySpecialty: hasResidency ? specialization : null,
    residencyYearEnd: hasResidency ? graduationYear + (hasInternship ? 3 : 2) : null,
    specialization,
    additionalSpecializations: additionalSpecs,
    qualificationCategory: qualCategory,
    categoryAssignedDate: categoryDate,
    categoryExpiryDate: categoryExpiry,
    accreditationStatus: hasAccreditation,
    accreditationDate,
    accreditationExpiryDate,
    certificateNumber: hasCert ? `${randInt(1000, 9999)}-${randInt(1000000, 9999999)}` : null,
    certificateIssueDate: certIssueDate,
    certificateExpiryDate: certExpiryDate,
    totalExperienceYears: totalExp,
    specialtyExperienceYears: specExp,
    nmoPoints: maybe(() => randInt(10, 250)),
    publications: maybe(() => `${randInt(1, 15)} публикаций в рецензируемых журналах`, 0.3),
    languages: ['Русский', ...pickN(LANGUAGES_LIST, 0, 1)],
    additionalSkills: maybe(() => pickN(SKILLS, 1, 3).join('; '), 0.5),
    branches: pickN(BRANCHES, 0, 2),
    status,
    priority,
    processingStatus: ResumeProcessingStatus.COMPLETED,
    aiConfidence: randFloat(0.65, 0.99, 2),
    aiScore: randFloat(30, 98),
    desiredSalary: hasSalary ? Math.round(randInt(60, 300) / 5) * 5000 : null,
    desiredSalaryType: hasSalary
      ? (Math.random() < 0.8 ? ResumeSalaryType.FIXED_RUB : ResumeSalaryType.PERCENT_OF_VISIT)
      : null,
  };
}

function createWorkHistoryItems(candidateId: string, city: string, specialization: string): Partial<ResumeWorkHistory>[] {
  const count = randInt(1, 4);
  const items: Partial<ResumeWorkHistory>[] = [];

  for (let i = 0; i < count; i++) {
    const startYear = randInt(2005, 2023 - (count - i));
    const isCurrent = i === count - 1;
    const endYear = isCurrent ? null : startYear + randInt(1, 4);

    items.push({
      candidateId,
      organization: pick(ORGANIZATIONS),
      position: pick(POSITIONS),
      department: maybe(() => pick(DEPARTMENTS), 0.6),
      city: maybe(() => city, 0.8) || pick(CITIES),
      startDate: new Date(startYear, randInt(0, 11), 1),
      endDate: endYear ? new Date(endYear, randInt(0, 11), 1) : null,
      isCurrent,
      description: maybe(() => `Работа в качестве ${specialization.toLowerCase()}. Приём пациентов, ведение документации.`, 0.4),
    });
  }

  return items;
}

function createEducationItems(
  candidateId: string,
  university: string,
  faculty: string,
  gradYear: number,
  specialization: string,
  hasResidency: boolean,
  hasInternship: boolean,
): Partial<ResumeEducation>[] {
  const items: Partial<ResumeEducation>[] = [];

  items.push({
    candidateId,
    institution: university,
    faculty,
    specialty: 'Лечебное дело',
    degree: 'Специалист',
    city: pick(CITIES),
    startYear: gradYear - 6,
    endYear: gradYear,
    type: 'higher',
  });

  if (hasInternship) {
    items.push({
      candidateId,
      institution: pick(UNIVERSITIES),
      faculty: null,
      specialty: specialization,
      degree: 'Интернатура',
      city: pick(CITIES),
      startYear: gradYear,
      endYear: gradYear + 1,
      type: 'internship',
    });
  }

  if (hasResidency) {
    items.push({
      candidateId,
      institution: pick(UNIVERSITIES),
      faculty: null,
      specialty: specialization,
      degree: 'Ординатура',
      city: pick(CITIES),
      startYear: hasInternship ? gradYear + 1 : gradYear,
      endYear: hasInternship ? gradYear + 3 : gradYear + 2,
      type: 'residency',
    });
  }

  return items;
}

function createCmeCourseItems(candidateId: string): Partial<ResumeCmeCourse>[] {
  const count = randInt(0, 5);
  if (count === 0) return [];

  return pickN(CME_COURSES, count, count).map(courseName => ({
    candidateId,
    courseName,
    provider: pick(CME_PROVIDERS),
    completedAt: randDate(2019, 2025),
    hours: pick([18, 36, 72, 108, 144]),
    nmoPoints: pick([6, 12, 18, 24, 36]),
    certificateNumber: maybe(() => `НМО-${randInt(100000, 999999)}`, 0.6),
  }));
}

function createCandidateTagItems(candidateId: string): Partial<ResumeCandidateTag>[] {
  const count = randInt(0, 3);
  if (count === 0) return [];

  return pickN(TAG_LABELS, count, count).map(label => ({
    candidateId,
    label,
    color: pick(TAG_COLORS),
  }));
}

function createCandidateNoteItems(candidateId: string): Partial<ResumeCandidateNote>[] {
  const count = randInt(0, 2);
  if (count === 0) return [];

  return Array.from({ length: count }, () => ({
    candidateId,
    content: pick(NOTE_TEXTS),
    authorName: pick(NOTE_AUTHORS),
  }));
}

function createLead(index: number): Partial<ResumeLead> {
  const isMale = Math.random() > 0.55;
  const firstName = isMale ? pick(MALE_FIRST_NAMES) : pick(FEMALE_FIRST_NAMES);
  const lastName = isMale ? pick(MALE_LAST_NAMES) : pick(FEMALE_LAST_NAMES);
  const patronymic = isMale ? pick(MALE_PATRONYMICS) : pick(FEMALE_PATRONYMICS);
  const name = `${lastName} ${firstName} ${patronymic}`;

  const hasSalary = Math.random() < 0.5;

  return {
    name,
    phone: generatePhone(200 + index),
    email: maybe(() => generateEmail(name, 200 + index), 0.7),
    city: maybe(() => pick(CITIES), 0.8),
    specialization: maybe(() => pick(SPECIALIZATIONS), 0.7),
    source: pick(LEAD_SOURCES),
    notes: maybe(() => pick(LEAD_NOTES), 0.6),
    doctorTypes: pickN(Object.values(ResumeCandidateDoctorType), 0, 2),
    branches: pickN(BRANCHES, 0, 1),
    desiredSalary: hasSalary ? Math.round(randInt(60, 300) / 5) * 5000 : null,
    desiredSalaryType: hasSalary
      ? (Math.random() < 0.8 ? ResumeSalaryType.FIXED_RUB : ResumeSalaryType.PERCENT_OF_VISIT)
      : null,
    status: pickWeighted<ResumeLeadStatus>([
      [ResumeLeadStatus.NEW, 30],
      [ResumeLeadStatus.IN_PROGRESS, 25],
      [ResumeLeadStatus.CONTACTED, 20],
      [ResumeLeadStatus.CONVERTED, 10],
      [ResumeLeadStatus.NOT_RELEVANT, 15],
    ]),
  };
}

function createLeadTagItems(leadId: string): Partial<ResumeLeadTag>[] {
  const count = randInt(0, 2);
  if (count === 0) return [];

  const leadTags = ['Горячий', 'Холодный', 'Перезвонить', 'Приоритет', 'Из рекомендации', 'Новый город'];
  return pickN(leadTags, count, count).map(label => ({
    leadId,
    label,
    color: pick(TAG_COLORS),
  }));
}

// ─── Главная функция ─────────────────────────────────────────────────

async function seed() {
  console.log('Подключение к БД...');
  await AppDataSource.initialize();

  const candidateRepo = AppDataSource.getRepository(ResumeCandidate);
  const workHistoryRepo = AppDataSource.getRepository(ResumeWorkHistory);
  const educationRepo = AppDataSource.getRepository(ResumeEducation);
  const cmeCourseRepo = AppDataSource.getRepository(ResumeCmeCourse);
  const tagRepo = AppDataSource.getRepository(ResumeCandidateTag);
  const noteRepo = AppDataSource.getRepository(ResumeCandidateNote);
  const leadRepo = AppDataSource.getRepository(ResumeLead);
  const leadTagRepo = AppDataSource.getRepository(ResumeLeadTag);

  if (process.argv.includes('--clean')) {
    console.log('Очистка существующих данных...');
    await leadTagRepo.createQueryBuilder().delete().execute();
    await leadRepo.createQueryBuilder().delete().execute();
    await noteRepo.createQueryBuilder().delete().execute();
    await tagRepo.createQueryBuilder().delete().execute();
    await cmeCourseRepo.createQueryBuilder().delete().execute();
    await educationRepo.createQueryBuilder().delete().execute();
    await workHistoryRepo.createQueryBuilder().delete().execute();
    await candidateRepo.createQueryBuilder().delete().execute();
    console.log('Данные очищены.');
  }

  // Генерация кандидатов
  const CANDIDATE_COUNT = 100;
  console.log(`Создание ${CANDIDATE_COUNT} кандидатов...`);
  const savedCandidates: ResumeCandidate[] = [];

  for (let i = 0; i < CANDIDATE_COUNT; i++) {
    const data = createCandidate(i);
    const saved = await candidateRepo.save(candidateRepo.create(data));
    savedCandidates.push(saved);

    // Опыт работы
    const workItems = createWorkHistoryItems(saved.id, data.city!, data.specialization!);
    await workHistoryRepo.save(workItems.map(w => workHistoryRepo.create(w)));

    // Образование
    const hasResidency = !!data.residencyPlace;
    const hasInternship = !!data.internshipPlace;
    const eduItems = createEducationItems(
      saved.id, data.university!, data.faculty!, data.graduationYear!,
      data.specialization!, hasResidency, hasInternship,
    );
    await educationRepo.save(eduItems.map(e => educationRepo.create(e)));

    // Курсы НМО
    const courses = createCmeCourseItems(saved.id);
    if (courses.length) await cmeCourseRepo.save(courses.map(c => cmeCourseRepo.create(c)));

    // Теги
    const tags = createCandidateTagItems(saved.id);
    if (tags.length) await tagRepo.save(tags.map(t => tagRepo.create(t)));

    // Заметки
    const notes = createCandidateNoteItems(saved.id);
    if (notes.length) await noteRepo.save(notes.map(n => noteRepo.create(n)));

    if ((i + 1) % 25 === 0) console.log(`  ... ${i + 1}/${CANDIDATE_COUNT}`);
  }

  // Генерация лидов
  const LEAD_COUNT = 50;
  console.log(`Создание ${LEAD_COUNT} лидов...`);

  for (let i = 0; i < LEAD_COUNT; i++) {
    const data = createLead(i);

    // Привязка конвертированных лидов к кандидатам
    if (data.status === ResumeLeadStatus.CONVERTED) {
      data.convertedCandidateId = pick(savedCandidates).id;
    }

    const saved = await leadRepo.save(leadRepo.create(data));

    const tags = createLeadTagItems(saved.id);
    if (tags.length) await leadTagRepo.save(tags.map(t => leadTagRepo.create(t)));
  }

  // Статистика
  console.log('\n--- Seed завершён ---');
  console.log(`Кандидатов: ${await candidateRepo.count()}`);
  console.log(`Опыт работы: ${await workHistoryRepo.count()}`);
  console.log(`Образование: ${await educationRepo.count()}`);
  console.log(`Курсы НМО: ${await cmeCourseRepo.count()}`);
  console.log(`Теги кандидатов: ${await tagRepo.count()}`);
  console.log(`Заметки: ${await noteRepo.count()}`);
  console.log(`Лидов: ${await leadRepo.count()}`);
  console.log(`Теги лидов: ${await leadTagRepo.count()}`);

  await AppDataSource.destroy();
}

seed().catch((err) => {
  console.error('Ошибка seed:', err);
  process.exit(1);
});
