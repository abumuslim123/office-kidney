import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import type { UploadedItem } from '../../lib/resume-types';

interface Props {
  onUpload: (item: UploadedItem) => void;
  onUpdate: (id: string, updates: Partial<UploadedItem>) => void;
}

export default function ResumeTextPasteArea({ onUpload, onUpdate }: Props) {
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const pollingRefs = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  useEffect(() => {
    return () => {
      for (const interval of pollingRefs.current.values()) clearInterval(interval);
    };
  }, []);

  const startPolling = useCallback((uploadId: string, candidateId: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/resume/candidates/${candidateId}`);
        const data = res.data as { processingStatus: UploadedItem['processingStatus']; processingError?: string };
        onUpdate(uploadId, { processingStatus: data.processingStatus, candidateId, error: data.processingError });
        if (data.processingStatus === 'COMPLETED' || data.processingStatus === 'FAILED') {
          clearInterval(interval);
          pollingRefs.current.delete(uploadId);
        }
      } catch { /* retry */ }
    }, 3000);
    pollingRefs.current.set(uploadId, interval);
  }, [onUpdate]);

  const handleSubmit = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setIsSubmitting(true);

    const uploadId = crypto.randomUUID();
    onUpload({
      id: uploadId,
      name: `Текст (${trimmed.slice(0, 30)}${trimmed.length > 30 ? '...' : ''})`,
      type: 'text',
      processingStatus: 'PENDING',
    });

    try {
      const res = await api.post('/resume/candidates', { rawText: trimmed });
      const data = res.data as { id: string; candidateId?: string };
      const candidateId = data.candidateId || data.id;
      onUpdate(uploadId, { processingStatus: 'EXTRACTING', candidateId });
      setText('');
      startPolling(uploadId, candidateId);
    } catch {
      onUpdate(uploadId, { processingStatus: 'FAILED', error: 'Не удалось отправить текст' });
    } finally {
      setIsSubmitting(false);
    }
  }, [text, onUpload, onUpdate, startPolling]);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Вставить текст</h3>
      <textarea
        placeholder="Вставьте текст резюме..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
      />
      <button
        onClick={handleSubmit}
        disabled={!text.trim() || isSubmitting}
        className="mt-3 px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isSubmitting ? 'Отправка...' : 'Обработать'}
      </button>
    </div>
  );
}
