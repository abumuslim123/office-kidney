import type { ResumeCandidate } from '../../lib/resume-types';
import { ResumeProcessingStatus } from '../../lib/resume-types';
import ResumeProcessingStatusBadge from './ResumeProcessingStatus';
import { formatDateTime } from '../../lib/resume-constants';

type Props = {
  candidates: ResumeCandidate[];
  onRetry?: (id: string) => void;
};

export default function ResumeFileList({ candidates, onRetry }: Props) {
  if (candidates.length === 0) {
    return (
      <p className="text-sm text-gray-400 py-4 text-center">
        Нет недавних загрузок
      </p>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {candidates.map((c) => (
        <div key={c.id} className="flex items-center justify-between py-3 gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {c.fullName || c.uploadedFile?.originalName || 'Без имени'}
            </p>
            <p className="text-xs text-gray-400">{formatDateTime(c.createdAt)}</p>
            {c.processingError && (
              <p className="text-xs text-red-500 mt-0.5 truncate" title={c.processingError}>
                {c.processingError}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <ResumeProcessingStatusBadge status={c.processingStatus} />
            {c.processingStatus === ResumeProcessingStatus.FAILED && onRetry && (
              <button
                type="button"
                onClick={() => onRetry(c.id)}
                className="text-xs text-accent hover:underline"
              >
                Повторить
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
