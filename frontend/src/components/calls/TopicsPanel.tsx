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

type TopicsPanelProps = {
  matches: TopicMatch[];
  activeTopicId?: string | null;
  onTopicClick?: (topicId: string) => void;
  keywordTimestamps?: KeywordTimestamp[];
  onSeek?: (time: number) => void;
};

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function TopicsPanel({ matches, activeTopicId, onTopicClick, keywordTimestamps, onSeek }: TopicsPanelProps) {
  const grouped = new Map<string, TopicMatch[]>();
  matches.forEach((m) => {
    const list = grouped.get(m.topicId) || [];
    list.push(m);
    grouped.set(m.topicId, list);
  });

  // Build keyword -> timestamps map
  const tsMap = new Map<string, number[]>();
  keywordTimestamps?.forEach((kt) => {
    const key = kt.keyword.toLowerCase();
    const list = tsMap.get(key) || [];
    list.push(kt.time);
    tsMap.set(key, list);
  });

  return (
    <div>
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
