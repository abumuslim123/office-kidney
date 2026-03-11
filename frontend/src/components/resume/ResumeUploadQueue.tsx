import type { UploadQueueItem } from '../../hooks/useUploadQueue';

type Props = {
  items: UploadQueueItem[];
  uploadedCount: number;
  totalCount: number;
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
  onClearCompleted: () => void;
};

const statusConfig = {
  queued: { label: 'В очереди', color: 'bg-gray-100 text-gray-600', barColor: 'bg-gray-300' },
  uploading: { label: 'Загрузка', color: 'bg-blue-100 text-blue-700', barColor: 'bg-accent' },
  uploaded: { label: 'Загружен', color: 'bg-green-100 text-green-700', barColor: 'bg-green-500' },
  error: { label: 'Ошибка', color: 'bg-red-100 text-red-700', barColor: 'bg-red-500' },
};

export default function ResumeUploadQueue({
  items,
  uploadedCount,
  totalCount,
  onRetry,
  onRemove,
  onClearCompleted,
}: Props) {
  const hasCompleted = items.some((i) => i.status === 'uploaded');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Загружено {uploadedCount} из {totalCount}
        </p>
        {hasCompleted && (
          <button
            onClick={onClearCompleted}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Очистить завершённые
          </button>
        )}
      </div>

      <div className="space-y-2 max-h-80 overflow-y-auto">
        {items.map((item) => {
          const cfg = statusConfig[item.status];
          return (
            <div
              key={item.id}
              className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm text-gray-800 truncate">{item.file.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${cfg.color}`}>
                    {cfg.label}
                  </span>
                </div>

                {(item.status === 'uploading' || item.status === 'queued') && (
                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${cfg.barColor} ${
                        item.status === 'uploading' ? 'animate-pulse' : ''
                      }`}
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                )}

                {item.status === 'error' && item.error && (
                  <p className="text-xs text-red-500 mt-0.5">{item.error}</p>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {item.status === 'error' && (
                  <button
                    onClick={() => onRetry(item.id)}
                    className="text-xs text-blue-600 hover:text-blue-800 px-1.5 py-0.5"
                    title="Повторить"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                )}
                <button
                  onClick={() => onRemove(item.id)}
                  className="text-xs text-gray-400 hover:text-gray-600 px-1.5 py-0.5"
                  title="Удалить"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
