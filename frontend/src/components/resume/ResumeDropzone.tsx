import { useState, useRef, useCallback } from 'react';
import { api } from '../../lib/api';
import { ACCEPTED_FILE_TYPES, MAX_FILE_SIZE } from '../../lib/resume-constants';

type Props = {
  onUploaded: () => void;
};

const acceptStr = Object.entries(ACCEPTED_FILE_TYPES)
  .flatMap(([mime, exts]) => [mime, ...exts])
  .join(',');

export default function ResumeDropzone({ onUploaded }: Props) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(
    async (file: File) => {
      setError('');
      if (file.size > MAX_FILE_SIZE) {
        setError('Файл слишком большой (макс. 10 МБ)');
        return;
      }
      const mimeOk = Object.keys(ACCEPTED_FILE_TYPES).includes(file.type);
      const extOk = Object.values(ACCEPTED_FILE_TYPES)
        .flat()
        .some((ext) => file.name.toLowerCase().endsWith(ext));
      if (!mimeOk && !extOk) {
        setError('Неподдерживаемый формат файла. Допустимы: PDF, DOCX, TXT, JPG, PNG, Pages');
        return;
      }
      setUploading(true);
      try {
        const form = new FormData();
        form.append('file', file);
        await api.post('/resume/upload', form);
        onUploaded();
      } catch (err: unknown) {
        const data =
          err && typeof err === 'object' && 'response' in err
            ? (err as { response?: { data?: { message?: string } } }).response?.data
            : null;
        setError(data?.message || 'Ошибка загрузки файла');
      } finally {
        setUploading(false);
      }
    },
    [onUploaded],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) upload(file);
    },
    [upload],
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) upload(file);
    e.target.value = '';
  };

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          dragging
            ? 'border-accent bg-accent/5'
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={acceptStr}
          onChange={handleChange}
          className="hidden"
        />
        {uploading ? (
          <p className="text-sm text-gray-500">Загрузка...</p>
        ) : (
          <>
            <p className="text-sm text-gray-600 font-medium">
              Перетащите файл резюме или нажмите для выбора
            </p>
            <p className="text-xs text-gray-400 mt-1">PDF, DOCX, TXT, JPG, PNG, Pages — до 10 МБ</p>
          </>
        )}
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
