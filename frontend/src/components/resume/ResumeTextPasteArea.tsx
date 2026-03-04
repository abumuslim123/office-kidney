import { useState } from 'react';
import { api } from '../../lib/api';

type Props = {
  onCreated: () => void;
};

export default function ResumeTextPasteArea({ onCreated }: Props) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    setError('');
    setSubmitting(true);
    try {
      await api.post('/resume/candidates', { rawText: trimmed });
      setText('');
      onCreated();
    } catch (err: unknown) {
      const data =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data
          : null;
      setError(data?.message || 'Ошибка создания кандидата');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Вставьте текст резюме..."
        rows={6}
        maxLength={50000}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-accent/30 focus:border-accent resize-y"
      />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {text.length.toLocaleString()} / 50 000
        </span>
        <button
          type="submit"
          disabled={!text.trim() || submitting}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-accent text-white hover:bg-accent-hover disabled:opacity-50 transition-colors"
        >
          {submitting ? 'Отправка...' : 'Создать кандидата'}
        </button>
      </div>
    </form>
  );
}
