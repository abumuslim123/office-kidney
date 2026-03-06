import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

type CallTopic = {
  id: string;
  name: string;
  keywords: string[];
  isActive: boolean;
};

type CallMatch = {
  topicId: string;
  topicName: string;
  keyword: string;
  occurrences: number;
};

type CallTranscript = {
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

type CallRow = {
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
  transcript: CallTranscript | null;
  matches: CallMatch[];
};

type CallStats = {
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

/* ── Icon components ── */

function IconTranscribe({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function IconSpinner({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function IconDetail({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

function IconPlay({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function IconPause({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
  );
}

function IconDownload({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

function IconTrash({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function IconFilter({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
    </svg>
  );
}

function IconUpload({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  );
}

function IconSettings({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function IconTag({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
    </svg>
  );
}

/* ── Helpers ── */

const toLocalInput = (date: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  return `${y}-${m}-${d}T${hh}:${mm}`;
};

const toIso = (localValue: string) => {
  if (!localValue) return '';
  const date = new Date(localValue);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString();
};

const formatDate = (s: string) => {
  try {
    return new Date(s).toLocaleString('ru');
  } catch {
    return s;
  }
};

const formatSeconds = (value?: number) => {
  if (!value || value <= 0) return '0:00';
  const total = Math.round(value);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const SENTIMENT_EMOJI: Record<string, string> = {
  positive: '😊',
  negative: '😠',
  neutral: '😐',
  angry: '🤬',
  happy: '😄',
  sad: '😢',
};

const sentimentEmoji = (val: string | null | undefined): string => {
  if (!val) return '';
  return SENTIMENT_EMOJI[val.toLowerCase()] || val;
};

const statusLabel: Record<string, string> = {
  uploaded: 'Загружен',
  transcribing: 'Транскрибируется',
  transcribed: 'Готово',
  failed: 'Ошибка',
  no_audio: 'Нет аудио',
};

const statusColor: Record<string, string> = {
  uploaded: 'bg-blue-50 text-blue-700',
  transcribing: 'bg-yellow-50 text-yellow-700',
  transcribed: 'bg-green-50 text-green-700',
  failed: 'bg-red-50 text-red-700',
  no_audio: 'bg-gray-100 text-gray-500',
};

/* ── Component ── */

export default function Calls() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [topics, setTopics] = useState<CallTopic[]>([]);
  const [stats, setStats] = useState<CallStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [transcribingId, setTranscribingId] = useState<string | null>(null);
  const [playingCallId, setPlayingCallId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(new Audio());

  const [showFilters, setShowFilters] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterEmployees, setFilterEmployees] = useState<string[]>([]);
  const [filterTopics, setFilterTopics] = useState<string[]>([]);
  const [searchParams] = useSearchParams();

  const [uploadEmployeeName, setUploadEmployeeName] = useState('');
  const [uploadClientName, setUploadClientName] = useState('');
  const [uploadClientPhone, setUploadClientPhone] = useState('');
  const [uploadCallAt, setUploadCallAt] = useState(() => toLocalInput(new Date()));
  const [uploadDurationSeconds, setUploadDurationSeconds] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const activeTopics = useMemo(() => topics.filter((t) => t.isActive), [topics]);
  const hasActiveFilters = filterFrom || filterTo || filterEmployees.length > 0 || filterTopics.length > 0;

  const apiBase = api.defaults.baseURL || '/api';
  const userPermissions = user?.permissions?.map((p) => p.slug) || [];
  const canViewSettings = userPermissions.includes('calls_settings');

  const buildParams = () => {
    const params: Record<string, string> = {};
    const fromIso = toIso(filterFrom);
    const toIsoValue = toIso(filterTo);
    if (fromIso) params.from = fromIso;
    if (toIsoValue) params.to = toIsoValue;
    if (filterEmployees.length) params.employees = filterEmployees.join(',');
    if (filterTopics.length) params.topics = filterTopics.join(',');
    return params;
  };

  const loadData = async (paramsOverride?: Record<string, string>) => {
    setLoading(true);
    setError('');
    try {
      const params = paramsOverride ?? buildParams();
      const [callsRes, statsRes, topicsRes] = await Promise.all([
        api.get<CallRow[]>('/calls', { params }),
        api.get<CallStats>('/calls/stats', { params }),
        api.get<CallTopic[]>('/calls/topics'),
      ]);
      setCalls(callsRes.data);
      setStats(statsRes.data);
      setTopics(topicsRes.data);
    } catch {
      setError('Не удалось загрузить данные по звонкам');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const topicsParam = searchParams.get('topics');
    const employeesParam = searchParams.get('employees');
    if (from) {
      const date = new Date(from);
      if (!Number.isNaN(date.getTime())) setFilterFrom(toLocalInput(date));
    }
    if (to) {
      const date = new Date(to);
      if (!Number.isNaN(date.getTime())) setFilterTo(toLocalInput(date));
    }
    if (topicsParam) setFilterTopics(topicsParam.split(',').filter(Boolean));
    if (employeesParam) setFilterEmployees(employeesParam.split(',').filter(Boolean));
    const params: Record<string, string> = {};
    if (from) params.from = from;
    if (to) params.to = to;
    if (topicsParam) params.topics = topicsParam;
    if (employeesParam) params.employees = employeesParam;
    if (from || to || topicsParam || employeesParam) setShowFilters(true);
    loadData(Object.keys(params).length ? params : undefined);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    const handleEnded = () => setPlayingCallId(null);
    const handleError = () => setPlayingCallId(null);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, []);

  const applyFilters = async () => {
    await loadData();
  };

  const resetFilters = async () => {
    setFilterFrom('');
    setFilterTo('');
    setFilterEmployees([]);
    setFilterTopics([]);
    await loadData({});
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      setError('Выберите аудиофайл');
      return;
    }
    setUploading(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', uploadFile);
      form.append('employeeName', uploadEmployeeName || 'Неизвестно');
      if (uploadClientName) form.append('clientName', uploadClientName);
      if (uploadClientPhone) form.append('clientPhone', uploadClientPhone);
      if (uploadCallAt) form.append('callAt', toIso(uploadCallAt));
      if (uploadDurationSeconds) form.append('durationSeconds', uploadDurationSeconds);
      await api.post('/calls/upload', form);
      setUploadFile(null);
      setUploadDurationSeconds('');
      await loadData();
    } catch (err: unknown) {
      const data = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data
        : null;
      setError((data?.message as string) || 'Ошибка загрузки');
    } finally {
      setUploading(false);
    }
  };

  const handleTranscribe = async (callId: string) => {
    setTranscribingId(callId);
    setError('');
    try {
      await api.post(`/calls/${callId}/transcribe`);
      await loadData();
    } catch (err: unknown) {
      const data = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data
        : null;
      setError((data?.message as string) || 'Ошибка транскрибации');
    } finally {
      setTranscribingId(null);
    }
  };

  const handleDeleteAudio = async (callId: string) => {
    if (!confirm('Удалить аудио и результаты транскрибации?')) return;
    setError('');
    try {
      await api.delete(`/calls/${callId}/audio`);
      await loadData();
    } catch (err: unknown) {
      const data = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data
        : null;
      setError((data?.message as string) || 'Ошибка удаления аудио');
    }
  };

  const handlePlayAudio = async (callId: string, audioUrl: string) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playingCallId === callId) {
      if (!audio.paused) {
        audio.pause();
        setPlayingCallId(null);
      } else {
        try {
          await audio.play();
          setPlayingCallId(callId);
        } catch {
          setPlayingCallId(null);
        }
      }
      return;
    }
    try {
      audio.pause();
      audio.src = audioUrl;
      audio.currentTime = 0;
      await audio.play();
      setPlayingCallId(callId);
    } catch {
      setPlayingCallId(null);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-semibold text-gray-900">Звонки</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowUpload((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              showUpload ? 'bg-accent text-white border-accent' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <IconUpload />
            Загрузить
          </button>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              showFilters
                ? 'bg-accent text-white border-accent'
                : hasActiveFilters
                  ? 'border-accent text-accent hover:bg-accent/5'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <IconFilter />
            Фильтры
            {hasActiveFilters && !showFilters && (
              <span className="ml-1 w-2 h-2 rounded-full bg-accent inline-block" />
            )}
          </button>
          {canViewSettings && (
            <Link
              to="/calls/settings"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <IconSettings />
              Настройки
            </Link>
          )}
          <Link
            to="/calls/topics"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            <IconTag />
            Тематики
          </Link>
          <Link
            to="/calls/dictionary"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Словарь
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Filters panel */}
      {showFilters && (
        <div className="mb-5 p-5 bg-white border border-gray-200 rounded-xl shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Период с</label>
              <input
                type="datetime-local"
                value={filterFrom}
                onChange={(e) => setFilterFrom(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Период по</label>
              <input
                type="datetime-local"
                value={filterTo}
                onChange={(e) => setFilterTo(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Сотрудники</label>
              <select
                multiple
                value={filterEmployees}
                onChange={(e) =>
                  setFilterEmployees(Array.from(e.target.selectedOptions).map((o) => o.value))
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm h-[72px] focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none transition"
              >
                {(stats?.employees || []).map((row) => (
                  <option key={row.employeeName} value={row.employeeName}>
                    {row.employeeName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Тематики</label>
              <select
                multiple
                value={filterTopics}
                onChange={(e) =>
                  setFilterTopics(Array.from(e.target.selectedOptions).map((o) => o.value))
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm h-[72px] focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none transition"
              >
                {activeTopics.map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    {topic.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              type="button"
              onClick={applyFilters}
              className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Применить
            </button>
            <button
              type="button"
              onClick={resetFilters}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Сбросить
            </button>
          </div>
        </div>
      )}

      {/* Upload panel */}
      {showUpload && (
        <div className="mb-5 p-5 bg-white border border-gray-200 rounded-xl shadow-sm">
          <div className="text-sm font-medium text-gray-700 mb-3">Ручная загрузка аудио</div>
          <form onSubmit={handleUpload} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Сотрудник</label>
              <input
                type="text"
                value={uploadEmployeeName}
                onChange={(e) => setUploadEmployeeName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none transition"
                placeholder="Иван Иванов"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Клиент</label>
              <input
                type="text"
                value={uploadClientName}
                onChange={(e) => setUploadClientName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none transition"
                placeholder="ООО Ромашка"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Телефон клиента</label>
              <input
                type="tel"
                value={uploadClientPhone}
                onChange={(e) => setUploadClientPhone(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none transition"
                placeholder="+7 999 123-45-67"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Дата и время</label>
              <input
                type="datetime-local"
                value={uploadCallAt}
                onChange={(e) => setUploadCallAt(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Аудиофайл</label>
              <input
                type="file"
                accept="audio/wav,audio/mpeg,audio/mp3"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setUploadFile(file);
                  if (!file) return;
                  const url = URL.createObjectURL(file);
                  const audio = new Audio();
                  audio.src = url;
                  audio.addEventListener('loadedmetadata', () => {
                    if (Number.isFinite(audio.duration) && audio.duration > 0) {
                      setUploadDurationSeconds(String(Math.round(audio.duration)));
                    }
                    URL.revokeObjectURL(url);
                  });
                  audio.addEventListener('error', () => {
                    URL.revokeObjectURL(url);
                  });
                }}
                className="w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 file:cursor-pointer file:transition-colors"
              />
            </div>
            <div>
              <button
                type="submit"
                disabled={uploading}
                className="w-full px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {uploading ? 'Загрузка...' : 'Загрузить'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="mb-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3 bg-white border border-gray-200 rounded-xl">
            <div className="text-xs text-gray-500">Всего</div>
            <div className="text-xl font-semibold text-gray-900 mt-0.5">{stats.totalCalls}</div>
          </div>
          <div className="p-3 bg-white border border-gray-200 rounded-xl">
            <div className="text-xs text-gray-500">Сотрудники</div>
            <div className="text-xl font-semibold text-gray-900 mt-0.5">{stats.totalEmployees}</div>
          </div>
          <div className="p-3 bg-white border border-gray-200 rounded-xl">
            <div className="text-xs text-gray-500">Клиенты</div>
            <div className="text-xl font-semibold text-gray-900 mt-0.5">{stats.totalClients}</div>
          </div>
          <div className="p-3 bg-white border border-gray-200 rounded-xl">
            <div className="text-xs text-gray-500">Общая длительность</div>
            <div className="text-xl font-semibold text-gray-900 mt-0.5">{formatSeconds(stats.totalDurationSeconds)}</div>
          </div>
          <div className="p-3 bg-white border border-gray-200 rounded-xl">
            <div className="text-xs text-gray-500">Ср. речь</div>
            <div className="text-xl font-semibold text-gray-900 mt-0.5">{formatSeconds(stats.avgSpeechDurationSeconds)}</div>
          </div>
          <div className="p-3 bg-white border border-gray-200 rounded-xl">
            <div className="text-xs text-gray-500">Ср. молчание</div>
            <div className="text-xl font-semibold text-gray-900 mt-0.5">{formatSeconds(stats.avgSilenceDurationSeconds)}</div>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <IconSpinner className="w-6 h-6 text-gray-400" />
        </div>
      ) : calls.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">Звонков пока нет</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr className="bg-gray-50/80">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Дата</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Кто звонил</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Клиент</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Длительность</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Тематики</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Эмоции</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Статус</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {calls.map((call) => {
                const audioUrl = `${apiBase}/calls/${call.id}/audio`;
                const hasAudio = Boolean(call.audioPath);
                const isTranscribing = transcribingId === call.id;
                const isPlaying = playingCallId === call.id;

                return (
                  <Fragment key={call.id}>
                    <tr className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {formatDate(call.callAt)}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {call.employeeName}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {call.clientName || call.clientPhone ? (
                          <div>
                            {call.clientName && <div>{call.clientName}</div>}
                            {call.clientPhone && <div className="text-xs text-gray-400">{call.clientPhone}</div>}
                          </div>
                        ) : (
                          <span className="text-gray-300">&mdash;</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        <div className="font-medium">{formatSeconds(call.durationSeconds)}</div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          речь {formatSeconds(call.speechDurationSeconds)} / тишина {formatSeconds(call.silenceDurationSeconds)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {call.matches.length ? (
                          <div className="flex flex-wrap gap-1">
                            {[...new Map(call.matches.map((m) => [m.topicName, m])).values()].map((m) => (
                              <span
                                key={m.topicId}
                                className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-indigo-50 text-indigo-700 rounded-full"
                              >
                                {m.topicName}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-300">&mdash;</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {call.transcript?.sentiment ? (
                          <span className="text-base" title={`Оператор: ${call.transcript.sentiment.operator || '—'}, Клиент: ${call.transcript.sentiment.abonent || '—'}`}>
                            {sentimentEmoji(call.transcript.sentiment.operator)}
                            {call.transcript.sentiment.operator && call.transcript.sentiment.abonent ? ' ' : ''}
                            {sentimentEmoji(call.transcript.sentiment.abonent)}
                          </span>
                        ) : (
                          <span className="text-gray-300">&mdash;</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor[call.status] || 'bg-gray-100 text-gray-600'}`}>
                          {statusLabel[call.status] || call.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleTranscribe(call.id)}
                            disabled={isTranscribing}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-accent hover:bg-accent/10 disabled:opacity-40 transition-colors"
                            title={isTranscribing ? 'Транскрибируем...' : 'Транскрибировать'}
                          >
                            {isTranscribing ? <IconSpinner /> : <IconTranscribe />}
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate(`/calls/${call.id}`)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-accent hover:bg-accent/10 transition-colors"
                            title="Подробнее"
                          >
                            <IconDetail />
                          </button>
                          {hasAudio && (
                            <>
                              <button
                                type="button"
                                onClick={() => handlePlayAudio(call.id, audioUrl)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors"
                                title={isPlaying ? 'Пауза' : 'Воспроизвести'}
                              >
                                {isPlaying ? <IconPause /> : <IconPlay />}
                              </button>
                              <a
                                href={audioUrl}
                                download
                                className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                title="Скачать аудио"
                              >
                                <IconDownload />
                              </a>
                              <button
                                type="button"
                                onClick={() => handleDeleteAudio(call.id)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                title="Удалить аудио"
                              >
                                <IconTrash />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
