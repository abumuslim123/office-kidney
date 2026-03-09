import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import type { CallRow, CallStats, CallTopic } from '../components/calls/calls-types';
import { toLocalInput, toIso } from '../components/calls/calls-types';
import CallsFilters from '../components/calls/CallsFilters';
import CallsUploadForm from '../components/calls/CallsUploadForm';
import CallsStatsPanel from '../components/calls/CallsStats';
import CallsTable from '../components/calls/CallsTable';

/* ── Icons (used only in header) ── */

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

function IconSpinner({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

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
  const [showSettingsHover, setShowSettingsHover] = useState(false);
  const settingsHoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const [fillerWords, setFillerWords] = useState<string[]>([]);
  const [negativeWords, setNegativeWords] = useState<string[]>([]);

  const abortRef = useRef<AbortController | null>(null);

  const unwantedStatus = useMemo(() => {
    const allWords = [...fillerWords, ...negativeWords];
    if (!allWords.length) return new Map<string, 'negative' | 'filler'>();
    const result = new Map<string, 'negative' | 'filler'>();
    const clean = (s: string) => s.toLowerCase().replace(/[.,!?;:"""''()]/g, '');
    for (const call of calls) {
      const opText = call.transcript?.operatorText;
      if (!opText) continue;
      const words = opText.split(/\s+/).map(clean);
      let hasNeg = false;
      let hasFiller = false;
      for (const phrase of negativeWords) {
        const parts = phrase.toLowerCase().split(/\s+/).filter(Boolean);
        if (!parts.length) continue;
        for (let i = 0; i <= words.length - parts.length; i++) {
          let matched = true;
          for (let j = 0; j < parts.length; j++) {
            if (words[i + j] !== parts[j]) { matched = false; break; }
          }
          if (matched) { hasNeg = true; break; }
        }
        if (hasNeg) break;
      }
      if (!hasNeg) {
        for (const phrase of fillerWords) {
          const parts = phrase.toLowerCase().split(/\s+/).filter(Boolean);
          if (!parts.length) continue;
          for (let i = 0; i <= words.length - parts.length; i++) {
            let matched = true;
            for (let j = 0; j < parts.length; j++) {
              if (words[i + j] !== parts[j]) { matched = false; break; }
            }
            if (matched) { hasFiller = true; break; }
          }
          if (hasFiller) break;
        }
      }
      if (hasNeg) result.set(call.id, 'negative');
      else if (hasFiller) result.set(call.id, 'filler');
    }
    return result;
  }, [calls, fillerWords, negativeWords]);

  const activeTopics = useMemo(() => topics.filter((t) => t.isActive), [topics]);
  const hasActiveFilters = filterFrom || filterTo || filterEmployees.length > 0 || filterTopics.length > 0;

  const userPermissions = user?.permissions?.map((p) => p.slug) || [];
  const canViewSettings = userPermissions.includes('calls_settings');

  const buildParams = useCallback(() => {
    const params: Record<string, string> = {};
    const fromIso = toIso(filterFrom);
    const toIsoValue = toIso(filterTo);
    if (fromIso) params.from = fromIso;
    if (toIsoValue) params.to = toIsoValue;
    if (filterEmployees.length) params.employees = filterEmployees.join(',');
    if (filterTopics.length) params.topics = filterTopics.join(',');
    return params;
  }, [filterFrom, filterTo, filterEmployees, filterTopics]);

  const loadData = useCallback(async (paramsOverride?: Record<string, string>) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError('');
    try {
      const params = paramsOverride ?? buildParams();
      const signal = controller.signal;
      const [callsRes, statsRes, topicsRes, uwRes] = await Promise.all([
        api.get<CallRow[]>('/calls', { params, signal }),
        api.get<CallStats>('/calls/stats', { params, signal }),
        api.get<CallTopic[]>('/calls/topics', { signal }),
        api.get<{ fillerWords: string[]; negativeWords: string[] }>('/calls/unwanted-words', { signal }),
      ]);
      setCalls(callsRes.data);
      setStats(statsRes.data);
      setTopics(topicsRes.data);
      setFillerWords(uwRes.data.fillerWords);
      setNegativeWords(uwRes.data.negativeWords);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'CanceledError') return;
      setError('Не удалось загрузить данные по звонкам');
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

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

    return () => { abortRef.current?.abort(); };
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

  const applyFilters = useCallback(async () => {
    await loadData();
  }, [loadData]);

  const resetFilters = useCallback(async () => {
    setFilterFrom('');
    setFilterTo('');
    setFilterEmployees([]);
    setFilterTopics([]);
    await loadData({});
  }, [loadData]);

  const handleUpload = useCallback(async (e: React.FormEvent) => {
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
  }, [uploadFile, uploadEmployeeName, uploadClientName, uploadClientPhone, uploadCallAt, uploadDurationSeconds, loadData]);

  const handleTranscribe = useCallback(async (callId: string) => {
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
  }, [loadData]);

  const handleDeleteAudio = useCallback(async (callId: string) => {
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
  }, [loadData]);

  const handleToggleFavorite = useCallback(async (callId: string) => {
    try {
      const res = await api.post<{ id: string; isFavorite: boolean }>(`/calls/favorites/${callId}`);
      setCalls((prev) => prev.map((c) => c.id === callId ? { ...c, isFavorite: res.data.isFavorite } : c));
    } catch { /* ignore */ }
  }, []);

  const handlePlayAudio = useCallback(async (callId: string, audioUrl: string) => {
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
  }, [playingCallId]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-semibold text-gray-900">KCalls</h2>
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
            <div
              className="relative"
              onMouseEnter={() => {
                if (settingsHoverTimer.current) clearTimeout(settingsHoverTimer.current);
                setShowSettingsHover(true);
              }}
              onMouseLeave={() => {
                settingsHoverTimer.current = setTimeout(() => setShowSettingsHover(false), 200);
              }}
            >
              <button
                type="button"
                onClick={() => navigate('/calls/settings')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <IconSettings />
                Настройки
              </button>
              {showSettingsHover && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50">
                  {[
                    { to: '/calls/settings/provider', label: 'Провайдер' },
                    { to: '/calls/settings/dictionary', label: 'Словарь' },
                    { to: '/calls/settings/topics', label: 'Тематики' },
                    { to: '/calls/settings/unwanted-words', label: 'Нежелательные слова' },
                    { to: '/calls/settings/favorites', label: 'Избранное' },
                    { to: '/calls/settings/recording', label: 'Режим записи' },
                    { to: '/calls/settings/reports', label: 'Отчеты' },
                  ].map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {error}
        </div>
      )}

      {showFilters && (
        <CallsFilters
          filterFrom={filterFrom}
          filterTo={filterTo}
          filterEmployees={filterEmployees}
          filterTopics={filterTopics}
          setFilterFrom={setFilterFrom}
          setFilterTo={setFilterTo}
          setFilterEmployees={setFilterEmployees}
          setFilterTopics={setFilterTopics}
          stats={stats}
          activeTopics={activeTopics}
          onApply={applyFilters}
          onReset={resetFilters}
        />
      )}

      {showUpload && (
        <CallsUploadForm
          uploadEmployeeName={uploadEmployeeName}
          uploadClientName={uploadClientName}
          uploadClientPhone={uploadClientPhone}
          uploadCallAt={uploadCallAt}
          uploadFile={uploadFile}
          uploading={uploading}
          setUploadEmployeeName={setUploadEmployeeName}
          setUploadClientName={setUploadClientName}
          setUploadClientPhone={setUploadClientPhone}
          setUploadCallAt={setUploadCallAt}
          setUploadFile={setUploadFile}
          setUploadDurationSeconds={setUploadDurationSeconds}
          onSubmit={handleUpload}
        />
      )}

      {stats && <CallsStatsPanel stats={stats} />}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <IconSpinner className="w-6 h-6 text-gray-400" />
        </div>
      ) : calls.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">Звонков пока нет</div>
      ) : (
        <CallsTable
          calls={calls}
          transcribingId={transcribingId}
          playingCallId={playingCallId}
          unwantedStatus={unwantedStatus}
          onTranscribe={handleTranscribe}
          onDeleteAudio={handleDeleteAudio}
          onToggleFavorite={handleToggleFavorite}
          onPlayAudio={handlePlayAudio}
        />
      )}
    </div>
  );
}
