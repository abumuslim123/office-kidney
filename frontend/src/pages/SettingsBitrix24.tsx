import { useEffect, useState } from 'react';
import { api } from '../lib/api';

type Settings = { webhookConfigured: boolean; webhookUrlMask?: string };

export default function SettingsBitrix24() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadSettings = async () => {
    try {
      const r = await api.get<Settings>('/bitrix24/settings');
      setSettings(r.data);
    } catch {
      setSettings({ webhookConfigured: false });
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    const url = webhookUrl.trim();
    if (!url) {
      setError('Введите URL вебхука');
      setSaving(false);
      return;
    }
    try {
      await api.put('/bitrix24/settings', { webhookUrl: url });
      setWebhookUrl('');
      setSuccess('Вебхук сохранён.');
      await loadSettings();
    } catch (err: unknown) {
      const data = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data
        : null;
      setError(data?.message || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 max-w-2xl">
      <h3 className="text-lg font-medium text-gray-900 mb-3">Настройка Bitrix24</h3>
      {settings && (
        <>
          {settings.webhookConfigured && settings.webhookUrlMask && (
            <p className="text-sm text-gray-600 mb-2">
              Вебхук настроен: {settings.webhookUrlMask}
            </p>
          )}
          {!settings.webhookConfigured && (
            <p className="text-sm text-gray-600 mb-2">Вебхук не настроен.</p>
          )}
          <form onSubmit={handleSave} className="flex flex-wrap items-end gap-3">
            <div className="min-w-[280px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL входящего вебхука
              </label>
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://портал.bitrix24.ru/rest/1/xxx/"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-accent text-white rounded text-sm font-medium disabled:opacity-50"
            >
              {saving ? 'Сохранение…' : 'Сохранить'}
            </button>
          </form>
          {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
          {success && <p className="text-sm text-green-600 mt-2">{success}</p>}
        </>
      )}
    </div>
  );
}
