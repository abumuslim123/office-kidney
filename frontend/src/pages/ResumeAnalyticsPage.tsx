import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  AreaChart, Area,
} from 'recharts';
import { api } from '../lib/api';
import type { AnalyticsData } from '../lib/resume-types';
import { BRANCHES, GENDER_PIE_COLORS, DOCTOR_TYPE_PIE_COLORS, formatDateTime } from '../lib/resume-constants';

const COLORS = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0891b2', '#4f46e5', '#be185d'];
const SCORE_BAR_COLORS: Record<string, string> = {
  '0-19': '#ef4444',
  '20-39': '#f97316',
  '40-59': '#eab308',
  '60-79': '#22c55e',
  '80-100': '#10b981',
};
const PERIODS = [
  { value: '7', label: '7 дней' },
  { value: '30', label: '30 дней' },
  { value: '90', label: '90 дней' },
  { value: '365', label: 'Год' },
  { value: '', label: 'Всё время' },
];

export default function ResumeAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30');
  const [branch, setBranch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (period) params.days = period;
      if (branch) params.branch = branch;
      const res = await api.get<AnalyticsData>('/resume/analytics', { params });
      setData(res.data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [period, branch]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <p className="text-sm text-gray-400">Загрузка аналитики...</p>;
  if (!data) return <p className="text-sm text-red-600">Ошибка загрузки</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-lg font-semibold text-gray-900">Аналитика</h2>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPeriod(p.value)}
                className={`px-3 py-1.5 text-sm transition-colors ${
                  period === p.value ? 'bg-accent text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <select
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
          >
            <option value="">Все филиалы</option>
            {BRANCHES.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {data.kpis.map((kpi) => (
          <div key={kpi.key} className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-1">{kpi.title}</p>
            <p className="text-2xl font-semibold text-gray-900">
              {kpi.format === 'percent'
                ? `${Math.round(kpi.value)}%`
                : kpi.format === 'decimal'
                  ? kpi.value.toFixed(1)
                  : kpi.format === 'fraction'
                    ? `${kpi.value}/${kpi.fractionTotal || 0}`
                    : kpi.value}
            </p>
            {kpi.previousValue != null && (
              <p className={`text-xs mt-1 ${
                kpi.trendDirection === 'up-good'
                  ? kpi.value >= kpi.previousValue ? 'text-green-600' : 'text-red-600'
                  : kpi.trendDirection === 'up-bad'
                    ? kpi.value >= kpi.previousValue ? 'text-red-600' : 'text-green-600'
                    : 'text-gray-400'
              }`}>
                {kpi.value >= kpi.previousValue ? '+' : ''}{kpi.value - kpi.previousValue}
                {' от прошлого периода'}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Timeline Chart */}
      {data.timeline.length > 0 && (
        <ChartCard title="Динамика поступления резюме">
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={data.timeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Area type="monotone" dataKey="count" stroke="#2563eb" fill="#2563eb" fillOpacity={0.1} name="Резюме" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Funnel */}
        {data.funnel.length > 0 && (
          <ChartCard title="Воронка">
            <div className="space-y-2">
              {data.funnel.map((stage, i) => (
                <div key={stage.name}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-700">{stage.name}</span>
                    <span className="font-medium">{stage.value}</span>
                  </div>
                  <div className="h-6 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${data.funnel[0].value ? (stage.value / data.funnel[0].value) * 100 : 0}%`,
                        backgroundColor: stage.color || COLORS[i % COLORS.length],
                      }}
                    />
                  </div>
                  {stage.conversionFromPrevious != null && i > 0 && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Конверсия: {Math.round(stage.conversionFromPrevious)}%
                    </p>
                  )}
                </div>
              ))}
            </div>
          </ChartCard>
        )}

        {/* Specializations */}
        {data.specializations.length > 0 && (
          <ChartCard title="По специализациям">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.specializations.slice(0, 10)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#2563eb" radius={[0, 4, 4, 0]} name="Кандидатов" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* Categories */}
        {data.categories.length > 0 && (
          <ChartCard title="Квалификационные категории">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={data.categories}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={(props: any) => `${props.name} (${Math.round(props.percent * 100)}%)`}
                >
                  {data.categories.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* Gender distribution */}
        {data.genderDistribution && data.genderDistribution.length > 0 && (
          <ChartCard title="Распределение по полу">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={data.genderDistribution}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={(props: any) => `${props.name} (${Math.round(props.percent * 100)}%)`}
                >
                  {data.genderDistribution.map((entry) => (
                    <Cell key={entry.key} fill={GENDER_PIE_COLORS[entry.key] || '#9ca3af'} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number | undefined) => [value ?? 0, 'Кандидатов']} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* Doctor type distribution */}
        {data.doctorTypeDistribution && data.doctorTypeDistribution.length > 0 && (
          <ChartCard title="Направление врача">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={data.doctorTypeDistribution}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={(props: any) => `${props.name} (${Math.round(props.percent * 100)}%)`}
                >
                  {data.doctorTypeDistribution.map((entry) => (
                    <Cell key={entry.key} fill={DOCTOR_TYPE_PIE_COLORS[entry.key] || '#9ca3af'} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any) => [value, 'Кандидатов']} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* Experience */}
        {data.experienceBuckets.length > 0 && (
          <ChartCard title="Опыт работы">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.experienceBuckets}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#7c3aed" radius={[4, 4, 0, 0]} name="Кандидатов" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* AI Score distribution */}
        {data.scoreDistribution && data.scoreDistribution.some((b) => b.count > 0) && (
          <ChartCard title="Распределение AI-оценок">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.scoreDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Кандидатов">
                  {data.scoreDistribution.map((entry) => (
                    <Cell key={entry.name} fill={SCORE_BAR_COLORS[entry.name] || '#6b7280'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* Branch distribution */}
        {data.branchDistribution.length > 0 && (
          <ChartCard title="По филиалам">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.branchDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="branch" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="NEW" stackId="a" fill="#9ca3af" name="Новый" />
                <Bar dataKey="REVIEWING" stackId="a" fill="#3b82f6" name="На рассмотрении" />
                <Bar dataKey="INVITED" stackId="a" fill="#8b5cf6" name="Приглашён" />
                <Bar dataKey="HIRED" stackId="a" fill="#10b981" name="Принят" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {/* Top tags */}
        {data.topTags.length > 0 && (
          <ChartCard title="Популярные теги">
            <div className="space-y-2">
              {data.topTags.map((tag) => (
                <div key={tag.label} className="flex items-center gap-3">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: tag.color || '#6b7280' }}
                  />
                  <span className="text-sm text-gray-700 flex-1">{tag.label}</span>
                  <span className="text-sm font-medium text-gray-900">{tag.count}</span>
                </div>
              ))}
            </div>
          </ChartCard>
        )}
      </div>

      {/* Branch coverage matrix */}
      {data.branchCoverage.length > 0 && (
        <ChartCard title="Покрытие специализаций по филиалам">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Специализация</th>
                  {BRANCHES.map((b) => (
                    <th key={b} className="text-center px-3 py-2 font-medium text-gray-600">{b}</th>
                  ))}
                  <th className="text-center px-3 py-2 font-medium text-gray-600">Итого</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.branchCoverage.map((row) => (
                  <tr key={row.specialization}>
                    <td className="px-3 py-2 text-gray-700">{row.specialization}</td>
                    {BRANCHES.map((b) => (
                      <td key={b} className="text-center px-3 py-2">
                        <span className={`inline-block min-w-[24px] text-center rounded-full px-1.5 py-0.5 text-xs font-medium ${
                          (row.branches[b] || 0) > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-400'
                        }`}>
                          {row.branches[b] || 0}
                        </span>
                      </td>
                    ))}
                    <td className="text-center px-3 py-2 font-medium">{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      )}

      {/* Expiring accreditations */}
      {data.expiringAccreditations.length > 0 && (
        <ChartCard title="Истекающие аккредитации">
          <div className="space-y-2">
            {data.expiringAccreditations.map((item) => (
              <div key={item.id} className="flex items-center justify-between py-1">
                <Link to={`/hr/resume/candidates/${item.id}`} className="text-sm text-accent hover:underline">
                  {item.fullName}
                </Link>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500">{item.specialization || '—'}</span>
                  <span className="text-xs text-red-600 font-medium">
                    {formatDateTime(item.accreditationExpiryDate)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </ChartCard>
      )}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">{title}</h3>
      {children}
    </div>
  );
}
