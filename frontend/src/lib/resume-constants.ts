export const SPECIALIZATIONS = [
  'Педиатр',
  'Неонатолог',
  'Детский хирург',
  'Детский невролог',
  'Детский кардиолог',
  'Детский эндокринолог',
  'Детский гастроэнтеролог',
  'Детский офтальмолог',
  'Детский оториноларинголог (ЛОР)',
  'Детский уролог',
  'Детский ортопед-травматолог',
  'Детский аллерголог-иммунолог',
  'Детский пульмонолог',
  'Детский дерматолог',
  'Детский инфекционист',
  'Детский реаниматолог-анестезиолог',
  'Детский психиатр',
  'Детский ревматолог',
  'Детский нефролог',
  'Детский гематолог-онколог',
  'Врач УЗД',
  'Рентгенолог',
  'Клинический лабораторный диагност',
  'Медицинская сестра',
] as const;

export const QUALIFICATION_CATEGORIES: Record<string, string> = {
  HIGHEST: 'Высшая',
  FIRST: 'Первая',
  SECOND: 'Вторая',
  NONE: 'Без категории',
};

export const CANDIDATE_STATUSES: Record<string, string> = {
  NEW: 'Новый',
  REVIEWING: 'На рассмотрении',
  INVITED: 'Приглашён',
  HIRED: 'Принят',
};

export const CANDIDATE_STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-gray-100 text-gray-800',
  REVIEWING: 'bg-blue-100 text-blue-800',
  INVITED: 'bg-purple-100 text-purple-800',
  HIRED: 'bg-emerald-100 text-emerald-800',
};

export const CANDIDATE_PRIORITIES: Record<string, string> = {
  ACTIVE: 'Актуальный',
  RESERVE: 'Кадровый резерв',
  NOT_SUITABLE: 'Не подходит',
  ARCHIVE: 'Архив',
};

export const CANDIDATE_PRIORITY_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  RESERVE: 'bg-yellow-100 text-yellow-800',
  NOT_SUITABLE: 'bg-red-100 text-red-800',
  ARCHIVE: 'bg-gray-100 text-gray-500',
};

export const BRANCHES = ['Каспийск', 'Махачкала', 'Хасавюрт'] as const;

export const BRANCH_COLORS: Record<string, string> = {
  'Каспийск': 'bg-sky-100 text-sky-800',
  'Махачкала': 'bg-violet-100 text-violet-800',
  'Хасавюрт': 'bg-teal-100 text-teal-800',
};

export const PROCESSING_STATUSES: Record<string, string> = {
  PENDING: 'Ожидание',
  EXTRACTING: 'Извлечение текста',
  PARSING: 'AI-обработка',
  COMPLETED: 'Готово',
  FAILED: 'Ошибка',
};

export const PROCESSING_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-800',
  EXTRACTING: 'bg-blue-100 text-blue-800',
  PARSING: 'bg-indigo-100 text-indigo-800',
  COMPLETED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
};

export const CATEGORY_COLORS: Record<string, string> = {
  HIGHEST: 'bg-amber-100 text-amber-800',
  FIRST: 'bg-blue-100 text-blue-800',
  SECOND: 'bg-green-100 text-green-800',
  NONE: 'bg-gray-100 text-gray-800',
};

export const PREDEFINED_TAGS = [
  { label: 'Приоритет', color: '#8b5cf6' },
  { label: 'Перезвонить', color: '#3b82f6' },
  { label: 'Срочно', color: '#f97316' },
  { label: 'Хороший специалист', color: '#22c55e' },
  { label: 'Нужна проверка', color: '#eab308' },
  { label: 'Возможный дубликат', color: '#ef4444' },
] as const;

export const EXPERIENCE_RANGES = [
  { value: '1-3', label: '1–3 года' },
  { value: '3-5', label: '3–5 лет' },
  { value: '5-10', label: '5–10 лет' },
  { value: '10+', label: 'Более 10 лет' },
] as const;

export function formatPhoneForWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('8') && digits.length === 11) {
    return '7' + digits.slice(1);
  }
  return digits;
}

export function getDaysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatMonthYear(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('ru-RU', {
    month: 'long',
    year: 'numeric',
  });
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatExperienceYears(years: number | null): string {
  if (years === null || years === undefined) return '—';
  const rounded = Math.round(years * 10) / 10;
  if (rounded === 1) return `${rounded} год`;
  if (rounded >= 2 && rounded <= 4) return `${rounded} года`;
  return `${rounded} лет`;
}
