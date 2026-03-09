import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

type TopicOption = { id: string; name: string };

type TopicStat = {
  topicId: string;
  topicName: string;
  callsCount: number;
  occurrences: number;
};

type WordDetail = { word: string; count: number };

type AnalysisResult = {
  totalCalls: number;
  transcribedCalls: number;
  transcribedCallIds: string[];
  topics: TopicStat[];
  summary: {
    fillerWords: number;
    negativeWords: number;
    fillerWordsDetail?: WordDetail[];
    negativeWordsDetail?: WordDetail[];
    greetedCount: number;
    farewellCount: number;
    avgDuration: number;
    avgSpeechDuration: number;
    avgSilenceDuration: number;
    speechRatio: number;
  };
};

const formatSeconds = (value: number) => {
  if (!value || value <= 0) return '0:00';
  const total = Math.round(value);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

const PIE_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16',
  '#e11d48', '#7c3aed',
];

function PieChart({ data }: { data: { name: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return null;

  let cumulative = 0;
  const slices = data.map((d) => {
    const startAngle = (cumulative / total) * 360;
    cumulative += d.value;
    const endAngle = (cumulative / total) * 360;
    return { ...d, startAngle, endAngle };
  });

  const toRad = (deg: number) => (deg * Math.PI) / 180;

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="-1.1 -1.1 2.2 2.2" className="w-48 h-48 flex-shrink-0">
        {slices.map((slice, i) => {
          const start = toRad(slice.startAngle - 90);
          const end = toRad(slice.endAngle - 90);
          const largeArc = slice.endAngle - slice.startAngle > 180 ? 1 : 0;
          const x1 = Math.cos(start);
          const y1 = Math.sin(start);
          const x2 = Math.cos(end);
          const y2 = Math.sin(end);

          if (slices.length === 1) {
            return <circle key={i} r="1" fill={slice.color} />;
          }

          return (
            <path
              key={i}
              d={`M 0 0 L ${x1} ${y1} A 1 1 0 ${largeArc} 1 ${x2} ${y2} Z`}
              fill={slice.color}
            />
          );
        })}
      </svg>
      <div className="space-y-1.5">
        {slices.map((slice, i) => {
          const pct = Math.round((slice.value / total) * 100);
          return (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span
                className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: slice.color }}
              />
              <span className="text-gray-700">{slice.name}</span>
              <span className="text-gray-400 ml-auto">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CallsReportAnalysis() {
  const [topics, setTopics] = useState<TopicOption[]>([]);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Filters
  const [filterMode, setFilterMode] = useState<'period' | 'month'>('month');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterMonth, setFilterMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [showCallsList, setShowCallsList] = useState(false);

  useEffect(() => {
    api.get<TopicOption[]>('/calls/topics').then((res) => {
      setTopics(res.data);
      setSelectedTopics(res.data.map((t) => t.id));
    });
  }, []);

  const handleSelectAll = () => {
    if (selectedTopics.length === topics.length) {
      setSelectedTopics([]);
    } else {
      setSelectedTopics(topics.map((t) => t.id));
    }
  };

  const handleToggleTopic = (id: string) => {
    setSelectedTopics((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );
  };

  const handleAnalyze = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    setShowCallsList(false);
    try {
      const params: Record<string, string> = {};
      if (filterMode === 'period') {
        if (filterFrom) params.from = new Date(filterFrom).toISOString();
        if (filterTo) params.to = new Date(filterTo).toISOString();
      } else {
        const [y, m] = filterMonth.split('-').map(Number);
        params.from = new Date(y, m - 1, 1).toISOString();
        params.to = new Date(y, m, 0, 23, 59, 59).toISOString();
      }
      if (selectedTopics.length && selectedTopics.length < topics.length) {
        params.topics = selectedTopics.join(',');
      }
      const res = await api.get<AnalysisResult>('/calls/reports/analysis', { params });
      setResult(res.data);
    } catch {
      setError('Ошибка загрузки отчёта');
    } finally {
      setLoading(false);
    }
  };

  const pieData = useMemo(() => {
    if (!result?.topics?.length) return [];
    return result.topics.map((t, i) => ({
      name: t.topicName,
      value: t.occurrences,
      color: PIE_COLORS[i % PIE_COLORS.length],
    }));
  }, [result]);

  const monthOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      opts.push({ value: val, label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}` });
    }
    return opts;
  }, []);

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Анализ разговоров</h3>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 p-4 bg-white border border-gray-200 rounded-lg space-y-4">
        {/* Period mode toggle */}
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-700">Период:</span>
          <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden">
            <button
              type="button"
              onClick={() => setFilterMode('month')}
              className={`px-3 py-1.5 text-sm transition-colors ${
                filterMode === 'month' ? 'bg-accent text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              Месяц
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('period')}
              className={`px-3 py-1.5 text-sm transition-colors ${
                filterMode === 'period' ? 'bg-accent text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              Произвольный
            </button>
          </div>
        </div>

        {filterMode === 'month' ? (
          <div>
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none"
            >
              {monthOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <label className="text-xs text-gray-500">
              С
              <input
                type="datetime-local"
                value={filterFrom}
                onChange={(e) => setFilterFrom(e.target.value)}
                className="ml-2 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none"
              />
            </label>
            <label className="text-xs text-gray-500">
              По
              <input
                type="datetime-local"
                value={filterTo}
                onChange={(e) => setFilterTo(e.target.value)}
                className="ml-2 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none"
              />
            </label>
          </div>
        )}

        {/* Topics selection */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-sm font-medium text-gray-700">Тематики:</span>
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-xs text-accent hover:underline"
            >
              {selectedTopics.length === topics.length ? 'Снять все' : 'Выбрать все'}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {topics.map((t) => {
              const selected = selectedTopics.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleToggleTopic(t.id)}
                  className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                    selected
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                      : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'
                  }`}
                >
                  {t.name}
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={handleAnalyze}
          disabled={loading}
          className="px-5 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {loading ? 'Анализ...' : 'Сформировать отчёт'}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Topic stats */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h4 className="text-base font-semibold text-gray-900 mb-4">Срабатывания по тематикам</h4>
            {result.topics.length === 0 ? (
              <p className="text-gray-400 text-sm">Совпадений не найдено за выбранный период.</p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Topic bars */}
                <div className="space-y-3">
                  {result.topics.map((t, i) => {
                    const maxOcc = Math.max(...result.topics.map((x) => x.occurrences));
                    const pct = maxOcc > 0 ? (t.occurrences / maxOcc) * 100 : 0;
                    return (
                      <div key={t.topicId}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="font-medium text-gray-700">{t.topicName}</span>
                          <span className="text-gray-500">
                            {t.occurrences} совп. / {t.callsCount} звонков
                          </span>
                        </div>
                        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: PIE_COLORS[i % PIE_COLORS.length],
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pie chart */}
                <div className="flex justify-center">
                  <PieChart data={pieData} />
                </div>
              </div>
            )}
          </div>

          {/* Summary table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <h4 className="text-base font-semibold text-gray-900 px-5 pt-5 pb-3">Сводная таблица</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr className="bg-gray-50/80">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Распознано разговоров</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Слова-паразиты</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Негативные слова</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Поздоровался</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Попрощался</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Ср. длительность записи</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Ср. длительность разговора</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Ср. длительность молчания</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Доля разговора</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-4 py-4 text-sm">
                      <button
                        type="button"
                        onClick={() => setShowCallsList((v) => !v)}
                        className="text-accent font-semibold hover:underline"
                      >
                        {result.transcribedCalls}
                      </button>
                      <span className="text-gray-400 text-xs ml-1">из {result.totalCalls}</span>
                    </td>
                    <td className="px-4 py-4 text-sm text-center font-medium text-gray-700">
                      {result.summary.fillerWords}
                    </td>
                    <td className="px-4 py-4 text-sm text-center font-medium text-gray-700">
                      {result.summary.negativeWords}
                    </td>
                    <td className="px-4 py-4 text-sm text-center">
                      <span className={`font-medium ${result.summary.greetedCount > 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {result.summary.greetedCount}
                      </span>
                      <span className="text-gray-400 text-xs ml-1">/ {result.transcribedCalls}</span>
                    </td>
                    <td className="px-4 py-4 text-sm text-center">
                      <span className={`font-medium ${result.summary.farewellCount > 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {result.summary.farewellCount}
                      </span>
                      <span className="text-gray-400 text-xs ml-1">/ {result.transcribedCalls}</span>
                    </td>
                    <td className="px-4 py-4 text-sm text-center font-medium text-gray-700">
                      {formatSeconds(result.summary.avgDuration)}
                    </td>
                    <td className="px-4 py-4 text-sm text-center font-medium text-gray-700">
                      {formatSeconds(result.summary.avgSpeechDuration)}
                    </td>
                    <td className="px-4 py-4 text-sm text-center font-medium text-gray-700">
                      {formatSeconds(result.summary.avgSilenceDuration)}
                    </td>
                    <td className="px-4 py-4 text-sm text-center font-medium text-gray-700">
                      {result.summary.speechRatio}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Unwanted words detail */}
          {(result.summary.fillerWordsDetail?.length || result.summary.negativeWordsDetail?.length) ? (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-base font-semibold text-gray-900 mb-4">Нежелательные слова — детализация</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {result.summary.negativeWordsDetail && result.summary.negativeWordsDetail.length > 0 && (
                  <div className="rounded-lg px-4 py-3 bg-red-50/60 ring-1 ring-red-200">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0" />
                      <span className="text-sm font-semibold text-red-700">Негативные</span>
                      <span className="text-xs text-red-400 ml-auto">
                        Всего: {result.summary.negativeWords}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {result.summary.negativeWordsDetail.map((d) => (
                        <div key={d.word} className="flex items-center justify-between text-sm">
                          <span className="text-red-600">«{d.word}»</span>
                          <span className="text-red-400 text-xs">×{d.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {result.summary.fillerWordsDetail && result.summary.fillerWordsDetail.length > 0 && (
                  <div className="rounded-lg px-4 py-3 bg-orange-50/60 ring-1 ring-orange-200">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-2.5 h-2.5 rounded-full bg-orange-400 flex-shrink-0" />
                      <span className="text-sm font-semibold text-orange-700">Слова-паразиты</span>
                      <span className="text-xs text-orange-400 ml-auto">
                        Всего: {result.summary.fillerWords}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {result.summary.fillerWordsDetail.map((d) => (
                        <div key={d.word} className="flex items-center justify-between text-sm">
                          <span className="text-orange-600">«{d.word}»</span>
                          <span className="text-orange-400 text-xs">×{d.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {/* Calls list (expandable) */}
          {showCallsList && result.transcribedCallIds.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h4 className="text-base font-semibold text-gray-900 mb-3">
                Распознанные разговоры ({result.transcribedCallIds.length})
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {result.transcribedCallIds.map((id) => (
                  <Link
                    key={id}
                    to={`/calls/${id}`}
                    className="px-3 py-2 text-xs text-accent bg-accent/5 border border-accent/20 rounded-lg hover:bg-accent/10 transition-colors truncate text-center"
                  >
                    {id.slice(0, 8)}...
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
