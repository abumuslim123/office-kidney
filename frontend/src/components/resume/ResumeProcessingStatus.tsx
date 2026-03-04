import type { ResumeProcessingStatus } from '../../lib/resume-types';
import { PROCESSING_STATUSES, PROCESSING_STATUS_COLORS } from '../../lib/resume-constants';

type Props = {
  status: ResumeProcessingStatus;
};

export default function ResumeProcessingStatusBadge({ status }: Props) {
  const label = PROCESSING_STATUSES[status] || status;
  const color = PROCESSING_STATUS_COLORS[status] || 'bg-gray-100 text-gray-800';

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}
    >
      {(status === 'EXTRACTING' || status === 'PARSING' || status === 'PENDING') && (
        <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 animate-pulse" />
      )}
      {label}
    </span>
  );
}
