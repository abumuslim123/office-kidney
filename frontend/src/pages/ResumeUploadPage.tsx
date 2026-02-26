import { useState } from 'react';
import ResumeDropzone from '../components/resume/ResumeDropzone';
import ResumeTextPasteArea from '../components/resume/ResumeTextPasteArea';
import ResumeFileList from '../components/resume/ResumeFileList';
import type { UploadedItem } from '../lib/resume-types';

export default function ResumeUploadPage() {
  const [uploads, setUploads] = useState<UploadedItem[]>([]);

  const addUpload = (item: UploadedItem) => {
    setUploads((prev) => [item, ...prev]);
  };

  const updateUpload = (id: string, updates: Partial<UploadedItem>) => {
    setUploads((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Загрузка резюме</h1>
        <p className="text-sm text-gray-500 mt-1">
          Загрузите файлы (PDF, DOCX) или вставьте текст резюме
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <ResumeDropzone onUpload={addUpload} onUpdate={updateUpload} />
        <ResumeTextPasteArea onUpload={addUpload} onUpdate={updateUpload} />
      </div>

      {uploads.length > 0 && <ResumeFileList items={uploads} />}
    </div>
  );
}
