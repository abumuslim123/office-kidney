export type CallTopic = {
  id: string;
  name: string;
  keywords: string[];
  isActive: boolean;
};

export type CallMatch = {
  topicId: string;
  topicName: string;
  keyword: string;
  occurrences: number;
};

export type CallTranscript = {
  id: string;
  callId: string;
  text: string;
  operatorText?: string | null;
  abonentText?: string | null;
  turns?: { speaker: string; text: string }[] | null;
  sentiment?: {
    operator: string | null;
    abonent: string | null;
  } | null;
  language: string | null;
  provider: string;
  createdAt: string;
  updatedAt: string;
};

export type CallRow = {
  id: string;
  employeeName: string;
  clientName: string | null;
  clientPhone: string | null;
  callAt: string;
  durationSeconds: number;
  speechDurationSeconds: number;
  silenceDurationSeconds: number;
  audioPath: string;
  status: string;
  isFavorite: boolean;
  transcript: CallTranscript | null;
  matches: CallMatch[];
};

export type CallStats = {
  totalCalls: number;
  totalEmployees: number;
  totalClients: number;
  totalDurationSeconds: number;
  avgDurationSeconds: number;
  avgSpeechDurationSeconds: number;
  avgSilenceDurationSeconds: number;
  employees: {
    employeeName: string;
    callsCount: number;
    clientsCount: number;
    totalDurationSeconds: number;
    avgDurationSeconds: number;
  }[];
  topics: {
    topicId: string;
    topicName: string;
    callsCount: number;
    occurrences: number;
  }[];
};

export const formatDate = (s: string) => {
  try {
    return new Date(s).toLocaleString('ru');
  } catch {
    return s;
  }
};

export const formatSeconds = (value?: number) => {
  if (!value || value <= 0) return '0:00';
  const total = Math.round(value);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

export const SENTIMENT_EMOJI: Record<string, string> = {
  positive: '😊',
  negative: '😠',
  neutral: '😐',
  angry: '🤬',
  happy: '😄',
  sad: '😢',
};

export const sentimentEmoji = (val: string | null | undefined): string => {
  if (!val) return '';
  return SENTIMENT_EMOJI[val.toLowerCase()] || val;
};

export const statusLabel: Record<string, string> = {
  uploaded: 'Загружен',
  transcribing: 'Транскрибируется',
  transcribed: 'Готово',
  failed: 'Ошибка',
  no_audio: 'Нет аудио',
};

export const statusColor: Record<string, string> = {
  uploaded: 'bg-blue-50 text-blue-700',
  transcribing: 'bg-yellow-50 text-yellow-700',
  transcribed: 'bg-green-50 text-green-700',
  failed: 'bg-red-50 text-red-700',
  no_audio: 'bg-gray-100 text-gray-500',
};

export const toLocalInput = (date: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  return `${y}-${m}-${d}T${hh}:${mm}`;
};

export const toIso = (localValue: string) => {
  if (!localValue) return '';
  const date = new Date(localValue);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString();
};

export async function downloadAudioWithAuth(url: string, filename: string) {
  const token = localStorage.getItem('kidney_access');
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) return;
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
