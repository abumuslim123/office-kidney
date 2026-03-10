import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

type PolzaSettings = {
  apiKeyConfigured: boolean;
  apiKeyMask?: string;
  baseUrl?: string;
  model?: string;
  availableModels: string[];
};

const DEFAULT_BASE_URL = 'https://api.polza.ai';

export default function SettingsProcesses() {
  const { user } = useAuth();
  const [polzaSettings, setPolzaSettings] = useState<PolzaSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL);
  const [model, setModel] = useState('');
  const [clearKey, setClearKey] = useState(false);

  const userPermissions = user?.permissions?.map((p) => p.slug) || [];
  const canEditProcesses = userPermissions.includes('processes_edit');

  const load = async () => {
    if (!canEditProcesses) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.get<PolzaSettings>('/processes/settings');
      setPolzaSettings(res.data);
      setBaseUrl(res.data.baseUrl || DEFAULT_BASE_URL);
      setModel(res.data.model || res.data.availableModels?.[0] || 'gpt-4o-mini');
      setApiKey('');
      setClearKey(false);
    } catch {
      setError('Не удалось загрузить настройки');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [canEditProcesses]);

  const savePolza = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditProcesses) return;
    setSaving(true);
    setError('');
    try {
      const payload: { apiKey?: string; baseUrl?: string; model?: string } = {
        baseUrl: baseUrl.trim() || undefined,
        model: model.trim() || undefined,
      };
      if (clearKey) {
        payload.apiKey = '';
      } else if (apiKey.trim()) {
        payload.apiKey = apiKey.trim();
      }
      const res = await api.put<Omit<PolzaSettings, 'availableModels'>>('/processes/settings', payload);
      setPolzaSettings((prev) => (prev ? { ...prev, ...res.data } : null));
      setApiKey('');
      setClearKey(false);
    } catch (err: unknown) {
      const data =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data
          : null;
      setError((data?.message as string) || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  if (!canEditProcesses) {
    return <p className="text-gray-500">Доступ к настройкам ограничен.</p>;
  }

  return (
    <div>
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Загрузка...</p>
      ) : (
        <section className="bg-white border border-gray-200 rounded-lg p-4 max-w-2xl">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Чек-листы процессов (Polza.ai)</h3>
          <p className="text-xs text-gray-500 mb-4">
            API ключ и модель для генерации чек-листов по тексту процесса. Используется при нажатии «Чек листы» в карточке процесса.
          </p>
          <form onSubmit={savePolza} className="space-y-4">
            <div>
              <label className="text-xs text-gray-600 block mb-1">API ключ Polza.ai</label>
              {polzaSettings?.apiKeyConfigured && !apiKey && !clearKey ? (
                <p className="text-sm text-gray-600">
                  Настроен ({polzaSettings.apiKeyMask || '***'}). Введите новый ключ для замены или отметьте «Очистить ключ».
                </p>
              ) : null}
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                placeholder="Вставьте API ключ"
                disabled={!!polzaSettings?.apiKeyConfigured && !clearKey && !apiKey}
              />
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-1">Base URL</label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                placeholder={DEFAULT_BASE_URL}
              />
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-1">Модель</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
              >
                {(polzaSettings?.availableModels || [
                  'gpt-4o-mini', 'gpt-4o', 'gpt-4o-nano', 'gpt-3.5-turbo',
                  'gpt-4-turbo', 'gpt-4', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano',
                  'gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'openai/gpt-5.1', 'gpt-5.1',
                  'o1', 'o1-mini', 'o3', 'o4-mini',
                ]).map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <input
                id="clear-polza-key"
                type="checkbox"
                checked={clearKey}
                onChange={(e) => setClearKey(e.target.checked)}
              />
              <label htmlFor="clear-polza-key">Очистить ключ при сохранении</label>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-1.5 bg-accent text-white rounded text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
              <button
                type="button"
                onClick={load}
                className="px-4 py-1.5 border border-gray-300 rounded text-sm hover:bg-gray-50"
              >
                Обновить
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
