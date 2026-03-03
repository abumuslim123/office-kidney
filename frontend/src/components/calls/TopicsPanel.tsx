type TopicMatch = {
  topicId: string;
  topicName: string;
  keyword: string;
  occurrences: number;
};

type TopicsPanelProps = {
  matches: TopicMatch[];
};

export default function TopicsPanel({ matches }: TopicsPanelProps) {
  const grouped = new Map<string, TopicMatch[]>();
  matches.forEach((m) => {
    const list = grouped.get(m.topicName) || [];
    list.push(m);
    grouped.set(m.topicName, list);
  });

  return (
    <div>
      <div className="text-sm font-medium text-gray-900 mb-2">Тематики</div>
      <div className="space-y-3">
        {grouped.size ? (
          Array.from(grouped.entries()).map(([topicName, items]) => (
            <div key={topicName}>
              <div className="text-xs font-semibold text-gray-700">{topicName}</div>
              <div className="mt-1 space-y-1">
                {items.map((item, idx) => (
                  <div key={`${topicName}-${idx}`} className="text-xs text-gray-600">
                    {item.keyword} ({item.occurrences})
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="text-xs text-gray-500">Тематики не найдены</div>
        )}
      </div>
    </div>
  );
}
