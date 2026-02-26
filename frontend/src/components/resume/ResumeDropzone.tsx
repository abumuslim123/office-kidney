import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import type { UploadedItem } from '../../lib/resume-types';

const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff', '.tif'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

interface Props {
  onUpload: (item: UploadedItem) => void;
  onUpdate: (id: string, updates: Partial<UploadedItem>) => void;
}

export default function ResumeDropzone({ onUpload, onUpdate }: Props) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRefs = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  useEffect(() => {
    return () => {
      for (const interval of pollingRefs.current.values()) clearInterval(interval);
    };
  }, []);

  const startPolling = useCallback((uploadId: string, candidateId: string) => {
    let pollCount = 0;
    const MAX_POLLS = 40;

    const interval = setInterval(async () => {
      pollCount++;
      if (pollCount > MAX_POLLS) {
        clearInterval(interval);
        pollingRefs.current.delete(uploadId);
        onUpdate(uploadId, { processingStatus: 'FAILED', error: 'Превышено время ожидания обработки' });
        return;
      }
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

  const uploadFile = useCallback(async (file: File) => {
    const uploadId = crypto.randomUUID();
    onUpload({ id: uploadId, name: file.name, size: file.size, type: 'file', processingStatus: 'PENDING' });

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/resume/upload', formData, { timeout: 120000 });
      const data = res.data as { id: string; candidateId?: string };
      const candidateId = data.candidateId || data.id;
      onUpdate(uploadId, { processingStatus: 'EXTRACTING', candidateId });
      startPolling(uploadId, candidateId);
    } catch {
      onUpdate(uploadId, { processingStatus: 'FAILED', error: 'Не удалось загрузить файл' });
    }
  }, [onUpload, onUpdate, startPolling]);

  const validateAndUpload = useCallback((files: FileList | File[]) => {
    Array.from(files).forEach((file) => {
      const ext = `.${file.name.split('.').pop()?.toLowerCase()}`;
      if (!ACCEPTED_EXTENSIONS.includes(ext)) {
        const id = crypto.randomUUID();
        onUpload({ id, name: file.name, size: file.size, type: 'file', processingStatus: 'FAILED', error: 'Неподдерживаемый формат файла' });
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        const id = crypto.randomUUID();
        onUpload({ id, name: file.name, size: file.size, type: 'file', processingStatus: 'FAILED', error: 'Файл превышает 10 МБ' });
        return;
      }
      uploadFile(file);
    });
  }, [onUpload, uploadFile]);

  return (
    <div
      onClick={() => fileInputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
      onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(false); }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        if (e.dataTransfer.files.length > 0) validateAndUpload(e.dataTransfer.files);
      }}
      className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
        isDragOver ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-indigo-400'
      }`}
    >
      <svg className="mb-3 h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
      </svg>
      <p className="text-sm font-medium text-gray-700">Перетащите файлы сюда</p>
      <p className="mt-1 text-xs text-gray-500">PDF, DOCX, JPG, PNG, WEBP — до 10 МБ</p>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPTED_EXTENSIONS.join(',')}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            validateAndUpload(e.target.files);
            e.target.value = '';
          }
        }}
        className="hidden"
      />
    </div>
  );
}
