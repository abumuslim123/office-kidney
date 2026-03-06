import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import HrTabs from '../components/HrTabs';

type HhStatus = { connected: boolean };

type HhMe = {
  first_name?: string;
  last_name?: string;
  email?: string;
  employer?: { name?: string; id?: number };
};

type HhVacancy = {
  id: string;
  name: string;
  area?: { name?: string };
  created_at?: string;
  counters?: { responses?: number; unread_responses?: number; views?: number };
};

type HhVacanciesResponse = {
  items?: HhVacancy[];
  found?: number;
  page?: number;
  pages?: number;
};

type HhNegotiation = {
  id: string;
  state?: { name?: string };
  vacancy?: { name?: string; id?: string };
  resume?: { title?: string; first_name?: string; last_name?: string };
  created_at?: string;
  updated_at?: string;
};

type HhNegotiationsResponse = {
  items?: HhNegotiation[];
  found?: number;
};

export default function HrHunter() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<HhStatus | null>(null);
  const [me, setMe] = useState<HhMe | null>(null);
  const [vacancies, setVacancies] = useState<HhVacanciesResponse | null>(null);
  const [negotiations, setNegotiations] = useState<HhNegotiationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const err = searchParams.get('error');
    if (err === 'no_code') setError('Авторизация не удалась: код не получен');
    else if (err === 'auth_failed') setError('Ошибка авторизации hh.ru');
  }, [searchParams]);

  useEffect(() => {
    loadStatus();
  }, []);

  async function loadStatus() {
    setLoading(true);
    try {
      const { data } = await api.get<HhStatus>('/hr/hh/status');
      setStatus(data);
      if (data.connected) {
        await loadDashboard();
      }
    } catch {
      setError('Не удалось получить статус подключения');
    } finally {
      setLoading(false);
    }
  }

  async function loadDashboard() {
    const [meRes, vacRes, negRes] = await Promise.allSettled([
      api.get<HhMe>('/hr/hh/me'),
      api.get<HhVacanciesResponse>('/hr/hh/vacancies'),
      api.get<HhNegotiationsResponse>('/hr/hh/negotiations'),
    ]);
    if (meRes.status === 'fulfilled') setMe(meRes.value.data);
    if (vacRes.status === 'fulfilled') setVacancies(vacRes.value.data);
    if (negRes.status === 'fulfilled') setNegotiations(negRes.value.data);
    const failed = [meRes, vacRes, negRes].filter((r) => r.status === 'rejected');
    if (failed.length === 3) setError('Не удалось загрузить данные с hh.ru');
  }

  async function handleConnect() {
    try {
      const { data } = await api.get<{ url: string }>('/hr/hh/auth-url');
      window.location.href = data.url;
    } catch {
      setError('Не удалось получить ссылку авторизации');
    }
  }

  async function handleDisconnect() {
    try {
      await api.post('/hr/hh/disconnect');
      setStatus({ connected: false });
      setMe(null);
      setVacancies(null);
      setNegotiations(null);
    } catch {
      setError('Ошибка при отключении');
    }
  }

  return (
    <div>
      <HrTabs active="hunter" />
      <h1 className="text-xl font-bold mb-4">Хантер — hh.ru</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded mb-4">
          {error}
          <button className="ml-2 underline" onClick={() => setError('')}>Скрыть</button>
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Загрузка...</p>
      ) : !status?.connected ? (
        <div className="bg-white rounded shadow p-6 max-w-md">
          <p className="text-gray-600 mb-4">
            Подключите аккаунт hh.ru для просмотра вакансий, откликов и статистики.
          </p>
          <button
            onClick={handleConnect}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-medium"
          >
            Подключить hh.ru
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Account info */}
          <div className="bg-white rounded shadow p-4 flex items-center justify-between">
            <div>
              <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-2" />
              <span className="font-medium">
                {me?.first_name} {me?.last_name}
              </span>
              {me?.employer?.name && (
                <span className="text-gray-500 ml-2">— {me.employer.name}</span>
              )}
            </div>
            <button
              onClick={handleDisconnect}
              className="text-sm text-red-600 hover:underline"
            >
              Отключить
            </button>
          </div>

          {/* Vacancies */}
          <div className="bg-white rounded shadow p-4">
            <h2 className="text-lg font-semibold mb-3">
              Активные вакансии
              {vacancies?.found != null && (
                <span className="text-gray-400 font-normal text-sm ml-2">({vacancies.found})</span>
              )}
            </h2>
            {!vacancies?.items?.length ? (
              <p className="text-gray-400">Нет активных вакансий</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="pb-2 pr-4">Вакансия</th>
                      <th className="pb-2 pr-4">Город</th>
                      <th className="pb-2 pr-4">Отклики</th>
                      <th className="pb-2 pr-4">Новые</th>
                      <th className="pb-2">Дата</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vacancies.items.map((v) => (
                      <tr key={v.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-2 pr-4">
                          <a
                            href={`https://hh.ru/vacancy/${v.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            {v.name}
                          </a>
                        </td>
                        <td className="py-2 pr-4 text-gray-600">{v.area?.name || '—'}</td>
                        <td className="py-2 pr-4">{v.counters?.responses ?? 0}</td>
                        <td className="py-2 pr-4">
                          {v.counters?.unread_responses ? (
                            <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-medium">
                              {v.counters.unread_responses}
                            </span>
                          ) : (
                            '0'
                          )}
                        </td>
                        <td className="py-2 text-gray-500">
                          {v.created_at ? new Date(v.created_at).toLocaleDateString('ru-RU') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Negotiations */}
          <div className="bg-white rounded shadow p-4">
            <h2 className="text-lg font-semibold mb-3">
              Последние отклики
              {negotiations?.found != null && (
                <span className="text-gray-400 font-normal text-sm ml-2">({negotiations.found})</span>
              )}
            </h2>
            {!negotiations?.items?.length ? (
              <p className="text-gray-400">Нет откликов</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="pb-2 pr-4">Кандидат</th>
                      <th className="pb-2 pr-4">Вакансия</th>
                      <th className="pb-2 pr-4">Статус</th>
                      <th className="pb-2">Дата</th>
                    </tr>
                  </thead>
                  <tbody>
                    {negotiations.items.map((n) => (
                      <tr key={n.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-2 pr-4 font-medium">
                          {n.resume?.last_name} {n.resume?.first_name}
                        </td>
                        <td className="py-2 pr-4 text-gray-600">{n.vacancy?.name || '—'}</td>
                        <td className="py-2 pr-4">
                          <span className="bg-gray-100 px-2 py-0.5 rounded text-xs">
                            {n.state?.name || '—'}
                          </span>
                        </td>
                        <td className="py-2 text-gray-500">
                          {n.updated_at
                            ? new Date(n.updated_at).toLocaleDateString('ru-RU')
                            : n.created_at
                              ? new Date(n.created_at).toLocaleDateString('ru-RU')
                              : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
