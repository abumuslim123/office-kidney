import { useRef, useState } from 'react';
import { publicApi } from '../lib/api';

export default function ResumeApplyPublic() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    city: '',
    specialization: '',
    rawText: '',
  });
  const [uploadedFileId, setUploadedFileId] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await publicApi.post<{ uploadedFileId: string }>(
        '/public/resume/apply/upload',
        formData,
      );
      setUploadedFileId(res.data.uploadedFileId);
    } catch (err: unknown) {
      const data =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string | string[] } } }).response?.data
          : null;
      const msg = data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : (msg as string) || 'Ошибка загрузки файла');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await publicApi.post('/public/resume/apply/submit', {
        ...form,
        uploadedFileId: uploadedFileId || undefined,
      });
      setSuccess(true);
      setForm({
        fullName: '',
        email: '',
        phone: '',
        city: '',
        specialization: '',
        rawText: '',
      });
      setUploadedFileId('');
    } catch (err: unknown) {
      const data =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string | string[] } } }).response?.data
          : null;
      const msg = data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : (msg as string) || 'Ошибка отправки');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto bg-white border border-gray-200 rounded-lg p-6">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Отклик на вакансию</h1>
        <p className="text-sm text-gray-600 mb-4">
          Заполните форму и приложите резюме файлом или вставьте текст.
        </p>

        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
        {success && (
          <p className="text-green-700 text-sm mb-3">
            Спасибо! Ваше резюме отправлено.
          </p>
        )}

        <form onSubmit={handleSubmit} className="grid gap-3">
          <input
            type="text"
            placeholder="ФИО"
            value={form.fullName}
            onChange={(e) => setForm((v) => ({ ...v, fullName: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded text-sm"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded text-sm"
            />
            <input
              type="text"
              placeholder="Телефон"
              value={form.phone}
              onChange={(e) => setForm((v) => ({ ...v, phone: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded text-sm"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Город"
              value={form.city}
              onChange={(e) => setForm((v) => ({ ...v, city: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded text-sm"
            />
            <input
              type="text"
              placeholder="Специализация"
              value={form.specialization}
              onChange={(e) => setForm((v) => ({ ...v, specialization: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded text-sm"
            />
          </div>

          <textarea
            rows={6}
            placeholder="Текст резюме (если без файла)"
            value={form.rawText}
            onChange={(e) => setForm((v) => ({ ...v, rawText: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded text-sm"
          />

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={handleUpload}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="px-3 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {uploading
              ? 'Загрузка файла...'
              : uploadedFileId
                ? 'Файл загружен'
                : 'Загрузить резюме файлом'}
          </button>

          <button
            type="submit"
            disabled={submitting || (!uploadedFileId && !form.rawText.trim())}
            className="px-4 py-2 bg-accent text-white rounded text-sm hover:bg-accent-hover disabled:opacity-50"
          >
            {submitting ? 'Отправка...' : 'Отправить отклик'}
          </button>
        </form>
      </div>
    </div>
  );
}
