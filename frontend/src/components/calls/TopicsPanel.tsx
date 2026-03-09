import React, { useMemo } from 'react';

type TopicMatch = {
  topicId: string;
  topicName: string;
  keyword: string;
  occurrences: number;
};

type KeywordTimestamp = {
  keyword: string;
  time: number;
};

type UnwantedWordMatch = {
  word: string;
  occurrences: number;
  timestamps: number[];
  type: 'filler' | 'negative';
};

type TopicsPanelProps = {
  matches: TopicMatch[];
  activeTopicId?: string | null;
  onTopicClick?: (topicId: string) => void;
  keywordTimestamps?: KeywordTimestamp[];
  onSeek?: (time: number) => void;
  unwantedWords?: UnwantedWordMatch[];
};

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function TopicsPanel({ matches, activeTopicId, onTopicClick, keywordTimestamps, onSeek, unwantedWords = [] }: TopicsPanelProps) {
  const grouped = useMemo(() => {
    const map = new Map<string, TopicMatch[]>();
    matches.forEach((m) => {
      const list = map.get(m.topicId) || [];
      list.push(m);
      map.set(m.topicId, list);
    });
    return map;
  }, [matches]);

  const tsMap = useMemo(() => {
    const map = new Map<string, number[]>();
    keywordTimestamps?.forEach((kt) => {
      const key = kt.keyword.toLowerCase();
      const list = map.get(key) || [];
      list.push(kt.time);
      map.set(key, list);
    });
    return map;
  }, [keywordTimestamps]);

  const fillerMatches = useMemo(() => unwantedWords.filter((w) => w.type === 'filler'), [unwantedWords]);
  const negativeMatches = useMemo(() => unwantedWords.filter((w) => w.type === 'negative'), [unwantedWords]);

  return (
    <div>
      {/* Unwanted words section */}
      {(fillerMatches.length > 0 || negativeMatches.length > 0) && (
        <div className="mb-5">
          <div className="text-sm font-semibold text-gray-900 mb-3">Нежелательные слова</div>
          <div className="space-y-2.5">
            {negativeMatches.length > 0 && (
              <div className="rounded-lg px-3 py-2.5 bg-red-50/60 ring-1 ring-red-200">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0" />
                  <span className="text-sm font-semibold text-red-700">Негативные</span>
                  <span className="text-xs text-red-400 ml-auto">
                    {negativeMatches.reduce((s, w) => s + w.occurrences, 0)}
                  </span>
                </div>
                <div className="space-y-1">
                  {negativeMatches.map((w) => (
                    <div key={w.word}>
                      <div className="text-sm text-red-600">
                        «{w.word}» <span className="text-xs opacity-70">×{w.occurrences}</span>
                      </div>
                      {w.timestamps.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {w.timestamps.map((t, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => onSeek?.(t)}
                              className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                            >
                              {formatTime(t)}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {fillerMatches.length > 0 && (
              <div className="rounded-lg px-3 py-2.5 bg-orange-50/60 ring-1 ring-orange-200">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-400 flex-shrink-0" />
                  <span className="text-sm font-semibold text-orange-700">Слова-паразиты</span>
                  <span className="text-xs text-orange-400 ml-auto">
                    {fillerMatches.reduce((s, w) => s + w.occurrences, 0)}
                  </span>
                </div>
                <div className="space-y-1">
                  {fillerMatches.map((w) => (
                    <div key={w.word}>
                      <div className="text-sm text-orange-600">
                        «{w.word}» <span className="text-xs opacity-70">×{w.occurrences}</span>
                      </div>
                      {w.timestamps.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {w.timestamps.map((t, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => onSeek?.(t)}
                              className="text-xs px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 hover:bg-orange-200 transition-colors"
                            >
                              {formatTime(t)}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="text-sm font-semibold text-gray-900 mb-3">Тематики</div>
      <div className="space-y-2.5">
        {grouped.size ? (
          Array.from(grouped.entries()).map(([topicId, items]) => {
            const isActive = activeTopicId === topicId;
            return (
              <div
                key={topicId}
                onClick={() => onTopicClick?.(topicId)}
                className={`rounded-lg px-3 py-2.5 cursor-pointer transition-colors ${
                  isActive
                    ? 'bg-green-50 ring-1 ring-green-400'
                    : 'hover:bg-gray-100'
                }`}
              >
                <div className={`text-sm font-semibold ${isActive ? 'text-green-700' : 'text-gray-700'}`}>
                  {items[0].topicName}
                </div>
                <div className="mt-1.5 space-y-1">
                  {items.map((item, idx) => {
                    const times = tsMap.get(item.keyword.toLowerCase()) || [];
                    return (
                      <div key={`${topicId}-${idx}`}>
                        <div className={`text-sm ${isActive ? 'text-green-600' : 'text-gray-600'}`}>
                          «{item.keyword}» <span className="text-xs opacity-70">×{item.occurrences}</span>
                        </div>
                        {times.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {times.map((t, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSeek?.(t);
                                }}
                                className={`text-xs px-1.5 py-0.5 rounded transition-colors ${
                                  isActive
                                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                }`}
                              >
                                {formatTime(t)}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-sm text-gray-500">Тематики не найдены</div>
        )}
      </div>
    </div>
  );
}

export default React.memo(TopicsPanel);
