import { useEffect, useState } from 'react';
import { api } from '../lib/api';

type BackupStatus = {
  hasBackupToday: boolean;
  lastBackup: string | null;
  lastBackupSize: number | null;
  backupCount: number;
};

export default function SettingsBackup() {
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get<BackupStatus>('/health/backup-status');
        setBackupStatus(res.data);
      } catch {
        // endpoint may not be available in dev
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return <p className="text-gray-500">Загрузка...</p>;
  }

  if (!backupStatus) {
    return <p className="text-gray-500">Статус бэкапа недоступен.</p>;
  }

  return (
    <section className="bg-white border border-gray-200 rounded-lg p-4 max-w-2xl">
      <h3 className="text-sm font-medium text-gray-700 mb-3">Бэкап базы данных</h3>
      <div className="flex items-center gap-3">
        <span
          className={`inline-block w-3 h-3 rounded-full ${
            backupStatus.hasBackupToday
              ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]'
              : 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]'
          }`}
        />
        <span className="text-sm text-gray-700">
          {backupStatus.hasBackupToday ? 'Бэкап за сегодня есть' : 'Бэкап за сегодня отсутствует'}
        </span>
      </div>
      {backupStatus.lastBackup && (
        <div className="mt-2 text-xs text-gray-500 space-y-0.5">
          <p>
            Последний бэкап:{' '}
            {new Date(backupStatus.lastBackup).toLocaleString('ru-RU', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
          {backupStatus.lastBackupSize !== null && (
            <p>Размер: {(backupStatus.lastBackupSize / 1024 / 1024).toFixed(2)} МБ</p>
          )}
          <p>Всего бэкапов: {backupStatus.backupCount}</p>
        </div>
      )}
    </section>
  );
}
