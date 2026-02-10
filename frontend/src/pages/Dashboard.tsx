import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';

type DashboardTopic = {
  topicId: string;
  topicName: string;
  callsCount: number;
  occurrences: number;
};

export default function Dashboard() {
  const { user } = useAuth();
  const [topics, setTopics] = useState<DashboardTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const userPermissions = user?.permissions?.map((p) => p.slug) || [];
  const canViewCalls = userPermissions.includes('calls');

  useEffect(() => {
    if (!canViewCalls) {
      setLoading(false);
      return;
    }
    api.get<{ topics: DashboardTopic[] }>('/calls/stats')
      .then((res) => {
        setTopics(res.data?.topics || []);
      })
      .catch(() => {
        setTopics([]);
      })
      .finally(() => setLoading(false));
  }, [canViewCalls]);

  const topTopics = useMemo(() => topics.slice(0, 10), [topics]);

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Главная</h2>
      <p className="text-gray-600">
        Добро пожаловать, {user?.displayName || user?.login || user?.email}. Выберите раздел в меню.
      </p>

      {canViewCalls && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Сработавшие тематики</h3>
          {loading ? (
            <p className="text-gray-500">Загрузка...</p>
          ) : topTopics.length === 0 ? (
            <p className="text-gray-500">Пока нет срабатываний тематик.</p>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Тематика</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Срабатывания</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Звонки</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {topTopics.map((topic) => (
                    <tr key={topic.topicId}>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        <Link to={`/calls?topics=${topic.topicId}`} className="text-accent hover:underline">
                          {topic.topicName}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700">{topic.occurrences}</td>
                      <td className="px-4 py-2 text-sm text-gray-700">{topic.callsCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
