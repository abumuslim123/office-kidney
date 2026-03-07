import { useState } from 'react';

export default function CallsRecording() {
  const [recordIncoming, setRecordIncoming] = useState(true);
  const [recordOutgoing, setRecordOutgoing] = useState(false);

  // Заглушка: данные хранилища
  const storageUsed = 2.4; // GB
  const storageTotal = 10; // GB
  const storagePercent = Math.round((storageUsed / storageTotal) * 100);

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Режим записи</h3>

      {/* Хранилище */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-5">
        <p className="text-sm font-medium text-gray-700 mb-2">Хранилище аудиозаписей</p>
        <div className="flex items-center gap-3 mb-2">
          <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all"
              style={{ width: `${storagePercent}%` }}
            />
          </div>
          <span className="text-sm font-medium text-gray-700 tabular-nums">
            {storageUsed} / {storageTotal} ГБ
          </span>
        </div>
        <p className="text-xs text-gray-500">
          Использовано {storagePercent}% хранилища. При заполнении старые записи будут удаляться автоматически.
        </p>
      </div>

      {/* Настройки записи */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
        <p className="text-sm font-medium text-gray-700">Настройки записи звонков</p>

        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <span className="text-sm text-gray-700">Запись входящих звонков</span>
            <p className="text-xs text-gray-400">Автоматическая запись всех входящих звонков</p>
          </div>
          <div
            className={`relative w-11 h-6 rounded-full transition-colors ${recordIncoming ? 'bg-accent' : 'bg-gray-300'}`}
            onClick={() => setRecordIncoming(!recordIncoming)}
          >
            <div
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${recordIncoming ? 'translate-x-5' : ''}`}
            />
          </div>
        </label>

        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <span className="text-sm text-gray-700">Запись исходящих звонков</span>
            <p className="text-xs text-gray-400">Автоматическая запись всех исходящих звонков</p>
          </div>
          <div
            className={`relative w-11 h-6 rounded-full transition-colors ${recordOutgoing ? 'bg-accent' : 'bg-gray-300'}`}
            onClick={() => setRecordOutgoing(!recordOutgoing)}
          >
            <div
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${recordOutgoing ? 'translate-x-5' : ''}`}
            />
          </div>
        </label>

        <p className="text-xs text-gray-400 pt-2 border-t border-gray-100">
          Настройки записи применяются к телефонной системе. Изменения вступят в силу после перезагрузки модуля.
        </p>
      </div>
    </div>
  );
}
