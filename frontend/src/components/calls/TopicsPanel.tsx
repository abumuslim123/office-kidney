type TopicMatch = {
  topicId: string;
  topicName: string;
  keyword: string;
  occurrences: number;
};

type TopicsPanelProps = {
  matches: TopicMatch[];
  activeTopicId?: string | null;
  onTopicClick?: (topicId: string) => void;
};

export default function TopicsPanel({ matches, activeTopicId, onTopicClick }: TopicsPanelProps) {
  const grouped = new Map<string, TopicMatch[]>();
  matches.forEach((m) => {
    const list = grouped.get(m.topicId) || [];
    list.push(m);
    grouped.set(m.topicId, list);
  });

  return (
    <div>
      <div className="text-sm font-medium text-gray-900 mb-2">Тематики</div>
      <div className="space-y-2">
        {grouped.size ? (
          Array.from(grouped.entries()).map(([topicId, items]) => {
            const isActive = activeTopicId === topicId;
            return (
              <div
                key={topicId}
                onClick={() => onTopicClick?.(topicId)}
                className={`rounded-lg px-3 py-2 cursor-pointer transition-colors ${
                  isActive
                    ? 'bg-green-50 ring-1 ring-green-400'
                    : 'hover:bg-gray-100'
                }`}
              >
                <div className={`text-xs font-semibold ${isActive ? 'text-green-700' : 'text-gray-700'}`}>
                  {items[0].topicName}
                </div>
                <div className="mt-1 space-y-0.5">
                  {items.map((item, idx) => (
                    <div key={`${topicId}-${idx}`} className={`text-xs ${isActive ? 'text-green-600' : 'text-gray-500'}`}>
                      {item.keyword} ({item.occurrences})
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-xs text-gray-500">Тематики не найдены</div>
        )}
      </div>
    </div>
  );
}
