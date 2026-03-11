import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/api';
import type { ResumeCandidate } from '../lib/resume-types';
import { ResumeProcessingStatus } from '../lib/resume-types';
import ResumeDropzone from '../components/resume/ResumeDropzone';
import ResumeTextPasteArea from '../components/resume/ResumeTextPasteArea';
import ResumeUrlInput from '../components/resume/ResumeUrlInput';
import ResumeFileList from '../components/resume/ResumeFileList';
import ResumeUploadQueue from '../components/resume/ResumeUploadQueue';
import { useUploadQueue } from '../hooks/useUploadQueue';

export default function ResumeUploadPage() {
  const [recent, setRecent] = useState<ResumeCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = useRef(0);

  const loadRecent = useCallback(async () => {
    try {
      const res = await api.get<{ data: ResumeCandidate[]; total: number }>('/resume/candidates', {
        params: { limit: 10, sortBy: 'createdAt', sortOrder: 'DESC' },
      });
      setRecent(res.data.data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  const queue = useUploadQueue(loadRecent);

  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  // Poll for processing status updates
  useEffect(() => {
    const hasPending = recent.some((c) =>
      [ResumeProcessingStatus.PENDING, ResumeProcessingStatus.EXTRACTING, ResumeProcessingStatus.PARSING].includes(c.processingStatus),
    );
    if (hasPending && !pollRef.current) {
      pollCountRef.current = 0;
      pollRef.current = setInterval(() => {
        pollCountRef.current++;
        if (pollCountRef.current > 40) {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          return;
        }
        loadRecent();
      }, 3000);
    }
    if (!hasPending && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [recent, loadRecent]);

  const handleRetry = async (id: string) => {
    try {
      await api.post(`/resume/candidates/${id}/reprocess`);
      loadRecent();
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">Загрузка резюме</h2>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Загрузить файлы</h3>
            <ResumeDropzone onFilesSelected={queue.addFiles} />
            {queue.hasItems && (
              <div className="mt-3">
                <ResumeUploadQueue
                  items={queue.items}
                  uploadedCount={queue.uploadedCount}
                  totalCount={queue.totalCount}
                  onRetry={queue.retryItem}
                  onRemove={queue.removeItem}
                  onClearCompleted={queue.clearCompleted}
                />
              </div>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Вставить текст</h3>
            <ResumeTextPasteArea onCreated={loadRecent} />
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Загрузить по ссылке</h3>
            <ResumeUrlInput onCreated={loadRecent} />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Недавние загрузки</h3>
          {loading ? (
            <p className="text-sm text-gray-400 py-4 text-center">Загрузка...</p>
          ) : (
            <ResumeFileList candidates={recent} onRetry={handleRetry} />
          )}
        </div>
      </div>
    </div>
  );
}
