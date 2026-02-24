import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

type CallsSettings = {
  apiKeyConfigured: boolean;
  apiKeyMask?: string;
  apiBase?: string;
  audioPath?: string;
  model?: string;
};

const DEFAULT_API_BASE = 'https://api.aitunnel.ru/v1';
const DEFAULT_AUDIO_PATH = '/audio/transcriptions';
const DEFAULT_MODELS = ['whisper-1', 'gpt-4o-transcribe-diarize'];

export default function CallsSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<CallsSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiBase, setApiBase] = useState('');
  const [audioPath, setAudioPath] = useState('');
  const [model, setModel] = useState('');
  const [clearKey, setClearKey] = useState(false);
  const userPermissions = user?.permissions?.map((p) => p.slug) || [];
  const canManageApiKey = userPermissions.includes('calls_api_key');
  const modelOptions = Array.from(new Set([...DEFAULT_MODELS, model].filter(Boolean)));

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<CallsSettings>('/calls/settings');
      setSettings(res.data);
      setApiBase(res.data.apiBase || DEFAULT_API_BASE);
      setAudioPath(res.data.audioPath || DEFAULT_AUDIO_PATH);
      setModel(res.data.model || DEFAULT_MODELS[0]);
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
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload: {
        apiKey?: string;
        apiBase?: string;
        audioPath?: string;
        model?: string;
      } = {
        apiBase,
        audioPath,
        model,
      };

      if (canManageApiKey && clearKey) {
        payload.apiKey = '';
      } else if (canManageApiKey && apiKey.trim()) {
        payload.apiKey = apiKey.trim();
      }

      const res = await api.put<CallsSettings>('/calls/settings', payload);
      setSettings(res.data);
      setApiKey('');
      setClearKey(false);
    } catch (err: unknown) {
      const data = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data
        : null;
      setError((data?.message as string) || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Настройки звонков</h2>
        <Link to="/calls" className="text-sm text-accent hover:underline">
          Назад к звонкам
        </Link>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Загрузка...</p>
      ) : (
        <form onSubmit={save} className="bg-white border border-gray-200 rounded-lg p-4 max-w-2xl">
          <div className="text-sm text-gray-600 mb-4">
            {canManageApiKey
              ? settings?.apiKeyConfigured
                ? `Ключ AITunnel настроен (${settings.apiKeyMask || '***'})`
                : 'Ключ AITunnel не настроен'
              : 'Доступ к API ключу ограничен'}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {canManageApiKey && (
              <label className="text-xs text-gray-600">
                API ключ (AITunnel)
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-sm"
                  placeholder="Вставьте новый ключ"
                />
              </label>
            )}
            {!canManageApiKey && (
              <div className="text-xs text-gray-500 border border-gray-200 rounded px-3 py-2 bg-gray-50">
                Для управления API ключом нужен доступ `calls_api_key`.
              </div>
            )}
            <label className="text-xs text-gray-600">
              API base URL (AITunnel)
              <input
                type="text"
                value={apiBase}
                readOnly
                className="mt-1 w-full border border-gray-200 bg-gray-50 rounded px-2 py-1 text-sm"
                placeholder="https://api.aitunnel.ru/v1"
              />
            </label>
            <label className="text-xs text-gray-600">
              Audio path
              <input
                type="text"
                value={audioPath}
                readOnly
                className="mt-1 w-full border border-gray-200 bg-gray-50 rounded px-2 py-1 text-sm"
                placeholder="/audio/transcriptions"
              />
            </label>
            <label className="text-xs text-gray-600">
              Модель транскрибации
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-sm"
              >
                {modelOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {canManageApiKey && (
            <div className="mt-3 flex items-center gap-2 text-xs text-gray-600">
              <input
                id="clear-api-key"
                type="checkbox"
                checked={clearKey}
                onChange={(e) => setClearKey(e.target.checked)}
              />
              <label htmlFor="clear-api-key">Очистить ключ при сохранении</label>
            </div>
          )}

          <div className="mt-4 flex gap-2">
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
      )}
    </div>
  );
}
