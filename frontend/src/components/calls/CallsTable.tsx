import React, { Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import type { CallRow } from './calls-types';
import { formatDate, formatSeconds, sentimentEmoji, statusLabel, statusColor, downloadAudioWithAuth } from './calls-types';

/* ── Icons ── */

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

type CallsTableProps = {
  calls: CallRow[];
  transcribingId: string | null;
  playingCallId: string | null;
  unwantedStatus: Map<string, 'negative' | 'filler'>;
  onTranscribe: (callId: string) => void;
  onDeleteAudio: (callId: string) => void;
  onToggleFavorite: (callId: string) => void;
  onPlayAudio: (callId: string, audioUrl: string) => void;
};

function CallsTable({
  calls, transcribingId, playingCallId, unwantedStatus,
  onTranscribe, onDeleteAudio, onToggleFavorite, onPlayAudio,
}: CallsTableProps) {
  const navigate = useNavigate();
  const apiBase = api.defaults.baseURL || '/api';

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead>
          <tr className="bg-gray-50/80">
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Дата</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Кто звонил</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Клиент</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Длительность</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Тематики</th>
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" title="Нежелательные слова">НС</th>
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
                    {unwantedStatus.has(call.id) ? (
                      <span
                        className={`inline-block w-2.5 h-2.5 rounded-full ${
                          unwantedStatus.get(call.id) === 'negative' ? 'bg-red-500' : 'bg-orange-400'
                        }`}
                        title={unwantedStatus.get(call.id) === 'negative' ? 'Негативные слова' : 'Слова-паразиты'}
                      />
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
                        onClick={() => onToggleFavorite(call.id)}
                        className={`p-1.5 rounded-lg transition-colors ${call.isFavorite ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-400'}`}
                        title={call.isFavorite ? 'Убрать из избранного' : 'В избранное'}
                      >
                        <svg className="w-4 h-4" fill={call.isFavorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => onTranscribe(call.id)}
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
                            onClick={() => onPlayAudio(call.id, audioUrl)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors"
                            title={isPlaying ? 'Пауза' : 'Воспроизвести'}
                          >
                            {isPlaying ? <IconPause /> : <IconPlay />}
                          </button>
                          <button
                            type="button"
                            onClick={() => downloadAudioWithAuth(audioUrl, `call-${call.id}.wav`)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Скачать аудио"
                          >
                            <IconDownload />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteAudio(call.id)}
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
  );
}

export default React.memo(CallsTable);
