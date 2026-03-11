import { useState, useCallback, useRef, useEffect } from 'react';
import { api } from '../lib/api';
import { ACCEPTED_FILE_TYPES, MAX_FILE_SIZE } from '../lib/resume-constants';

export interface UploadQueueItem {
  id: string;
  file: File;
  status: 'queued' | 'uploading' | 'uploaded' | 'error';
  progress: number;
  error?: string;
}

const MAX_CONCURRENT = 3;
const MAX_FILES = 20;

function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) {
    return 'Файл слишком большой (макс. 10 МБ)';
  }
  const mimeOk = Object.keys(ACCEPTED_FILE_TYPES).includes(file.type);
  const extOk = Object.values(ACCEPTED_FILE_TYPES)
    .flat()
    .some((ext) => file.name.toLowerCase().endsWith(ext));
  if (!mimeOk && !extOk) {
    return 'Неподдерживаемый формат';
  }
  return null;
}

export function useUploadQueue(onUploaded: () => void) {
  const [items, setItems] = useState<UploadQueueItem[]>([]);
  const activeUploads = useRef(0);
  const abortControllers = useRef<Map<string, AbortController>>(new Map());

  const updateItem = useCallback((id: string, patch: Partial<UploadQueueItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const startUpload = useCallback(
    async (item: UploadQueueItem) => {
      activeUploads.current++;
      updateItem(item.id, { status: 'uploading', progress: 0 });

      const controller = new AbortController();
      abortControllers.current.set(item.id, controller);

      const form = new FormData();
      form.append('file', item.file);

      try {
        await api.post('/resume/upload', form, {
          signal: controller.signal,
          onUploadProgress: (e) => {
            const pct = Math.round((e.loaded * 100) / (e.total ?? e.loaded));
            updateItem(item.id, { progress: pct });
          },
        });
        updateItem(item.id, { status: 'uploaded', progress: 100 });
        onUploaded();
      } catch (err: unknown) {
        if (controller.signal.aborted) return;
        const data =
          err && typeof err === 'object' && 'response' in err
            ? (err as { response?: { data?: { message?: string } } }).response?.data
            : null;
        updateItem(item.id, { status: 'error', error: data?.message || 'Ошибка загрузки' });
      } finally {
        activeUploads.current--;
        abortControllers.current.delete(item.id);
      }
    },
    [onUploaded, updateItem],
  );

  // Запускаем загрузку файлов из очереди
  useEffect(() => {
    if (activeUploads.current >= MAX_CONCURRENT) return;
    const queued = items.filter((i) => i.status === 'queued');
    const toStart = queued.slice(0, MAX_CONCURRENT - activeUploads.current);
    for (const item of toStart) {
      startUpload(item);
    }
  }, [items, startUpload]);

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      abortControllers.current.forEach((c) => c.abort());
    };
  }, []);

  const addFiles = useCallback((files: File[]) => {
    setItems((prev) => {
      const currentActive = prev.filter((i) => i.status !== 'uploaded' && i.status !== 'error').length;
      const allowed = Math.min(files.length, MAX_FILES - currentActive);
      const newItems: UploadQueueItem[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const id = crypto.randomUUID();
        const validationError = i < allowed ? validateFile(file) : 'Превышен лимит (макс. 20 файлов)';

        if (validationError) {
          newItems.push({ id, file, status: 'error', progress: 0, error: validationError });
        } else {
          newItems.push({ id, file, status: 'queued', progress: 0 });
        }
      }

      return [...prev, ...newItems];
    });
  }, []);

  const retryItem = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status: 'queued' as const, progress: 0, error: undefined } : item,
      ),
    );
  }, []);

  const removeItem = useCallback((id: string) => {
    const controller = abortControllers.current.get(id);
    if (controller) controller.abort();
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearCompleted = useCallback(() => {
    setItems((prev) => prev.filter((item) => item.status !== 'uploaded'));
  }, []);

  const hasItems = items.length > 0;
  const uploadedCount = items.filter((i) => i.status === 'uploaded').length;
  const totalCount = items.length;
  const hasErrors = items.some((i) => i.status === 'error');
  const isUploading = items.some((i) => i.status === 'uploading' || i.status === 'queued');

  return {
    items,
    addFiles,
    retryItem,
    removeItem,
    clearCompleted,
    hasItems,
    uploadedCount,
    totalCount,
    hasErrors,
    isUploading,
  };
}
