import { Link } from 'react-router-dom';
import ResumeProcessingStatus from './ResumeProcessingStatus';
import type { UploadedItem } from '../../lib/resume-types';

function formatFileSize(bytes?: number): string {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

interface Props {
  items: UploadedItem[];
}

export default function ResumeFileList({ items }: Props) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="px-5 py-3 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900">Загруженные файлы</h3>
      </div>
      <div className="p-4 space-y-3">
        {items.map((item) => {
          const inner = (
            <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3 hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3 overflow-hidden">
                <svg className="h-5 w-5 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">{item.name}</p>
                  {item.size != null && (
                    <p className="text-xs text-gray-500">{formatFileSize(item.size)}</p>
                  )}
                  {item.error && (
                    <p className="text-xs text-red-600">{item.error}</p>
                  )}
                </div>
              </div>
              <ResumeProcessingStatus status={item.processingStatus} />
            </div>
          );

          if (item.processingStatus === 'COMPLETED' && item.candidateId) {
            return (
              <Link key={item.id} to={`/hr/resume/candidates/${item.candidateId}`}>
                {inner}
              </Link>
            );
          }
          return <div key={item.id}>{inner}</div>;
        })}
      </div>
    </div>
  );
}
