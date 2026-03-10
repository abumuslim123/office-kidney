import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

type CallsSettingsData = {
  apiKeyConfigured: boolean;
  apiKeyMask?: string;
  apiBase?: string;
  audioPath?: string;
  model?: string;
  provider: string;
  speechkitConfigured: boolean;
  speechkitFolderIdMask?: string;
  tritechConfigured: boolean;
  tritechUsernameMask?: string;
};

const DEFAULT_API_BASE = 'https://api.aitunnel.ru/v1';
const DEFAULT_AUDIO_PATH = '/audio/transcriptions';
const DEFAULT_MODELS = ['whisper-1', 'gpt-4o-transcribe-diarize'];

export default function SettingsKCalls() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<CallsSettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // AITunnel / Polza.ai
  const [apiKey, setApiKey] = useState('');
  const [apiBase, setApiBase] = useState('');
  const [audioPath, setAudioPath] = useState('');
  const [model, setModel] = useState('');
  const [clearKey, setClearKey] = useState(false);

  // Провайдер
  const [provider, setProvider] = useState<'aitunnel' | 'yandex' | 'tritech'>('aitunnel');

  // Yandex SpeechKit
  const [speechkitApiKey, setSpeechkitApiKey] = useState('');
  const [speechkitFolderId, setSpeechkitFolderId] = useState('');
  const [clearSpeechkitKey, setClearSpeechkitKey] = useState(false);

  // 3iTech
  const [tritechClientId, setTritechClientId] = useState('');
  const [tritechClientSecret, setTritechClientSecret] = useState('');
  const [tritechUsername, setTritechUsername] = useState('');
  const [tritechPassword, setTritechPassword] = useState('');
  const [clearTritech, setClearTritech] = useState(false);

  const userPermissions = user?.permissions?.map((p) => p.slug) || [];
  const canManageApiKey = userPermissions.includes('calls_api_key');
  const modelOptions = Array.from(new Set([...DEFAULT_MODELS, model].filter(Boolean)));

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<CallsSettingsData>('/calls/settings');
      setSettings(res.data);
      setApiBase(res.data.apiBase || DEFAULT_API_BASE);
      setAudioPath(res.data.audioPath || DEFAULT_AUDIO_PATH);
      setModel(res.data.model || DEFAULT_MODELS[0]);
      setProvider((res.data.provider as 'aitunnel' | 'yandex' | 'tritech') || 'aitunnel');
      setApiKey('');
      setSpeechkitApiKey('');
      setSpeechkitFolderId('');
      setTritechClientId('');
      setTritechClientSecret('');
      setTritechUsername('');
      setTritechPassword('');
      setClearKey(false);
      setClearSpeechkitKey(false);
      setClearTritech(false);
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
      const payload: Record<string, string> = { apiBase, audioPath, model, provider };

      if (canManageApiKey) {
        if (clearKey) payload.apiKey = '';
        else if (apiKey.trim()) payload.apiKey = apiKey.trim();
      }

      if (canManageApiKey) {
        if (clearSpeechkitKey) {
          payload.speechkitApiKey = '';
          payload.speechkitFolderId = '';
        } else {
          if (speechkitApiKey.trim()) payload.speechkitApiKey = speechkitApiKey.trim();
          if (speechkitFolderId.trim()) payload.speechkitFolderId = speechkitFolderId.trim();
        }
      }

      if (canManageApiKey) {
        if (clearTritech) {
          payload.tritechClientId = '';
          payload.tritechClientSecret = '';
          payload.tritechUsername = '';
          payload.tritechPassword = '';
        } else {
          if (tritechClientId.trim()) payload.tritechClientId = tritechClientId.trim();
          if (tritechClientSecret.trim()) payload.tritechClientSecret = tritechClientSecret.trim();
          if (tritechUsername.trim()) payload.tritechUsername = tritechUsername.trim();
          if (tritechPassword.trim()) payload.tritechPassword = tritechPassword.trim();
        }
      }

      const res = await api.put<CallsSettingsData>('/calls/settings', payload);
      setSettings(res.data);
      setApiKey('');
      setSpeechkitApiKey('');
      setSpeechkitFolderId('');
      setTritechClientId('');
      setTritechClientSecret('');
      setTritechUsername('');
      setTritechPassword('');
      setClearKey(false);
      setClearSpeechkitKey(false);
      setClearTritech(false);
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
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Провайдер транскрипции</h3>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Загрузка...</p>
      ) : (
        <form onSubmit={save} className="max-w-2xl space-y-4">

          {/* Провайдер */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Провайдер транскрипции</p>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="provider"
                  value="aitunnel"
                  checked={provider === 'aitunnel'}
                  onChange={() => setProvider('aitunnel')}
                  className="accent-indigo-600"
                />
                <span className="text-sm text-gray-700">
                  Whisper / GPT-4o
                  <span className="ml-1 text-xs text-gray-400">(Polza.ai · AITunnel)</span>
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="provider"
                  value="yandex"
                  checked={provider === 'yandex'}
                  onChange={() => setProvider('yandex')}
                  className="accent-indigo-600"
                />
                <span className="text-sm text-gray-700">
                  Yandex SpeechKit
                  <span className="ml-1 text-xs text-gray-400">(русский язык)</span>
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="provider"
                  value="tritech"
                  checked={provider === 'tritech'}
                  onChange={() => setProvider('tritech')}
                  className="accent-indigo-600"
                />
                <span className="text-sm text-gray-700">
                  3iTech
                  <span className="ml-1 text-xs text-gray-400">(3i-vox.ru · диаризация)</span>
                </span>
              </label>
            </div>
          </div>

          {/* AITunnel / Polza.ai */}
          {provider === 'aitunnel' && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-700 mb-1">Polza.ai / AITunnel</p>
              <p className="text-xs text-gray-500 mb-3">
                {canManageApiKey
                  ? settings?.apiKeyConfigured
                    ? `Ключ настроен (${settings.apiKeyMask || '***'})`
                    : 'Ключ не настроен'
                  : 'Доступ к API ключу ограничен'}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {canManageApiKey ? (
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
                ) : (
                  <div className="text-xs text-gray-500 border border-gray-200 rounded px-3 py-2 bg-gray-50">
                    Для управления API ключом нужен доступ `calls_api_key`.
                  </div>
                )}
                <label className="text-xs text-gray-600">
                  Модель транскрибации
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-sm"
                  >
                    {modelOptions.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-gray-600">
                  API base URL
                  <input
                    type="text"
                    value={apiBase}
                    readOnly
                    className="mt-1 w-full border border-gray-200 bg-gray-50 rounded px-2 py-1 text-sm"
                  />
                </label>
                <label className="text-xs text-gray-600">
                  Audio path
                  <input
                    type="text"
                    value={audioPath}
                    readOnly
                    className="mt-1 w-full border border-gray-200 bg-gray-50 rounded px-2 py-1 text-sm"
                  />
                </label>
              </div>

              {canManageApiKey && (
                <div className="mt-3 flex items-center gap-2 text-xs text-gray-600">
                  <input
                    id="settings-clear-api-key"
                    type="checkbox"
                    checked={clearKey}
                    onChange={(e) => setClearKey(e.target.checked)}
                  />
                  <label htmlFor="settings-clear-api-key">Очистить ключ при сохранении</label>
                </div>
              )}
            </div>
          )}

          {/* Yandex SpeechKit */}
          {provider === 'yandex' && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-700 mb-1">Yandex SpeechKit</p>
              <p className="text-xs text-gray-500 mb-3">
                {settings?.speechkitConfigured
                  ? `Настроен (Folder: ${settings.speechkitFolderIdMask || '***'})`
                  : 'Не настроен — укажите API ключ и Folder ID'}
              </p>

              <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-3 text-xs text-blue-700">
                <strong>Как получить:</strong> Yandex Cloud Console → Сервисные аккаунты → создать аккаунт с ролью <code>ai.speechkit-stt.user</code> → создать API ключ. Folder ID — в настройках каталога.
              </div>

              {canManageApiKey ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="text-xs text-gray-600">
                    API ключ (статический)
                    <input
                      type="password"
                      value={speechkitApiKey}
                      onChange={(e) => setSpeechkitApiKey(e.target.value)}
                      className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-sm"
                      placeholder="Вставьте API ключ"
                    />
                  </label>
                  <label className="text-xs text-gray-600">
                    Folder ID
                    <input
                      type="text"
                      value={speechkitFolderId}
                      onChange={(e) => setSpeechkitFolderId(e.target.value)}
                      className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-sm"
                      placeholder="b1g..."
                    />
                  </label>
                </div>
              ) : (
                <div className="text-xs text-gray-500 border border-gray-200 rounded px-3 py-2 bg-gray-50">
                  Для управления ключами нужен доступ `calls_api_key`.
                </div>
              )}

              {canManageApiKey && (
                <div className="mt-3 flex items-center gap-2 text-xs text-gray-600">
                  <input
                    id="settings-clear-speechkit-key"
                    type="checkbox"
                    checked={clearSpeechkitKey}
                    onChange={(e) => setClearSpeechkitKey(e.target.checked)}
                  />
                  <label htmlFor="settings-clear-speechkit-key">Очистить ключи SpeechKit при сохранении</label>
                </div>
              )}

              <p className="mt-3 text-xs text-gray-400">
                Аудио → ffmpeg (нарезка по 24 сек, 16 кГц моно) → SpeechKit REST v1 → сборка текста → LLM-коррекция терминов
              </p>
            </div>
          )}

          {/* 3iTech */}
          {provider === 'tritech' && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-700 mb-1">3iTech (3i-vox.ru)</p>
              <p className="text-xs text-gray-500 mb-3">
                {settings?.tritechConfigured
                  ? `Настроен (${settings.tritechUsernameMask || '***'})`
                  : 'Не настроен — укажите Client ID, Client Secret, логин и пароль'}
              </p>

              <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-3 text-xs text-blue-700">
                Распознавание речи с автоматическим определением спикеров (оператор / абонент).
                Поддерживает стерео и моно записи, пунктуацию, диаризацию.
              </div>

              {canManageApiKey ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="text-xs text-gray-600">
                    Client ID
                    <input
                      type="text"
                      value={tritechClientId}
                      onChange={(e) => setTritechClientId(e.target.value)}
                      className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-sm"
                      placeholder="Вставьте Client ID"
                    />
                  </label>
                  <label className="text-xs text-gray-600">
                    Client Secret
                    <input
                      type="password"
                      value={tritechClientSecret}
                      onChange={(e) => setTritechClientSecret(e.target.value)}
                      className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-sm"
                      placeholder="Вставьте Client Secret"
                    />
                  </label>
                  <label className="text-xs text-gray-600">
                    Логин (username)
                    <input
                      type="text"
                      value={tritechUsername}
                      onChange={(e) => setTritechUsername(e.target.value)}
                      className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-sm"
                      placeholder="Логин 3i-vox.ru"
                    />
                  </label>
                  <label className="text-xs text-gray-600">
                    Пароль (password)
                    <input
                      type="password"
                      value={tritechPassword}
                      onChange={(e) => setTritechPassword(e.target.value)}
                      className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-sm"
                      placeholder="Пароль 3i-vox.ru"
                    />
                  </label>
                </div>
              ) : (
                <div className="text-xs text-gray-500 border border-gray-200 rounded px-3 py-2 bg-gray-50">
                  Для управления ключами нужен доступ `calls_api_key`.
                </div>
              )}

              {canManageApiKey && (
                <div className="mt-3 flex items-center gap-2 text-xs text-gray-600">
                  <input
                    id="settings-clear-tritech-key"
                    type="checkbox"
                    checked={clearTritech}
                    onChange={(e) => setClearTritech(e.target.checked)}
                  />
                  <label htmlFor="settings-clear-tritech-key">Очистить ключи 3iTech при сохранении</label>
                </div>
              )}

              <p className="mt-3 text-xs text-gray-400">
                Аудио → загрузка в 3i-vox.ru → распознавание с диаризацией → результат с разделением на оператора и абонента.
                Анализ эмоций включён автоматически.
              </p>

              <Link
                to="/settings/kcalls/speakers"
                className="mt-3 inline-flex items-center gap-1 text-sm text-accent hover:underline"
              >
                Модели дикторов (3iTech) →
              </Link>
            </div>
          )}

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
      )}
    </div>
  );
}
