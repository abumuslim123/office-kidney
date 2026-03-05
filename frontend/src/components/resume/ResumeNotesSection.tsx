import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../lib/api';
import type { ResumeCandidateNote } from '../../lib/resume-types';
import { formatDateTime } from '../../lib/resume-constants';

type Props = {
  candidateId: string;
  notes: ResumeCandidateNote[];
  onUpdated: () => void;
};

export default function ResumeNotesSection({ candidateId, notes, onUpdated }: Props) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      await api.post(`/resume/candidates/${candidateId}/notes`, {
        content: content.trim(),
        authorName: user?.displayName || user?.login || 'Аноним',
      });
      setContent('');
      onUpdated();
    } catch {
      /* ignore */
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (noteId: string) => {
    if (!confirm('Удалить заметку?')) return;
    try {
      await api.delete(`/resume/candidates/${candidateId}/notes/${noteId}`);
      onUpdated();
    } catch {
      /* ignore */
    }
  };

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Заметки</h3>

      {notes.length > 0 && (
        <div className="space-y-3 mb-4">
          {notes.map((n) => (
            <div key={n.id} className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{n.content}</p>
                <button
                  type="button"
                  onClick={() => handleDelete(n.id)}
                  className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                  title="Удалить"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {n.authorName} — {formatDateTime(n.createdAt)}
              </p>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Добавить заметку..."
          maxLength={10000}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-accent/30 focus:border-accent"
        />
        <button
          type="submit"
          disabled={!content.trim() || submitting}
          className="px-3 py-1.5 text-sm font-medium rounded-lg bg-accent text-white hover:bg-accent-hover disabled:opacity-50 transition-colors"
        >
          Добавить
        </button>
      </form>
    </div>
  );
}
