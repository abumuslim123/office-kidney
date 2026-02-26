import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { BRANCHES, formatDate } from '../lib/resume-constants';
import type { AnalyticsData, PeriodPreset } from '../lib/resume-types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList, Legend,
  AreaChart, Area,
} from 'recharts';

const PERIOD_PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: '7d', label: '7 дней' },
  { value: '30d', label: '30 дней' },
  { value: '90d', label: '90 дней' },
  { value: 'year', label: 'Год' },
  { value: 'all', label: 'Всё время' },
];

const STATUS_COLORS: Record<string, { fill: string; name: string }> = {
  NEW: { fill: '#94a3b8', name: 'Новый' },
  REVIEWING: { fill: '#3b82f6', name: 'На рассмотрении' },
  INVITED: { fill: '#8b5cf6', name: 'Приглашён' },
  HIRED: { fill: '#22c55e', name: 'Принят' },
};

const CATEGORY_CHART_COLORS = ['#8b5cf6', '#3b82f6', '#22c55e', '#94a3b8'];

export default function ResumeAnalyticsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const period = (searchParams.get('period') || 'all') as PeriodPreset;
  const branch = searchParams.get('branch') || '';

  const updateParam = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value); else params.delete(key);
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (period !== 'all') params.period = period;
      if (branch) params.branch = branch;
      const res = await api.get<AnalyticsData>('/resume/analytics', { params });
      setData(res.data);
    } catch { setData(null); } finally { setLoading(false); }
  }, [period, branch]);

  useEffect(() => { load(); }, [load]);

  const totalConversion = useMemo(() => {
    if (!data) return 0;
    const hiredStage = data.funnel.find((s) => s.name === 'Приняты');
    const totalStage = data.funnel[0];
    return hiredStage && totalStage && totalStage.value > 0
      ? Math.round((hiredStage.value / totalStage.value) * 100) : 0;
  }, [data]);

  if (loading) return <div className="flex items-center justify-center py-20 text-gray-500">Загрузка аналитики...</div>;
  if (!data) return <div className="text-center py-20 text-gray-500">Не удалось загрузить данные</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Аналитика</h1>
        <p className="text-sm text-gray-500 mt-1">Обзор базы кандидатов и ключевые метрики</p>
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {PERIOD_PRESETS.map((p) => (
            <button
              key={p.value}
              onClick={() => updateParam('period', p.value === 'all' ? '' : p.value)}
              className={`px-3 py-1.5 text-sm rounded-md ${period === p.value ? 'bg-indigo-600 text-white' : 'border border-gray-300 hover:bg-gray-50'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <select
          value={branch || 'all'}
          onChange={(e) => updateParam('branch', e.target.value === 'all' ? '' : e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-md"
        >
          <option value="all">Все филиалы</option>
          {BRANCHES.map((b) => (<option key={b} value={b}>{b}</option>))}
        </select>
        {(period !== 'all' || branch) && (
          <button onClick={() => setSearchParams({})} className="text-sm text-gray-500 hover:text-gray-700">Сбросить</button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data.kpis.map((metric) => {
          const trend = getTrend(metric);
          return (
            <div key={metric.key} className="rounded-lg border border-gray-200 bg-white p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-500">{metric.title}</p>
              </div>
              <p className="text-2xl font-bold text-gray-900">{formatKpiValue(metric)}</p>
              {trend !== null && (
                <p className={`mt-1 text-xs ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                  {trend.change > 0 ? '+' : ''}{trend.change}% vs пред. период
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Timeline */}
        <ChartCard title="Динамика добавления">
          {data.timeline.every((d) => d.count === 0) ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={data.timeline}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => [`${value} кандидатов`, '']} />
                <Area type="monotone" dataKey="count" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorCount)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Funnel */}
        <ChartCard title="Воронка рекрутинга" badge={`Конверсия: ${totalConversion}%`}>
          {data.funnel.every((d) => d.value === 0) ? <EmptyChart /> : (
            <>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.funnel} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => [`${value} кандидатов`, '']} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {data.funnel.map((entry, index) => (<Cell key={index} fill={entry.color} />))}
                    <LabelList dataKey="value" position="right" style={{ fontSize: 11 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-3 flex flex-wrap gap-3 text-xs">
                {data.funnel.filter((d) => d.conversionFromPrevious !== null).map((d) => (
                  <span key={d.name} className="text-gray-500">
                    {d.name}: <span className={`font-medium ${d.conversionFromPrevious! >= 50 ? 'text-green-600' : d.conversionFromPrevious! >= 20 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {d.conversionFromPrevious}%
                    </span>
                  </span>
                ))}
              </div>
            </>
          )}
        </ChartCard>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Specializations */}
        <ChartCard title="По специализациям">
          {data.specializations.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.specializations} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Categories */}
        <ChartCard title="По категориям">
          {data.categories.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.categories.map((d) => ({ ...d, label: `${d.count} (${d.percentage}%)` }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value, _name, props) => {
                  const pct = (props as unknown as { payload: { percentage: number } }).payload?.percentage ?? 0;
                  return [`${value} (${pct}%)`, 'Кандидатов'];
                }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {data.categories.map((_, index) => (<Cell key={index} fill={CATEGORY_CHART_COLORS[index % CATEGORY_CHART_COLORS.length]} />))}
                  <LabelList dataKey="label" position="top" style={{ fontSize: 10 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Branch distribution */}
        <ChartCard title="По филиалам">
          {data.branchDistribution.every((d) => d.total === 0) ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={data.branchDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="branch" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                {Object.entries(STATUS_COLORS).map(([key, { fill, name }]) => (
                  <Bar key={key} dataKey={key} stackId="a" fill={fill} name={name} />
                ))}
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Tags */}
        <ChartCard title="Популярные теги">
          {data.topTags.length === 0 ? <EmptyChart text="Теги ещё не добавлены" /> : (
            <ResponsiveContainer width="100%" height={Math.max(data.topTags.length * 35, 150)}>
              <BarChart data={data.topTags.map((t) => ({ name: t.label, count: t.count, color: t.color }))} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(value) => [`${value} кандидатов`, '']} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {data.topTags.map((entry, index) => (<Cell key={index} fill={entry.color || '#6366f1'} />))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Experience */}
        <ChartCard title="По стажу работы (лет)">
          {data.experienceBuckets.every((d) => d.count === 0) ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.experienceBuckets}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Branch coverage matrix */}
        <ChartCard title="Покрытие специализаций">
          {data.branchCoverage.every((r) => r.total === 0) ? <EmptyChart /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-left py-2 pr-2 font-medium text-gray-500 sticky left-0 bg-white">Специализация</th>
                    {BRANCHES.map((b) => (<th key={b} className="text-center px-2 py-2 font-medium text-gray-500 whitespace-nowrap">{b}</th>))}
                    <th className="text-center px-2 py-2 font-bold text-gray-700">Итого</th>
                  </tr>
                </thead>
                <tbody>
                  {data.branchCoverage.filter((r) => r.total > 0).map((row) => (
                    <tr key={row.specialization} className="border-t border-gray-100">
                      <td className="py-1.5 pr-2 font-medium text-gray-700 sticky left-0 bg-white">{row.specialization}</td>
                      {BRANCHES.map((b) => {
                        const count = row.branches[b] || 0;
                        const cls = count === 0 ? 'bg-red-50 text-red-600' : count === 1 ? 'bg-yellow-50 text-yellow-700' : 'bg-green-50 text-green-700';
                        return <td key={b} className={`text-center px-2 py-1.5 font-medium ${cls}`}>{count}</td>;
                      })}
                      <td className="text-center px-2 py-1.5 font-bold text-gray-900">{row.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ChartCard>
      </div>

      {/* Expiring accreditations */}
      {data.expiringAccreditations.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="px-5 py-3 border-b border-gray-200 flex items-center gap-2">
            <svg className="h-5 w-5 text-yellow-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <h3 className="text-sm font-semibold text-gray-900">Истекающая аккредитация (90 дней)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">ФИО</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Специализация</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Дата истечения</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Дней осталось</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.expiringAccreditations.map((c) => {
                  const daysRemaining = c.accreditationExpiryDate
                    ? Math.ceil((new Date(c.accreditationExpiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                    : null;
                  const isUrgent = daysRemaining !== null && daysRemaining <= 30;
                  return (
                    <tr key={c.id}>
                      <td className="px-4 py-2">
                        <Link to={`/hr/resume/candidates/${c.id}`} className="text-indigo-600 hover:underline">{c.fullName}</Link>
                      </td>
                      <td className="px-4 py-2 text-gray-600">{c.specialization || '—'}</td>
                      <td className="px-4 py-2 text-gray-600">{formatDate(c.accreditationExpiryDate)}</td>
                      <td className="px-4 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isUrgent ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
                          {daysRemaining} дн.
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ChartCard({ title, badge, children }: { title: string; badge?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {badge && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">{badge}</span>}
      </div>
      {children}
    </div>
  );
}

function EmptyChart({ text = 'Нет данных' }: { text?: string }) {
  return <p className="text-gray-400 text-center py-8 text-sm">{text}</p>;
}

function formatKpiValue(metric: { value: number; format: string; fractionTotal?: number }): string {
  switch (metric.format) {
    case 'percent': return `${metric.value}%`;
    case 'decimal': return metric.value.toFixed(1);
    case 'fraction': return metric.fractionTotal != null ? `${metric.value} / ${metric.fractionTotal}` : String(metric.value);
    default: return String(metric.value);
  }
}

function getTrend(metric: { value: number; previousValue: number | null; trendDirection: string }): { change: number; isPositive: boolean } | null {
  if (metric.previousValue === null || metric.previousValue === 0) return null;
  const change = Math.round(((metric.value - metric.previousValue) / metric.previousValue) * 100);
  if (change === 0) return { change: 0, isPositive: true };
  const isIncreasing = change > 0;
  let isPositive: boolean;
  if (metric.trendDirection === 'up-good') isPositive = isIncreasing;
  else if (metric.trendDirection === 'up-bad') isPositive = !isIncreasing;
  else isPositive = true;
  return { change, isPositive };
}
