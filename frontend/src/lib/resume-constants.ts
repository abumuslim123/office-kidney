export const QUALIFICATION_CATEGORIES: Record<string, string> = {
  HIGHEST: 'Высшая', FIRST: 'Первая', SECOND: 'Вторая', NONE: 'Без категории',
};

export const CANDIDATE_STATUSES: Record<string, string> = {
  NEW: 'Новый', REVIEWING: 'На рассмотрении', INVITED: 'Приглашён', HIRED: 'Принят',
  RESERVE: 'Кадровый резерв', REJECTED: 'Не подходит',
};

export const CANDIDATE_STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-gray-100 text-gray-800',
  REVIEWING: 'bg-blue-100 text-blue-800',
  INVITED: 'bg-purple-100 text-purple-800',
  HIRED: 'bg-emerald-100 text-emerald-800',
  RESERVE: 'bg-yellow-100 text-yellow-800',
  REJECTED: 'bg-red-100 text-red-800',
};

export const CANDIDATE_PRIORITIES: Record<string, string> = {
  ACTIVE: 'Актуальный', RESERVE: 'Кадровый резерв', NOT_SUITABLE: 'Не подходит', ARCHIVE: 'Архив',
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
  PENDING: 'Ожидание', EXTRACTING: 'Извлечение текста', PARSING: 'AI-обработка',
  COMPLETED: 'Готово', FAILED: 'Ошибка',
};

export const PROCESSING_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-800',
  EXTRACTING: 'bg-blue-100 text-blue-800',
  PARSING: 'bg-indigo-100 text-indigo-800',
  COMPLETED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
};

export const PREDEFINED_TAGS = [
  { label: 'Приоритет', color: '#8b5cf6' },
  { label: 'Перезвонить', color: '#3b82f6' },
  { label: 'Срочно', color: '#f97316' },
  { label: 'Хороший специалист', color: '#22c55e' },
  { label: 'Нужна проверка', color: '#eab308' },
  { label: 'Возможный дубликат', color: '#ef4444' },
  { label: 'Дубликат', color: '#dc2626' },
] as const;

export const CATEGORY_COLORS: Record<string, string> = {
  HIGHEST: 'bg-amber-100 text-amber-800',
  FIRST: 'bg-blue-100 text-blue-800',
  SECOND: 'bg-green-100 text-green-800',
  NONE: 'bg-gray-100 text-gray-800',
};

export const GENDER_LABELS: Record<string, string> = {
  MALE: 'Мужчина',
  FEMALE: 'Женщина',
  UNKNOWN: 'Не определён',
};

export const GENDER_COLORS: Record<string, string> = {
  MALE: 'bg-blue-100 text-blue-800',
  FEMALE: 'bg-pink-100 text-pink-800',
  UNKNOWN: 'bg-gray-100 text-gray-500',
};

export const GENDER_PIE_COLORS: Record<string, string> = {
  MALE: '#60a5fa',
  FEMALE: '#f472b6',
  UNKNOWN: '#9ca3af',
};

export const DOCTOR_TYPE_LABELS: Record<string, string> = {
  PEDIATRIC: 'Детский',
  THERAPIST: 'Взрослый',
  FAMILY: 'Семейный',
};

export const DOCTOR_TYPE_COLORS: Record<string, string> = {
  PEDIATRIC: 'bg-cyan-100 text-cyan-800',
  THERAPIST: 'bg-orange-100 text-orange-800',
  FAMILY: 'bg-lime-100 text-lime-800',
};

export const DOCTOR_TYPE_PIE_COLORS: Record<string, string> = {
  PEDIATRIC: '#22d3ee',
  THERAPIST: '#fb923c',
  FAMILY: '#a3e635',
};

export const ACCEPTED_FILE_TYPES: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'text/plain': ['.txt'],
};

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export const EXPERIENCE_RANGES = [
  { label: '0-2 года', min: 0, max: 2 },
  { label: '2-5 лет', min: 2, max: 5 },
  { label: '5-10 лет', min: 5, max: 10 },
  { label: '10+ лет', min: 10, max: Infinity },
] as const;

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

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
