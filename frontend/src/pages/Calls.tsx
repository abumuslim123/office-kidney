import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
  language: string | null;
  provider: string;
  createdAt: string;
  updatedAt: string;
};

type CallRow = {
  id: string;
  employeeName: string;
  clientName: string | null;
  callAt: string;
  durationSeconds: number;
  speechDurationSeconds: number;
  silenceDurationSeconds: number;
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

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const highlightText = (text: string, keywords: string[]) => {
  if (!text) return '';
  const uniq = Array.from(new Set(keywords.map((k) => k.trim()).filter(Boolean)));
  if (!uniq.length) return escapeHtml(text);
  const pattern = uniq.map(escapeRegExp).join('|');
  const regex = new RegExp(`(${pattern})`, 'gi');
  return escapeHtml(text).replace(regex, '<mark class="bg-yellow-200 text-gray-900 px-1 rounded">$1</mark>');
};

export default function Calls() {
  const { user } = useAuth();
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [topics, setTopics] = useState<CallTopic[]>([]);
  const [stats, setStats] = useState<CallStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [transcribingId, setTranscribingId] = useState<string | null>(null);
  const [expandedCallId, setExpandedCallId] = useState<string | null>(null);

  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterEmployees, setFilterEmployees] = useState<string[]>([]);
  const [filterTopics, setFilterTopics] = useState<string[]>([]);

  const [uploadEmployeeName, setUploadEmployeeName] = useState('');
  const [uploadClientName, setUploadClientName] = useState('');
  const [uploadCallAt, setUploadCallAt] = useState(() => toLocalInput(new Date()));
  const [uploadDurationSeconds, setUploadDurationSeconds] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const activeTopics = useMemo(() => topics.filter((t) => t.isActive), [topics]);

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
    loadData();
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

  const toggleTranscript = (callId: string) => {
    setExpandedCallId((prev) => (prev === callId ? null : callId));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Звонки</h2>
        <div className="flex items-center gap-2">
          {canViewSettings && (
            <Link
              to="/calls/settings"
              className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
            >
              Настройки
            </Link>
          )}
          <Link
            to="/calls/topics"
            className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded hover:opacity-90"
          >
            Тематики
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="mb-6 p-4 bg-white border border-gray-200 rounded-lg">
        <div className="text-sm font-medium text-gray-900 mb-3">Фильтры</div>
        <div className="flex flex-wrap gap-4 items-end">
          <label className="text-xs text-gray-600">
            Период с
            <input
              type="datetime-local"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              className="mt-1 w-48 border border-gray-300 rounded px-2 py-1 text-sm"
            />
          </label>
          <label className="text-xs text-gray-600">
            Период по
            <input
              type="datetime-local"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              className="mt-1 w-48 border border-gray-300 rounded px-2 py-1 text-sm"
            />
          </label>
          <label className="text-xs text-gray-600">
            Сотрудники
            <select
              multiple
              value={filterEmployees}
              onChange={(e) =>
                setFilterEmployees(Array.from(e.target.selectedOptions).map((o) => o.value))
              }
              className="mt-1 w-56 border border-gray-300 rounded px-2 py-1 text-sm h-24"
            >
              {(stats?.employees || []).map((row) => (
                <option key={row.employeeName} value={row.employeeName}>
                  {row.employeeName}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-gray-600">
            Тематики
            <select
              multiple
              value={filterTopics}
              onChange={(e) =>
                setFilterTopics(Array.from(e.target.selectedOptions).map((o) => o.value))
              }
              className="mt-1 w-56 border border-gray-300 rounded px-2 py-1 text-sm h-24"
            >
              {activeTopics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={applyFilters}
              className="px-3 py-1.5 bg-accent text-white rounded text-sm font-medium hover:opacity-90"
            >
              Применить
            </button>
            <button
              type="button"
              onClick={resetFilters}
              className="px-3 py-1.5 border border-gray-300 rounded text-sm hover:bg-gray-50"
            >
              Сбросить
            </button>
          </div>
        </div>
      </div>

      {stats && (
        <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-white border border-gray-200 rounded-lg">
            <div className="text-xs text-gray-500">Всего звонков</div>
            <div className="text-2xl font-semibold text-gray-900">{stats.totalCalls}</div>
          </div>
          <div className="p-4 bg-white border border-gray-200 rounded-lg">
            <div className="text-xs text-gray-500">Сотрудники / Клиенты</div>
            <div className="text-2xl font-semibold text-gray-900">
              {stats.totalEmployees} / {stats.totalClients}
            </div>
          </div>
          <div className="p-4 bg-white border border-gray-200 rounded-lg">
            <div className="text-xs text-gray-500">Суммарная длительность</div>
            <div className="text-2xl font-semibold text-gray-900">
              {formatSeconds(stats.totalDurationSeconds)}
            </div>
          </div>
          <div className="p-4 bg-white border border-gray-200 rounded-lg">
            <div className="text-xs text-gray-500">Средняя запись</div>
            <div className="text-lg font-semibold text-gray-900">
              {formatSeconds(stats.avgDurationSeconds)}
            </div>
          </div>
          <div className="p-4 bg-white border border-gray-200 rounded-lg">
            <div className="text-xs text-gray-500">Средняя речь</div>
            <div className="text-lg font-semibold text-gray-900">
              {formatSeconds(stats.avgSpeechDurationSeconds)}
            </div>
          </div>
          <div className="p-4 bg-white border border-gray-200 rounded-lg">
            <div className="text-xs text-gray-500">Среднее молчание</div>
            <div className="text-lg font-semibold text-gray-900">
              {formatSeconds(stats.avgSilenceDurationSeconds)}
            </div>
          </div>
        </div>
      )}

      <div className="mb-6 bg-white border border-gray-200 rounded-lg p-4">
        <div className="text-sm font-medium text-gray-900 mb-3">Ручная загрузка для тестирования</div>
        <form onSubmit={handleUpload} className="flex flex-wrap gap-4 items-end">
          <label className="text-xs text-gray-600">
            Сотрудник
            <input
              type="text"
              value={uploadEmployeeName}
              onChange={(e) => setUploadEmployeeName(e.target.value)}
              className="mt-1 w-48 border border-gray-300 rounded px-2 py-1 text-sm"
              placeholder="Иван Иванов"
            />
          </label>
          <label className="text-xs text-gray-600">
            Клиент
            <input
              type="text"
              value={uploadClientName}
              onChange={(e) => setUploadClientName(e.target.value)}
              className="mt-1 w-48 border border-gray-300 rounded px-2 py-1 text-sm"
              placeholder="ООО Ромашка"
            />
          </label>
          <label className="text-xs text-gray-600">
            Дата и время
            <input
              type="datetime-local"
              value={uploadCallAt}
              onChange={(e) => setUploadCallAt(e.target.value)}
              className="mt-1 w-48 border border-gray-300 rounded px-2 py-1 text-sm"
            />
          </label>
          <label className="text-xs text-gray-600">
            Длительность (сек)
            <input
              type="number"
              min={0}
              value={uploadDurationSeconds}
              onChange={(e) => setUploadDurationSeconds(e.target.value)}
              className="mt-1 w-32 border border-gray-300 rounded px-2 py-1 text-sm"
            />
          </label>
          <label className="text-xs text-gray-600">
            Аудиофайл
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
              className="mt-1 block w-64 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={uploading}
            className="px-4 py-1.5 bg-accent text-white rounded text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {uploading ? 'Загрузка...' : 'Загрузить'}
          </button>
        </form>
      </div>

      {loading ? (
        <p className="text-gray-500">Загрузка...</p>
      ) : calls.length === 0 ? (
        <p className="text-gray-500">Звонков пока нет.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Дата</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Сотрудник</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Клиент</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Длительность</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Тематики</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {calls.map((call) => {
                const keywords = call.matches.map((m) => m.keyword);
                const audioUrl = `${apiBase}/calls/${call.id}/audio`;
                const isExpanded = expandedCallId === call.id;
                return (
                  <Fragment key={call.id}>
                    <tr className="align-top">
                      <td className="px-4 py-2 text-sm text-gray-700 whitespace-nowrap">{formatDate(call.callAt)}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{call.employeeName}</td>
                      <td className="px-4 py-2 text-sm text-gray-700">{call.clientName || '—'}</td>
                      <td className="px-4 py-2 text-sm text-gray-700">
                        {formatSeconds(call.durationSeconds)}
                        <div className="text-xs text-gray-500">
                          Речь {formatSeconds(call.speechDurationSeconds)} / молчание {formatSeconds(call.silenceDurationSeconds)}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700">
                        {call.matches.length ? (
                          <div className="flex flex-wrap gap-1">
                            {call.matches.map((m, idx) => (
                              <span key={`${m.topicId}-${m.keyword}-${idx}`} className="px-2 py-0.5 text-xs bg-gray-100 rounded">
                                {m.topicName} ({m.occurrences})
                              </span>
                            ))}
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700">
                        {call.status === 'uploaded' && 'Загружен'}
                        {call.status === 'transcribing' && 'Транскрибируется'}
                        {call.status === 'transcribed' && 'Готово'}
                        {call.status === 'failed' && 'Ошибка'}
                      </td>
                      <td className="px-4 py-2 text-sm text-right space-x-2">
                        <button
                          type="button"
                          onClick={() => handleTranscribe(call.id)}
                          disabled={transcribingId === call.id}
                          className="text-accent hover:underline disabled:opacity-50"
                        >
                          {transcribingId === call.id ? 'Транскрибируем...' : 'Транскрибировать'}
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleTranscript(call.id)}
                          className="text-accent hover:underline"
                        >
                          {isExpanded ? 'Скрыть текст' : 'Текст'}
                        </button>
                        <a href={audioUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                          Аудио
                        </a>
                      <button
                        type="button"
                        onClick={() => handleDeleteAudio(call.id)}
                        className="text-red-600 hover:underline"
                      >
                        Удалить аудио
                      </button>
                      </td>
                    </tr>
                    {isExpanded && call.transcript?.text && (
                      <tr>
                        <td colSpan={7} className="px-4 py-3 bg-gray-50">
                          <div className="text-sm font-medium text-gray-900 mb-2">Транскрипт</div>
                          <div
                            className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: highlightText(call.transcript.text, keywords) }}
                          />
                        </td>
                      </tr>
                    )}
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
