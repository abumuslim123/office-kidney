import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import HrTabs from '../components/HrTabs';

type VacancyItem = {
  id: string;
  name: string;
  area?: { name: string };
  salary?: { from?: number; to?: number; currency?: string };
  created_at?: string;
  counters?: { responses?: number; unread_responses?: number };
};

type DashboardData = {
  vacancies: { total: number; items: VacancyItem[] };
  negotiations: { totalNew: number; byVacancy: Record<string, number> };
};

type StatusData = {
  connected: boolean;
  employerName?: string;
  employerId?: string;
};

export default function HrHunter() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState<StatusData | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [connecting, setConnecting] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const { data } = await api.get('/hunter/status');
      setStatus(data);
      return data as StatusData;
    } catch {
      setError('Не удалось загрузить статус');
      return null;
    }
  }, []);

  const loadDashboard = useCallback(async () => {
    try {
      const { data } = await api.get('/hunter/dashboard');
      setDashboard(data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Не удалось загрузить данные');
    }
  }, []);

  // Handle OAuth callback code
  useEffect(() => {
    const code = searchParams.get('code');
    if (!code) return;

    setConnecting(true);
    setSearchParams({}, { replace: true });

    api
      .post('/hunter/callback', { code })
      .then(async () => {
        const st = await loadStatus();
        if (st?.connected) await loadDashboard();
      })
      .catch((err: unknown) => {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
        setError(msg || 'Ошибка подключения к hh.ru');
      })
      .finally(() => setConnecting(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Initial load
  useEffect(() => {
    (async () => {
      setLoading(true);
      const st = await loadStatus();
      if (st?.connected) await loadDashboard();
      setLoading(false);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConnect = async () => {
    try {
      const { data } = await api.get('/hunter/auth-url');
      window.location.href = data.url;
    } catch {
      setError('Не удалось получить ссылку авторизации');
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Отключить hh.ru?')) return;
    try {
      await api.post('/hunter/disconnect');
      setStatus({ connected: false });
      setDashboard(null);
    } catch {
      setError('Ошибка при отключении');
    }
  };

  const formatSalary = (s?: VacancyItem['salary']) => {
    if (!s) return '—';
    const parts: string[] = [];
    if (s.from) parts.push(`от ${s.from.toLocaleString('ru-RU')}`);
    if (s.to) parts.push(`до ${s.to.toLocaleString('ru-RU')}`);
    if (!parts.length) return '—';
    return parts.join(' ') + (s.currency ? ` ${s.currency}` : '');
  };

  return (
    <div className="space-y-6">
      <HrTabs active="hunter" />

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
          <button onClick={() => setError('')} className="ml-3 text-red-500 underline text-sm">
            Закрыть
          </button>
        </div>
      )}

      {(loading || connecting) && (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <svg className="animate-spin h-6 w-6 mr-3" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {connecting ? 'Подключение к hh.ru...' : 'Загрузка...'}
        </div>
      )}

      {!loading && !connecting && status && !status.connected && (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center max-w-lg mx-auto">
          <div className="text-5xl mb-4">&#128269;</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Подключение к hh.ru</h2>
          <p className="text-gray-500 mb-6">
            Подключите аккаунт работодателя на hh.ru, чтобы видеть вакансии и отклики прямо здесь.
          </p>
          <button
            onClick={handleConnect}
            className="bg-accent text-white px-6 py-2.5 rounded-lg font-medium hover:opacity-90 transition"
          >
            Подключить hh.ru
          </button>
        </div>
      )}

      {!loading && !connecting && status?.connected && (
        <>
          {/* Status bar */}
          <div className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-5 py-3">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 bg-green-500 rounded-full inline-block" />
              <span className="text-sm text-gray-700">
                Подключено: <span className="font-medium">{status.employerName || 'hh.ru'}</span>
              </span>
            </div>
            <button
              onClick={handleDisconnect}
              className="text-sm text-red-500 hover:text-red-700 transition"
            >
              Отключить
            </button>
          </div>

          {/* Summary cards */}
          {dashboard && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <p className="text-sm text-gray-500 mb-1">Активные вакансии</p>
                <p className="text-3xl font-bold text-gray-800">{dashboard.vacancies.total}</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <p className="text-sm text-gray-500 mb-1">Новые отклики</p>
                <p className="text-3xl font-bold text-gray-800">{dashboard.negotiations.totalNew}</p>
              </div>
            </div>
          )}

          {/* Vacancies table */}
          {dashboard && dashboard.vacancies.items.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700">Вакансии</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <tr>
                      <th className="text-left px-5 py-2">Название</th>
                      <th className="text-left px-5 py-2">Город</th>
                      <th className="text-left px-5 py-2">Зарплата</th>
                      <th className="text-center px-5 py-2">Отклики</th>
                      <th className="text-center px-5 py-2">Новые</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {dashboard.vacancies.items.map((v) => (
                      <tr key={v.id} className="hover:bg-gray-50">
                        <td className="px-5 py-3">
                          <a
                            href={`https://hh.ru/vacancy/${v.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent hover:underline font-medium"
                          >
                            {v.name}
                          </a>
                        </td>
                        <td className="px-5 py-3 text-gray-600">{v.area?.name || '—'}</td>
                        <td className="px-5 py-3 text-gray-600">{formatSalary(v.salary)}</td>
                        <td className="px-5 py-3 text-center text-gray-600">
                          {v.counters?.responses ?? 0}
                        </td>
                        <td className="px-5 py-3 text-center">
                          {(v.counters?.unread_responses || 0) > 0 ? (
                            <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs font-medium">
                              {v.counters?.unread_responses}
                            </span>
                          ) : (
                            <span className="text-gray-400">0</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {dashboard && dashboard.vacancies.items.length === 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-400">
              Нет активных вакансий
            </div>
          )}
        </>
      )}
    </div>
  );
}
