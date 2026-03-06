import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import AudioPlayer, { type AudioPlayerHandle } from '../components/calls/AudioPlayer';
import TranscriptChat from '../components/calls/TranscriptChat';
import TopicsPanel from '../components/calls/TopicsPanel';

type CallSentiment = {
  operator: string | null;
  abonent: string | null;
  perTurn: { speaker: string; sentiment: string; confidence?: number }[] | null;
};

type CallTranscript = {
  id: string;
  callId: string;
  text: string;
  operatorText?: string | null;
  abonentText?: string | null;
  turns?: { speaker: string; text: string; start?: number; end?: number }[] | null;
  words?: { word: string; start: number; end: number; speaker: string }[] | null;
  sentiment?: CallSentiment | null;
  language: string | null;
  provider: string;
};

type CallMatch = {
  topicId: string;
  topicName: string;
  keyword: string;
  occurrences: number;
};

type CallData = {
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

const SENTIMENT_MAP: Record<string, { emoji: string; label: string; color: string }> = {
  positive: { emoji: '😊', label: 'позитив', color: 'text-green-600' },
  negative: { emoji: '😠', label: 'негатив', color: 'text-red-600' },
  neutral: { emoji: '😐', label: 'нейтрально', color: 'text-gray-500' },
  angry: { emoji: '🤬', label: 'раздражение', color: 'text-red-600' },
  happy: { emoji: '😄', label: 'радость', color: 'text-green-600' },
  sad: { emoji: '😢', label: 'грусть', color: 'text-blue-600' },
};

function sentimentLabel(sentiment: string): string {
  const s = SENTIMENT_MAP[sentiment.toLowerCase()];
  return s ? `${s.emoji} ${s.label}` : sentiment;
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function CallDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [call, setCall] = useState<CallData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const playerRef = useRef<AudioPlayerHandle>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api
      .get(`/calls/${id}`)
      .then((res) => setCall(res.data))
      .catch((err) => setError(err?.response?.data?.message || 'Ошибка загрузки'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSeek = useCallback((time: number) => {
    playerRef.current?.seekTo(time);
    playerRef.current?.play();
  }, []);

  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  // Keywords of the active (clicked) topic — for green highlighting
  const activeTopicKeywords = useMemo(() => {
    if (!activeTopicId || !call?.matches?.length) return [];
    return call.matches
      .filter((m) => m.topicId === activeTopicId)
      .map((m) => m.keyword);
  }, [activeTopicId, call]);

  const handleTopicClick = useCallback((topicId: string) => {
    setActiveTopicId((prev) => (prev === topicId ? null : topicId));
  }, []);

  // Compute keyword positions for waveform markers (must be before early returns)
  const keywordMarkers = useMemo(() => {
    const words = call?.transcript?.words;
    const matches = call?.matches;
    if (!words?.length || !matches?.length) return [];
    const keywords = matches.map((m) => m.keyword);
    const activeKwSet = new Set(activeTopicKeywords.map((k) => k.toLowerCase()));
    const result: { time: number; label: string; color: string }[] = [];
    for (const w of words) {
      const cleaned = w.word.toLowerCase().replace(/[.,!?;:"""''()]/g, '');
      for (const kw of keywords) {
        if (cleaned.includes(kw.toLowerCase())) {
          const isActive = activeKwSet.has(kw.toLowerCase());
          result.push({
            time: w.start,
            label: kw,
            color: isActive ? 'rgba(34, 197, 94, 0.6)' : 'rgba(234, 179, 8, 0.5)',
          });
          break;
        }
      }
    }
    return result;
  }, [call, activeTopicKeywords]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-gray-500">Загрузка...</span>
      </div>
    );
  }

  if (error || !call) {
    return (
      <div>
        <button onClick={() => navigate('/calls')} className="text-indigo-600 hover:underline mb-4">
          &larr; Назад к звонкам
        </button>
        <div className="text-red-600">{error || 'Звонок не найден'}</div>
      </div>
    );
  }

  const audioUrl = `${api.defaults.baseURL}/calls/${call.id}/audio`;
  const authToken = localStorage.getItem('kidney_access') || undefined;
  const hasAudio = call.audioPath && call.status !== 'no_audio';
  const turns = call.transcript?.turns || [];
  const words = call.transcript?.words || null;
  const keywords = call.matches.map((m) => m.keyword);

  const displayTurns =
    turns.length > 0
      ? turns
      : call.transcript?.text
        ? call.transcript.text
            .split(/\r?\n/)
            .filter(Boolean)
            .map((line, i) => ({ speaker: i % 2 === 0 ? 'operator' : 'abonent', text: line }))
        : [];

  // Use negative margin to escape Layout's p-6 and take full width/height
  return (
    <div className="-m-6 flex flex-col" style={{ height: 'calc(100vh - 49px)' }}>
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-3 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/calls')}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              title="Назад к звонкам"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-base font-semibold text-gray-900">
                {call.employeeName}
                {(call.clientName || call.clientPhone) && (
                  <span className="text-gray-400 font-normal">
                    {' '}&rarr; {call.clientName || ''}{call.clientName && call.clientPhone ? ' ' : ''}{call.clientPhone && <span className="text-gray-400">{call.clientPhone}</span>}
                  </span>
                )}
              </h1>
              <div className="text-xs text-gray-500 flex items-center gap-2">
                <span>{new Date(call.callAt).toLocaleString('ru-RU')}</span>
                <span className="text-gray-300">|</span>
                <span>{formatDuration(call.durationSeconds)}</span>
                {call.speechDurationSeconds > 0 && (
                  <>
                    <span className="text-gray-300">|</span>
                    <span>речь {formatDuration(call.speechDurationSeconds)}</span>
                  </>
                )}
                {call.transcript?.sentiment && (
                  <>
                    {call.transcript.sentiment.operator && (
                      <>
                        <span className="text-gray-300">|</span>
                        <span className={SENTIMENT_MAP[call.transcript.sentiment.operator.toLowerCase()]?.color} title="Эмоция оператора">
                          {sentimentLabel(call.transcript.sentiment.operator)} оператор
                        </span>
                      </>
                    )}
                    {call.transcript.sentiment.abonent && (
                      <>
                        <span className="text-gray-300">|</span>
                        <span className={SENTIMENT_MAP[call.transcript.sentiment.abonent.toLowerCase()]?.color} title="Эмоция собеседника">
                          {sentimentLabel(call.transcript.sentiment.abonent)} собеседник
                        </span>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
          {hasAudio && (
            <a
              href={audioUrl}
              download
              className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Скачать аудио
            </a>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {call.transcript ? (
          <div className="h-full grid grid-cols-1 lg:grid-cols-[1fr_260px]">
            <div className="overflow-y-auto px-6 py-4">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Диалог</div>
              {displayTurns.length > 0 ? (
                <TranscriptChat
                  turns={displayTurns}
                  words={words}
                  currentTime={currentTime}
                  keywords={keywords}
                  highlightedKeywords={activeTopicKeywords}
                  onSeek={handleSeek}
                />
              ) : (
                <div className="text-sm text-gray-600 whitespace-pre-wrap">{call.transcript.text}</div>
              )}
            </div>
            <div className="border-l border-gray-200 px-5 py-4 overflow-y-auto bg-gray-50/50">
              <TopicsPanel matches={call.matches} activeTopicId={activeTopicId} onTopicClick={handleTopicClick} />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            Транскрипт недоступен. Нажмите «Транскрибировать» на странице звонков.
          </div>
        )}
      </div>

      {/* Bottom: Audio player */}
      {hasAudio && (
        <div className="flex-shrink-0">
          <AudioPlayer
            ref={playerRef}
            audioUrl={audioUrl}
            authToken={authToken}
            onTimeUpdate={handleTimeUpdate}
            markers={keywordMarkers}
          />
        </div>
      )}
    </div>
  );
}
