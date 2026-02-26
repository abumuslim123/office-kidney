import { PROCESSING_STATUSES, PROCESSING_STATUS_COLORS } from '../../lib/resume-constants';

interface Props {
  status: string;
}

export default function ResumeProcessingStatus({ status }: Props) {
  const label = PROCESSING_STATUSES[status] ?? status;
  const colorClass = PROCESSING_STATUS_COLORS[status] ?? '';
  const isProcessing = status === 'PENDING' || status === 'EXTRACTING' || status === 'PARSING';
  const isCompleted = status === 'COMPLETED';
  const isFailed = status === 'FAILED';

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass}`}>
      {isProcessing && (
        <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {isCompleted && (
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )}
      {isFailed && (
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )}
      {label}
    </span>
  );
}
