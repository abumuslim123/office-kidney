import { useState } from 'react';
import { api } from '../../lib/api';

type Props = {
  onCreated: () => void;
};

export default function ResumeUrlInput({ onCreated }: Props) {
  const [url, setUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;

    try {
      new URL(trimmed);
    } catch {
      setError('Введите корректный URL (например, https://hh.ru/resume/...)');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      await api.post('/resume/upload-url', { url: trimmed });
      setUrl('');
      onCreated();
    } catch (err: unknown) {
      const data =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response
              ?.data
          : null;
      setError(data?.message || 'Ошибка загрузки по URL');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            if (error) setError('');
          }}
          placeholder="https://hh.ru/resume/..."
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none"
        />
        <button
          type="submit"
          disabled={!url.trim() || submitting}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-accent text-white hover:bg-accent-hover disabled:opacity-50 transition-colors whitespace-nowrap"
        >
          {submitting ? 'Загрузка...' : 'Загрузить'}
        </button>
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      <p className="mt-1 text-xs text-gray-400">
        hh.ru, SuperJob или любая страница с резюме
      </p>
    </form>
  );
}
