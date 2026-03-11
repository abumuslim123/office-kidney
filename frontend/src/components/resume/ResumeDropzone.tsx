import { useState, useRef, useCallback } from 'react';
import { ACCEPTED_FILE_TYPES } from '../../lib/resume-constants';

type Props = {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
};

const acceptStr = Object.entries(ACCEPTED_FILE_TYPES)
  .flatMap(([mime, exts]) => [mime, ...exts])
  .join(',');

export default function ResumeDropzone({ onFilesSelected, disabled }: Props) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (fileList: FileList) => {
      const files = Array.from(fileList);
      if (files.length > 0) onFilesSelected(files);
    },
    [onFilesSelected],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (!disabled) handleFiles(e.dataTransfer.files);
    },
    [disabled, handleFiles],
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files);
    e.target.value = '';
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
        disabled
          ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
          : dragging
            ? 'border-accent bg-accent/5 cursor-pointer'
            : 'border-gray-300 hover:border-gray-400 cursor-pointer'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={acceptStr}
        multiple
        onChange={handleChange}
        className="hidden"
        disabled={disabled}
      />
      <p className="text-sm text-gray-600 font-medium">
        Перетащите файлы резюме или нажмите для выбора
      </p>
      <p className="text-xs text-gray-400 mt-1">PDF, DOCX, TXT, JPG, PNG, Pages — до 10 МБ, до 20 файлов</p>
    </div>
  );
}
